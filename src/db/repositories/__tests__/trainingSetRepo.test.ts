/**
 * G21 回归守卫 — `getLastSetsForExercises` 的 SQL 投影。
 *
 * 背景（2026-09-27 真机 DB 定位）：该函数原本写的是
 *
 *   SELECT *, ROW_NUMBER() OVER (...) AS rn
 *     FROM training_sets ts JOIN trainings t ON t.id = ts.training_id
 *
 * JOIN 之下 `SELECT *` 会把**两张表**的同名列都吐出来：`id` 和
 * `duration_seconds` 在两个表里都存在。expo-sqlite 的 `composeRow()`
 * (node_modules/expo-sqlite/src/paramUtils.ts:65) 是按列序逐列
 * `row[name] = values[i]` 赋值的，**后者覆盖前者** —— 结果是
 * `r.id` 变成 *训练* 的 id、`r.duration_seconds` 变成 *整场训练* 的总时长。
 * 同一场训练的每一组于是共享同一个 id，`LastSetsPreview` 的
 * `key={s.id}` 撞车，warning 被 errorLogs 捕获后累计 186 条同 fingerprint
 * 记录、升级成红屏 overlay（即 G21 报的现象）。
 *
 * 真机 DB 实测（OPPO PBEM00 拉出的 workout2.db）：修复前 2/2 个有 ≥2 组
 * 历史的动作都复现 `count=2 unique=1`；改成 `ts.*` 后 0/2。
 *
 * 项目惯例：DB 层用 mock SQLiteDatabase 验证 SQL/args 契约（见
 * `bodyMeasurementRepo.test.ts` 顶部注释）。这里沿用，重点不是"跑出正确数据"
 * 而是**锁住投影写法**，因为这类 bug 的形态正是"数据看着合理、字段被静默串味"。
 */

import { getLastSetsForExercises } from '@/db/repositories/trainingSetRepo';
import type { SQLiteDatabase } from 'expo-sqlite';

/* -------------------------------------------------------------------------- */
/* Mock factory                                                              */
/* -------------------------------------------------------------------------- */

interface Captured {
  sql: string;
  args: unknown[];
}

function makeMockDB(rows: Record<string, unknown>[] = []) {
  const getAllCalls: Captured[] = [];
  const db = {
    getAllAsync: jest.fn(async (sql: string, args: unknown[] = []) => {
      getAllCalls.push({ sql, args });
      return rows;
    }),
  } as unknown as SQLiteDatabase;
  return { db, getAllCalls };
}

