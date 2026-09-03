/**
 * Training store.
 *
 * 训练分为两类：
 * 1. **当前进行中的训练**（activeTraining）—— 内存持有 set 数组；完成时一次性 batch insert。
 * 2. **历史记录**（history）—— 从 DB 加载，按 started_at 倒序。
 *
 * G2 阶段先实现数据骨架；G6-G8 在此基础上加 completeTraining / cancelTraining 行为细节。
 *
 * 设计要点：
 * - activeTraining 包含 plan 信息快照（nameSnapshot），删除/重命名计划不影响历史展示
 * - activeTraining.exercises[i].sets 是当前已记录的 set 数组
 * - completeTraining 把所有 set 一次性 batch insert + 更新 training 行（耗时/总训练量/动作数/组数）
 * - cancelTraining 仅清空内存，不写 DB
 */

import { create } from 'zustand';

import type { SetTypeValue } from '@/constants/setTypes';
import { getDatabase } from '@/db';
import type { Exercise } from '@/db/schema';
import type { Training } from '@/db/repositories/trainingRepo';
import {
  createTraining,
  deleteTraining,
  getTraining,
  listTrainings,
  updateTraining,
  updateTrainingInTransaction,
} from '@/db/repositories/trainingRepo';
import {
  batchInsertTrainingSetsInTransaction,
  type CreateTrainingSetInput,
} from '@/db/repositories/trainingSetRepo';
import type { TrainingSet } from '@/db/schema';

export interface ActiveSet extends CreateTrainingSetInput {
  /** 前端的临时 id（与 DB id 区分），用于 React key。 */
  clientId: string;
  /** 行 ID，DB 写入后填充。 */
  rowId?: string;
}

export interface ActiveExercise {
  position: number;
  exercise: Exercise;
  sets: ActiveSet[];
}

export interface ActiveTraining {
  id: string;
  planId: string | null;
  planNameSnapshot: string | null;
  startedAt: number;
  exercises: ActiveExercise[];
}

export interface TrainingStoreState {
  history: Training[];
  activeTraining: ActiveTraining | null;
  loading: boolean;
  error: string | null;

  /**
   * View state — which exercise + set the user is currently editing in the
   * active training screen. Resets when `startTraining` or `cancelTraining`
   * is called. Not persisted anywhere.
   */
  currentExerciseIndex: number;
  currentSetIndex: number;

  loadHistory: () => Promise<void>;

  /**
   * G9: delete a single history entry. Removes the training row (cascade
   * also removes its sets) and updates local state so the list view drops
   * the entry without a refetch.
   */
  deleteHistory: (trainingId: string) => Promise<void>;

  startTraining: (input: {
    planId: string | null;
    planNameSnapshot: string | null;
    exercises: Array<{
      exercise: Exercise;
      /**
       * Optional plan-editor hints — preserved count and `setType`, but the
       * numeric fields stay null so the user re-enters data fresh during
       * training (G6 "数据不预填").
       */
      initialSets?: Array<{
        weight?: number | null;
        reps?: number | null;
        durationSeconds?: number | null;
        distanceKm?: number | null;
        setType?: SetTypeValue;
      }>;
    }>;
  }) => Promise<ActiveTraining>;

  /** 在当前训练的某个动作下加一组（默认复制上一组数据）。 */
  addSet: (
    position: number,
    prototype?: Partial<CreateTrainingSetInput>,
  ) => ActiveSet | null;

  /**
   * G6: append a *clean* empty set to the active exercise. Used by the
   * training screen after a set is completed so the user always has a
   * "next" set to fill in. Does NOT copy from previous.
   */
  appendEmptySet: (position: number) => ActiveSet | null;

  /** 更新某组数据（仅内存，DB 在 complete 时写）。 */
  updateSet: (
    position: number,
    clientId: string,
    patch: Partial<CreateTrainingSetInput>,
  ) => void;

  /** G6: 标记某组已完成（并打时间戳）。 */
  markSetCompleted: (position: number, clientId: string) => void;

