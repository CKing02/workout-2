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
