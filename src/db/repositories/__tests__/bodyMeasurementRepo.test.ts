/**
 * US-12d — `bodyMeasurementRepo` 行为测试。
 *
 * 项目惯例：DB 层没有集成测试套件（避免 expo-sqlite mock 复杂度）；
 * 这里用 mock SQLiteDatabase 验证 SQL / args 正确性 + repo 行为契约。
 *
 * 覆盖:
 *  - listBodyMeasurements:ORDER BY created_at DESC
 *  - getBodyMeasurementById:命中/未命中
 *  - createBodyMeasurement:INSERT 参数映射 + measuredDate 空校验
 *  - updateBodyMeasurement:部分字段 + 全字段 + 空 patch + id 不存在 throw
 *  - deleteBodyMeasurement:幂等(不存在不报错)
 */

import {
  bodyMeasurementRepo,
  createBodyMeasurement,
  deleteBodyMeasurement,
  getBodyMeasurementById,
  listBodyMeasurements,
  updateBodyMeasurement,
} from '@/db/repositories/bodyMeasurementRepo';
import type { BodyMeasurementRow } from '@/db/schema';
import type { SQLiteDatabase } from 'expo-sqlite';

/* -------------------------------------------------------------------------- */
/* Mock factory                                                              */
/* -------------------------------------------------------------------------- */

interface MockDB {
  db: SQLiteDatabase;
  runCalls: Array<{ sql: string; args: unknown[] }>;
  getFirstCalls: Array<{ sql: string; args: unknown[] }>;
  getAllCalls: Array<{ sql: string; args: unknown[] }>;
}

function makeMockDB(initialRows: BodyMeasurementRow[] = []): MockDB {
  let store = [...initialRows];
  const runCalls: MockDB['runCalls'] = [];
  const getFirstCalls: MockDB['getFirstCalls'] = [];
  const getAllCalls: MockDB['getAllCalls'] = [];

  const db = {
    runAsync: jest.fn(async (sql: string, args: unknown[] = []) => {
      runCalls.push({ sql, args });
      // 模拟 UPDATE/DELETE changes
      if (/^UPDATE\s+body_measurements/i.test(sql)) {
        const id = args[args.length - 1] as string;
        let changes = 0;
        store = store.map((r) => {
          if (r.id !== id) return r;
          changes = 1;
          // 简化:不在 mock 里真的解析 SET 子句;测试只关心 ID 命中
          return r;
        });
        return { changes, lastInsertRowId: 0 };
      }
      if (/^DELETE\s+FROM\s+body_measurements/i.test(sql)) {
        const id = args[0] as string;
        const before = store.length;
        store = store.filter((r) => r.id !== id);
        return { changes: before - store.length, lastInsertRowId: 0 };
      }
      if (/^INSERT\s+INTO\s+body_measurements/i.test(sql)) {
        // 不解析;只关心 SQL 字符串被调用
        return { changes: 1, lastInsertRowId: 1 };
      }
      return { changes: 0, lastInsertRowId: 0 };
    }),
    getFirstAsync: jest.fn(async <T>(sql: string, args: unknown[] = []): Promise<T | null> => {
      getFirstCalls.push({ sql, args });
      if (/WHERE\s+id\s*=/i.test(sql)) {
        const id = args[0] as string;
        return (store.find((r) => r.id === id) ?? null) as T | null;
      }
      return null;
    }),
    getAllAsync: jest.fn(async <T>(sql: string, args: unknown[] = []): Promise<T[]> => {
      getAllCalls.push({ sql, args });
      if (/FROM\s+body_measurements/i.test(sql)) {
        // 模拟 ORDER BY created_at DESC
        return [...store].sort((a, b) => b.created_at - a.created_at) as unknown as T[];
      }
      return [];
    }),
  } as unknown as SQLiteDatabase;

  return { db, runCalls, getFirstCalls, getAllCalls };
}

/* -------------------------------------------------------------------------- */
/* Tests                                                                      */
/* -------------------------------------------------------------------------- */

