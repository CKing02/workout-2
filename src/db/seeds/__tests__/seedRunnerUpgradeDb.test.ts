/**
 * G41 闪退根因复测 — upgradeExerciseSeedIfMissing 不能开嵌套事务。
 *
 * 背景(commit cde3c69 引入的 bug):
 *  - runMigrations 给每个 migration 包了 `db.withTransactionAsync`(外层 BEGIN)。
 *  - v10 migration.run() 调 upgradeExerciseSeedIfMissing,后者内部又调
 *    `db.withTransactionAsync`(再次 BEGIN)。
 *  - expo-sqlite 14 的 withTransactionAsync 用的是**裸 BEGIN**(不是 SAVEPOINT),
 *    见 node_modules/expo-sqlite/build/SQLiteDatabase.js:120-130。
 *  - 嵌套 BEGIN → SQLite 抛 "cannot start a transaction within a transaction" →
 *    内层 catch 的 ROLLBACK 把外层事务也回滚 → runMigrations 抛 →
 *    handleDbInit 不 catch → unhandled rejection → 进程崩溃。
 *
 * 测试目标:用 mock DB 把 withTransactionAsync 调用次数断言为 0。
 * (jest-expo 没装 better-sqlite3,本测试全程 fake,不连真 SQLite。)
 */

import type { SQLiteDatabase } from 'expo-sqlite';

import { EXERCISE_SEEDS } from '../exercises';
import { upgradeExerciseSeedIfMissing } from '../seedRunner';

interface MockDb {
  // count how many times each method was called
  withTransactionAsync: jest.Mock<Promise<void>, [() => Promise<void>]>;
  getAllAsync: jest.Mock<Promise<unknown[]>, [string]>;
  prepareAsync: jest.Mock<Promise<{ finalizeAsync: jest.Mock; executeAsync: jest.Mock }>, [string]>;
}

function makeMockDb(existingNames: string[]): MockDb {
  const stmt = {
    executeAsync: jest.fn().mockResolvedValue({ changes: 1 }),
    finalizeAsync: jest.fn().mockResolvedValue(undefined),
  };
  return {
    // 必须 throw — 如果 upgradeExerciseSeedIfMissing 误调了它,
    // 我们立刻知道,且 jest 用例 fail。
    withTransactionAsync: jest.fn<Promise<void>, [() => Promise<void>]>(async () => {
      throw new Error(
        'NESTED TRANSACTION DETECTED: upgradeExerciseSeedIfMissing 必须依赖' +
          ' caller 的事务,不能再 db.withTransactionAsync。',
      );
    }),
    getAllAsync: jest.fn().mockResolvedValue(
      existingNames.map((name) => ({ name })),
    ),
    prepareAsync: jest.fn().mockResolvedValue(stmt),
  };
}

describe('G41 upgradeExerciseSeedIfMissing — 不开嵌套事务 (闪退回归)', () => {
  it('空表:走 prepareAsync + executeAsync + finalizeAsync,绝对不调 withTransactionAsync', async () => {
    const db = makeMockDb([]);
    const result = await upgradeExerciseSeedIfMissing(
      db as unknown as SQLiteDatabase,
    );
    expect(result).toBe(323); // EXERCISE_SEEDS.length
    expect(db.withTransactionAsync).not.toHaveBeenCalled();
    expect(db.prepareAsync).toHaveBeenCalledTimes(1);
    const stmt = await db.prepareAsync.mock.results[0]!.value;
    expect(stmt.executeAsync).toHaveBeenCalledTimes(323);
    expect(stmt.finalizeAsync).toHaveBeenCalledTimes(1);
  });

  it('老装 52 行(G40 状态):INSERT 254 差量,withTransactionAsync 仍为 0', async () => {
    // 模拟 G40 老装:DB 里已有 52 个 bundled seed 名。
    const existing = new Set<string>();
    for (const seed of EXERCISE_SEEDS) {
      existing.add(seed.name);
      if (existing.size >= 52) break;
    }
    const db = makeMockDb([...existing]);
    const result = await upgradeExerciseSeedIfMissing(
      db as unknown as SQLiteDatabase,
    );
    expect(result).toBe(271);
    expect(db.withTransactionAsync).not.toHaveBeenCalled();
    const stmt = await db.prepareAsync.mock.results[0]!.value;
    expect(stmt.executeAsync).toHaveBeenCalledTimes(271);
  });

  it('已升级 306 行:无 INSERT,直接 return 0', async () => {
    const db = makeMockDb(EXERCISE_SEEDS.map((s) => s.name));
    const result = await upgradeExerciseSeedIfMissing(
      db as unknown as SQLiteDatabase,
    );
    expect(result).toBe(0);
    expect(db.withTransactionAsync).not.toHaveBeenCalled();
    expect(db.prepareAsync).not.toHaveBeenCalled();
  });
});
