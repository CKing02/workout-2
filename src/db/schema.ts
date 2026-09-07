/**
 * SQLite schema (附录 A).
 *
 * 6 张表：exercises / plans / plan_exercises / trainings / training_sets / settings。
 * 所有 ID 使用 TEXT PRIMARY KEY，由 `crypto.randomUUID()` 生成。
 *
 * 设计决策（与 PRD / GOALS 一致；偏离处见 migrations 注释）：
 * - `trainings.plan_id` 可空：支持 G11 自由训练（不关联计划）。
 * - `training_sets` 上 `(training_id)` 自动 cascade 删除。
 * - `plan_exercises.plan_id` 自动 cascade 删除。
 * - `secondary_muscles` 用 JSON 字符串存（SQLite 没有数组类型）。
 *
 * ⚠️ G2 阶段不启用外键约束（PRAGMA foreign_keys = ON 在 index.ts 显式打开）。
 * 启用后 cascade 才生效，repository 实现依赖此行为。
 */

import type { SQLiteDatabase } from 'expo-sqlite';

/** 表的原始行结构（来自 SQLite），类型可能宽松。 */
export interface ExerciseRow {
  id: string;
  name: string;
  muscle_group: string;
  secondary_muscles: string; // JSON array
  equipment: string;
  metric_type: string;
  image_uri: string | null;
  is_custom: number; // 0 | 1
  created_at: number;
}

export interface PlanRow {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
}

export interface PlanExerciseRow {
  id: string;
  plan_id: string;
  exercise_id: string;
  position: number;
  rest_seconds: number;
}

/**
 * Per-plan_exercise set preset. G24a: persisted to DB (was MVP-未落库 before).
 * G24a follow-up: also stores `weight` + `reps` as the **plan-level
 * prescription** ("10kg × 10 reps" template). G6's "数据不预填" still
 * applies — at *training* time the user re-enters the actual numbers
 * (which may differ from the plan) and those land in `training_sets`.
 * `plan_sets.weight/reps` are the planned values, persisted across
 * restarts so the user doesn't lose their template.
 */
export interface PlanSetRow {
  id: string;
  plan_exercise_id: string;
  set_index: number;
  set_type: string;
  weight: number;
  reps: number;
}

export interface TrainingRow {
  id: string;
  plan_id: string | null;
  plan_name_snapshot: string | null;
  started_at: number;
  ended_at: number | null;
  duration_seconds: number | null;
  total_volume: number | null;
  exercise_count: number | null;
  set_count: number | null;
}

export interface TrainingSetRow {
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
  set_type: string; // normal | warmup | dropout | failure
  completed: number; // 0 | 1
}

export interface SettingRow {
  key: string;
  value: string;
}

/** In-app captured error row. Populated by `installErrorHandlers()`. */
export interface ErrorLogRow {
  id: string;
  occurred_at: number;
  source: string; // 'js' | 'promise'
  name: string | null;
  message: string;
  stack: string | null;
  component_stack: string | null;
  fingerprint: string;
  is_fatal: number; // 0 | 1
}

/** Domain-friendly 视图（自动解 JSON）。 */
export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  secondaryMuscles: string[];
  equipment: string;
  metricType: string;
  imageUri: string | null;
  isCustom: boolean;
  createdAt: number;
}

export function rowToExercise(row: ExerciseRow): Exercise {
  let secondary: string[] = [];
  try {
    const parsed = JSON.parse(row.secondary_muscles);
    if (Array.isArray(parsed)) {
      secondary = parsed.filter((v): v is string => typeof v === 'string');
    }
  } catch {
    secondary = [];
  }
  return {
    id: row.id,
    name: row.name,
    muscleGroup: row.muscle_group,
    secondaryMuscles: secondary,
    equipment: row.equipment,
    metricType: row.metric_type,
    imageUri: row.image_uri,
    isCustom: row.is_custom === 1,
    createdAt: row.created_at,
  };
}

export interface PlanExercise {
  id: string;
  planId: string;
  exerciseId: string;
  position: number;
  /** Per-exercise rest interval in seconds. Defaults to 60. */
  restSeconds: number;
}

