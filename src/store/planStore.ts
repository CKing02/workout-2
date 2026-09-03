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
  createPlan,
  deletePlan,
  getPlan,
  listPlansWithCount,
  updatePlan,
} from '@/db/repositories/planRepo';
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

  /** In-memory only. Copy the last set's data when `copyFromLast` is true. */
  addSetToPlanExercise: (
    planId: string,
    planExerciseId: string,
    copyFromLast?: boolean,
  ) => void;

  /** In-memory only. Removes the set at `setIndex` (0-based). */
  removeSetFromPlanExercise: (
    planId: string,
    planExerciseId: string,
    setIndex: number,
  ) => void;

  /** In-memory only. Replaces the full set list for an exercise. */
  updatePlanExerciseSets: (
    planId: string,
    planExerciseId: string,
    sets: PlanSetDraft[],
  ) => void;

  /**
   * G16: 重新排序计划内的动作（持久化）。
   * 从 in-memory detail.exerciseIds 读取当前顺序，移动一项到新位置后
   * 复用 `update({ exerciseIds })` 路径批量重写 `plan_exercises` 行。
   * `fromIndex === toIndex` 时为 no-op。
   */
  reorderExercises: (
    planId: string,
    fromIndex: number,
    toIndex: number,
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
      exercise: pe.exercise,
      sets: [],
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
    set((state) => {
      // Update the in-memory detail cache if present so UI stays consistent.
      const detail = state.detailById[id];
      let nextDetail = detail;
      if (detail && patch.exerciseIds) {
        const desired = patch.exerciseIds;
        // Drop removed exercises; append new ones as empty drafts (no sets).
        const byId = new Map(detail.exercises.map((e) => [e.exerciseId, e]));
        const rebuilt: PlanExerciseDraft[] = desired
          .map((exId, idx) => {
            const carry = byId.get(exId);
            if (carry) {
              return { ...carry, position: idx };
            }
            // New exercise added since the editor was opened. The editor will
            // call `loadDetail` to refresh metadata when needed.
            return null;
          })
          .filter((v): v is PlanExerciseDraft => v !== null);
        nextDetail = { exercises: rebuilt, exerciseIds: desired };
      }
      return {
        plans: state.plans.map((p) => (p.id === id ? plan : p)),
        detailById: nextDetail
          ? { ...state.detailById, [id]: nextDetail }
          : state.detailById,
      };
    });
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
    set((state) => {
      const carry = new Map<string, PlanSetDraft[]>();
      for (const e of detail?.exercises ?? []) {
        if (e.sets.length > 0) carry.set(e.exerciseId, e.sets);
      }
      const rebuilt: PlanExerciseDraft[] = fresh.exercises.map((pe) => ({
        id: pe.id,
        planId: pe.planId,
        exerciseId: pe.exerciseId,
        position: pe.position,
        exercise: pe.exercise,
        sets: carry.get(pe.exerciseId) ?? [],
      }));
      const nextDetail: PlanDetailState = {
        exercises: rebuilt,
        exerciseIds: fresh.exercises.map((pe) => pe.exerciseId),
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

  addSetToPlanExercise: (planId, planExerciseId, copyFromLast = true) => {
    set((state) => {
      const detail = state.detailById[planId];
      if (!detail) return state;
      const exercises = detail.exercises.map((pe) => {
        if (pe.id !== planExerciseId) return pe;
        const last = pe.sets[pe.sets.length - 1];
        const newSet = copyFromLast && last
          ? cloneSet(last, nextSetIndex(pe.sets))
          : { ...makeEmptySet(), setIndex: nextSetIndex(pe.sets) };
        return { ...pe, sets: [...pe.sets, newSet] };
      });
      return {
        detailById: {
          ...state.detailById,
          [planId]: { ...detail, exercises },
        },
      };
    });
  },

  removeSetFromPlanExercise: (planId, planExerciseId, setIndex) => {
    set((state) => {
      const detail = state.detailById[planId];
      if (!detail) return state;
      const exercises = detail.exercises.map((pe) => {
        if (pe.id !== planExerciseId) return pe;
        const filtered = pe.sets.filter((_, i) => i !== setIndex);
        return { ...pe, sets: reindexSets(filtered) };
      });
      return {
        detailById: {
          ...state.detailById,
          [planId]: { ...detail, exercises },
        },
      };
    });
  },

  updatePlanExerciseSets: (planId, planExerciseId, sets) => {
    set((state) => {
      const detail = state.detailById[planId];
      if (!detail) return state;
      const exercises = detail.exercises.map((pe) =>
        pe.id === planExerciseId ? { ...pe, sets: reindexSets(sets) } : pe,
      );
      return {
        detailById: {
          ...state.detailById,
          [planId]: { ...detail, exercises },
        },
      };
    });
  },

  // ---------- G16: 拖拽排序 ----------

  reorderExercises: async (planId, fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;
    const detail = get().detailById[planId];
    if (!detail) return;
    const len = detail.exerciseIds.length;
    if (fromIndex < 0 || fromIndex >= len) return;
    if (toIndex < 0 || toIndex >= len) return;
    const ids = [...detail.exerciseIds];
    const [moved] = ids.splice(fromIndex, 1);
    ids.splice(toIndex, 0, moved);
    // 复用 `update` 的 exerciseIds 路径：DB 事务内 DELETE 旧行 +
    // 按新顺序 INSERT；detailById 会被重建。
    await get().update(planId, { exerciseIds: ids });
  },
}));
