/**
 * G32 — exerciseHistory repository.
 *
 * 单动作历史下钻的数据查询：
 *  - 按 `exercise_id` + 时间窗口 (`sinceMs`) 拉所有已完成的 normal set
 *  - 关联 `trainings` 表取 `started_at`（日期轴）
 *  - 排除 `ended_at IS NULL` 的废弃训练（与既有 listTrainings 一致）
 *  - 结果按 `training_id ASC, set_index ASC` 排序
 *
 * 注：Brzycki 1RM 在调用方（useExerciseHistory hook）按 training 分组后
 * 计算 — SQL 层只负责"拉原始 set"，避免 SQLite 内嵌 Brzycki 公式或
 * 自定义 function 的复杂度。volume 在 SQL 层 sum。
 */

import type { SQLiteDatabase } from 'expo-sqlite';

import { rowToTrainingSet, type TrainingSet, type TrainingSetRow } from '../schema';

export interface ExerciseHistorySetRow extends TrainingSet {
  /** 该 set 所属训练的 `started_at` 毫秒时间戳。 */
  trainingStartedAt: number;
}

/**
 * 拉指定动作在 `sinceMs` 之后的所有 normal 已完成 set。
 *
 * @param db SQLite 连接
 * @param exerciseId 动作 ID
 * @param sinceMs 起始时间（毫秒）；传 0 = 不限时间
 * @returns set 行 + 训练开始时间，按 training_id ASC, set_index ASC 排序
 */
export async function listSetsByExerciseInRange(
  db: SQLiteDatabase,
  exerciseId: string,
  sinceMs: number,
): Promise<ExerciseHistorySetRow[]> {
  const rows = await db.getAllAsync<
    TrainingSetRow & { t_started_at: number; t_id: string }
  >(
    `SELECT ts.*, t.started_at AS t_started_at, t.id AS t_id
       FROM training_sets ts
       JOIN trainings t ON t.id = ts.training_id
       WHERE ts.exercise_id = ?
         AND ts.set_type = 'normal'
         AND ts.completed = 1
         AND t.ended_at IS NOT NULL
         AND (? = 0 OR t.started_at >= ?)
       ORDER BY t.started_at ASC, ts.set_index ASC;`,
    [exerciseId, sinceMs, sinceMs],
  );
  return rows.map((r) => ({
    ...rowToTrainingSet({
      id: r.id,
      training_id: r.training_id,
      exercise_id: r.exercise_id,
      exercise_name_snapshot: r.exercise_name_snapshot,
      position: r.position,
      set_index: r.set_index,
      weight: r.weight,
      reps: r.reps,
      duration_seconds: r.duration_seconds,
      distance_km: r.distance_km,
      set_type: r.set_type,
      completed: r.completed,
    }),
    trainingStartedAt: r.t_started_at,
  }));
}

/**
 * G32 — 拉指定动作的所有"出现过的训练"（dedup by training_id），
 * 用于顶部 Header 的「训练总次数」字段。
 *
 * 比 listSetsByExerciseInRange 便宜（只 JOIN 不取 set 细节）。
 * 同样排除废弃训练和非常规 set。
 */
export async function countTrainingsByExerciseInRange(
  db: SQLiteDatabase,
  exerciseId: string,
  sinceMs: number,
): Promise<number> {
  const row = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(DISTINCT ts.training_id) AS c
       FROM training_sets ts
       JOIN trainings t ON t.id = ts.training_id
       WHERE ts.exercise_id = ?
         AND ts.set_type = 'normal'
         AND ts.completed = 1
         AND t.ended_at IS NOT NULL
         AND (? = 0 OR t.started_at >= ?);`,
    [exerciseId, sinceMs, sinceMs],
  );
  return row?.c ?? 0;
}