export function rowToPlanExercise(row: PlanExerciseRow): PlanExercise {
  return {
    id: row.id,
    planId: row.plan_id,
    exerciseId: row.exercise_id,
    position: row.position,
    restSeconds: row.rest_seconds,
  };
}

/** In-app shape for a set preset (camelCase + normalized). */
export interface PlanSet {
  id: string;
  planExerciseId: string;
  setIndex: number;
  setType: 'normal' | 'warmup' | 'dropout' | 'failure';
  /** Planned weight (kg stored unit). 0 = not specified. */
  weight: number;
  /** Planned rep count. 0 = not specified. */
  reps: number;
}

export function rowToPlanSet(row: PlanSetRow): PlanSet {
  return {
    id: row.id,
    planExerciseId: row.plan_exercise_id,
    setIndex: row.set_index,
    setType: row.set_type as PlanSet['setType'],
    weight: row.weight,
    reps: row.reps,
  };
}

export interface PlanWithExercises {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  exercises: PlanExerciseWithDetail[];
}

export interface PlanExerciseWithDetail extends PlanExercise {
  exercise: Exercise;
  /** Per-exercise set presets (count + type). Empty array = no sets configured yet. */
  sets: PlanSet[];
}

export interface Training {
  id: string;
  planId: string | null;
  planNameSnapshot: string | null;
  startedAt: number;
  endedAt: number | null;
  durationSeconds: number | null;
  totalVolume: number | null;
  exerciseCount: number | null;
  setCount: number | null;
}

export function rowToTraining(row: TrainingRow): Training {
  return {
    id: row.id,
    planId: row.plan_id,
    planNameSnapshot: row.plan_name_snapshot,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationSeconds: row.duration_seconds,
    totalVolume: row.total_volume,
    exerciseCount: row.exercise_count,
    setCount: row.set_count,
  };
}

export interface TrainingSet {
  id: string;
  trainingId: string;
  exerciseId: string;
  exerciseNameSnapshot: string;
  position: number;
  setIndex: number;
  weight: number | null;
  reps: number | null;
  durationSeconds: number | null;
  distanceKm: number | null;
  setType: string;
  completed: boolean;
}

export function rowToTrainingSet(row: TrainingSetRow): TrainingSet {
  return {
    id: row.id,
    trainingId: row.training_id,
    exerciseId: row.exercise_id,
    exerciseNameSnapshot: row.exercise_name_snapshot,
    position: row.position,
    setIndex: row.set_index,
    weight: row.weight,
    reps: row.reps,
    durationSeconds: row.duration_seconds,
    distanceKm: row.distance_km,
    setType: row.set_type,
    completed: row.completed === 1,
  };
}

/**
 * 建表 SQL。`IF NOT EXISTS` 保证幂等；migrations 仍走 `user_version`。
 */
