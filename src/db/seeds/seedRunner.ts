/**
 * Seeds: write built-in exercises if `exercises` table is empty.
 *
 * Idempotent: runs once per "fresh install". User-created (`is_custom=1`)
 * rows survive across calls — only seeds when count == 0.
 *
 * G35 §3+: 新装 → 走 `seedExercisesIfEmpty` 完整 INSERT(带 5 字段)。
 * 老装 → 走 `backfillExerciseI18n` 按 name UPDATE,把 5 字段补到老行
 * (老行是 G2 时代写入的,只有 9 列)。
 */

import type { SQLiteDatabase } from 'expo-sqlite';

import { EXERCISE_SEEDS, toExerciseRows } from './exercises';

/**
 * Generate a random UUID. `crypto.randomUUID()` is available in modern React
 * Native (JSC + Hermes), but we keep a tiny fallback for safety on older
 * runtimes (e.g. very old Android Hermes).
 */
function randomUUID(): string {
  // Prefer global crypto if available.
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
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1
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

export async function seedExercisesIfEmpty(db: SQLiteDatabase): Promise<number> {
  const existing = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM exercises WHERE is_custom = 0;',
  );
  const existingCount = existing?.count ?? 0;
  if (existingCount > 0) {
    return 0;
  }

  const now = Date.now();
  const rows = toExerciseRows(now);
  const ids = rows.map(() => randomUUID());

  await db.withTransactionAsync(async () => {
    const stmt = await db.prepareAsync(
      `INSERT INTO exercises
        (id, name, muscle_group, secondary_muscles, equipment, metric_type, image_uri, is_custom, created_at,
         description_zh, steps_zh, gif_url, target_zh, attribution)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    );
    try {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const id = ids[i];
        if (!row || !id) continue;
        await stmt.executeAsync([
          id,
          row.name,
          row.muscle_group,
          row.secondary_muscles,
          row.equipment,
          row.metric_type,
          row.image_uri,
          row.is_custom,
          row.created_at,
          row.description_zh,
          row.steps_zh,
          row.gif_url,
          row.target_zh,
          row.attribution,
        ]);
      }
    } finally {
      await stmt.finalizeAsync();
    }
  });

  return rows.length;
}

/**
 * G35 §3 老装兼容:按 name 把 5 字段 UPDATE 到已有 seed 行。
 *
 * 触发条件:seedExercisesIfEmpty 检测到 32 条非 custom 行已经存在(老装)。
 * 老行没有 description_zh/steps_zh/gif_url/target_zh/attribution,所以
 * detailScreen 看到 null → fallback。
 *
 * UPDATE 规则:
 *  - 匹配 `name = ?` AND `is_custom = 0`(老装可能是老 G2 时代写的 user-created?不会,user-created 走 createExercise,is_custom=1)
 *  - `WHERE (description_zh IS NULL OR steps_zh IS NULL OR gif_url IS NULL)` —
 *    已经填过的行不动,idempotent
 *  - `created_at` 不动(G2 原时间戳保留)
 *
 * 返回:实际 UPDATE 行数(0 表示全部已填过,新装;N 表示补了 N 行)。
 */
export async function backfillExerciseI18n(db: SQLiteDatabase): Promise<number> {
  const rows = toExerciseRows(Date.now());
  let updated = 0;
  await db.withTransactionAsync(async () => {
    const stmt = await db.prepareAsync(
      `UPDATE exercises
         SET description_zh = ?, steps_zh = ?, gif_url = ?, target_zh = ?, attribution = ?
       WHERE name = ? AND is_custom = 0
         AND (description_zh IS NULL OR steps_zh IS NULL OR gif_url IS NULL);`,
    );
    try {
      for (const row of rows) {
        const result = await stmt.executeAsync([
          row.description_zh,
          row.steps_zh,
          row.gif_url,
          row.target_zh,
          row.attribution,
          row.name,
        ]);
        updated += result.changes;
      }
    } finally {
      await stmt.finalizeAsync();
    }
  });
  return updated;
}

/**
 * Expose the seed count for tests / debug.
 */
export const EXPECTED_SEED_COUNT = EXERCISE_SEEDS.length;

/**
 * 纯函数:计算应该被 INSERT 的差量 seed 行。
 *
 * 用途:G41 扩种(52 → 306)。`seedExercisesIfEmpty` 只在空表上跑全量 INSERT,
 * 老装(已有 52 条 seed 行)升级时它会 return 0,导致新增的 254 个 bundled:false
 * 动作永远进不了 DB。本函数接受当前 DB 里已存在的 seed name 集合,
 * 返回 `EXERCISE_SEEDS` 中 **不在该集合里** 的行,让
 * `upgradeExerciseSeedIfMissing` 走差量 INSERT。
 *
 * 设计取舍:
 *  - 纯函数 → 可 jest 单测(不连 SQLite,见 seedRunnerUpgrade.test.ts)。
 *  - 不读 PDF,只比对 name(老装可能重命名过 seed 行?UI 没这入口,改名风险 0)。
 *    若未来放开,改成比对 `id`(mapping.hasaneyldrmId)更稳。
 *  - 返回值 timestamp 用调用方传入的 `now`,方便测试断言时间戳。
 */
export function filterMissingSeedRows(
  existingNames: ReadonlySet<string>,
  now: number,
): Omit<ReturnType<typeof toExerciseRows>[number], 'id'>[] {
  return toExerciseRows(now).filter((r) => !existingNames.has(r.name));
}

/**
 * G41 升级路径:把 EXERCISE_SEEDS 里有、但 DB 里还没的 seed 行 INSERT 进去。
 *
 * 触发:v10 migration(老装 user_version=9 → 10 时跑一次)。
 * 也可能在 wipeAllData 之后被 seedExercisesIfEmpty "全量路径" 取代。
 *
 * 幂等:三段 status:
 *  - 新装空表 → SELECT 返回 [] → INSERT 全部 306(v10 接管"全量插入"职责)。
 *  - 老装 52 行 → SELECT 返回 52 name → INSERT 差量 254 → DB 到 306。
 *  - 已升级 306 行 → SELECT 返回 306 name → INSERT 0 → no-op。
 *
 * 不动 is_custom=1 的用户自定义行(SELECT 用 `WHERE is_custom = 0` 过滤)。
 *
 * ⚠️ 不要在本函数内再开 `withTransactionAsync`!
 * expo-sqlite 14 的 `withTransactionAsync` 实现是裸 `BEGIN`(不是 SAVEPOINT,
 * 见 node_modules/expo-sqlite/build/SQLiteDatabase.js:120)。本函数从
 * `runMigrations` 调用时,**外层 v10 migration 已经在事务里**;再开嵌套事务
 * 会触发 SQLite "cannot start a transaction within a transaction",且内层
 * catch 的 ROLLBACK 会把外层也回滚掉,导致整条 migration 抛错 → handleDbInit
 * 没 catch → unhandled rejection → 进程崩溃(G41 闪退根因)。
 *
 * 返回:实际 INSERT 行数。
 */
export async function upgradeExerciseSeedIfMissing(
  db: SQLiteDatabase,
): Promise<number> {
  const existing = await db.getAllAsync<{ name: string }>(
    'SELECT name FROM exercises WHERE is_custom = 0;',
  );
  const existingNames = new Set(existing.map((r) => r.name));
  const missing = filterMissingSeedRows(existingNames, Date.now());
  if (missing.length === 0) {
    return 0;
  }

  const ids = missing.map(() => randomUUID());

  // 外层(运行 Migrations 的 caller)已开事务。这里**绝对不要再 withTransactionAsync**。
  // v9 run() 用 db.runAsync 直接跑就是同款模式。
  const stmt = await db.prepareAsync(
    `INSERT INTO exercises
      (id, name, muscle_group, secondary_muscles, equipment, metric_type, image_uri, is_custom, created_at,
       description_zh, steps_zh, gif_url, target_zh, attribution)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
  );
  try {
    for (let i = 0; i < missing.length; i++) {
      const row = missing[i];
      const id = ids[i];
      if (!row || !id) continue;
      await stmt.executeAsync([
        id,
        row.name,
        row.muscle_group,
        row.secondary_muscles,
        row.equipment,
        row.metric_type,
        row.image_uri,
        row.is_custom,
        row.created_at,
        row.description_zh,
        row.steps_zh,
        row.gif_url,
        row.target_zh,
        row.attribution,
      ]);
    }
  } finally {
    await stmt.finalizeAsync();
  }

  return missing.length;
}
