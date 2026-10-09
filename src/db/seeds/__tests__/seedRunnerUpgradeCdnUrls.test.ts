/**
 * G44 升级路径测试 — upgradeExerciseCdnUrls 把 254 行 R2 placeholder 替换成 COS URL。
 *
 * 跟 seedRunnerUpgradeDb.test.ts (G41 v10) 同样模式:mock DB,不连真 SQLite。
 * 重点断言:
 *   1. **不开嵌套事务**(外层 runMigrations 已开,内层再开 → expo-sqlite 14 裸 BEGIN → 闪退)
 *   2. prepared statement 复用 — 1 次 prepareAsync + 254 次 executeAsync + 1 次 finalizeAsync
 *   3. bundled === true 的 mapping 行被跳过(asset: 前缀不能被覆盖成 https URL)
 *   4. WHERE `gif_url LIKE '%r2.dev%'` 让幂等性生效:再次跑没 R2 URL 的已升级 DB 应该 0 行变更
 */

import type { SQLiteDatabase } from 'expo-sqlite';

import { EXERCISE_G35_MAPPING } from '../exerciseG35Mapping';
import { upgradeExerciseCdnUrls } from '../seedRunner';

interface MockDb {
  // count how many times each method was called
  withTransactionAsync: jest.Mock<Promise<void>, [() => Promise<void>]>;
  prepareAsync: jest.Mock<Promise<{ finalizeAsync: jest.Mock; executeAsync: jest.Mock }>, [string]>;
}

/**
 * 构造一个 mock DB,`executeAsync` 的 changes 数由 caller 控制(模拟 R2 URL 命中数)。
 */
function makeMockDb(changesPerUpdate: number): MockDb {
  const stmt = {
    executeAsync: jest.fn().mockResolvedValue({ changes: changesPerUpdate }),
    finalizeAsync: jest.fn().mockResolvedValue(undefined),
  };
  return {
    // 必须 throw — 如果 upgradeExerciseCdnUrls 误调了它,
    // 我们立刻知道,且 jest 用例 fail(同 G41 闪退回归)。
    withTransactionAsync: jest.fn<Promise<void>, [() => Promise<void>]>(async () => {
      throw new Error(
        'NESTED TRANSACTION DETECTED: upgradeExerciseCdnUrls 必须依赖' +
          ' caller 的事务,不能再 db.withTransactionAsync。',
      );
    }),
    prepareAsync: jest.fn().mockResolvedValue(stmt),
  };
}

describe('G44 upgradeExerciseCdnUrls — R2 placeholder → 腾讯云 COS', () => {
  it('G41 老装 R2 URL:254 行 UPDATE,prepared 复用,无嵌套事务', async () => {
    const db = makeMockDb(1);
    const result = await upgradeExerciseCdnUrls(db as unknown as SQLiteDatabase);

    // executeAsync 调 N 次 = bundled=false 且 cdnUrl 有值的 mapping 数
    const expectedUpdates = EXERCISE_G35_MAPPING.filter(
      (m) => !m.bundled && m.cdnUrl,
    ).length;
    expect(expectedUpdates).toBe(254); // 映射总数 306 - bundled=true 52 = 254
    expect(result).toBe(254);

    // 嵌套事务回归保护
    expect(db.withTransactionAsync).not.toHaveBeenCalled();

    // prepared statement 复用
    expect(db.prepareAsync).toHaveBeenCalledTimes(1);
    const stmt = await db.prepareAsync.mock.results[0]!.value;
    expect(stmt.executeAsync).toHaveBeenCalledTimes(254);
    expect(stmt.finalizeAsync).toHaveBeenCalledTimes(1);

    // SQL 必须带 WHERE 幂等条件 + is_custom=0 保护 + LIKE '%r2.dev%'
    const sql = db.prepareAsync.mock.calls[0]?.[0] ?? '';
    expect(sql).toMatch(/UPDATE exercises/);
    expect(sql).toMatch(/SET gif_url = \?/);
    expect(sql).toMatch(/WHERE name = \?/);
    expect(sql).toMatch(/is_custom = 0/);
    expect(sql).toMatch(/r2\.dev/);

    // 每次 executeAsync 的参数必须是 [cdnUrl, seedName]
    const calls = stmt.executeAsync.mock.calls;
    const firstCall = calls[0];
    expect(firstCall).toBeDefined();
    const firstParams = firstCall?.[0] as [string, string];
    expect(firstParams[0]).toMatch(/^https:\/\/.*\.cos\..*\.myqcloud\.com\/exercises\//);
    expect(typeof firstParams[1]).toBe('string'); // seedName

    // 跳过的 bundled=true 行一次都不该被 UPDATE
    // 简单校验:bundled=true mapping 的 seedName 不应该出现在 executeAsync 调用里
    const executedSeedNames = calls
      .map((c: [string, string]) => c[1])
      .filter((n: unknown): n is string => typeof n === 'string');
    const bundledSeedNames = EXERCISE_G35_MAPPING.filter((m) => m.bundled)
      .map((m) => m.seedName);
    for (const bs of bundledSeedNames) {
      expect(executedSeedNames).not.toContain(bs);
    }
  });

  it('已升级 306 行(无 R2 URL):changes=0,executeAsync 仍调 254 次(WHERE 不命中)', async () => {
    // 模拟 G44 跑过一次后,DB 里 gif_url 已全是 COS → WHERE LIKE r2.dev 不匹配
    // → executeAsync 调用 254 次,但每次 changes=0
    const db = makeMockDb(0);
    const result = await upgradeExerciseCdnUrls(db as unknown as SQLiteDatabase);
    expect(result).toBe(0);
    expect(db.withTransactionAsync).not.toHaveBeenCalled();
    const stmt = await db.prepareAsync.mock.results[0]!.value;
    expect(stmt.executeAsync).toHaveBeenCalledTimes(254); // 仍尝试 254 次
    expect(stmt.finalizeAsync).toHaveBeenCalledTimes(1);
  });
});