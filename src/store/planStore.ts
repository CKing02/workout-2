/**
 * Plan store.
 *
 * Plans list + CRUD. Stores load via `load()` (called from app boot).
 * Mutations propagate to DB through `planRepo`.
 *
 * G5 additions:
 * - `planDetailCache` — in-memory mirror of `plan_exercises` + optional set
 *   definitions keyed by plan id. The DB schema has no `plan_sets` table by
 *   design (MVP), so set state lives in memory only. It's loaded when a
 *   `PlanEditorScreen` opens a plan and survives until the app reload or
 *   `clearDetail()` is called (auto on remove).
 * - `addExerciseToPlan / removeExerciseFromPlan` are the supported entry points
 *   for mutating a plan's exercise list; they go through `planRepo` so the
 *   changes are persisted and reflected in `plans[]`.
 * - `addSetToPlanExercise / removeSetFromPlanExercise / updatePlanExerciseSets`
 *   operate exclusively on the in-memory cache. UI components read from there.
 */

import { create } from 'zustand';

import { getDatabase } from '@/db';
import type {
  Plan,
  PlanWithCount,
  PlanWithExercises,
} from '@/db/repositories/planRepo';
import {
  appendSetForPlanExercise,
  createPlan,
  deletePlan,
  getPlan,
  listPlansWithCount,
  removeSetForPlanExerciseByIndex,
  replaceExercise as replaceExerciseInRepo,
  replaceSetsForPlanExercise,
  setExerciseRestSeconds as setExerciseRestSecondsInRepo,
  updatePlan,
} from '@/db/repositories/planRepo';
import { getExercise } from '@/db/repositories/exerciseRepo';
import type { Exercise } from '@/db/schema';
import type { SetTypeValue } from '@/constants/setTypes';

/** UI-level set row kept inside the plan editor; not persisted in MVP. */
export interface PlanSetDraft {
  /** Stable client-side id; never sent to the DB. */
  localId: string;
  setIndex: number;
  weight: number;
  reps: number;
  setType: SetTypeValue;
}

/** UI-level row: a plan_exercise enriched with detail + draft sets. */
export interface PlanExerciseDraft {
  /** The DB row id (plan_exercises.id). */
  id: string;
  planId: string;
  exerciseId: string;
  position: number;
  /** Per-exercise rest interval in seconds. Mirrors `plan_exercises.rest_seconds`. */
  restSeconds: number;
  exercise: Exercise;
  sets: PlanSetDraft[];
}

export type PlanDetailState = {
  exercises: PlanExerciseDraft[];
  /** Tracks which exercise ids are currently in the plan (ordered). */
  exerciseIds: string[];
};

export interface PlanStoreState {
  plans: PlanWithCount[];
  loading: boolean;
  error: string | null;

  /** Keyed by plan id. Empty until the editor pushes the plan in. */
  detailById: Record<string, PlanDetailState>;
  /** Tracks which plan is currently being edited — convenience for screens. */
  activePlanId: string | null;

  load: () => Promise<void>;
  reload: () => Promise<void>;
  fetch: (id: string) => Promise<PlanWithExercises | null>;
  create: (input: { name: string; exerciseIds?: string[] }) => Promise<Plan>;
  update: (
    id: string,
    patch: { name?: string; exerciseIds?: string[] },
  ) => Promise<Plan>;
  remove: (id: string) => Promise<void>;

  // ---------- G5 helpers ----------

  /** Push a plan into the editor cache (loads plan + exercises from DB). */
  loadDetail: (planId: string) => Promise<PlanDetailState | null>;

  /** Discard the cache entry for a plan. */
  clearDetail: (planId: string) => void;

  /** Append an exercise to the plan (persisted). */
  addExerciseToPlan: (planId: string, exerciseId: string) => Promise<void>;

  /** Remove an exercise from the plan (persisted). */
  removeExerciseFromPlan: (planId: string, planExerciseId: string) => Promise<void>;

  /** G24a: persisted. Copy the last set's data when `copyFromLast` is true. */
  addSetToPlanExercise: (
    planId: string,
    planExerciseId: string,
    copyFromLast?: boolean,
  ) => Promise<void>;

  /** G24a: persisted. Removes the set at `setIndex` (0-based). */
  removeSetFromPlanExercise: (
    planId: string,
    planExerciseId: string,
    setIndex: number,
  ) => Promise<void>;

  /** G24a: persisted. Replaces the full set list for an exercise. */
  updatePlanExerciseSets: (
    planId: string,
    planExerciseId: string,
    sets: PlanSetDraft[],
  ) => Promise<void>;