  /**
   * Atomic "complete this set and advance focus" — collapses what was
   * previously 3 mutations (`markSetCompleted` → `appendEmptySet` →
   * `setCurrentSetIndex`) into a single `set()` call.
   *
   * Why atomic: the original flow had `appendEmptySet` + a closure-captured
   * `ex.sets.length` for the new-set-index. On a double-tap (or any
   * pre-commit re-entry) the second call would still see `target.completed
   * === false` and append another stray set, producing the "3 组变 4 组"
   * bug.
   *
   * Behavior change vs the original:
   *  - **Never auto-appends.** The user-set group count from the plan is
   *    sacred: a plan that says "3 组" stays "3 组" until the user
   *    explicitly taps "+ 添加组". Auto-appending on every complete
   *    surprised users who finished their 3 prescribed sets and saw a
   *    4th empty chip appear. If the user wants extra sets, they tap
   *    "+ 添加组" which still calls `appendEmptySet` directly.
   *  - **Idempotent.** Returns `false` (no-op) when the target is already
   *    `completed` — prevents double-tap from advancing state.
   *  - **Advances focus** to the next uncompleted set in the same
   *    exercise. If this was the last uncompleted set, focus stays on
   *    it (it's now `completed`); the caller checks `wouldAllBeDone`
   *    before this call and routes to `completeAndNavigate()` to auto-end
   *    the training.
   */
  completeAndAdvance: (position: number, clientId: string) => boolean;

  /** 删除一组。 */
  removeSet: (position: number, clientId: string) => void;

  /** G6: 改组类型 (W / 正式 / D / F)。 */
  changeSetType: (
    position: number,
    clientId: string,
    newType: SetTypeValue,
  ) => void;

  /** G6: 切换查看的动作 / 组（只更新 view state）。 */
  setCurrentExerciseIndex: (index: number) => void;
  setCurrentSetIndex: (index: number) => void;

  /** 完成训练：批量写入 set + 更新 training 统计。一次事务（G8）。 */
  completeTraining: () => Promise<
    | (Training & {
        stats: {
          durationSeconds: number;
          totalVolume: number;
          exerciseCount: number;
          setCount: number;
        };
      })
    | null
  >;

  /** 取消训练：不写 DB。 */
  cancelTraining: () => void;

  /** 列表删除（管理界面用）。 */
  removeFromHistory: (id: string) => Promise<void>;
}

function computeStats(active: ActiveTraining): {
  durationSeconds: number;
  totalVolume: number;
  exerciseCount: number;
  setCount: number;
} {
  let totalVolume = 0;
  let setCount = 0;
  for (const ex of active.exercises) {
    for (const s of ex.sets) {
      if (s.completed) {
        setCount += 1;
        if (s.weight && s.reps) totalVolume += s.weight * s.reps;
      }
    }
  }
  return {
    durationSeconds: Math.max(
      0,
      Math.floor((Date.now() - active.startedAt) / 1000),
    ),
    totalVolume,
    exerciseCount: active.exercises.length,
    setCount,
  };
}

