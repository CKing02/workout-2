/**
 * Training repository.
 *
 * 一次训练记录 + 其下的所有 set。
 * CRUD 顶层是 `trainings`；set 的写入在 `trainingSetRepo.batchInsertTrainingSets`
 * 中提供（一次事务批量）。
 */

import type { SQLiteDatabase } from 'expo-sqlite';

import { rowToTraining, type Training, type TrainingRow } from '../schema';

import { newId, nowMs } from './_helpers';

export type { Training } from '../schema';

export async function listTrainings(
  db: SQLiteDatabase,
): Promise<Training[]> {
  // Only completed trainings. Abandoned rows (where `cancelTraining` was
  // called or the app crashed mid-session) keep `ended_at IS NULL` — they
  // must not surface in the home feed or history list. The cancel path
  // deletes them outright (see `cancelTraining` in trainingStore), and
  // the `ended_at IS NULL` filter here is a defensive backstop in case
  // a row slips past the delete (e.g. process crash between the two
  // statements of a future refactor).
  const rows = await db.getAllAsync<TrainingRow>(
    `SELECT * FROM trainings
       WHERE ended_at IS NOT NULL
       ORDER BY started_at DESC;`,
  );
  return rows.map(rowToTraining);
}

export async function getTraining(
  db: SQLiteDatabase,
  id: string,
): Promise<Training | null> {
  const row = await db.getFirstAsync<TrainingRow>(
    'SELECT * FROM trainings WHERE id = ?;',
    [id],
  );
  return row ? rowToTraining(row) : null;
}

export interface CreateTrainingInput {
  planId?: string | null;
  planNameSnapshot?: string | null;
  startedAt?: number;
}

export async function createTraining(
  db: SQLiteDatabase,
  input: CreateTrainingInput,
): Promise<Training> {
  const id = newId();
  const startedAt = input.startedAt ?? nowMs();
  await db.runAsync(
    `INSERT INTO trainings
       (id, plan_id, plan_name_snapshot, started_at)
     VALUES (?, ?, ?, ?);`,
    [id, input.planId ?? null, input.planNameSnapshot ?? null, startedAt],
  );
  return {
    id,
    planId: input.planId ?? null,
    planNameSnapshot: input.planNameSnapshot ?? null,
    startedAt,
    endedAt: null,
    durationSeconds: null,
    totalVolume: null,
    exerciseCount: null,
    setCount: null,
  };
}

export interface UpdateTrainingInput {
  endedAt?: number;
  durationSeconds?: number;
  totalVolume?: number;
  exerciseCount?: number;
  setCount?: number;
}

export async function updateTraining(
  db: SQLiteDatabase,
  id: string,
  patch: UpdateTrainingInput,
): Promise<Training> {
  const existing = await getTraining(db, id);
  if (!existing) throw new Error(`Training not found: ${id}`);

  const next: Training = {
    ...existing,
    endedAt: patch.endedAt ?? existing.endedAt,
    durationSeconds: patch.durationSeconds ?? existing.durationSeconds,
    totalVolume: patch.totalVolume ?? existing.totalVolume,
    exerciseCount: patch.exerciseCount ?? existing.exerciseCount,
    setCount: patch.setCount ?? existing.setCount,
  };
  await db.runAsync(
    `UPDATE trainings
       SET ended_at = ?, duration_seconds = ?, total_volume = ?, exercise_count = ?, set_count = ?
       WHERE id = ?;`,
    [
      next.endedAt,
      next.durationSeconds,
      next.totalVolume,
      next.exerciseCount,
      next.setCount,
      id,
    ],
  );
  return next;
}

/**
 * 在已有事务中更新 trainings 行统计字段（不打开新事务）。
 * 用于 G8 `completeTrainingAtomic` 的外层事务里。
 */
export async function updateTrainingInTransaction(
  db: SQLiteDatabase,
  id: string,
  patch: Required<UpdateTrainingInput>,
): Promise<Training> {
  await db.runAsync(
    `UPDATE trainings
       SET ended_at = ?, duration_seconds = ?, total_volume = ?, exercise_count = ?, set_count = ?
       WHERE id = ?;`,
    [
      patch.endedAt,
      patch.durationSeconds,
      patch.totalVolume,
      patch.exerciseCount,
      patch.setCount,
      id,
    ],
  );
  return {
    id,
    planId: null,
    planNameSnapshot: null,
    startedAt: 0,
    endedAt: patch.endedAt,
    durationSeconds: patch.durationSeconds,
    totalVolume: patch.totalVolume,
    exerciseCount: patch.exerciseCount,
    setCount: patch.setCount,
  };
}

export async function deleteTraining(
  db: SQLiteDatabase,
  id: string,
): Promise<void> {
  // CASCADE removes training_sets rows automatically.
  await db.runAsync('DELETE FROM trainings WHERE id = ?;', [id]);
}

/**
 * Query training records within a date range. Returns completed rows
 * sorted by `started_at` descending. Abandoned rows (`ended_at IS NULL`)
 * are filtered out — see `listTrainings` for the rationale.
 * `groupByDate` 留给上层（按日期分组是 UI 关心的事）。
 */
export async function queryByDateRange(
  db: SQLiteDatabase,
  fromMs: number,
  toMs: number,
): Promise<Training[]> {
  const rows = await db.getAllAsync<TrainingRow>(
    `SELECT * FROM trainings
       WHERE started_at >= ? AND started_at <= ?
         AND ended_at IS NOT NULL
       ORDER BY started_at DESC;`,
    [fromMs, toMs],
  );
  return rows.map(rowToTraining);
}

export const trainingRepo = {
  list: listTrainings,
  get: getTraining,
  create: createTraining,
  update: updateTraining,
  delete: deleteTraining,
  queryByDateRange,
};