  /**
   * Replace the underlying exercise of a single plan_exercise slot.
   * Persists via `replaceExercise` repo call and updates the in-memory
   * cache (position, sets, restSeconds stay; exercise metadata swap).
   */
  replaceExerciseInPlan: (
    planId: string,
    planExerciseId: string,
    newExerciseId: string,
  ) => Promise<void>;

  /** Update the per-exercise rest interval. */
  setExerciseRestSeconds: (
    planId: string,
    planExerciseId: string,
    seconds: number,
  ) => Promise<void>;
}

function localSetId(): string {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function makeEmptySet(): PlanSetDraft {
  return {
    localId: localSetId(),
    setIndex: 1,
    weight: 0,
    reps: 0,
    setType: 'normal',
  };
}

function cloneSet(template: PlanSetDraft, newIndex: number): PlanSetDraft {
  return {
    localId: localSetId(),
    setIndex: newIndex,
    weight: template.weight,
    reps: template.reps,
    setType: template.setType,
  };
}

function reindexSets(sets: PlanSetDraft[]): PlanSetDraft[] {
  return sets.map((s, i) => ({ ...s, setIndex: i + 1 }));
}

/** Pull the next free set index for a plan exercise based on its set count. */
function nextSetIndex(sets: PlanSetDraft[]): number {
  return sets.length + 1;
}

/** Reshape `PlanWithExercises` -> the editor-friendly `PlanDetailState`. */
function toDraftState(plan: PlanWithExercises): PlanDetailState {
  return {
    exercises: plan.exercises.map((pe) => ({
      id: pe.id,
      planId: pe.planId,
      exerciseId: pe.exerciseId,
      position: pe.position,
      restSeconds: pe.restSeconds,
      exercise: pe.exercise,
      // G24a follow-up: persist the plan-level prescription (weight, reps)
      // so the editor's "10kg × 10 reps" template survives restarts. G6's
      // "数据不预填" still applies at training time — `training_sets.weight`
      // / `.reps` are the actual values the user re-enters during the
      // session. plan_sets.* is the planned/prescribed value, kept across
      // sessions.
      sets: pe.sets.map((s) => ({
        localId: localSetId(),
        setIndex: s.setIndex,
        weight: s.weight,
        reps: s.reps,
        setType: s.setType,
      })),
    })),
    exerciseIds: plan.exercises.map((pe) => pe.exerciseId),
  };
}

export const usePlanStore = create<PlanStoreState>((set, get) => ({
  plans: [],
  loading: false,
  error: null,
  detailById: {},
  activePlanId: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const db = await getDatabase();
      // Use the denormalized variant so the training list can render
      // `n 个动作` and enable the start button without a per-plan query.
      const plans = await listPlansWithCount(db);
      set({ plans, loading: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ loading: false, error: msg });
      throw err;
    }
  },

  reload: async () => {
    await get().load();
  },

  fetch: async (id) => {
    const db = await getDatabase();
    return getPlan(db, id);
  },

  create: async (input) => {
    const db = await getDatabase();
    const plan = await createPlan(db, input);
    set((state) => ({ plans: [plan, ...state.plans] }));
    return plan;
  },

  update: async (id, patch) => {
    const db = await getDatabase();
    const plan = await updatePlan(db, id, patch);
    set((state) => ({
      plans: state.plans.map((p) => (p.id === id ? plan : p)),
    }));
    // G24 fix (BUG-A): `updatePlan` does DELETE + INSERT with fresh
    // `plan_exercises.id` values, so the in-memory `PlanExerciseDraft.id`
    // references go stale. If the editor held a detail cache, refresh it
    // from the DB so subsequent per-row ops (`replaceExerciseInPlan`,
    // `setExerciseRestSeconds`) target the right rows. Carries in-memory
    // set drafts across by `exerciseId` — the repo's reconcile preserves
    // `rest_seconds` per exercise, so we just pick it up from the fresh
    // row.
    if (patch.exerciseIds) {
      const detail = get().detailById[id];
      const carriedDraftsByExId = new Map<string, PlanExerciseDraft>();
      const carriedSetsByExId = new Map<string, PlanSetDraft[]>();
      for (const e of detail?.exercises ?? []) {
        carriedDraftsByExId.set(e.exerciseId, e);
        if (e.sets.length > 0) carriedSetsByExId.set(e.exerciseId, e.sets);
      }
      const fresh = await getPlan(db, id);
      if (fresh) {
        // G24a: the CASCADE from plan_exercises DELETE wiped every plan_sets
        // row whose plan_exercise_id pointed at the old (now-deleted) rows.
        // For each carried set list, re-INSERT under the fresh plan_exercise
        // ids so the DB state matches what the in-memory cache will reflect.
        for (const pe of fresh.exercises) {
          const carried = carriedSetsByExId.get(pe.exerciseId);
          if (carried && carried.length > 0) {
            await replaceSetsForPlanExercise(
              db,
              pe.id,
              carried.map((s) => ({
                setType: s.setType,
                weight: s.weight,
                reps: s.reps,
              })),
            );
          }
        }
        // Re-fetch once more so the new plan_sets land in the in-memory
        // view's `pe.sets` (toDraftState is the only consumer; this keeps
        // reload-after-save honest).
        const fresh2 = await getPlan(db, id);
        if (fresh2) {
          const rebuilt: PlanExerciseDraft[] = fresh2.exercises.map((pe) => {
            const carried = carriedSetsByExId.get(pe.exerciseId);
            if (carried) {
              return {
                id: pe.id, // FRESH plan_exercise row id from DB
                planId: pe.planId,
                exerciseId: pe.exerciseId,
                position: pe.position,
                restSeconds: pe.restSeconds,
                exercise: pe.exercise,
                sets: carried,
              };
            }
            // No carry (e.g. reorder added a new exercise we didn't know
            // about) — hydrate from the freshly-loaded DB sets (including
            // the just-re-INSERTed weight + reps from the carried sets).
            return {
              id: pe.id,
              planId: pe.planId,
              exerciseId: pe.exerciseId,
              position: pe.position,
              restSeconds: pe.restSeconds,
              exercise: pe.exercise,
              sets: pe.sets.map((s) => ({
                localId: localSetId(),
                setIndex: s.setIndex,
                weight: s.weight,
                reps: s.reps,
                setType: s.setType,
              })),
            };
          });
          const nextDetail: PlanDetailState = {
            exercises: rebuilt,
            exerciseIds: fresh2.exercises.map((pe) => pe.exerciseId),
          };
          set((state) => ({
            detailById: { ...state.detailById, [id]: nextDetail },
          }));
        }
      }
    }
    return plan;
  },

  remove: async (id) => {
    const db = await getDatabase();
    await deletePlan(db, id);
    set((state) => {
      const { [id]: _removed, ...rest } = state.detailById;
      return {
        plans: state.plans.filter((p) => p.id !== id),
        detailById: rest,
        activePlanId: state.activePlanId === id ? null : state.activePlanId,
      };
    });
  },

  // ---------- G5 helpers ----------

  loadDetail: async (planId) => {
    const cached = get().detailById[planId];
    if (cached) {
      set({ activePlanId: planId });
      return cached;
    }
    const db = await getDatabase();
    const plan = await getPlan(db, planId);
    if (!plan) return null;
    const draft = toDraftState(plan);
    set((state) => ({
      detailById: { ...state.detailById, [planId]: draft },
      activePlanId: planId,
    }));
    return draft;
  },

  clearDetail: (planId) => {
    set((state) => {
      const { [planId]: _removed, ...rest } = state.detailById;
      return {
        detailById: rest,
        activePlanId: state.activePlanId === planId ? null : state.activePlanId,
      };
    });
  },

  addExerciseToPlan: async (planId, exerciseId) => {
    const db = await getDatabase();
    const detail = get().detailById[planId];
    // Cheap optimistic guard against double-add inside the same session.
    if (detail?.exerciseIds.includes(exerciseId)) return;
    // Resolve the base list: prefer the in-memory cache; otherwise pull
    // directly from the DB so the call works even if the editor never
    // opened the plan detail (defensive).
    const baseIds =
      detail?.exerciseIds ??
      (await getPlan(db, planId))?.exercises.map((e) => e.exerciseId) ??
      [];
    const nextIds = baseIds.includes(exerciseId)
      ? baseIds
      : [...baseIds, exerciseId];
    // Persist + update the top-level `plans` entry without going through the
    // rebuild logic in `update` (which would wipe in-memory new exercises).
    const updated = await updatePlan(db, planId, { exerciseIds: nextIds });
    set((state) => {
      // Mirror the DB result into the plans list.
      const newPlans = state.plans.map((p) => (p.id === planId ? updated : p));
      // Refresh the detail cache from DB to pick up authoritative metadata
      // (positions, exercise rows). Preserve in-memory set drafts by
      // re-attaching them to the same planExerciseIds.
      const carriedDraftsByExId = new Map<string, PlanExerciseDraft>();
      for (const e of detail?.exercises ?? []) {
        carriedDraftsByExId.set(e.exerciseId, e);
      }
      return state; // see async refresh below
    });

    // Re-pull from the DB to pick up plan_exercises.id mapping. Sets survive
    // because we re-attach them by `exerciseId`.
    const fresh = await getPlan(db, planId);
    if (!fresh) return;
    // G24a: any freshly-added plan_exercise (i.e. one whose `exerciseId` is
    // not in the prior detail) starts with 0 plan_sets. Seed 1 default
    // 'normal' set so the user has something to interact with immediately
    // and so the "1 set per new exercise" mental model holds.
    const priorExIds = new Set((detail?.exercises ?? []).map((e) => e.exerciseId));
    for (const pe of fresh.exercises) {
      if (!priorExIds.has(pe.exerciseId) && pe.sets.length === 0) {
        await appendSetForPlanExercise(db, pe.id, 'normal');
      }
    }
    // Re-fetch one more time so the seed lands in `pe.sets`.
    const fresh2 = await getPlan(db, planId);
    if (!fresh2) return;
    set((state) => {
      const carry = new Map<string, PlanSetDraft[]>();
      for (const e of detail?.exercises ?? []) {
        if (e.sets.length > 0) carry.set(e.exerciseId, e.sets);
      }
      const rebuilt: PlanExerciseDraft[] = fresh2.exercises.map((pe) => ({
        id: pe.id,
        planId: pe.planId,
        exerciseId: pe.exerciseId,
        position: pe.position,
        restSeconds: pe.restSeconds,
        exercise: pe.exercise,
        // Use the DB sets (now includes the seed) when carry has nothing;
        // for previously-known exercises the carry (in-memory) wins so
        // any unsaved local edits survive. weight + reps round-trip from
        // the DB so a reloaded plan shows the user's prescription.
        sets: (carry.get(pe.exerciseId) ?? pe.sets.map((s) => ({
          localId: localSetId(),
          setIndex: s.setIndex,
          weight: s.weight,
          reps: s.reps,
          setType: s.setType,
        }))),
      }));
      const nextDetail: PlanDetailState = {
        exercises: rebuilt,
        exerciseIds: fresh2.exercises.map((pe) => pe.exerciseId),
      };
      return {
        plans: state.plans.map((p) => (p.id === planId ? updated : p)),
        detailById: { ...state.detailById, [planId]: nextDetail },
      };
    });
  },

  removeExerciseFromPlan: async (planId, planExerciseId) => {
    const db = await getDatabase();
    const detail = get().detailById[planId];
    if (!detail) return;
    const target = detail.exercises.find((e) => e.id === planExerciseId);
    if (!target) return;
    const nextIds = detail.exerciseIds.filter((id) => id !== target.exerciseId);
    const updated = await updatePlan(db, planId, { exerciseIds: nextIds });
    set((state) => {
      const d = state.detailById[planId];
      const filtered = (d?.exercises ?? []).filter(
        (e) => e.exerciseId !== target.exerciseId,
      );
      return {
        plans: state.plans.map((p) => (p.id === planId ? updated : p)),
        detailById: {
          ...state.detailById,
          [planId]: {
            exercises: filtered,
            exerciseIds: nextIds,
          },
        },
      };
    });
  },

  addSetToPlanExercise: async (planId, planExerciseId, copyFromLast = true) => {
    const detail = get().detailById[planId];
    if (!detail) return;
    const pe = detail.exercises.find((e) => e.id === planExerciseId);
    if (!pe) return;
    const last = pe.sets[pe.sets.length - 1];
    const newSet: PlanSetDraft = copyFromLast && last
      ? cloneSet(last, nextSetIndex(pe.sets))
      : { ...makeEmptySet(), setIndex: nextSetIndex(pe.sets) };
    // Optimistic in-memory update first — UI stays snappy even if the
    // DB write lags. Failure path: the next loadDetail will re-fetch
    // from DB and re-attach whatever landed.
    set((state) => {
      const d = state.detailById[planId];
      if (!d) return state;
      const exercises = d.exercises.map((e) =>
        e.id === planExerciseId ? { ...e, sets: [...e.sets, newSet] } : e,
      );
      return { detailById: { ...state.detailById, [planId]: { ...d, exercises } } };
    });
    // Persist. We use `replaceSetsForPlanExercise` to keep the DB row
    // set in lockstep with in-memory — partial-appends would leave the
    // DB with a different set_index sequence than the UI shows after
    // deletes. G24a follow-up: also persist the new set's weight + reps
    // (e.g. copied from the last set via "复制上组").
    const updated = get().detailById[planId]?.exercises.find(
      (e) => e.id === planExerciseId,
    );
    if (!updated) return;
    const db = await getDatabase();
    await replaceSetsForPlanExercise(
      db,
      planExerciseId,
      updated.sets.map((s) => ({ setType: s.setType, weight: s.weight, reps: s.reps })),
    );
  },

  removeSetFromPlanExercise: async (planId, planExerciseId, setIndex) => {
    const detail = get().detailById[planId];
    if (!detail) return;
    const pe = detail.exercises.find((e) => e.id === planExerciseId);
    if (!pe) return;
    if (pe.sets.length <= 1) return; // mirror UI invariant
    // In-memory: drop the row + reindex, same shape as before.
    set((state) => {
      const d = state.detailById[planId];
      if (!d) return state;
      const exercises = d.exercises.map((e) => {
        if (e.id !== planExerciseId) return e;
        const filtered = e.sets.filter((_, i) => i !== setIndex);
        return { ...e, sets: reindexSets(filtered) };
      });
      return { detailById: { ...state.detailById, [planId]: { ...d, exercises } } };
    });
    // Persist the new full set list (the repo's renumber keeps set_index
    // contiguous, so we use the simpler full-replace path).
    const updated = get().detailById[planId]?.exercises.find(
      (e) => e.id === planExerciseId,
    );
    if (!updated) return;
    const db = await getDatabase();
    await replaceSetsForPlanExercise(
      db,
      planExerciseId,
      updated.sets.map((s) => ({ setType: s.setType, weight: s.weight, reps: s.reps })),
    );
  },

  updatePlanExerciseSets: async (planId, planExerciseId, sets) => {
    const detail = get().detailById[planId];
    if (!detail) return;
    const pe = detail.exercises.find((e) => e.id === planExerciseId);
    if (!pe) return;
    const reindexed = reindexSets(sets);
    set((state) => {
      const d = state.detailById[planId];
      if (!d) return state;
      const exercises = d.exercises.map((e) =>
        e.id === planExerciseId ? { ...e, sets: reindexed } : e,
      );
      return { detailById: { ...state.detailById, [planId]: { ...d, exercises } } };
    });
    const db = await getDatabase();
    await replaceSetsForPlanExercise(
      db,
      planExerciseId,
      reindexed.map((s) => ({ setType: s.setType, weight: s.weight, reps: s.reps })),
    );
  },

  // ---------- 替换运动 / 休息时长 ----------

  replaceExerciseInPlan: async (planId, planExerciseId, newExerciseId) => {
    // 防御性：如果新运动没换，什么都不做。
    const detail = get().detailById[planId];
    const target = detail?.exercises.find((e) => e.id === planExerciseId);
    if (!target) return;
    if (target.exerciseId === newExerciseId) return;

    const db = await getDatabase();
    await replaceExerciseInRepo(db, planId, planExerciseId, newExerciseId);
    // 加载新运动的 Exercise 详情并替换 detailById 中的元数据。
    // restSeconds/position/sets 都保留 —— 用户为该 *槽位* 配的休息
    // 时长与新运动一并迁移。
    const newExercise = await getExercise(db, newExerciseId);
    if (!newExercise) return;
    set((state) => {
      const d = state.detailById[planId];
      if (!d) return state;
      const newExercises = d.exercises.map((e) =>
        e.id === planExerciseId
          ? { ...e, exerciseId: newExerciseId, exercise: newExercise }
          : e,
      );
      const newIds = newExercises.map((e) => e.exerciseId);
      return {
        detailById: {
          ...state.detailById,
          [planId]: { exercises: newExercises, exerciseIds: newIds },
        },
      };
    });
  },

  setExerciseRestSeconds: async (planId, planExerciseId, seconds) => {
    const bounded = Math.max(0, Math.min(600, Math.round(seconds)));
    const db = await getDatabase();
    await setExerciseRestSecondsInRepo(db, planId, planExerciseId, bounded);
    set((state) => {
      const d = state.detailById[planId];
      if (!d) return state;
      return {
        detailById: {
          ...state.detailById,
          [planId]: {
            ...d,
            exercises: d.exercises.map((e) =>
              e.id === planExerciseId ? { ...e, restSeconds: bounded } : e,
            ),
          },
        },
      };
    });
  },
}));
