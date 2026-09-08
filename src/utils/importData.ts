/**
 * G31 — 数据导入（JSON 回滚）。
 *
 * G19 实现了 JSON 导出，本文件是其逆操作：把一份由 `buildBackupPayload()`
 * 生成的 JSON 还原到本地 SQLite。
 *
 * 关键设计：
 * - **全表覆盖语义**：导入 = 还原。先 DELETE 7 张表，再按 FK 安全顺序
 *   INSERT 回来。语义最简单，跟 G14「清除全部」对称；如果用户先导出
 *   再清除再导入，等于撤销清除。
 * - **校验先行**：先跑 `validateBackupPayload()`，校验失败直接 toast
 *   报错，DB 不动。校验只检查顶层结构和字段类型，不读 DB，所以廉价。
 * - **二次确认**由 UI 层（SettingsScreen）触发；本模块只负责执行。
 * - **失败抛错**：事务内任何一步失败都会回滚，调用方 catch 后 toast
 *   `导入失败:{msg}`。
 *
 * 设计决策记录：
 * - `plan_exercises.id` / `rest_seconds` 不在 G19 的 payload 里（payload 只
 *   带 planId / exerciseId / position），导入时生成新 id，rest_seconds
 *   默认 60（与 `createPlan` 一致）。
 * - `plan_sets` 也不在 payload 里（G19 导出限制）—— 不写入，让用户
 *   重新训练时由 `ActiveTrainingScreen` 落库。
 * - `settings` 走全表覆盖：遍历 `Record<string, string>` 写入。
 *   注意内置默认值（kg / 90s 等）如果备份里没带，会被恢复成"用户导出
 *   时的真实值"，与 G14 清除后回到 defaults 不同 —— 这是用户期望的。
 * - `error_logs` 全表覆盖：导入端的 errors 是用户历史环境的；保留
 *   `fingerprint` 字段（用于 30s 滑动窗口去重；详见 G23 dedup 模块）。
 */

import { getDatabase } from '@/db';
import type {
  BodyMeasurement,
  Exercise,
  ErrorLog,
  Training,
  TrainingSet,
} from '@/db/schema';

export type { BackupPayload } from './exportData';

export interface ImportCounts {
  exercises: number;
  plans: number;
  trainings: number;
  trainingSets: number;
  planExercises: number;
  settings: number;
  errorLogs: number;
  bodyMeasurements: number;
}

/* -------------------------------------------------------------------------- */
/* 校验                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * 顶层 payload 的形状（与 exportData.BackupPayload 兼容）。
 *
 * 注意：这里只列"导入端关心的最小字段"。其它字段（appVersion / exportedAt
 * / counts）即使存在也忽略 —— 它们是 metadata，对还原无影响。
 */
export interface ValidatablePayload {
  schemaVersion: 1;
  exercises: unknown;
  plans: unknown;
  planExercises: unknown;
  trainings: unknown;
  trainingSets: unknown;
  settings: unknown;
  errorLogs: unknown;
  /**
   * US-12 — 身体测量。**可选**字段：旧备份(US-12 之前的 schemaVersion=1)
   * 没这个键,导入时用空数组兜底,导入仍然成功。
   */
  bodyMeasurements?: unknown;
}

export type ValidationResult =
  | { ok: true; payload: ValidatablePayload }
  | { ok: false; error: string };

/** 顶层 7 个数据键 — 全部必须存在（值可以是空数组）。body_measurements 单独可选。 */
const REQUIRED_KEYS = [
  'exercises',
  'plans',
  'planExercises',
  'trainings',
  'trainingSets',
  'settings',
  'errorLogs',
] as const;

/**
 * 校验一份未知对象是否是合法的 G19 备份。
 * 失败时返回的 `error` 适合直接塞进 toast。
 */
export function validateBackupPayload(input: unknown): ValidationResult {
  if (input === null || typeof input !== 'object') {
    return { ok: false, error: '不是有效的备份文件（顶层不是对象）' };
  }
  const obj = input as Record<string, unknown>;

  if (obj.schemaVersion !== 1) {
    return {
      ok: false,
      error: `不支持的备份版本（schemaVersion=${String(obj.schemaVersion)}，当前仅支持 1）`,
    };
  }

  const missing = REQUIRED_KEYS.filter((k) => !(k in obj));
  if (missing.length > 0) {
    return {
      ok: false,
      error: `不是有效的备份文件（缺失字段：${missing.join('、')}）`,
    };
  }

  // 字段类型
  const checks: Array<[string, unknown]> = [
    ['exercises', obj.exercises],
    ['plans', obj.plans],
    ['planExercises', obj.planExercises],
    ['trainings', obj.trainings],
    ['trainingSets', obj.trainingSets],
    ['errorLogs', obj.errorLogs],
  ];
  for (const [key, val] of checks) {
    if (!Array.isArray(val)) {
      return {
        ok: false,
        error: `不是有效的备份文件（${key} 应为数组，实际为 ${describe(val)}）`,
      };
    }
  }

  // US-12: bodyMeasurements 是可选字段(向后兼容)。如果存在,必须是数组;
  // 缺失则补空数组,旧备份(US-12 之前导出的)能继续导入。
  if (obj.bodyMeasurements !== undefined && !Array.isArray(obj.bodyMeasurements)) {
    return {
      ok: false,
      error: `不是有效的备份文件（bodyMeasurements 应为数组，实际为 ${describe(obj.bodyMeasurements)}）`,
    };
  }

  // settings 必须是 object（不是 array、不是 string、不是 null — JS 里
  // typeof null === 'object' 所以单独判 null）
  if (
    obj.settings === null ||
    typeof obj.settings !== 'object' ||
    Array.isArray(obj.settings)
  ) {
    return {
      ok: false,
      error: `不是有效的备份文件（settings 应为对象，实际为 ${describe(obj.settings)}）`,
    };
  }

  return { ok: true, payload: obj as unknown as ValidatablePayload };
}

