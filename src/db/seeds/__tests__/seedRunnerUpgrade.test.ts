/**
 * G41 修复 — upgradeExerciseSeedIfMissing 纯函数单测。
 *
 * 不连 SQLite(项目 jest preset 是 jest-expo + node env,装 better-sqlite3 不划算):
 * 只测 filterMissingSeedRows 的差量逻辑。DB 写入路径在 commit 前用 review
 * 校对 column 数,真机升级用 EAS Build 验证(EXPECTED_SEED_COUNT 行数落地)。
 *
 * 关键不变式:
 *  - filterMissingSeedRows(empty)  → toExerciseRows(now) 全部 306 条
 *  - filterMissingSeedRows(full)   → []                  (idempotent 起点)
 *  - filterMissingSeedRows(partial) → 缺的差量行,顺序保持 EXERCISE_SEEDS 原序
 *  - filterMissingSeedRows(包含用户自定义名) → 不被误算成"缺"
 *  - 返回行 timestamp == 传入的 now
 */

import { EXERCISE_SEEDS } from '../exercises';
import { filterMissingSeedRows } from '../seedRunner';

describe('G41 filterMissingSeedRows — 差量 INSERT 列表生成', () => {
  const now = 1_700_000_000_000;

  it('空 existing set → 全部 306 行(takeover 全量职责)', () => {
    const missing = filterMissingSeedRows(new Set(), now);
    expect(missing.length).toBe(EXERCISE_SEEDS.length);
    expect(missing.length).toBe(306);
  });

  it('full set(306 个 seed name)→ [] (idempotent,no-op 起点)', () => {
    const allNames = new Set(EXERCISE_SEEDS.map((s) => s.name));
    const missing = filterMissingSeedRows(allNames, now);
    expect(missing).toEqual([]);
  });

  it('partial set:只装 G40 那 52 个 → 剩下 254 个 bundled:false 入差量', () => {
    // 模拟用户从 G40 升级到 G41。G40 装时 seedExercisesIfEmpty 一次性
    // INSERT 了 52 条 bundled;DB 里 is_custom=0 的 name 集合 ≈ 这 52 个
    // (种子顺序与 toExerciseRows 一致,因为 EXERCISE_SEEDS 是同一数组)。
    const partial = new Set<string>();
    let bundledCount = 0;
    for (const seed of EXERCISE_SEEDS) {
      // gif_url 字段在 toExerciseRows 里以 asset:/https:/null 分流,直接重跑
      // toExerciseRows 取前 52 条 bundled 行名,与真机 DB 一致。
      const row = filterMissingSeedRows(new Set([seed.name]), now)[0];
      if (!row) continue;
      if (row.gif_url?.startsWith('asset:')) {
        partial.add(seed.name);
        bundledCount++;
        if (bundledCount >= 52) break;
      }
    }
    expect(bundledCount).toBe(52); // sanity:真机升级状态

    const missing = filterMissingSeedRows(partial, now);
    // 254 = 306 - 52,这就是用户手机这次升级该 INSERT 的差量。
    expect(missing.length).toBe(254);
    // 没有一个名字出现在已存在集合里
    for (const r of missing) {
      expect(partial.has(r.name)).toBe(false);
    }
    // 顺序 = EXERCISE_SEEDS 原序(便于升级可预测)
    const expectedNames = EXERCISE_SEEDS.filter((s) => !partial.has(s.name)).map(
      (s) => s.name,
    );
    expect(missing.map((r) => r.name)).toEqual(expectedNames);
  });

  it('包含 is_custom=1 用户自定义行 → 不影响差量(只看 seed name)', () => {
    // 用户的自定义动作 name 不会出现在 EXERCISE_SEEDS 里,所以天然不会被
    // 当成"缺"。模拟场景:DB 里有 52 个 seed + 3 个 user-created,缺的是 254 个 CDN。
    const existing = new Set<string>();
    for (const seed of EXERCISE_SEEDS) {
      // 这里只 mock 52 个 seed 名(G40 装状态)
      existing.add(seed.name);
      if (existing.size >= 52) break;
    }
    existing.add('我的深蹲变体'); // user-created,名字不在 EXERCISE_SEEDS
    existing.add('前侧平举测试');
    existing.add('私有热身');

    const missing = filterMissingSeedRows(existing, now);
    expect(missing.length).toBe(254);
    expect(missing.some((r) => r.name === '我的深蹲变体')).toBe(false);
  });

  it('返回行的 created_at == 传入的 now(供 INSERT 直接用)', () => {
    const customNow = 1_234_567_890_000;
    const missing = filterMissingSeedRows(new Set(), customNow);
    expect(missing.every((r) => r.created_at === customNow)).toBe(true);
  });

  it('差量行 14 列齐全(name/muscle_group/.../attribution)', () => {
    const missing = filterMissingSeedRows(new Set(), now);
    const expectedKeys = [
      'name', 'muscle_group', 'secondary_muscles', 'equipment', 'metric_type',
      'image_uri', 'is_custom', 'created_at',
      'description_zh', 'steps_zh', 'gif_url', 'target_zh', 'attribution',
    ].sort();
    for (const r of missing) {
      expect(Object.keys(r).sort()).toEqual(expectedKeys);
    }
    // G41:差量行里 gif_url 是 https:// URL,不走 asset: 本地
    const remoteCount = missing.filter((r) => r.gif_url?.startsWith('https://')).length;
    expect(remoteCount).toBe(254);
  });

  it('三态幂等验证(老装现状 52 → 应触发 254 INSERT;再跑一次 0)', () => {
    const partial = new Set<string>();
    for (const seed of EXERCISE_SEEDS) {
      const row = filterMissingSeedRows(new Set([seed.name]), now)[0];
      if (row?.gif_url?.startsWith('asset:')) {
        partial.add(seed.name);
        if (partial.size >= 52) break;
      }
    }
    expect(partial.size).toBe(52);

    const firstPass = filterMissingSeedRows(partial, now);
    expect(firstPass.length).toBe(254);

    // 模拟第一轮 INSERT 完后,DB 已有 52+254=306 个 name → 第二轮 no-op
    const afterFirstPass = new Set([
      ...partial,
      ...firstPass.map((r) => r.name),
    ]);
    expect(afterFirstPass.size).toBe(306);
    const secondPass = filterMissingSeedRows(afterFirstPass, now);
    expect(secondPass).toEqual([]);
  });
});