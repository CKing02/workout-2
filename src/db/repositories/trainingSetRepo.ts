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
  metricTypeSnapshot?: string | null;
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
    s.metricTypeSnapshot ?? null,
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
       (id, training_id, exercise_id, exercise_name_snapshot, metric_type_snapshot,
        position, set_index, weight, reps, duration_seconds, distance_km,
        set_type, completed)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
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

/**
 * G17: 取一个动作最近 N 组训练记录（按时间倒序），不含当前进行中的未完成 set。
 * 通过 JOIN `trainings` 取 `started_at`，排除尚未完成的训练（用 `ended_at IS NOT NULL`）。
 * 单组动作：weight/reps/durationSeconds/distanceKm。
 */
export async function getLastSetsForExercise(
  db: SQLiteDatabase,
  exerciseId: string,
  limit = 3,
): Promise<TrainingSet[]> {
  const rows = await db.getAllAsync<TrainingSetRow>(
    `SELECT ts.*
       FROM training_sets ts
       JOIN trainings t ON t.id = ts.training_id
       WHERE ts.exercise_id = ?
         AND ts.completed = 1
         AND t.ended_at IS NOT NULL
       ORDER BY t.started_at DESC, ts.set_index DESC
       LIMIT ?;`,
    [exerciseId, limit],
  );
  return rows.map(rowToTrainingSet);
}

/**
 * 取每个动作上一次完成训练中的组，避免把更早训练的组混入“上次”。
 * 用一条 IN 查询，避免 N+1。
 */
export async function getLastSetsForExercises(
  db: SQLiteDatabase,
  exerciseIds: string[],
  perExerciseLimit = 3,
): Promise<Record<string, TrainingSet[]>> {
  const out: Record<string, TrainingSet[]> = {};
  if (exerciseIds.length === 0) return out;
  // 占位符数量 = exerciseIds.length
  const placeholders = exerciseIds.map(() => '?').join(',');
  // 必须是 `ts.*` 而不是 `*`。[G21 真正根因，2026-09-27 实机 DB 定位]
  // `SELECT *` 在 JOIN 下会把**两张表**的同名列都吐出来，而 `training_sets.id`
  // 与 `trainings.id` 同名、`duration_seconds` 也同名。expo-sqlite 的
  // `composeRow()`（node_modules/expo-sqlite/src/paramUtils.ts:65）是按列序
  // `row[name] = values[i]` 逐列赋值 —— **后者覆盖前者**，于是
  //   - `r.id`            拿到的是 *训练* 的 id（不是 set 的）
  //   - `r.duration_seconds` 拿到的是 *整场训练* 的总时长（不是本组的）
  // 同一场训练里的每一组于是共享同一个 `id` → `LastSetsPreview` 的
  // `key={s.id}` 撞车 → React "Encountered two children with the same key"，
  // 在 errorLogs 里一次性炸出 186 条同 fingerprint 记录、升级成红屏 overlay。
  // 真机 DB 实测：2/2 个有 ≥2 组历史的动作都复现 `count=2 unique=1`。
  // `duration_seconds` 那半边还会让「上次」预览把整场训练时长当成单组时长显示。
  //
  // 同文件的 `listSetsByExerciseInRange` 用的是正确写法（`ts.*` + `t.*` 起别名），
  // 本函数是唯一漏网的。改回 `ts.*` 后两个字段同时归位。
  const rows = await db.getAllAsync<TrainingSetRow & { rn: number }>(
    `SELECT ts.*, ROW_NUMBER() OVER (
       PARTITION BY ts.exercise_id
       ORDER BY ts.set_index ASC
     ) AS rn
       FROM training_sets ts
       JOIN trainings t ON t.id = ts.training_id
       WHERE ts.exercise_id IN (${placeholders})
         AND ts.completed = 1
         AND t.ended_at IS NOT NULL
         AND t.id = (
           SELECT t2.id FROM trainings t2
           JOIN training_sets ts2 ON ts2.training_id = t2.id
           WHERE ts2.exercise_id = ts.exercise_id
             AND ts2.completed = 1 AND t2.ended_at IS NOT NULL
           ORDER BY t2.started_at DESC, t2.id DESC LIMIT 1
         );`,
    exerciseIds,
  );
  for (const r of rows) {
    if (r.rn > perExerciseLimit) continue;
    const set = rowToTrainingSet(r);
    (out[r.exercise_id] ??= []).push(set);
  }
  // SQL 没保证顺序，再排一次稳定。
  for (const id of Object.keys(out)) {
    out[id] = out[id].sort((a, b) => {
      return a.setIndex - b.setIndex;
    });
  }
  return out;
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
    metricTypeSnapshot:
      patch.metricTypeSnapshot !== undefined
        ? patch.metricTypeSnapshot
        : existing.metricTypeSnapshot,
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
       SET exercise_id = ?, exercise_name_snapshot = ?, metric_type_snapshot = ?, position = ?, set_index = ?,
           weight = ?, reps = ?, duration_seconds = ?, distance_km = ?,
           set_type = ?, completed = ?
       WHERE id = ?;`,
    [
      next.exerciseId,
      next.exerciseNameSnapshot,
      next.metricTypeSnapshot,
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
  getLastSetsForExercise,
  getLastSetsForExercises,
  get: getTrainingSet,
  update: updateTrainingSet,
  delete: deleteTrainingSet,
};
