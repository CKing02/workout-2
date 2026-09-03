/**
 * Database singleton + initDatabase().
 *
 * 设计：
 * - 由 `<SQLiteProvider>` 打开 DB（`onInit` 触发）；调用 `setDatabaseInstance(db)`
 *   把这个连接缓存到模块级 `dbPromise`，供 Zustand store / repositories 复用
 * - `initDatabase()` 仍然走 migrations + seeds 幂等路径，可独立于 Provider 调用
 *   （App 启动时双重保险：Provider 的 onInit 跑一次，DatabaseBootstrap 也跑一次）
 * - 业务代码通过 `getDatabase()` 拿连接
 *
 * G12 — 错误兜底：`getDatabase()` 自打开失败时，缓存一个永远 reject 的
 * Promise，让上层 catch 到一致的"数据库不可用"错误，而不是每次调用都重新
 * 打一次原生层；`initDatabase()` 把任何 SQLite 错误重新包成更友好的消息。
 */

import type { SQLiteDatabase } from 'expo-sqlite';

import { bindDatabase } from '@/lib/diagnostics/installErrorHandlers';

import { runMigrations } from './migrations';
import { seedExercisesIfEmpty } from './seeds/seedRunner';

const DATABASE_NAME = 'workout2.db';

let dbPromise: Promise<SQLiteDatabase> | null = null;
let dbInitFailed = false;

/**
 * Provider 触发的入口。把已经打开的 db 缓存到模块级。
 * 同时把 `getDatabase()` 直接 resolve 成这个 db。
 *
 * 还会把这个 db 交给 diagnostics 处理器，让启动期累积在内存 buffer
 * 里的事件落库,并接管后续事件的写入路径。
 */
export function setDatabaseInstance(db: SQLiteDatabase): void {
  dbPromise = Promise.resolve(db);
  dbInitFailed = false;
  bindDatabase(db);
}

/** 拿到当前的 db 连接（Promise 形式，便于异步调用）。 */
export function getDatabase(): Promise<SQLiteDatabase> {
  if (dbPromise) return dbPromise;
  // 容错：万一有代码在 SQLiteProvider 之前调 getDatabase()，回退到自打开。
  // 这种情况不应该发生，但兜底可以让错误更早暴露。
  try {
    const { openDatabaseAsync } =
      require('expo-sqlite') as typeof import('expo-sqlite');
    const p = openDatabaseAsync(DATABASE_NAME, { enableChangeListener: true });
    dbPromise = p.catch((err: unknown) => {
      // G12: 缓存错误 + 重新抛 —— 防止重试风暴，并把首次失败暴露给上层。
      // eslint-disable-next-line no-console
      console.error('[db] failed to open database', err);
      dbInitFailed = true;
      dbPromise = null;
      throw err instanceof Error
        ? err
        : new Error('数据库打开失败：' + String(err));
    });
    return dbPromise;
  } catch (err) {
    // require 自身失败（极少见，例如原生模块未链接）
    dbInitFailed = true;
    dbPromise = null;
    const wrapped =
      err instanceof Error
        ? err
        : new Error('数据库模块加载失败：' + String(err));
    return Promise.reject(wrapped);
  }
}

/**
 * 启动时调用一次：跑 migration + seed。幂等。
 *
 * 任何一步失败都会抛出经过包装的 Error，方便调用方 toast 提示。
 */
export async function initDatabase(): Promise<SQLiteDatabase> {
  let db: SQLiteDatabase;
  try {
    db = await getDatabase();
  } catch (err) {
    dbInitFailed = true;
    throw new Error(
      '无法连接到本地数据库：' +
        (err instanceof Error ? err.message : String(err)),
    );
  }
  try {
    await runMigrations(db);
  } catch (err) {
    dbInitFailed = true;
    throw new Error(
      '数据库迁移失败：' +
        (err instanceof Error ? err.message : String(err)),
    );
  }
  try {
    await seedExercisesIfEmpty(db);
  } catch (err) {
    // Seed 失败相对宽容（应用仍可写入新数据），但仍要通知用户。
    dbInitFailed = true;
    throw new Error(
      '内置动作库种子写入失败：' +
        (err instanceof Error ? err.message : String(err)),
    );
  }
  return db;
}

/** UI 用：检测当前数据库是否处于失败状态（用于禁用写入按钮等）。 */
export function isDatabaseUnavailable(): boolean {
  return dbInitFailed && dbPromise === null;
}

/**
 * G14: 清除全部数据（用户数据 + 设置 + 内置动作重新种子）。
 *
 * 用途：用户从"我的"或"设置"页的"清除全部数据"按钮调用 —— 二次确认
 * Dialog 确认后，删除 7 张表的全部行，再把内置动作库写回，让动作库
 * picker 不会变成空。
 *
 * 副作用（调用方需自行处理）：
 * - settings 表清空后，用户的 kg/lb / 主题 / 默认休息 / 震动 / 用户名
 *   全部回到 defaults。store 内存中的 settings 仍保留旧值，调用方需要
 *   `useSettingsStore.getState().load()` 重新拉一次。
 * - exerciseStore / planStore / trainingStore 内存中也保留旧数据，
 *   调用方需 reload/loadHistory 拉新。
 * - 不主动取消进行中的训练（清数据按钮不在 ActiveTrainingScreen 屏，
 *   触达不到；如果未来有其它入口，调用方应 cancelTraining）。
 *
 * 失败抛 Error：调用方 catch 后 toast。
 */
export async function wipeAllData(): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    // Order doesn't strictly matter (FK CASCADE is on via configurePragmas),
    // but explicit is clearer and resilient to future schema changes.
    // error_logs has no FK so list it separately.
    await db.execAsync(`
      DELETE FROM training_sets;
      DELETE FROM trainings;
      DELETE FROM plan_exercises;
      DELETE FROM plans;
      DELETE FROM exercises;
      DELETE FROM settings;
      DELETE FROM error_logs;
    `);
  });
  // Re-seed the built-in library. seedExercisesIfEmpty is idempotent and
  // checks `WHERE is_custom = 0` count — safe to call after wipe.
  await seedExercisesIfEmpty(db);
}

/** 测试 / 重置用：关闭连接 + 清空缓存。下次 getDatabase() 会重新打开。 */
export async function resetDatabaseForTests(): Promise<void> {
  if (!dbPromise) return;
  try {
    const db = await dbPromise;
    await db.closeAsync();
  } catch {
    // 忽略关闭错误 — reset 的目的是清理状态。
  }
  dbPromise = null;
  dbInitFailed = false;
}

export { DATABASE_NAME };
