/**
 * G47x bug fix — `createPlan` restSecondsByExerciseId 参数行为测试。
 *
 * 背景：用户报告"第一次创建运动计划时，设置好的运动组休息时间为30秒，
 * 保存后，进行训练，时间有恢复到60秒"。根因是 createPlan 签名只接 exerciseIds，
 * 写 DB 时 rest_seconds 硬编码 60，把用户在 PlanEditorScreen.handleRestSecondsCommit
 * 里改的内存 detailById restSeconds 丢掉了。
 *
 * 修复：
 *  - createPlan 加可选参数 restSecondsByExerciseId?: Record<string, number>
 *  - INSERT 时按 exId 取覆盖值,缺省回落 60
 *  - planStore.create 在 caller 没传时从 detailById[STUB_NEW_PLAN_ID] 自动收集
 *
 * 覆盖:
 *  - 传 restSecondsByExerciseId 时 INSERT 用传入值
 *  - 缺省时(无 record)回落 60
 *  - 部分 key 缺失时缺 key 项回落 60
 *  - 兼容旧调用方(不传 restSecondsByExerciseId 行为不变)
 */

import { createPlan, DEFAULT_REST_SECONDS } from '@/db/repositories/planRepo';
import type { SQLiteDatabase } from 'expo-sqlite';

interface MockDB {
  db: SQLiteDatabase;
  /** plan_exercises INSERT 每次调用的 args 列表(顺序对应 exIds) */
  planExercisesArgs: unknown[][];
  /** 模拟的 transaction 入口被调次数(应为 1) */
  inTransaction: number;
  /** 验证 transaction 行为用 */
  runCalls: Array<{ sql: string; args: unknown[] }>;
  preparedSQLs: string[];
}

function makeMockDB(): MockDB {
  const planExercisesArgs: unknown[][] = [];
  let inTransaction = 0;
  const runCalls: Array<{ sql: string; args: unknown[] }> = [];
  const preparedSQLs: string[] = [];

  // 把 mock statement 提到 makeMockDB 顶层 —— 这样 prepareAsync 返回的 statement
  // 对象身份稳定, jest mock 的 `mock.instances[0]` 也能查到.
  // (之前放在 prepareAsync 工厂闭包里, jest 看到的是新对象每次重建, mock 实例
  // 链不上 → 推 push 行为表现不稳定.)
  const stmt: any = {
    executeAsync: jest.fn(async (...callArgs: unknown[]) => {
      const args = (callArgs[0] as unknown[]) ?? [];
      planExercisesArgs.push(args);
      return { changes: 1, lastInsertRowId: 0 };
    }),
    finalizeAsync: jest.fn(async () => undefined),
  };

  const db: any = {
    withTransactionAsync: jest.fn(async (fn: () => Promise<void>) => {
      inTransaction++;
      await fn();
    }),
    runAsync: jest.fn(async (sql: string, args: unknown[] = []) => {
      runCalls.push({ sql, args });
      return { changes: 1, lastInsertRowId: 0 };
    }),
    prepareAsync: jest.fn(async (sql: string) => {
      preparedSQLs.push(sql);
      return stmt;
    }),
  };

  return {
    db: db as SQLiteDatabase,
    planExercisesArgs,
    get inTransaction() { return inTransaction; },
    runCalls,
    preparedSQLs,
  };
}

describe('planRepo.createPlan — G47x fix: restSecondsByExerciseId', () => {
  it('缺省时(不传 restSecondsByExerciseId)INSERT 用 DEFAULT_REST_SECONDS=60', async () => {
    const mock = makeMockDB();
    await createPlan(mock.db, {
      name: 'P1',
      exerciseIds: ['e1', 'e2'],
    });
    // plan_exercises INSERT 的列顺序:(plan_exercise_id, plan_id, exercise_id, position, rest_seconds)
    expect(mock.planExercisesArgs).toHaveLength(2);
    expect(mock.planExercisesArgs[0]).toEqual([
      expect.any(String), // plan_exercise_id (newId)
      expect.any(String), // plan_id
      'e1',
      0,
      DEFAULT_REST_SECONDS, // 60
    ]);
    expect(mock.planExercisesArgs[1][4]).toBe(DEFAULT_REST_SECONDS);
  });

  it('传 restSecondsByExerciseId 时按 exerciseId 取覆盖值', async () => {
    const mock = makeMockDB();
    await createPlan(mock.db, {
      name: 'P1',
      exerciseIds: ['e1', 'e2', 'e3'],
      restSecondsByExerciseId: { e1: 30, e2: 90, e3: 45 },
    });
    expect(mock.planExercisesArgs[0][4]).toBe(30);
    expect(mock.planExercisesArgs[1][4]).toBe(90);
    expect(mock.planExercisesArgs[2][4]).toBe(45);
  });

  it('部分 key 缺失时,缺 key 项回落 DEFAULT_REST_SECONDS=60', async () => {
    const mock = makeMockDB();
    await createPlan(mock.db, {
      name: 'P1',
      exerciseIds: ['e1', 'e2', 'e3'],
      restSecondsByExerciseId: { e2: 30 }, // 只有 e2 覆盖
    });
    expect(mock.planExercisesArgs[0][4]).toBe(DEFAULT_REST_SECONDS); // e1 缺 → 60
    expect(mock.planExercisesArgs[1][4]).toBe(30);                  // e2 = 30
    expect(mock.planExercisesArgs[2][4]).toBe(DEFAULT_REST_SECONDS); // e3 缺 → 60
  });

  it('restSecondsByExerciseId 含未知 exerciseId 时不影响(取不到回落 60)', async () => {
    const mock = makeMockDB();
    await createPlan(mock.db, {
      name: 'P1',
      exerciseIds: ['e1'],
      restSecondsByExerciseId: { unknown: 999 }, // 多余的 key 无害
    });
    expect(mock.planExercisesArgs[0][4]).toBe(DEFAULT_REST_SECONDS);
  });

  it('exerciseIds 为空时不会触发 plan_exercises INSERT', async () => {
    const mock = makeMockDB();
    await createPlan(mock.db, { name: 'Empty' });
    expect(mock.planExercisesArgs).toHaveLength(0);
  });

  it('整个流程在 withTransactionAsync 内执行(原子性保留)', async () => {
    const mock = makeMockDB();
    await createPlan(mock.db, {
      name: 'P1',
      exerciseIds: ['e1'],
      restSecondsByExerciseId: { e1: 30 },
    });
    expect(mock.inTransaction).toBe(1);
    // 事务里 plan row INSERT 1 次 + plan_exercises 1 次 prepare
    expect(mock.runCalls.length).toBe(1); // plans
    expect(mock.preparedSQLs.length).toBe(1); // plan_exercises
  });
});