describe('db/repositories/bodyMeasurementRepo', () => {
  describe('listBodyMeasurements', () => {
    it('按 created_at DESC 返回', async () => {
      const m = makeMockDB([
        {
          id: 'a',
          measured_date: '2026-09-01',
          weight_kg: 70,
          body_fat_pct: 18,
          note: null,
          created_at: 1000,
          updated_at: 1000,
        },
        {
          id: 'b',
          measured_date: '2026-09-02',
          weight_kg: 71,
          body_fat_pct: null,
          note: '午',
          created_at: 2000,
          updated_at: 2000,
        },
      ]);
      const result = await listBodyMeasurements(m.db);
      expect(result.map((r) => r.id)).toEqual(['b', 'a']);
      expect(result[0]!.weightKg).toBe(71);
      expect(result[0]!.note).toBe('午');
      // 验证 SQL
      expect(m.getAllCalls[0]!.sql).toMatch(/ORDER BY created_at DESC/i);
    });

    it('空表 → 空数组', async () => {
      const m = makeMockDB([]);
      const result = await listBodyMeasurements(m.db);
      expect(result).toEqual([]);
    });
  });

  describe('getBodyMeasurementById', () => {
    it('命中 → 返回 camelCase 行', async () => {
      const m = makeMockDB([
        {
          id: 'x',
          measured_date: '2026-09-08',
          weight_kg: 72.5,
          body_fat_pct: 17.2,
          note: '晨',
          created_at: 5000,
          updated_at: 5000,
        },
      ]);
      const result = await getBodyMeasurementById(m.db, 'x');
      expect(result?.id).toBe('x');
      expect(result?.weightKg).toBe(72.5);
      expect(result?.bodyFatPct).toBe(17.2);
      expect(result?.measuredDate).toBe('2026-09-08');
    });

    it('未命中 → null', async () => {
      const m = makeMockDB([]);
      const result = await getBodyMeasurementById(m.db, 'missing');
      expect(result).toBeNull();
    });
  });

  describe('createBodyMeasurement', () => {
    it('INSERT 参数映射正确', async () => {
      const m = makeMockDB([]);
      await createBodyMeasurement(m.db, {
        measuredDate: '2026-09-08',
        weightKg: 70.5,
        bodyFatPct: 18.0,
        note: '晨',
      });
      expect(m.runCalls).toHaveLength(1);
      const call = m.runCalls[0]!;
      expect(call.sql).toMatch(/INSERT INTO body_measurements/);
      // [id, measuredDate, weightKg, bodyFatPct, note, ts, ts]
      expect(call.args).toHaveLength(7);
      expect(call.args[1]).toBe('2026-09-08');
      expect(call.args[2]).toBe(70.5);
      expect(call.args[3]).toBe(18.0);
      expect(call.args[4]).toBe('晨');
      expect(typeof call.args[0]).toBe('string'); // id
      expect(typeof call.args[5]).toBe('number'); // createdAt
    });

    it('measuredDate 空 → throw', async () => {
      const m = makeMockDB([]);
      await expect(
        createBodyMeasurement(m.db, {
          measuredDate: '',
          weightKg: 70,
          bodyFatPct: null,
          note: null,
        }),
      ).rejects.toThrow('measuredDate 不能为空');
    });

    it('允许 weight / fat 任一为 null', async () => {
      const m = makeMockDB([]);
      await createBodyMeasurement(m.db, {
        measuredDate: '2026-09-08',
        weightKg: null,
        bodyFatPct: 20,
        note: null,
      });
      expect(m.runCalls[0]!.args[2]).toBeNull(); // weightKg
      expect(m.runCalls[0]!.args[3]).toBe(20); // bodyFatPct
    });
  });

  describe('updateBodyMeasurement', () => {
    it('部分字段 → 只更新指定字段 + updated_at', async () => {
      const m = makeMockDB([
        {
          id: 'u',
          measured_date: '2026-09-08',
          weight_kg: 70,
          body_fat_pct: 18,
          note: null,
          created_at: 1000,
          updated_at: 1000,
        },
      ]);
      await updateBodyMeasurement(m.db, 'u', { weightKg: 71.5 });
      const sql = m.runCalls[0]!.sql;
      expect(sql).toMatch(/UPDATE body_measurements/);
      expect(sql).toContain('weight_kg = ?');
      expect(sql).not.toContain('body_fat_pct = ?');
      expect(sql).toContain('updated_at = ?');
      expect(m.runCalls[0]!.args).toEqual([71.5, expect.any(Number), 'u']);
    });

    it('空 patch + id 存在 → 不发 UPDATE,直接返回当前行', async () => {
      const m = makeMockDB([
        {
          id: 'p',
          measured_date: '2026-09-08',
          weight_kg: 70,
          body_fat_pct: 18,
          note: null,
          created_at: 1000,
          updated_at: 1000,
        },
      ]);
      const result = await updateBodyMeasurement(m.db, 'p', {});
      expect(result.id).toBe('p');
      expect(m.runCalls).toHaveLength(0); // 没发 SQL
    });

    it('id 不存在 → throw', async () => {
      const m = makeMockDB([]);
      // mock 的 UPDATE 在 id 不在 store 里时 changes=0
      await expect(
        updateBodyMeasurement(m.db, 'ghost', { weightKg: 70 }),
      ).rejects.toThrow(/not found/i);
    });
  });

  describe('deleteBodyMeasurement', () => {
    it('命中 → DELETE 调用', async () => {
      const m = makeMockDB([
        {
          id: 'd',
          measured_date: '2026-09-08',
          weight_kg: 70,
          body_fat_pct: null,
          note: null,
          created_at: 1,
          updated_at: 1,
        },
      ]);
      await deleteBodyMeasurement(m.db, 'd');
      expect(m.runCalls[0]!.sql).toMatch(/DELETE FROM body_measurements/);
      expect(m.runCalls[0]!.args).toEqual(['d']);
    });

    it('不存在 → 幂等,不报错', async () => {
      const m = makeMockDB([]);
      await expect(deleteBodyMeasurement(m.db, 'ghost')).resolves.toBeUndefined();
    });
  });

  describe('bodyMeasurementRepo barrel', () => {
    it('暴露的 5 个 API 与命名函数一致', () => {
      expect(bodyMeasurementRepo.listAll).toBe(listBodyMeasurements);
      expect(bodyMeasurementRepo.getById).toBe(getBodyMeasurementById);
      expect(bodyMeasurementRepo.create).toBe(createBodyMeasurement);
      expect(bodyMeasurementRepo.update).toBe(updateBodyMeasurement);
      expect(bodyMeasurementRepo.delete).toBe(deleteBodyMeasurement);
    });
  });
});
