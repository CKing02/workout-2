/**
 * G18 — 数据可视化聚合查询
 *
 * 数据来源：`trainings` + `training_sets` + `exercises`。
 * 设计：先一次性拉全量已完成训练 + 所有 set + 关联 exercise，然后 JS
 * 内存聚合，避免 N+1（按时间窗口过滤可下沉到 SQL，但本地数据量小，
 * 内存聚合更简单）。
 *
 * 聚合函数全部接收 db + 时间窗口，返回适合图表直接渲染的 POJO。
 * 边界：所有函数对"无数据"返回空数组 / 空 Map，由 UI 层决定兜底文案。
 */

import type { SQLiteDatabase } from 'expo-sqlite';

import {
  rowToExercise,
  rowToTraining,
  rowToTrainingSet,
  type Exercise,
  type Training,
  type TrainingSet,
} from '@/db/schema';

export interface JoinedSetRow {
  set: TrainingSet;
  exercise: Exercise;
  /** 训练开始时间，用于 1RM 排序"最近胜出"。 */
  trainingStartedAt: number;
}

/**
 * 拉所有「已完成」训练下的 set 行 + 关联 exercise 字段。
 * 用 LEFT JOIN 一次性拿全部所需字段，避免循环 N+1。
 */
export async function listJoinedCompletedSets(
  db: SQLiteDatabase,
): Promise<JoinedSetRow[]> {
  const rows = await db.getAllAsync<{
    // training_sets columns
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
    // exercises columns
    e_id: string;
    e_name: string;
    e_muscle_group: string;
    e_secondary_muscles: string;
    e_equipment: string;
    e_metric_type: string;
    e_image_uri: string | null;
    e_is_custom: number;
    e_created_at: number;
    // trainings columns (subset)
    t_ended_at: number | null;
    t_started_at: number;
  }>(
    `SELECT
       ts.id, ts.training_id, ts.exercise_id, ts.exercise_name_snapshot,
       ts.position, ts.set_index, ts.weight, ts.reps,
       ts.duration_seconds, ts.distance_km, ts.set_type, ts.completed,
       e.id          AS e_id,
       e.name        AS e_name,
       e.muscle_group AS e_muscle_group,
       e.secondary_muscles AS e_secondary_muscles,
       e.equipment   AS e_equipment,
       e.metric_type AS e_metric_type,
       e.image_uri   AS e_image_uri,
       e.is_custom   AS e_is_custom,
       e.created_at  AS e_created_at,
       t.ended_at    AS t_ended_at,
       t.started_at  AS t_started_at
     FROM training_sets ts
     JOIN exercises e ON e.id = ts.exercise_id
     JOIN trainings t ON t.id = ts.training_id
     WHERE ts.completed = 1 AND t.ended_at IS NOT NULL;`,
  );
  return rows.map((r) => ({
    set: rowToTrainingSet({
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
    exercise: rowToExercise({
      id: r.e_id,
      name: r.e_name,
      muscle_group: r.e_muscle_group,
      secondary_muscles: r.e_secondary_muscles,
      equipment: r.e_equipment,
      metric_type: r.e_metric_type,
      image_uri: r.e_image_uri,
      is_custom: r.e_is_custom,
      created_at: r.e_created_at,
      // G35 §3 — 历史聚合视图不展示 i18n/GIF,一律 null
      description_zh: null,
      steps_zh: null,
      gif_url: null,
      target_zh: null,
      attribution: null,
    }),
    trainingStartedAt: r.t_started_at,
  }));
}

/**
 * 拉全部「已完成」训练。
 */
export async function listCompletedTrainings(
  db: SQLiteDatabase,
): Promise<Training[]> {
  const rows = await db.getAllAsync<{
    id: string;
    plan_id: string | null;
    plan_name_snapshot: string | null;
    started_at: number;
    ended_at: number | null;
    duration_seconds: number | null;
    total_volume: number | null;
    exercise_count: number | null;
    set_count: number | null;
  }>(
    `SELECT * FROM trainings WHERE ended_at IS NOT NULL ORDER BY started_at DESC;`,
  );
  return rows.map((r) =>
    rowToTraining({
      id: r.id,
      plan_id: r.plan_id,
      plan_name_snapshot: r.plan_name_snapshot,
      started_at: r.started_at,
      ended_at: r.ended_at,
      duration_seconds: r.duration_seconds,
      total_volume: r.total_volume,
      exercise_count: r.exercise_count,
      set_count: r.set_count,
    }),
  );
}

/**
 * 本地日期字符串 `YYYY-MM-DD`（用于按日聚合键）。
 * 用本地时区切分，避免 UTC 跨日错误。
 */
export function dayKey(ms: number): string {
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** 一周从周一开始；返回该周周一 00:00 的毫秒时间戳。 */
export function weekStartMs(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun..6=Sat
  const diffToMonday = (day + 6) % 7; // Mon=0, Tue=1, ..., Sun=6
  d.setDate(d.getDate() - diffToMonday);
  return d.getTime();
}

/** 周键 `YYYY-MM-DD`（周一的本地日期）。 */
export function weekKey(ms: number): string {
  return dayKey(weekStartMs(ms));
}

/* -------------------------------------------------------------------------- */
/* Aggregations                                                               */
/* -------------------------------------------------------------------------- */

export interface DailyVolume {
  /** YYYY-MM-DD 本地日期。 */
  day: string;
  /** 该日所有训练累加的 total_volume。 */
  volume: number;
}

/**
 * 按日聚合训练量。`trainings.total_volume` 已经包含该训练所有 weight × reps，
 * 直接 SUM 即可。注意：`time` / `km` 类型不计入 totalVolume（与 G8 computeStats
 * 保持一致：仅 weight × reps 计入），所以这套聚合只反映「阻力训练量」。
 */
export function aggregateDailyVolume(trainings: Training[]): DailyVolume[] {
  const map = new Map<string, number>();
  for (const t of trainings) {
    if (t.endedAt === null || t.totalVolume === null) continue;
    const key = dayKey(t.startedAt);
    map.set(key, (map.get(key) ?? 0) + t.totalVolume);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, volume]) => ({ day, volume }));
}

export interface WeeklyVolume {
  /** YYYY-MM-DD（该周周一）。 */
  week: string;
  volume: number;
}

export function aggregateWeeklyVolume(trainings: Training[]): WeeklyVolume[] {
  const map = new Map<string, number>();
  for (const t of trainings) {
    if (t.endedAt === null || t.totalVolume === null) continue;
    const key = weekKey(t.startedAt);
    map.set(key, (map.get(key) ?? 0) + t.totalVolume);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, volume]) => ({ week, volume }));
}