function genClientId(): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useTrainingStore = create<TrainingStoreState>((set, get) => ({
  history: [],
  activeTraining: null,
  currentExerciseIndex: 0,
  currentSetIndex: 0,
  loading: false,
  error: null,

  loadHistory: async () => {
    set({ loading: true, error: null });
    try {
      const db = await getDatabase();
      const list = await listTrainings(db);
      // `listTrainings` already does `ORDER BY started_at DESC` server-side,
      // but we re-sort defensively to guarantee newest-first for the home feed
      // even if a future repo variant changes the query.
      const history = [...list].sort((a, b) => b.startedAt - a.startedAt);
      set({ history, loading: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ loading: false, error: msg });
      throw err;
    }
  },

  deleteHistory: async (trainingId) => {
    const db = await getDatabase();
    await deleteTraining(db, trainingId);
    set((state) => ({
      history: state.history.filter((t) => t.id !== trainingId),
    }));
  },

  startTraining: async (input) => {
    const db = await getDatabase();
    const created = await createTraining(db, {
      planId: input.planId,
      planNameSnapshot: input.planNameSnapshot,
      startedAt: Date.now(),
    });
    const active: ActiveTraining = {
      id: created.id,
      planId: created.planId,
      planNameSnapshot: created.planNameSnapshot,
      startedAt: created.startedAt,
      exercises: input.exercises.map((ex, i) => {
        const hints = ex.initialSets ?? [];
        // If the plan editor provided a hint list, materialize each as an
        // empty ActiveSet — preserve the count and setType, but leave the
        // numeric fields null so the user re-enters them fresh (G6).
        if (hints.length > 0) {
          return {
            position: i,
            exercise: ex.exercise,
            sets: hints.map((h, idx) => ({
              clientId: genClientId(),
              trainingId: created.id,
              exerciseId: ex.exercise.id,
              exerciseNameSnapshot: ex.exercise.name,
              position: i,
              setIndex: idx + 1,
              weight: null,
              reps: null,
              durationSeconds: null,
              distanceKm: null,
              setType: h.setType ?? 'normal',
              completed: false,
            })),
          };
        }
        // Otherwise seed a single empty set so the chip strip is never
        // empty — user can swipe-delete it or auto-creates more on complete.
        return {
          position: i,
          exercise: ex.exercise,
          sets: [
            {
              clientId: genClientId(),
              trainingId: created.id,
              exerciseId: ex.exercise.id,
              exerciseNameSnapshot: ex.exercise.name,
              position: i,
              setIndex: 1,
              weight: null,
              reps: null,
              durationSeconds: null,
              distanceKm: null,
              setType: 'normal',
              completed: false,
            },
          ],
        };
      }),
    };
    set({
      activeTraining: active,
      currentExerciseIndex: 0,
      currentSetIndex: 0,
    });
    return active;
  },

  addSet: (position, prototype) => {
    const active = get().activeTraining;
    if (!active) return null;
    const ex = active.exercises.find((e) => e.position === position);
    if (!ex) return null;

    const last = ex.sets[ex.sets.length - 1];
    const newSetIndex = (last?.setIndex ?? 0) + 1;
    const newSet: ActiveSet = {
      clientId: genClientId(),
      trainingId: active.id,
      exerciseId: ex.exercise.id,
      exerciseNameSnapshot: ex.exercise.name,
      position: ex.position,
      setIndex: newSetIndex,
      weight: prototype?.weight ?? last?.weight ?? null,
      reps: prototype?.reps ?? last?.reps ?? null,
      durationSeconds:
        prototype?.durationSeconds ?? last?.durationSeconds ?? null,
      distanceKm: prototype?.distanceKm ?? last?.distanceKm ?? null,
      setType: prototype?.setType ?? last?.setType ?? 'normal',
      completed: prototype?.completed ?? false,
    };

    set((state) => {
      if (!state.activeTraining) return state;
      return {
        activeTraining: {
          ...state.activeTraining,
          exercises: state.activeTraining.exercises.map((e) =>
            e.position === position ? { ...e, sets: [...e.sets, newSet] } : e,
          ),
        },
      };
    });
    return newSet;
  },

  appendEmptySet: (position) => {
    const active = get().activeTraining;
    if (!active) return null;
    const ex = active.exercises.find((e) => e.position === position);
    if (!ex) return null;

    const last = ex.sets[ex.sets.length - 1];
    const newSetIndex = (last?.setIndex ?? 0) + 1;
    const newSet: ActiveSet = {
      clientId: genClientId(),
      trainingId: active.id,
      exerciseId: ex.exercise.id,
      exerciseNameSnapshot: ex.exercise.name,
      position: ex.position,
      setIndex: newSetIndex,
      weight: null,
      reps: null,
      durationSeconds: null,
      distanceKm: null,
      setType: last?.setType ?? 'normal',
      completed: false,
    };

    set((state) => {
      if (!state.activeTraining) return state;
      return {
        activeTraining: {
          ...state.activeTraining,
          exercises: state.activeTraining.exercises.map((e) =>
            e.position === position ? { ...e, sets: [...e.sets, newSet] } : e,
          ),
        },
      };
    });
    return newSet;
  },

  markSetCompleted: (position, clientId) => {
    set((state) => {
      if (!state.activeTraining) return state;
      return {
        activeTraining: {
          ...state.activeTraining,
          exercises: state.activeTraining.exercises.map((e) => {
            if (e.position !== position) return e;
            return {
              ...e,
              sets: e.sets.map((s) =>
                s.clientId === clientId ? { ...s, completed: true } : s,
              ),
            };
          }),
        },
      };
    });
  },

  completeAndAdvance: (position, clientId) => {
    // Single-shot: mark completed, advance focus to the next uncompleted
    // set in the same exercise — all inside ONE set() so the snapshot we
    // read is the snapshot we write. Never auto-appends; the user-set
    // group count from the plan is sacred.
    let didAdvance = false;
    set((state) => {
      if (!state.activeTraining) return state;
      const exIdx = state.activeTraining.exercises.findIndex(
        (e) => e.position === position,
      );
      if (exIdx < 0) return state;
      const ex = state.activeTraining.exercises[exIdx];
      const setIdx = ex.sets.findIndex((s) => s.clientId === clientId);
      if (setIdx < 0) return state;
      const target = ex.sets[setIdx];
      // Idempotency guard — second tap (or any out-of-order re-entry) is a
      // no-op so we don't double-advance. Returning `false` lets the caller
      // skip haptics/toast/rest-timer side effects on the duplicate call.
      if (target.completed) return state;

      const newSets = ex.sets.map((s) =>
        s.clientId === clientId ? { ...s, completed: true } : s,
      );
      didAdvance = true;

      // Move focus to the next uncompleted set in this exercise. If this
      // was the last uncompleted set, focus stays on the just-completed
      // set (index `setIdx`); the caller has already computed
      // `wouldAllBeDone` before this call and will route to
      // `completeAndNavigate()` for auto-end-of-training.
      const nextUncompletedIdx = newSets.findIndex((s) => !s.completed);
      const nextSetIndex =
        nextUncompletedIdx >= 0 ? nextUncompletedIdx : setIdx;

      return {
        activeTraining: {
          ...state.activeTraining,
          exercises: state.activeTraining.exercises.map((e, i) =>
            i === exIdx ? { ...e, sets: newSets } : e,
          ),
        },
        currentSetIndex: nextSetIndex,
      };
    });
    return didAdvance;
  },

  updateSet: (position, clientId, patch) => {
    set((state) => {
      if (!state.activeTraining) return state;
      return {
        activeTraining: {
          ...state.activeTraining,
          exercises: state.activeTraining.exercises.map((e) => {
            if (e.position !== position) return e;
            return {
              ...e,
              sets: e.sets.map((s) =>
                s.clientId === clientId ? { ...s, ...patch } : s,
              ),
            };
          }),
        },
      };
    });
  },

  removeSet: (position, clientId) => {
    set((state) => {
      if (!state.activeTraining) return state;
      const ex = state.activeTraining.exercises.find((e) => e.position === position);
      if (!ex) return state;
      // Refuse to remove the last set — UI surfaces a disabled state, but we
      // belt-and-suspenders here so the invariant holds even from a script.
      if (ex.sets.length <= 1) return state;
      const removedIdx = ex.sets.findIndex((s) => s.clientId === clientId);
      const filtered = ex.sets.filter((s) => s.clientId !== clientId);
      // Re-index so setIndex stays 1-based and contiguous.
      const reindexed = filtered.map((s, i) => ({ ...s, setIndex: i + 1 }));
      const nextActive = {
        ...state.activeTraining,
        exercises: state.activeTraining.exercises.map((e) =>
          e.position === position ? { ...e, sets: reindexed } : e,
        ),
      };
      // If the user removed the currently-viewed set, drop focus to the
      // previous one (or the new last one if we removed index 0).
      let nextSetIdx = state.currentSetIndex;
      if (removedIdx !== -1) {
        if (removedIdx < state.currentSetIndex) {
          nextSetIdx = Math.max(0, state.currentSetIndex - 1);
        } else if (removedIdx === state.currentSetIndex) {
          nextSetIdx = Math.min(
            reindexed.length - 1,
            state.currentSetIndex,
          );
        }
      }
      return {
        activeTraining: nextActive,
        currentSetIndex: nextSetIdx,
      };
    });
  },

  changeSetType: (position, clientId, newType) => {
    set((state) => {
      if (!state.activeTraining) return state;
      return {
        activeTraining: {
          ...state.activeTraining,
          exercises: state.activeTraining.exercises.map((e) => {
            if (e.position !== position) return e;
            return {
              ...e,
              sets: e.sets.map((s) =>
                s.clientId === clientId ? { ...s, setType: newType } : s,
              ),
            };
          }),
        },
      };
    });
  },

  setCurrentExerciseIndex: (index) => {
    set((state) => {
      if (!state.activeTraining) return state;
      const clamped = Math.max(
        0,
        Math.min(state.activeTraining.exercises.length - 1, index),
      );
      if (clamped === state.currentExerciseIndex) return state;
      return { currentExerciseIndex: clamped, currentSetIndex: 0 };
    });
  },

  setCurrentSetIndex: (index) => {
    set((state) => {
      if (!state.activeTraining) return state;
      const ex = state.activeTraining.exercises[state.currentExerciseIndex];
      if (!ex) return state;
      const clamped = Math.max(0, Math.min(ex.sets.length - 1, index));
      if (clamped === state.currentSetIndex) return state;
      return { currentSetIndex: clamped };
    });
  },

  completeTraining: async () => {
    const active = get().activeTraining;
    if (!active) return null;
    const stats = computeStats(active);
    const db = await getDatabase();
    const allSets: CreateTrainingSetInput[] = [];
    for (const ex of active.exercises) {
      for (const s of ex.sets) {
        // 只写入已完成的组；未完成的直接丢弃（PRD 风险评估要求：MVP 完成后批量写入）。
        if (!s.completed) continue;
        allSets.push({
          trainingId: s.trainingId,
          exerciseId: s.exerciseId,
          exerciseNameSnapshot: s.exerciseNameSnapshot,
          position: s.position,
          setIndex: s.setIndex,
          weight: s.weight,
          reps: s.reps,
          durationSeconds: s.durationSeconds,
          distanceKm: s.distanceKm,
          setType: s.setType,
          completed: true,
        });
      }
    }

    // G8：一次事务完成 UPDATE trainings 统计行 + INSERT 所有 set，
    //   保证训练历史不会出现"有 training 行但 set 行缺失"或反之的破损状态。
    const endedAt = Date.now();
    // `db.withTransactionAsync` infers a `Promise<void>` return from its
    // callback — assigning through an outer `let` keeps `updated` strongly
    // typed as `Training`.
    let updated: Training = {
      id: active.id,
      planId: active.planId,
      planNameSnapshot: active.planNameSnapshot,
      startedAt: active.startedAt,
      endedAt,
      durationSeconds: stats.durationSeconds,
      totalVolume: stats.totalVolume,
      exerciseCount: stats.exerciseCount,
      setCount: stats.setCount,
    };
    await db.withTransactionAsync(async () => {
      await updateTrainingInTransaction(db, active.id, {
        endedAt,
        durationSeconds: stats.durationSeconds,
        totalVolume: stats.totalVolume,
        exerciseCount: stats.exerciseCount,
        setCount: stats.setCount,
      });
      // Re-fetch so the returned row carries the persisted started_at / plan
      // snapshot fields — `updateTrainingInTransaction` only returns the
      // patched stats.
      const persisted = await getTraining(db, active.id);
      if (persisted) {
        updated = {
          ...persisted,
          endedAt,
          durationSeconds: stats.durationSeconds,
          totalVolume: stats.totalVolume,
          exerciseCount: stats.exerciseCount,
          setCount: stats.setCount,
        };
      }
      if (allSets.length > 0) {
        await batchInsertTrainingSetsInTransaction(db, allSets);
      }
    });

    // G12 (#1, G9 feedback): re-fetch history so the Home tab reflects the
    // new training on first focus, with no manual refresh. The local
    // optimistic insert below keeps the in-tab list snappy in case the
    // user is already on Home.
    await get().loadHistory();

    set((state) => ({
      activeTraining: null,
      currentExerciseIndex: 0,
      currentSetIndex: 0,
    }));
    return { ...updated, stats };
  },

  cancelTraining: () => {
    set({ activeTraining: null, currentExerciseIndex: 0, currentSetIndex: 0 });
  },

  removeFromHistory: async (id) => {
    const db = await getDatabase();
    await deleteTraining(db, id);
    set((state) => ({ history: state.history.filter((t) => t.id !== id) }));
  },
}));

/**
 * Re-export for callers that need the raw DB shape.
 */
export type { TrainingSet };