/** 取 SELECT 与 FROM 之间的投影列表，并剔除 ROW_NUMBER() OVER (...) 子表达式。 */
function selectList(sql: string): string[] {
  const m = /select\s+([\s\S]*?)\s+from\s/i.exec(sql);
  if (!m) throw new Error(`no SELECT..FROM in SQL: ${sql}`);
  return m[1]
    // 窗口函数连同它的别名一起剔除（`ROW_NUMBER() OVER (...) AS rn`）
    .replace(/row_number\(\)\s*over\s*\([^)]*\)\s*(as\s+\w+)?/gi, '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/* -------------------------------------------------------------------------- */
/* 投影守卫                                                                   */
/* -------------------------------------------------------------------------- */

describe('getLastSetsForExercises — SQL 投影守卫（G21 回归）', () => {
  it('必须显式写 ts.*，不得使用裸 SELECT *', () => {
    const { db, getAllCalls } = makeMockDB();
    void getLastSetsForExercises(db, ['e1'], 3);

    const { sql } = getAllCalls[0];
    expect(sql).toMatch(/SELECT\s+ts\.\*/i);
    // 裸 `SELECT *` 是这个 bug 的唯一成因；`SELECT ts.*` 不匹配下面这条
    // （`*` 前面是 `ts.`，`\s+` 要求 `*` 紧跟空白）。
    expect(sql).not.toMatch(/SELECT\s+\*/i);
  });

  it('JOIN 查询里每个投影列都必须带表前缀或别名', () => {
    // 这是通用不变量，不只针对 id/duration_seconds：任何未限定的列名只要
    // 在两张表里同名就会被后者覆盖，且**静默**。宁可在此拦死。
    const { db, getAllCalls } = makeMockDB();
    void getLastSetsForExercises(db, ['e1'], 3);

    const dirty = selectList(getAllCalls[0].sql).filter(
      (tok) => !tok.includes('.') && !/\s+as\s+/i.test(tok),
    );
    expect(dirty).toEqual([]);
  });

  it('两张表的重名列（id / duration_seconds）不得出现在投影里', () => {
    const { db, getAllCalls } = makeMockDB();
    void getLastSetsForExercises(db, ['e1'], 3);

    const tokens = selectList(getAllCalls[0].sql);
    for (const collision of ['id', 'duration_seconds']) {
      expect(tokens).not.toContain(collision);
    }
    // ts.* 已经涵盖它们，语义上不缺字段。
    expect(tokens).toContain('ts.*');
  });
});

/* -------------------------------------------------------------------------- */
/* 行为契约                                                                   */
/* -------------------------------------------------------------------------- */

function setRow(over: Record<string, unknown> = {}) {
  return {
    id: 's1',
    training_id: 't1',
    exercise_id: 'e1',
    exercise_name_snapshot: '卧推',
    position: 0,
    set_index: 0,
    weight: 60,
    reps: 8,
    duration_seconds: null,
    distance_km: null,
    set_type: 'normal',
    completed: 1,
    rn: 1,
    ...over,
  };
}

describe('getLastSetsForExercises — 行为契约', () => {
  it('按 exercise_id 分组返回 Record', async () => {
    const { db } = makeMockDB([
      setRow({ id: 's1', exercise_id: 'e1', rn: 1, set_index: 2 }),
      setRow({ id: 's2', exercise_id: 'e1', rn: 2, set_index: 1 }),
      setRow({ id: 's3', exercise_id: 'e2', rn: 1, set_index: 0 }),
    ]);

    const out = await getLastSetsForExercises(db, ['e1', 'e2'], 3);

    expect(Object.keys(out).sort()).toEqual(['e1', 'e2']);
    expect(out.e1).toHaveLength(2);
    expect(out.e2).toHaveLength(1);
  });

  it('rn 超过 perExerciseLimit 的行被丢弃', async () => {
    const { db } = makeMockDB([
      setRow({ id: 's1', rn: 1 }),
      setRow({ id: 's2', rn: 2 }),
      setRow({ id: 's3', rn: 3 }),
      setRow({ id: 's4', rn: 4 }),
    ]);

    const out = await getLastSetsForExercises(db, ['e1'], 3);

    expect(out.e1.map((s) => s.id).sort()).toEqual(['s1', 's2', 's3']);
  });

  it('不同 set 的 id 保持互异（G21 现象本身）', async () => {
    // 修复前这两行会同时拿到 trainings.id，导致 LastSetsPreview 的
    // key={s.id} 撞车。用真实形态的行断言 id 一路透传到 TrainingSet.id。
    const { db } = makeMockDB([
      setRow({ id: 'set-a', rn: 1, set_index: 2 }),
      setRow({ id: 'set-b', rn: 2, set_index: 1 }),
    ]);

    const out = await getLastSetsForExercises(db, ['e1'], 3);
    const ids = out.e1.map((s) => s.id);

    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it('空的 exerciseIds 直接返回空对象且不查库', async () => {
    const { db, getAllCalls } = makeMockDB();

    await expect(getLastSetsForExercises(db, [], 3)).resolves.toEqual({});
    expect(getAllCalls).toHaveLength(0);
  });

  it('IN 占位符数量与 exerciseIds 一致，参数原样透传', async () => {
    const { db, getAllCalls } = makeMockDB();

    await getLastSetsForExercises(db, ['e1', 'e2', 'e3'], 3);

    const { sql, args } = getAllCalls[0];
    expect(sql.match(/\?/g)).toHaveLength(3);
    expect(args).toEqual(['e1', 'e2', 'e3']);
  });
});
