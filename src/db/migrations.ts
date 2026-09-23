/**
 * Schema migration runner.
 *
 * 使用 SQLite 内置 `user_version` pragma 记录当前 schema 版本：
 * - 启动时读取 `user_version`，与本地 `CURRENT_VERSION` 对比
 * - 顺序执行所有未跑过的 migration（一个 migration = 一段 SQL）
 * - 每个 migration 结束将 `user_version += 1`
 *
 * G2 阶段：版本 = 1（初始建表）。后续 G3+ 修改 schema 时追加到 `MIGRATIONS`。
 */

import type { SQLiteDatabase } from 'expo-sqlite';

import { EXERCISE_G35_MAPPING } from './seeds/exerciseG35Mapping';
import { upgradeExerciseCdnUrls, upgradeExerciseSeedIfMissing } from './seeds/seedRunner';
import { applyCreateTables, configurePragmas } from './schema';

interface Migration {
  /** 单调递增的版本号（与 user_version 对应）。 */
  version: number;
  /** 一段 SQL。失败会抛出 → 整体回滚（user_version 不会被改写）。 */
  sql: string;
  /**
   * 自定义 runner。用于 v3/v5/v6 这种 ALTER TABLE ADD COLUMN 重复列的迁移
   * —— safeAddColumn 内部吞掉 duplicate column name。给 sql 就走 execAsync,
   * 给 run 就走自定义(避免把 runner 函数序列化成 SQL 字符串)。
   */
  run?: (db: SQLiteDatabase) => Promise<void>;
  /** 描述。仅用于开发时日志。 */
  description: string;
}

