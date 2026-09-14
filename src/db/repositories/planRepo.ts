/**
 * Plan repository.
 *
 * Plans + plan_exercises (with ON DELETE CASCADE).
 * Delete on a plan automatically clears its plan_exercises rows.
 */

import type { SQLiteDatabase } from 'expo-sqlite';

import {
  rowToExercise,
  rowToPlanExercise,
  rowToPlanSet,
  type ExerciseRow,
  type PlanExerciseRow,
  type PlanRow,
  type PlanSet,
  type PlanSetRow,
  type PlanWithExercises,
} from '../schema';

import { newId, nowMs } from './_helpers';

export type { PlanExercise, PlanExerciseWithDetail, PlanSet, PlanWithExercises } from '../schema';

export interface Plan {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Plan + denormalized `exerciseCount`.
 *
 * Computed via a LEFT JOIN with COUNT on `plan_exercises` so the training
 * list can render "n 个动作" + enable the start button without N+1 queries
 * (and without needing to query history — which was the old, wrong source
 * for this field: a brand-new plan with no training history would always
 * read 0 and disable its start button).
 */
export interface PlanWithCount extends Plan {
  exerciseCount: number;
}

function rowToPlan(row: PlanRow): Plan {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToPlanWithCount(row: PlanRow & { exercise_count: number }): PlanWithCount {
  return { ...rowToPlan(row), exerciseCount: row.exercise_count };
}

export async function listPlans(db: SQLiteDatabase): Promise<Plan[]> {
  const rows = await db.getAllAsync<PlanRow>(
    'SELECT * FROM plans ORDER BY updated_at DESC;',
  );
  return rows.map(rowToPlan);
}

/**
 * List plans with `exerciseCount` denormalized via SQL aggregate.
 * Single round-trip; no N+1.
 */
export async function listPlansWithCount(
  db: SQLiteDatabase,
): Promise<PlanWithCount[]> {
  const rows = await db.getAllAsync<PlanRow & { exercise_count: number }>(
    `SELECT p.*, COUNT(pe.id) AS exercise_count
       FROM plans p
       LEFT JOIN plan_exercises pe ON pe.plan_id = p.id
       GROUP BY p.id
       ORDER BY p.updated_at DESC;`,
  );
  return rows.map(rowToPlanWithCount);
}

export async function getPlan(
  db: SQLiteDatabase,
  id: string,
): Promise<PlanWithExercises | null> {
  const planRow = await db.getFirstAsync<PlanRow>(
    'SELECT * FROM plans WHERE id = ?;',
    [id],
  );
  if (!planRow) return null;
  const planId = planRow.id;

  const linkRows = await db.getAllAsync<PlanExerciseRow>(
    'SELECT * FROM plan_exercises WHERE plan_id = ? ORDER BY position ASC;',
    [planId],
  );
  const exerciseIds = linkRows.map((r) => r.exercise_id);
  const exerciseMap = new Map<string, ExerciseRow>();
  if (exerciseIds.length > 0) {
    const placeholders = exerciseIds.map(() => '?').join(',');
    const exRows = await db.getAllAsync<ExerciseRow>(
      `SELECT * FROM exercises WHERE id IN (${placeholders});`,
      exerciseIds,
    );
    for (const r of exRows) exerciseMap.set(r.id, r);
  }

  const exercises = linkRows.map((link) => {
    const ex = exerciseMap.get(link.exercise_id);
    if (!ex) {
      // Should never happen — cascade should have removed the link.
      throw new Error(
        `Plan exercise missing: plan=${planId}, exercise=${link.exercise_id}`,
      );
    }
    return {
      ...rowToPlanExercise(link),
      exercise: rowToExercise(ex),
      sets: [] as PlanSet[], // filled below
    };
  });

  // G24a: load persisted set presets (count + type) per plan_exercise.
  // Empty rows for a plan_exercise is legitimate (a brand-new plan added via
  // the picker before any sets were configured); the UI shows an empty
  // strip in that case.
  if (linkRows.length > 0) {
    const peIds = linkRows.map((r) => r.id);
    const setPlaceholders = peIds.map(() => '?').join(',');
    const setRows = await db.getAllAsync<PlanSetRow>(
      `SELECT * FROM plan_sets
        WHERE plan_exercise_id IN (${setPlaceholders})
        ORDER BY plan_exercise_id, set_index ASC;`,
      peIds,
    );
    const setsByPeId = new Map<string, PlanSet[]>();
    for (const r of setRows) {
      const list = setsByPeId.get(r.plan_exercise_id) ?? [];
      list.push(rowToPlanSet(r));
      setsByPeId.set(r.plan_exercise_id, list);
    }
    for (const pe of exercises) {
      pe.sets = setsByPeId.get(pe.id) ?? [];
    }
  }

  return {
    id: planRow.id,
    name: planRow.name,
    createdAt: planRow.created_at,
    updatedAt: planRow.updated_at,
    exercises,
  };
}

async function countPlanExercises(
  db: SQLiteDatabase,
  planId: string,
): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM plan_exercises WHERE plan_id = ?;',
    [planId],
  );
  return row?.count ?? 0;
}

