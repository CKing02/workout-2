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
 * - `plan_exercises.id` 始终是新生成的 UUID（v1/v2 都一样）—— 它是纯代理键，
 *   除了被 plan_sets 引用之外没有对外含义，重建比映射便宜。
 * - **计划处方（v2，2026-10-01 修 §13.1）**：`rest_seconds` 和该 link 的
 *   `plan_sets` 组处方内嵌在 `payload.planExercises[].sets` 里，导入端拿着
 *   刚 `newId()` 出来的 id 立刻写进去 —— 零 id 映射、零查找。
 *   v2 之前这两样压根不在 payload 里，而本流程开头就 `DELETE FROM plan_sets`
 *   → 「导出 → 导入」把用户配的 60kg×10 和休息时间静默抹成默认值（净破坏）。
 * - **v1 老备份仍可导入**：`restSeconds` / `sets` 缺字段就降级 ——
 *   rest_seconds 落 60、该 link 不写组，不抛错。
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

import type { BackupPlanSet } from './exportData';

export type { BackupPayload, BackupPlanSet } from './exportData';

/** 创建计划时的默认组间休息（与 planRepo.DEFAULT_REST_SECONDS 一致）。 */
const DEFAULT_REST_SECONDS = 60;

export interface ImportCounts {
  exercises: number;
  plans: number;
  trainings: number;
  trainingSets: number;
  planExercises: number;
  /** 还原回来的计划处方组数（v2 payload 才 > 0）。 */
  planSets: number;
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
  /**
   * v1 = G19 原始格式（planExercises 只有 planId/exerciseId/position）。
   * v2 = 2026-10-01 起，planExercises 每项带 restSeconds + sets[]。
   * v3 = trainingSets 带 metricTypeSnapshot。
   * 三种都接受 —— 老备份文件必须还能导入。
   */
  schemaVersion: 1 | 2 | 3;
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

/**
 * `plan_exercises` 的一条 link + 它的计划处方。
 *
 * `restSeconds` / `sets` 都是**可选**的：v1 老备份没有这两个键，
 * 导入端降级成 60 / 空组，不抛错（见下方第 4 步）。
 */
interface PlanExercisePayload {
  planId: string;
  exerciseId: string;
  position: number;
  restSeconds?: number;
  sets?: BackupPlanSet[];
}

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

