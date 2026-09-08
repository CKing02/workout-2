/**
 * G32 — exerciseList repository.
 *
 * 「按动作」Tab 的数据源：列出"有训练记录"的动作，按最高 Brzycki 1RM 降序。
 *
 * 设计：
 *  - JOIN 三表：`exercises` + `training_sets` + `trainings`
 *  - 过滤：normal + completed + 已结束训练（与其他 repo 一致）
 *  - 1RM 在 SQL 层 **无法** 直接算（无 Brzycki 函数），所以先 GROUP BY
 *    拿每个动作的 (id, name, muscle_group, equipment, total_trainings)，
 *    再 JOIN 该动作下所有 normal set 在应用层 group-by 算 max Brzycki。
 *    ——但 N+1 不理想，因此这里采取折中：一次性把该动作下所有 set 拉上来
 *    在内存里 reduce；本地数据量小（几十个动作 × 几百组），成本可接受。
 *
 * 替代方案：先 SQL 出 (exercise, total_trainings)，再单独 SQL 出该动作
 * 所有 set 在 JS 层 group-by 算 1RM。两步走的好处是少拉一张大表的中间列，
 * 但代码多一层循环；这里用一步 SQL + JS reduce 折中。
 */

import type { SQLiteDatabase } from 'expo-sqlite';

import { rowToExercise, type Exercise, type ExerciseRow } from '../schema';

import { brzycki } from '@/utils/oneRm';

export interface ExerciseListRow {
  exercise: Exercise;
  totalTrainings: number;
  /** 该动作下所有 normal set 的最大 Brzycki 1RM（kg）。0 = 无 set 可算。 */
  maxOneRm: number;
}

interface RawSetRow {
  id: string;
  training_id: string;
  exercise_id: string;
  exercise_name_snapshot: string;
  position: number;
  set_index: number;
  weight: number | null;
  reps: number | null;
  duration_seconds: number | null;
  distance_km: number | null;
  set_type: string;
  completed: number;
}

/**
 * 拉"有训练记录"的所有动作 + 每个动作的训练次数 + 最大 Brzycki 1RM。
 * 按 maxOneRm DESC 排序（同分按总训练次数 DESC）。
 */
export async function listExercisesWithHistory(
  db: SQLiteDatabase,
): Promise<ExerciseListRow[]> {
  // 1) 拿动作元数据 + 训练次数（dedup by training_id）
  const exerciseRows = await db.getAllAsync<
    ExerciseRow & { total_trainings: number }
  >(
    `SELECT e.*, COUNT(DISTINCT ts.training_id) AS total_trainings
       FROM exercises e
       JOIN training_sets ts ON e.id = ts.exercise_id
       JOIN trainings t ON ts.training_id = t.id
       WHERE ts.set_type = 'normal'
         AND ts.completed = 1
         AND t.ended_at IS NOT NULL
       GROUP BY e.id
       ORDER BY e.is_custom ASC, e.name COLLATE NOCASE ASC;`,
  );

  if (exerciseRows.length === 0) return [];

  // 2) 一次性拿这些动作的所有 normal set 算 Brzycki
  const ids = exerciseRows.map((r) => r.id);
  const placeholders = ids.map(() => '?').join(',');
  const setRows = await db.getAllAsync<RawSetRow>(
    `SELECT ts.*
       FROM training_sets ts
       JOIN trainings t ON ts.training_id = t.id
       WHERE ts.exercise_id IN (${placeholders})
         AND ts.set_type = 'normal'
         AND ts.completed = 1
         AND t.ended_at IS NOT NULL;`,
    ids,
  );

  const oneRmByExercise = new Map<string, number>();
  for (const r of setRows) {
    const v = brzycki(r.weight ?? 0, r.reps ?? 0);
    if (v <= 0) continue;
    const cur = oneRmByExercise.get(r.exercise_id) ?? 0;
    if (v > cur) oneRmByExercise.set(r.exercise_id, v);
  }

  // 3) 组装结果，按 maxOneRm DESC 排序
  const list: ExerciseListRow[] = exerciseRows.map((r) => ({
    exercise: rowToExercise({
      id: r.id,
      name: r.name,
      muscle_group: r.muscle_group,
      secondary_muscles: r.secondary_muscles,
      equipment: r.equipment,
      metric_type: r.metric_type,
      image_uri: r.image_uri,
      is_custom: r.is_custom,
      created_at: r.created_at,
      // G35 §3 — 这条 SQL 走的是历史 list,详情页才需要 i18n/GIF 字段;list 视图一律 null
      description_zh: null,
      steps_zh: null,
      gif_url: null,
      target_zh: null,
      attribution: null,
    }),
    totalTrainings: r.total_trainings,
    maxOneRm: oneRmByExercise.get(r.id) ?? 0,
  }));

  return list.sort((a, b) => {
    if (b.maxOneRm !== a.maxOneRm) return b.maxOneRm - a.maxOneRm;
    return b.totalTrainings - a.totalTrainings;
  });
}