/** Default per-exercise rest interval (seconds). */
const DEFAULT_REST_SECONDS = 60;

export async function createPlan(
  db: SQLiteDatabase,
  input: { name: string; exerciseIds?: string[] },
): Promise<PlanWithCount> {
  const id = newId();
  const now = nowMs();
  // 记录刚生成的 (exerciseId -> planExerciseId) 映射,方便 store 在
  // create() 里把内存里临时 ID (tmp_xxx) 的 set drafts 一次性 carry
  // 到真正的 plan_exercise row 上 —— 见 planStore.create 的 fix。
  const createdPairs: Array<{ exerciseId: string; planExerciseId: string }> = [];
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO plans (id, name, created_at, updated_at) VALUES (?, ?, ?, ?);`,
      [id, input.name, now, now],
    );
    const exIds = input.exerciseIds ?? [];
    if (exIds.length > 0) {
      const stmt = await db.prepareAsync(
        `INSERT INTO plan_exercises (id, plan_id, exercise_id, position, rest_seconds) VALUES (?, ?, ?, ?, ?);`,
      );
      try {
        for (let i = 0; i < exIds.length; i++) {
          const planExerciseId = newId();
          await stmt.executeAsync([planExerciseId, id, exIds[i], i, DEFAULT_REST_SECONDS]);
          createdPairs.push({ exerciseId: exIds[i], planExerciseId });
        }
      } finally {
        await stmt.finalizeAsync();
      }
    }
  });
  return {
    id,
    name: input.name,
    createdAt: now,
    updatedAt: now,
    exerciseCount: input.exerciseIds?.length ?? 0,
    // 新建计划的 plan_exercises row IDs 暴露给上层(planStore.create 用它做
    // set drafts carry)。其它既有调用方不会读这个字段,TypeScript 加 & 联合
    // 类型在下面。
    planExercisePairs: createdPairs,
  } as PlanWithCount & {
    planExercisePairs: Array<{ exerciseId: string; planExerciseId: string }>;
  };
}

export async function updatePlan(
  db: SQLiteDatabase,
  id: string,
  patch: { name?: string; exerciseIds?: string[] },
): Promise<PlanWithCount> {
  const existing = await db.getFirstAsync<PlanRow>(
    'SELECT * FROM plans WHERE id = ?;',
    [id],
  );
  if (!existing) throw new Error(`Plan not found: ${id}`);
  const now = nowMs();
  const nextName = patch.name ?? existing.name;
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE plans SET name = ?, updated_at = ? WHERE id = ?;',
      [nextName, now, id],
    );
    if (patch.exerciseIds) {
      // Reconcile strategy: keep each existing row's `rest_seconds` if its
      // `exercise_id` is still in the new list, otherwise default to
      // DEFAULT_REST_SECONDS for genuinely new exercises. This preserves
      // user-configured rest intervals across reorders/adds/removes that
      // go through `updatePlan` (which is most paths; only the dedicated
      // `replaceExercise` / `setExerciseRestSeconds` helpers bypass this).
      const existingRows = await db.getAllAsync<{
        exercise_id: string;
        rest_seconds: number;
      }>(
        'SELECT exercise_id, rest_seconds FROM plan_exercises WHERE plan_id = ?;',
        [id],
      );
      const restByExId = new Map<string, number>(
        existingRows.map((r) => [r.exercise_id, r.rest_seconds]),
      );

      await db.runAsync('DELETE FROM plan_exercises WHERE plan_id = ?;', [id]);
      const stmt = await db.prepareAsync(
        `INSERT INTO plan_exercises (id, plan_id, exercise_id, position, rest_seconds) VALUES (?, ?, ?, ?, ?);`,
      );
      try {
        for (let i = 0; i < patch.exerciseIds.length; i++) {
          const exId = patch.exerciseIds[i];
          const restSeconds = restByExId.get(exId) ?? DEFAULT_REST_SECONDS;
          await stmt.executeAsync([newId(), id, exId, i, restSeconds]);
        }
      } finally {
        await stmt.finalizeAsync();
      }
    }
  });
  // Re-read count from DB — the caller's update may have added/removed
  // exercises and we want the returned row to reflect that.
  const exerciseCount = await countPlanExercises(db, id);
  return {
    id,
    name: nextName,
    createdAt: existing.created_at,
    updatedAt: now,
    exerciseCount,
  };
}

export async function deletePlan(
  db: SQLiteDatabase,
  id: string,
): Promise<void> {
  // CASCADE removes plan_exercises rows automatically.
  await db.runAsync('DELETE FROM plans WHERE id = ?;', [id]);
}

/**
 * Replace the `exercise_id` of a single `plan_exercises` row without
 * disturbing its position or `rest_seconds` setting. Used by the plan
 * editor's "替换运动" flow — the user keeps the existing rest interval
 * (which was configured for that *slot*, not for the original exercise)
 * and the new exercise inherits it.
 */
export async function replaceExercise(
  db: SQLiteDatabase,
  planId: string,
  planExerciseId: string,
  newExerciseId: string,
): Promise<void> {
  const result = await db.runAsync(
    `UPDATE plan_exercises
        SET exercise_id = ?
        WHERE id = ? AND plan_id = ?;`,
    [newExerciseId, planExerciseId, planId],
  );
  if (result.changes === 0) {
    throw new Error(
      `replaceExercise: no row updated (planExerciseId=${planExerciseId})`,
    );
  }
}

/**
 * Update the per-exercise rest interval. No-op on `seconds === existing`,
 * but we always issue the SQL — cheaper than the round-trip to read
 * first, and `rest_seconds` is the only column touched.
 */
export async function setExerciseRestSeconds(
  db: SQLiteDatabase,
  planId: string,
  planExerciseId: string,
  seconds: number,
): Promise<void> {
  await db.runAsync(
    `UPDATE plan_exercises
        SET rest_seconds = ?
        WHERE id = ? AND plan_id = ?;`,
    [seconds, planExerciseId, planId],
  );
}

/* -------------------------------------------------------------------------- */
/* plan_sets — per plan_exercise set presets (G24a)                           */
/* -------------------------------------------------------------------------- */

/**
 * Atomically replace all set presets for a single plan_exercise.
 * Used by planStore whenever the set list changes (add / remove / reorder /
 * type-change / weight+reps edit). Inserts new rows; the DB id is
 * regenerated so the in-memory `localId` ↔ DB `id` mapping always goes
 * through this function.
 *
 * `sets` is the desired final state (ordered by `setIndex`). We do a single
 * DELETE + bulk INSERT inside one transaction so a half-applied state can
 * never land in the DB if the process dies mid-call.
 *
 * G24a follow-up: each set carries its full prescription (`weight`, `reps`,
 * `setType`). All three are persisted so the plan editor's
 * "10kg × 10 reps" template survives restarts.
 *
 * ⋯ 组数据按 metricType 渲染:time 类写 `durationSeconds`,km 类写 `distanceKm`。
 * 旧调用方继续按 `{ setType, weight, reps }` 传 → 缺失字段默认 0。
 */
export async function replaceSetsForPlanExercise(
  db: SQLiteDatabase,
  planExerciseId: string,
  sets: ReadonlyArray<{
    setType: string;
    weight: number;
    reps: number;
    durationSeconds?: number;
    distanceKm?: number;
  }>,
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'DELETE FROM plan_sets WHERE plan_exercise_id = ?;',
      [planExerciseId],
    );
    if (sets.length === 0) return;
    const stmt = await db.prepareAsync(
      `INSERT INTO plan_sets (id, plan_exercise_id, set_index, set_type, weight, reps, duration_seconds, distance_km)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    );
    try {
      for (let i = 0; i < sets.length; i++) {
        const s = sets[i];
        await stmt.executeAsync([
          newId(),
          planExerciseId,
          i + 1,
          s.setType,
          s.weight,
          s.reps,
          s.durationSeconds ?? 0,
          s.distanceKm ?? 0,
        ]);
      }
    } finally {
      await stmt.finalizeAsync();
    }
  });
}

