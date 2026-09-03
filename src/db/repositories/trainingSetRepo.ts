/**
 * Training-set repository.
 *
 * 训练中的每组记录。写入通过 batch insert（一次事务）。
 * 读：按 training_id 查询全部 set，按 (position, set_index) 排序。
 */

import type { SQLiteBindValue, SQLiteDatabase } from 'expo-sqlite';

import {
  rowToTrainingSet,
  type TrainingSet,
  type TrainingSetRow,
} from '../schema';

import { newId } from './_helpers';

export interface CreateTrainingSetInput {
  trainingId: string;
  exerciseId: string;
  exerciseNameSnapshot: string;
  position: number;
  setIndex: number;
  weight?: number | null;
  reps?: number | null;
  durationSeconds?: number | null;
  distanceKm?: number | null;
  setType?: string;
  completed?: boolean;
}

function toInsertArgs(s: CreateTrainingSetInput): SQLiteBindValue[] {
  return [
    newId(),
    s.trainingId,
    s.exerciseId,
    s.exerciseNameSnapshot,
    s.position,
    s.setIndex,
    s.weight ?? null,
    s.reps ?? null,
    s.durationSeconds ?? null,
    s.distanceKm ?? null,
    s.setType ?? 'normal',
    s.completed ? 1 : 0,
  ];
}

/**
 * 在已有事务内批量插入 set。调用方必须已经处于 `withTransactionAsync` 块内。
 * 不打开自己的事务，保证外层事务能包裹全部写入（G8 completeTraining 需要）。
 */
export async function batchInsertTrainingSetsInTransaction(
  db: SQLiteDatabase,
  sets: CreateTrainingSetInput[],
): Promise<number> {
  if (sets.length === 0) return 0;
  const stmt = await db.prepareAsync(
    `INSERT INTO training_sets
       (id, training_id, exercise_id, exercise_name_snapshot,
        position, set_index, weight, reps, duration_seconds, distance_km,
        set_type, completed)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
  );
  try {
    for (const s of sets) {
      await stmt.executeAsync(toInsertArgs(s));
    }
  } finally {
    await stmt.finalizeAsync();
  }
  return sets.length;
}

/**
 * 批量插入。一次事务内完成，避免中间失败导致部分写入。
 * 返回插入的行数。
 */
export async function batchInsertTrainingSets(
  db: SQLiteDatabase,
  sets: CreateTrainingSetInput[],
): Promise<number> {
  if (sets.length === 0) return 0;

  await db.withTransactionAsync(async () => {
    await batchInsertTrainingSetsInTransaction(db, sets);
  });

  return sets.length;
}

export async function listSetsByTraining(
  db: SQLiteDatabase,
  trainingId: string,
): Promise<TrainingSet[]> {
  const rows = await db.getAllAsync<TrainingSetRow>(
    `SELECT * FROM training_sets
       WHERE training_id = ?
       ORDER BY position ASC, set_index ASC;`,
    [trainingId],
  );
  return rows.map(rowToTrainingSet);
}

export async function getTrainingSet(
  db: SQLiteDatabase,
  id: string,
): Promise<TrainingSet | null> {
  const row = await db.getFirstAsync<TrainingSetRow>(
    'SELECT * FROM training_sets WHERE id = ?;',
    [id],
  );
  return row ? rowToTrainingSet(row) : null;
}

export async function updateTrainingSet(
  db: SQLiteDatabase,
  id: string,
  patch: Partial<Omit<CreateTrainingSetInput, 'trainingId' | 'id'>>,
): Promise<TrainingSet> {
  const existing = await getTrainingSet(db, id);
  if (!existing) throw new Error(`TrainingSet not found: ${id}`);

  const next: TrainingSet = {
    ...existing,
    exerciseId: patch.exerciseId ?? existing.exerciseId,
    exerciseNameSnapshot:
      patch.exerciseNameSnapshot ?? existing.exerciseNameSnapshot,
    position: patch.position ?? existing.position,
    setIndex: patch.setIndex ?? existing.setIndex,
    weight: patch.weight !== undefined ? patch.weight : existing.weight,
    reps: patch.reps !== undefined ? patch.reps : existing.reps,
    durationSeconds:
      patch.durationSeconds !== undefined
        ? patch.durationSeconds
        : existing.durationSeconds,
    distanceKm:
      patch.distanceKm !== undefined ? patch.distanceKm : existing.distanceKm,
    setType: patch.setType ?? existing.setType,
    completed:
      patch.completed !== undefined ? patch.completed : existing.completed,
  };
  await db.runAsync(
    `UPDATE training_sets
       SET exercise_id = ?, exercise_name_snapshot = ?, position = ?, set_index = ?,
           weight = ?, reps = ?, duration_seconds = ?, distance_km = ?,
           set_type = ?, completed = ?
       WHERE id = ?;`,
    [
      next.exerciseId,
      next.exerciseNameSnapshot,
      next.position,
      next.setIndex,
      next.weight,
      next.reps,
      next.durationSeconds,
      next.distanceKm,
      next.setType,
      next.completed ? 1 : 0,
      id,
    ],
  );
  return next;
}

export async function deleteTrainingSet(
  db: SQLiteDatabase,
  id: string,
): Promise<void> {
  await db.runAsync('DELETE FROM training_sets WHERE id = ?;', [id]);
}

export const trainingSetRepo = {
  batchInsert: batchInsertTrainingSets,
  listByTraining: listSetsByTraining,
  get: getTrainingSet,
  update: updateTrainingSet,
  delete: deleteTrainingSet,
};