  // 严格 === 数字（'1' 这种字符串不算）。v3 是当前格式，v1/v2 保留兼容：
  // 用户手里可能还存着升级前导出的 .json，不能因为版本号旧就拒收。
  if (
    obj.schemaVersion !== 1 &&
    obj.schemaVersion !== 2 &&
    obj.schemaVersion !== 3
  ) {
    return {
      ok: false,
      error: `不支持的备份版本（schemaVersion=${String(obj.schemaVersion)}，当前支持 1 / 2 / 3）`,
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
 *   1. 清 8 张表（按 children-first 安全顺序）
 *   2. INSERT exercises
 *   3. INSERT plans
 *   4. INSERT plan_exercises（生成新 id，rest_seconds 取 payload）+ 同轮 INSERT plan_sets
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

  const planExercises = (payload.planExercises as unknown[]).map(
    (pe) => pe as PlanExercisePayload,
  );

  const counts: ImportCounts = {
    exercises: (payload.exercises as unknown[]).length,
    plans: (payload.plans as unknown[]).length,
    planExercises: planExercises.length,
    // v1 老备份没有 sets 字段 → 0。
    planSets: planExercises.reduce((sum, pe) => sum + (pe.sets?.length ?? 0), 0),
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
    // 1. 清表（children first，避免 FK 检查失败）。
    //    plan_sets 也在 payload 里（v2 内嵌在 planExercises），但仍然是「先清后写」：
    //    全表覆盖语义要求旧数据不能残留 —— 第 4 步会把 payload 里的组重新插回去。
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
    const metricTypeByExerciseId = new Map(
      exercises.map((exercise) => [exercise.id, exercise.metricType]),
    );
    if (exercises.length > 0) {
      // ⚠️ G35 的 5 列必须一起写（2026-09-30 真机发现）。
      //
      // 导出端 dump 的是 `Exercise` 视图，**带** descriptionZh / stepsZh /
      // gifUrl / targetZh / attribution（见 exportData.ts 的 `exercises: Exercise[]`
      // 与备份 JSON）。而这里原来只 INSERT 9 列 —— 导出带了、导入不写。
      // 又因为导入流程开头就 `DELETE FROM exercises`，所以「导出 → 导入」=
      // **净破坏**：306 个动作的中文说明、步骤、GIF、版权归属全部落成 NULL。
      //
      // 症状极具迷惑性：动作名、肌群、器械都在（那 9 列有），只有详情页的
      // 说明和动作库/训练页的 GIF 变空 → 看起来像「网络挂了 / CDN 挂了 /
      // 缓存坏了」，实际是 DB 里 `gif_url` 整列为 NULL，App 压根没有 URL 可请求。
      // 排查时值得记住的判据：`SELECT COUNT(*) FROM exercises WHERE gif_url IS NULL`
      // 拿到全量数字（而不是少数几条），就该怀疑导入，而不是怀疑网络。
      const stmt = await db.prepareAsync(
        `INSERT INTO exercises
           (id, name, muscle_group, secondary_muscles, equipment,
            metric_type, image_uri, is_custom, created_at,
            description_zh, steps_zh, gif_url, target_zh, attribution)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
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
            // steps_zh 在 DB 里是 JSON 数组字符串（schema.ts 的 rowToExercise 反解）
            e.descriptionZh ?? null,
            e.stepsZh ? JSON.stringify(e.stepsZh) : null,
            e.gifUrl ?? null,
            e.targetZh ?? null,
            e.attribution ?? null,
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

    // 4. plan_exercises + plan_sets — id 是新生成的 UUID，组处方内嵌在 pe 上。
    //
    // ⚠️ 2026-10-01 之前这里有两处净破坏（§13.1）：
    //   a) `VALUES (..., 60)` 把 rest_seconds 写死成常量，用户改过的休息时间被抹平；
    //   b) 内嵌组处方压根没写，而流程开头就 `DELETE FROM plan_sets`
    //      → 用户配的「60kg × 10」和组类型全丢，且全程无报错。
    // 现在 rest_seconds 取 payload 值、sets 跟着新 id 一起插。改动前先看
    // importDataDbWrite.test.ts 的 plan_sets 用例。
    if (planExercises.length > 0) {
      const peStmt = await db.prepareAsync(
        `INSERT INTO plan_exercises
           (id, plan_id, exercise_id, position, rest_seconds)
         VALUES (?, ?, ?, ?, ?);`,
      );
      const setStmt = await db.prepareAsync(
        `INSERT INTO plan_sets
           (id, plan_exercise_id, set_index, set_type, weight, reps,
            duration_seconds, distance_km)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      );
      try {
        for (const pe of planExercises) {
          // 新 id 先生成出来，同一轮里立刻用来写这个 link 的组 ——
          // 顺序天然对齐，不需要「旧 id → 新 id」映射表。
          const planExerciseId = newId();
          await peStmt.executeAsync([
            planExerciseId,
            pe.planId,
            pe.exerciseId,
            pe.position,
            // v1 老备份没有这个字段 → 回落到 createPlan 的默认值。
            pe.restSeconds ?? DEFAULT_REST_SECONDS,
          ]);

          const sets = pe.sets ?? [];
          for (let i = 0; i < sets.length; i++) {
            const s = sets[i];
            await setStmt.executeAsync([
              newId(),
              planExerciseId,
              // set_index 缺失时按数组下标补 1..N，保证组序连续。
              s.setIndex ?? i + 1,
              s.setType ?? 'normal',
              s.weight ?? 0,
              s.reps ?? 0,
              s.durationSeconds ?? 0,
              s.distanceKm ?? 0,
            ]);
          }
        }
      } finally {
        await peStmt.finalizeAsync();
        await setStmt.finalizeAsync();
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
           (id, training_id, exercise_id, exercise_name_snapshot, metric_type_snapshot,
            position, set_index, weight, reps, duration_seconds, distance_km,
            set_type, completed)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      );
      try {
        for (const s of allSets) {
          await stmt.executeAsync([
            s.id,
            s.trainingId,
            s.exerciseId,
            s.exerciseNameSnapshot,
            s.metricTypeSnapshot ?? metricTypeByExerciseId.get(s.exerciseId) ?? null,
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