/**
 * Append one set preset to the end of a plan_exercise's list. Returns the
 * freshly-inserted row's `set_index` (1-based) — the caller pairs this with
 * the new in-memory `localId` to keep the two views in sync.
 *
 * G24a follow-up: also accepts initial `weight` + `reps` (e.g. when copying
 * the last set's values via the editor's "复制上组" button).
 *
 * ⋯ 增 `durationSeconds` / `distanceKm` 两个可选形参(time / km 类动作首组用)。
 */
export async function appendSetForPlanExercise(
  db: SQLiteDatabase,
  planExerciseId: string,
  setType: string,
  weight: number = 0,
  reps: number = 0,
  durationSeconds: number = 0,
  distanceKm: number = 0,
): Promise<number> {
  const nextIndexRow = await db.getFirstAsync<{ next_index: number }>(
    `SELECT COALESCE(MAX(set_index), 0) + 1 AS next_index
       FROM plan_sets WHERE plan_exercise_id = ?;`,
    [planExerciseId],
  );
  const setIndex = nextIndexRow?.next_index ?? 1;
  await db.runAsync(
    `INSERT INTO plan_sets (id, plan_exercise_id, set_index, set_type, weight, reps, duration_seconds, distance_km)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    [newId(), planExerciseId, setIndex, setType, weight, reps, durationSeconds, distanceKm],
  );
  return setIndex;
}

/**
 * Remove a single set preset by 1-based `setIndex`. After deletion, the
 * remaining rows are renumbered 1..N so the visible group count matches the
 * row count. Single transaction keeps the renumbering atomic.
 */
export async function removeSetForPlanExerciseByIndex(
  db: SQLiteDatabase,
  planExerciseId: string,
  setIndex: number,
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'DELETE FROM plan_sets WHERE plan_exercise_id = ? AND set_index = ?;',
      [planExerciseId, setIndex],
    );
    // Re-number remaining rows so set_index stays contiguous 1..N. Two-step
    // (negative-offset update + zero-out + positive-offset) avoids the
    // UNIQUE-style constraint problem of "what if 1, 2, 3, then I move 1→2
    // — there's already a 2". Since plan_sets has no UNIQUE constraint on
    // (plan_exercise_id, set_index), a direct renumber would also work, but
    // the offset dance is safer if a future migration adds one.
    const remaining = await db.getAllAsync<{ id: string; set_index: number }>(
      `SELECT id, set_index FROM plan_sets
        WHERE plan_exercise_id = ?
        ORDER BY set_index ASC;`,
      [planExerciseId],
    );
    for (const row of remaining) {
      await db.runAsync(
        'UPDATE plan_sets SET set_index = ? WHERE id = ?;',
        [-row.set_index, row.id],
      );
    }
    for (const row of remaining) {
      await db.runAsync(
        'UPDATE plan_sets SET set_index = ? WHERE id = ?;',
        [remaining.indexOf(row) + 1, row.id],
      );
    }
  });
}

export const planRepo = {
  list: listPlans,
  listWithCount: listPlansWithCount,
  get: getPlan,
  create: createPlan,
  update: updatePlan,
  delete: deletePlan,
  replaceExercise,
  setExerciseRestSeconds,
  replaceSetsForPlanExercise,
  appendSetForPlanExercise,
  removeSetForPlanExerciseByIndex,
};