export const CREATE_TABLE_SQL: string[] = [
  `CREATE TABLE IF NOT EXISTS exercises (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     muscle_group TEXT NOT NULL,
     secondary_muscles TEXT NOT NULL DEFAULT '[]',
     equipment TEXT NOT NULL,
     metric_type TEXT NOT NULL,
     image_uri TEXT,
     is_custom INTEGER NOT NULL DEFAULT 0,
     created_at INTEGER NOT NULL
   );`,

  `CREATE TABLE IF NOT EXISTS plans (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     created_at INTEGER NOT NULL,
     updated_at INTEGER NOT NULL
   );`,

  `CREATE TABLE IF NOT EXISTS plan_exercises (
     id TEXT PRIMARY KEY,
     plan_id TEXT NOT NULL,
     exercise_id TEXT NOT NULL,
     position INTEGER NOT NULL,
     rest_seconds INTEGER NOT NULL DEFAULT 60,
     FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE,
     FOREIGN KEY (exercise_id) REFERENCES exercises(id)
   );`,

  `CREATE INDEX IF NOT EXISTS idx_plan_exercises_plan_id ON plan_exercises(plan_id);`,

  `CREATE TABLE IF NOT EXISTS plan_sets (
     id TEXT PRIMARY KEY,
     plan_exercise_id TEXT NOT NULL,
     set_index INTEGER NOT NULL,
     set_type TEXT NOT NULL DEFAULT 'normal',
     weight REAL NOT NULL DEFAULT 0,
     reps INTEGER NOT NULL DEFAULT 0,
     FOREIGN KEY (plan_exercise_id) REFERENCES plan_exercises(id) ON DELETE CASCADE
   );`,

  `CREATE INDEX IF NOT EXISTS idx_plan_sets_plan_exercise_id ON plan_sets(plan_exercise_id);`,

  `CREATE TABLE IF NOT EXISTS trainings (
     id TEXT PRIMARY KEY,
     plan_id TEXT,
     plan_name_snapshot TEXT,
     started_at INTEGER NOT NULL,
     ended_at INTEGER,
     duration_seconds INTEGER,
     total_volume REAL,
     exercise_count INTEGER,
     set_count INTEGER
   );`,

  `CREATE INDEX IF NOT EXISTS idx_trainings_started_at ON trainings(started_at DESC);`,

  `CREATE TABLE IF NOT EXISTS training_sets (
     id TEXT PRIMARY KEY,
     training_id TEXT NOT NULL,
     exercise_id TEXT NOT NULL,
     exercise_name_snapshot TEXT NOT NULL,
     position INTEGER NOT NULL,
     set_index INTEGER NOT NULL,
     weight REAL,
     reps INTEGER,
     duration_seconds INTEGER,
     distance_km REAL,
     set_type TEXT NOT NULL DEFAULT 'normal',
     completed INTEGER NOT NULL DEFAULT 0,
     FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE,
     FOREIGN KEY (exercise_id) REFERENCES exercises(id)
   );`,

  `CREATE INDEX IF NOT EXISTS idx_training_sets_training_id ON training_sets(training_id);`,

  `CREATE TABLE IF NOT EXISTS settings (
     key TEXT PRIMARY KEY,
     value TEXT NOT NULL
   );`,

  `CREATE TABLE IF NOT EXISTS error_logs (
     id TEXT PRIMARY KEY,
     occurred_at INTEGER NOT NULL,
     source TEXT NOT NULL,
     name TEXT,
     message TEXT NOT NULL,
     stack TEXT,
     component_stack TEXT,
     fingerprint TEXT NOT NULL,
     is_fatal INTEGER NOT NULL DEFAULT 0
   );`,

  `CREATE INDEX IF NOT EXISTS idx_error_logs_occurred_at ON error_logs(occurred_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_error_logs_fingerprint ON error_logs(fingerprint);`,
];

/**
 * 在 initDatabase() 启动时一次性执行。WAL 模式允许读写并发，写入性能更好。
 */
export async function applyCreateTables(db: SQLiteDatabase): Promise<void> {
  for (const sql of CREATE_TABLE_SQL) {
    await db.execAsync(sql);
  }
}

/**
 * 关闭外键 / 打开外键；CASCADE 删除依赖此设置。
 */
export async function configurePragmas(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');
}

/* -------------------------------------------------------------------------- */
/* error_logs — captured JS / Promise-rejection errors                       */
/* -------------------------------------------------------------------------- */

export interface ErrorLog {
  id: string;
  occurredAt: number;
  source: 'js' | 'promise' | 'console';
  name: string | null;
  message: string;
  stack: string | null;
  componentStack: string | null;
  fingerprint: string;
  isFatal: boolean;
}

/** Truncate long messages/stacks so one bad row can't fill the DB. */
const MESSAGE_MAX = 2048;
const STACK_MAX = 8192;

export function rowToErrorLog(row: ErrorLogRow): ErrorLog {
  const source: 'js' | 'promise' | 'console' =
    row.source === 'promise'
      ? 'promise'
      : row.source === 'console'
      ? 'console'
      : 'js';
  return {
    id: row.id,
    occurredAt: row.occurred_at,
    source,
    name: row.name,
    message: row.message.slice(0, MESSAGE_MAX),
    stack: row.stack ? row.stack.slice(0, STACK_MAX) : null,
    componentStack: row.component_stack,
    fingerprint: row.fingerprint,
    isFatal: row.is_fatal === 1,
  };
}
