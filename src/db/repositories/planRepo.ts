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
  type ExerciseRow,
  type PlanExerciseRow,
  type PlanRow,
  type PlanWithExercises,
} from '../schema';

import { newId, nowMs } from './_helpers';

export type { PlanExercise, PlanExerciseWithDetail, PlanWithExercises } from '../schema';

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
    };
  });

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
          await stmt.executeAsync([newId(), id, exIds[i], i, DEFAULT_REST_SECONDS]);
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

export const planRepo = {
  list: listPlans,
  listWithCount: listPlansWithCount,
  get: getPlan,
  create: createPlan,
  update: updatePlan,
  delete: deletePlan,
  replaceExercise,
  setExerciseRestSeconds,
};