export interface MuscleGroupSlice {
  muscleGroup: string;
  volume: number;
}

/**
 * 按主要肌群聚合训练量。基于 joined set 行：用每组的 `weight × reps` 加和
 * （与 training.total_volume 算法一致；JOIN 后能拿到每个 set 对应的肌群）。
 */
export function aggregateMuscleGroup(
  joined: JoinedSetRow[],
): MuscleGroupSlice[] {
  const map = new Map<string, number>();
  for (const r of joined) {
    const w = r.set.weight ?? 0;
    const reps = r.set.reps ?? 0;
    if (w <= 0 || reps <= 0) continue;
    map.set(r.exercise.muscleGroup, (map.get(r.exercise.muscleGroup) ?? 0) + w * reps);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([muscleGroup, volume]) => ({ muscleGroup, volume }));
}

export interface OneRMRecord {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string;
  /** Epley 公式：1RM ≈ weight × (1 + reps / 30)。 */
  oneRm: number;
  /** 取得该 1RM 的 weight。 */
  weight: number;
  /** 取得该 1RM 的 reps。 */
  reps: number;
  /** 该 1RM 出现的训练 startedAt（最近的胜出）。 */
  achievedAt: number;
}

/**
 * 估算每个动作的最高 1RM：基于 Epley 公式 weight × (1 + reps / 30)。
 * reps === 1 时直接返回 weight；reps === 0 时跳过。
 * 同动作出现多组同等 1RM 时，取最近一次（用 `achievedAt` 比较）。
 */
export function aggregateOneRM(joined: JoinedSetRow[]): OneRMRecord[] {
  const map = new Map<string, OneRMRecord>();
  for (const r of joined) {
    const w = r.set.weight ?? 0;
    const reps = r.set.reps ?? 0;
    if (w <= 0 || reps <= 0) continue;
    const oneRm = w * (1 + reps / 30);
    const existing = map.get(r.exercise.id);
    if (!existing || oneRm > existing.oneRm) {
      map.set(r.exercise.id, {
        exerciseId: r.exercise.id,
        exerciseName: r.exercise.name,
        muscleGroup: r.exercise.muscleGroup,
        oneRm,
        weight: w,
        reps,
        achievedAt: r.trainingStartedAt,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.oneRm - a.oneRm);
}