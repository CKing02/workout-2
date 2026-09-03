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
];

/**
 * 当前最新版本号。migrations 列表最大值。
 */
export const CURRENT_VERSION = MIGRATIONS.reduce(
  (max, m) => Math.max(max, m.version),
  0,
);

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
      await db.execAsync(migration.sql);
    });
    await setUserVersion(db, migration.version);
    current = migration.version;
  }
}