/**
 * Migration 列表。按 version 升序。
 * - version 1：建表 + 索引（WAL + foreign_keys 在 configurePragmas 中处理）。
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    description: 'Initial schema: 6 tables + indexes + JSON columns.',
    sql: '-- placeholder; actual statements run via applyCreateTables',
  },
  {
    version: 2,
    description: 'Add error_logs table for in-app diagnostics.',
    sql: '-- placeholder; CREATE TABLE IF NOT EXISTS runs via applyCreateTables',
  },
  {
    version: 3,
    description: 'Add plan_exercises.rest_seconds (per-exercise rest interval, default 60s).',
    sql: 'ALTER TABLE plan_exercises ADD COLUMN rest_seconds INTEGER NOT NULL DEFAULT 60;',
    run: async (db) => {
      await safeAddColumn(
        db,
        'plan_exercises',
        'rest_seconds',
        'INTEGER NOT NULL DEFAULT 60',
      );
    },
  },
  {
    version: 4,
    description: 'Add plan_sets table for per-exercise set presets (G24a: persist 组数 + 类型).',
    sql: `CREATE TABLE IF NOT EXISTS plan_sets (
            id TEXT PRIMARY KEY,
            plan_exercise_id TEXT NOT NULL,
            set_index INTEGER NOT NULL,
            set_type TEXT NOT NULL DEFAULT 'normal',
            FOREIGN KEY (plan_exercise_id) REFERENCES plan_exercises(id) ON DELETE CASCADE
          );
          CREATE INDEX IF NOT EXISTS idx_plan_sets_plan_exercise_id ON plan_sets(plan_exercise_id);`,
  },
  {
    version: 5,
    description: 'Add plan_sets.weight + plan_sets.reps (G24a: persist prescription values, not just count/type).',
    sql: `ALTER TABLE plan_sets ADD COLUMN weight REAL NOT NULL DEFAULT 0;
          ALTER TABLE plan_sets ADD COLUMN reps INTEGER NOT NULL DEFAULT 0;`,
    run: async (db) => {
      await safeAddColumn(db, 'plan_sets', 'weight', 'REAL NOT NULL DEFAULT 0');
      await safeAddColumn(db, 'plan_sets', 'reps', 'INTEGER NOT NULL DEFAULT 0');
    },
  },
  {
    version: 6,
    description: 'G35: exercises 表加 i18n + GIF 关联 5 字段(description_zh/steps_zh/gif_url/target_zh/attribution)。旧行 nullable 字段置 NULL,seed 重新注入时填满。',
    sql: `ALTER TABLE exercises ADD COLUMN description_zh TEXT;
          ALTER TABLE exercises ADD COLUMN steps_zh TEXT;
          ALTER TABLE exercises ADD COLUMN gif_url TEXT;
          ALTER TABLE exercises ADD COLUMN target_zh TEXT;
          ALTER TABLE exercises ADD COLUMN attribution TEXT;`,
    run: async (db) => {
      await safeAddColumn(db, 'exercises', 'description_zh', 'TEXT');
      await safeAddColumn(db, 'exercises', 'steps_zh', 'TEXT');
      await safeAddColumn(db, 'exercises', 'gif_url', 'TEXT');
      await safeAddColumn(db, 'exercises', 'target_zh', 'TEXT');
      await safeAddColumn(db, 'exercises', 'attribution', 'TEXT');
    },
  },
  {
    version: 7,
    description: 'US-12: 新增 body_measurements 表(体重+体脂),同日允许多条(weight_kg/body_fat_pct 都可 NULL)。',
    sql: `CREATE TABLE IF NOT EXISTS body_measurements (
             id TEXT PRIMARY KEY,
             measured_date TEXT NOT NULL,
             weight_kg REAL,
             body_fat_pct REAL,
             note TEXT,
             created_at INTEGER NOT NULL,
             updated_at INTEGER NOT NULL
           );
           CREATE INDEX IF NOT EXISTS idx_body_measurements_date
             ON body_measurements(measured_date DESC, created_at DESC);`,
  },
  {
    version: 8,
    description: '⋯: plan_sets 加 duration_seconds + distance_km 两列;exercises 内置 reps(负重)迁移到 weight_reps(自定 reps 不动,语义升级为自重)。',
    sql: `ALTER TABLE plan_sets ADD COLUMN duration_seconds INTEGER NOT NULL DEFAULT 0;
          ALTER TABLE plan_sets ADD COLUMN distance_km REAL NOT NULL DEFAULT 0;
          UPDATE exercises SET metric_type = 'weight_reps' WHERE metric_type = 'reps' AND is_custom = 0;`,
    run: async (db) => {
      await safeAddColumn(db, 'plan_sets', 'duration_seconds', 'INTEGER NOT NULL DEFAULT 0');
      await safeAddColumn(db, 'plan_sets', 'distance_km', 'REAL NOT NULL DEFAULT 0');
      await db.runAsync(
        `UPDATE exercises SET metric_type = 'weight_reps' WHERE metric_type = 'reps' AND is_custom = 0;`,
      );
    },
  },
  {
    version: 9,
    description:
      'G39: gif_url 改为带前缀的语义(asset: 本地 bundle;https:// 走 CDN;null 等 R2 配齐后回填)。' +
      '存量 assets/exercises/{file}.gif → asset:{file}(30 条 bundled);其他老路径 → null。',
    sql: '-- placeholder; UPDATE via run, basename 白名单来自 EXERCISE_G35_MAPPING',
    run: async (db) => {
      // 30 张 bundled 的 basename 白名单(mapping.bundled === true)。
      const bundled = new Set(
        EXERCISE_G35_MAPPING.filter((m) => m.bundled && m.assetFileName).map(
          (m) => m.assetFileName as string,
        ),
      );
      if (bundled.size === 0) return;

      // 拉所有老路径,逐行决定转 asset: 前缀还是置 NULL。
      // 注:runMigrations 已经包了一层 withTransactionAsync,这里不能再开
      // 嵌套事务 —— SQLite 不支持,会抛 "cannot rollback - no transaction is active"。
      // 直接 runAsync,外层事务统一兜底提交/回滚。
      const rows = await db.getAllAsync<{ gif_url: string }>(
        `SELECT gif_url FROM exercises WHERE gif_url LIKE 'assets/exercises/%';`,
      );
      for (const r of rows) {
        const basename = r.gif_url.slice('assets/exercises/'.length);
        if (bundled.has(basename)) {
          await db.runAsync(
            `UPDATE exercises SET gif_url = ? WHERE gif_url = ?;`,
            [`asset:${basename}`, r.gif_url],
          );
        } else {
          // 老装里这 22 张 + 1 orphan 走 CDN;此处置 NULL,等 R2 配齐后
          // 由 scripts/seed-cdn-gif-urls.ts 或 G39 后续 commit 回填。
          await db.runAsync(
            `UPDATE exercises SET gif_url = NULL WHERE gif_url = ?;`,
            [r.gif_url],
          );
        }
      }
    },
  },
  {
    version: 10,
    description:
      'G41: 动作库 52 → 306 扩种。seedExercisesIfEmpty 只在空表上全量 INSERT,' +
      '老装(已有 52 条 seed)升级路径它直接 return 0,导致新增的 254 个 bundled:false' +
      '动作永远进不了 DB。本 migration 走 upgradeExerciseSeedIfMissing 差量 INSERT,' +
      '幂等(空表 / 52 / 306 三态都安全)。',
    sql: '-- placeholder; 差量 INSERT via run,逻辑在 upgradeExerciseSeedIfMissing',
    run: async (db) => {
      await upgradeExerciseSeedIfMissing(db);
    },
  },
  {
    version: 11,
    description:
      'G44: 254 张 CDN GIF URL 从 R2 placeholder (`pub-PLACEHOLDER.r2.dev/workout2-gifs/...`)' +
      '更新到腾讯云 COS URL。G44 commit `1d8de95` 改了 `EXERCISE_G35_MAPPING[i].cdnUrl`,但老装' +
      '走 v10 时已 INSERT 254 行,DB 里 `gif_url` 仍是 R2 placeholder → `getCachedOrDownload` 永远 401' +
      '→ 通知栏 / 详情页都 Skeleton。本 migration 走 `upgradeExerciseCdnUrls` 按 `name` UPDATE' +
      '这 254 行的 `gif_url`,WHERE 子句 `gif_url LIKE %r2.dev%` 模式匹配 R2 域名,保证幂等(已升级的行不再匹配)。',
    sql: '-- placeholder; UPDATE via run,逻辑在 upgradeExerciseCdnUrls',
    run: async (db) => {
      await upgradeExerciseCdnUrls(db);
    },
  },
];

/**
 * 当前最新版本号。migrations 列表最大值。
 */