function describe(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return '数组';
  return typeof v;
}

/* -------------------------------------------------------------------------- */
/* 写库                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * 把 payload 全量还原到 SQLite。
 *
 * 流程（单事务）：
 *   1. 清 7 张表（按 children-first 安全顺序）
 *   2. INSERT exercises
 *   3. INSERT plans
 *   4. INSERT plan_exercises（生成新 id，rest_seconds 默认 60）
 *   5. INSERT trainings
 *   6. INSERT training_sets（按 payload 里既有的 id / trainingId）
 *   7. INSERT settings（遍历 Record<string, string>）
 *   8. INSERT error_logs（保留 fingerprint，供 G23 dedup 模块识别）
 *
 * 失败抛 Error；调用方 catch 后 toast。
 */
export async function importFromBackup(
  payload: ValidatablePayload,
): Promise<ImportCounts> {
  const db = await getDatabase();

  const counts: ImportCounts = {
    exercises: (payload.exercises as unknown[]).length,
    plans: (payload.plans as unknown[]).length,
    planExercises: (payload.planExercises as unknown[]).length,
    trainings: (payload.trainings as unknown[]).length,
    trainingSets: (payload.trainingSets as Array<{ sets: unknown[] }>).reduce(
      (sum, t) => sum + t.sets.length,
      0,
    ),
    settings: Object.keys(payload.settings as Record<string, unknown>).length,
    errorLogs: (payload.errorLogs as unknown[]).length,
    bodyMeasurements: ((payload.bodyMeasurements as unknown[] | undefined) ?? []).length,
  };

  await db.withTransactionAsync(async () => {
    // 1. 清表（children first，避免 FK 检查失败）。plan_sets / body_measurements
    //    不在旧 payload 里但也要清，避免残留。
    await db.execAsync(`
      DELETE FROM error_logs;
      DELETE FROM settings;
      DELETE FROM training_sets;
      DELETE FROM trainings;
      DELETE FROM plan_sets;
      DELETE FROM plan_exercises;
      DELETE FROM plans;
      DELETE FROM exercises;
      DELETE FROM body_measurements;
    `);

    // 2. exercises
    const exercises = payload.exercises as Exercise[];
    if (exercises.length > 0) {
      const stmt = await db.prepareAsync(
        `INSERT INTO exercises
           (id, name, muscle_group, secondary_muscles, equipment,
            metric_type, image_uri, is_custom, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      );
      try {
        for (const e of exercises) {
          await stmt.executeAsync([
            e.id,
            e.name,
            e.muscleGroup,
            JSON.stringify(e.secondaryMuscles ?? []),
            e.equipment,
            e.metricType,
            e.imageUri ?? null,
            e.isCustom ? 1 : 0,
            e.createdAt,
          ]);
        }
      } finally {
        await stmt.finalizeAsync();
      }
    }

    // 3. plans
    const plans = payload.plans as Array<{
      id: string;
      name: string;
      createdAt: number;
      updatedAt: number;
      // PlanWithCount 还有 exerciseCount；这里忽略 — 由 plan_exercises 表
      // 通过 JOIN 计算得出。
    }>;
    if (plans.length > 0) {
      const stmt = await db.prepareAsync(
        `INSERT INTO plans (id, name, created_at, updated_at) VALUES (?, ?, ?, ?);`,
      );
      try {
        for (const p of plans) {
          await stmt.executeAsync([p.id, p.name, p.createdAt, p.updatedAt]);
        }
      } finally {
        await stmt.finalizeAsync();
      }
    }

    // 4. plan_exercises — payload 没带 id，生成新 UUID；rest_seconds 默认 60。
    const planExercises = payload.planExercises as Array<{
      planId: string;
      exerciseId: string;
      position: number;
    }>;
    if (planExercises.length > 0) {
      const stmt = await db.prepareAsync(
        `INSERT INTO plan_exercises
           (id, plan_id, exercise_id, position, rest_seconds)
         VALUES (?, ?, ?, ?, 60);`,
      );
      try {
        for (const pe of planExercises) {
          await stmt.executeAsync([
            newId(),
            pe.planId,
            pe.exerciseId,
            pe.position,
          ]);
        }
      } finally {
        await stmt.finalizeAsync();
      }
    }

    // 5. trainings
    const trainings = payload.trainings as Training[];
    if (trainings.length > 0) {
      const stmt = await db.prepareAsync(
        `INSERT INTO trainings
           (id, plan_id, plan_name_snapshot, started_at, ended_at,
            duration_seconds, total_volume, exercise_count, set_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      );
      try {
        for (const t of trainings) {
          await stmt.executeAsync([
            t.id,
            t.planId,
            t.planNameSnapshot,
            t.startedAt,
            t.endedAt,
            t.durationSeconds,
            t.totalVolume,
            t.exerciseCount,
            t.setCount,
          ]);
        }
      } finally {
        await stmt.finalizeAsync();
      }
    }

    // 6. training_sets（payload 是嵌套结构：[{trainingId, sets: TrainingSet[]}]）
    const trainingSets = payload.trainingSets as Array<{
      trainingId: string;
      sets: TrainingSet[];
    }>;
    const allSets = trainingSets.flatMap((t) => t.sets);
    if (allSets.length > 0) {
      const stmt = await db.prepareAsync(
        `INSERT INTO training_sets
           (id, training_id, exercise_id, exercise_name_snapshot,
            position, set_index, weight, reps, duration_seconds, distance_km,
            set_type, completed)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      );
      try {
        for (const s of allSets) {
          await stmt.executeAsync([
            s.id,
            s.trainingId,
            s.exerciseId,
            s.exerciseNameSnapshot,
            s.position,
            s.setIndex,
            s.weight,
            s.reps,
            s.durationSeconds,
            s.distanceKm,
            s.setType,
            s.completed ? 1 : 0,
          ]);
        }
      } finally {
        await stmt.finalizeAsync();
      }
    }

    // 7. settings — Record<string, string> 走全量 upsert
    const settings = payload.settings as Record<string, string>;
    const settingKeys = Object.keys(settings);
    if (settingKeys.length > 0) {
      const stmt = await db.prepareAsync(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
      );
      try {
        for (const key of settingKeys) {
          await stmt.executeAsync([key, settings[key] ?? '']);
        }
      } finally {
        await stmt.finalizeAsync();
      }
    }

    // 8. error_logs — 保留 fingerprint 字段
    const errorLogs = payload.errorLogs as ErrorLog[];
    if (errorLogs.length > 0) {
      const stmt = await db.prepareAsync(
        `INSERT INTO error_logs
           (id, occurred_at, source, name, message, stack,
            component_stack, fingerprint, is_fatal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      );
      try {
        for (const log of errorLogs) {
          await stmt.executeAsync([
            log.id,
            log.occurredAt,
            log.source,
            log.name,
            log.message,
            log.stack,
            log.componentStack,
            log.fingerprint,
            log.isFatal ? 1 : 0,
          ]);
        }
      } finally {
        await stmt.finalizeAsync();
      }
    }

    // 9. body_measurements (US-12) — payload 可能没有这个键(旧备份),跳过
    const bodyMeasurements = (payload.bodyMeasurements as BodyMeasurement[] | undefined) ?? [];
    if (bodyMeasurements.length > 0) {
      const stmt = await db.prepareAsync(
        `INSERT INTO body_measurements
           (id, measured_date, weight_kg, body_fat_pct, note,
            created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
      );
      try {
        for (const m of bodyMeasurements) {
          await stmt.executeAsync([
            m.id,
            m.measuredDate,
            m.weightKg,
            m.bodyFatPct,
            m.note,
            m.createdAt,
            m.updatedAt,
          ]);
        }
      } finally {
        await stmt.finalizeAsync();
      }
    }
  });

  return counts;
}

/* -------------------------------------------------------------------------- */
/* helpers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Generate a random UUID. `crypto.randomUUID()` is available in modern React
 * Native (JSC + Hermes), but we keep a tiny fallback for safety on older
 * runtimes (e.g. very old Android Hermes).
 *
 * 与 seedRunner.randomUUID() 等价；这里独立一份避免 import 那个模块带来
 * 副作用（它会在模块加载时执行一些 seed 检查）。
 */
function newId(): string {
  const c = (globalThis as unknown as { crypto?: { randomUUID?: () => string } })
    .crypto;
  if (c?.randomUUID) {
    return c.randomUUID();
  }
  // RFC4122-ish fallback. Not cryptographic, but unique enough for ID purposes.
  const bytes = new Uint8Array(16);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex: string[] = [];
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i] ?? 0;
    hex.push(b.toString(16).padStart(2, '0'));
  }
  return (
    hex.slice(0, 4).join('') +
    '-' +
    hex.slice(4, 6).join('') +
    '-' +
    hex.slice(6, 8).join('') +
    '-' +
    hex.slice(8, 10).join('') +
    '-' +
    hex.slice(10, 16).join('')
  );
}