export const CURRENT_VERSION = MIGRATIONS.reduce(
  (max, m) => Math.max(max, m.version),
  0,
);

/**
 * 幂等的 ALTER TABLE ADD COLUMN。
 *
 * 为什么需要这个:
 * schema.ts 里 CREATE TABLE 已经包含这些列(v3/v5/v6 加的列都在 CREATE TABLE 里)。
 * 老装升级路径上,migration 之前的版本没这些列 → ALTER 成功;
 * 新装路径上,CREATE TABLE 已经建好这些列 → ALTER 报 "duplicate column name"。
 *
 * 我们不能只让 migration 在新装上跑(用户切到旧版本再回来,老 bug 会回来),
 * 也不能只让 CREATE TABLE 建列(migration 之前的升级路径上需要 ALTER)。
 * 所以 ADD COLUMN 必须幂等:列已存在就当成功。
 */
async function safeAddColumn(
  db: SQLiteDatabase,
  table: string,
  column: string,
  definition: string,
): Promise<void> {
  try {
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('duplicate column name')) {
      // Schema 已经包含这列(CREATE TABLE 路径),静默跳过。
      return;
    }
    throw err;
  }
}

async function getUserVersion(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version;',
  );
  return row?.user_version ?? 0;
}

async function setUserVersion(db: SQLiteDatabase, version: number): Promise<void> {
  // user_version 必须为正整数；0 是初始值。
  await db.execAsync(`PRAGMA user_version = ${version};`);
}

/**
 * 应用所有未跑过的 migration。幂等。
 */
export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  await configurePragmas(db);
  await applyCreateTables(db);

  let current = await getUserVersion(db);
  if (current >= CURRENT_VERSION) {
    return;
  }

  // 按版本顺序执行。
  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;
    // version === 1 是 initial schema，已经在 applyCreateTables 执行过；只更新 user_version。
    if (migration.version === 1) {
      await setUserVersion(db, 1);
      current = 1;
      continue;
    }
    await db.withTransactionAsync(async () => {
      if (migration.run) {
        await migration.run(db);
      } else {
        await db.execAsync(migration.sql);
      }
    });
    await setUserVersion(db, migration.version);
    current = migration.version;
  }
}
