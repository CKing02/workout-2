/**
 * exerciseRepo — BL-003 排序回归测试
 *
 * 验证所有 list 路径的 ORDER BY 子句都是 `is_custom DESC, name COLLATE NOCASE ASC`,
 * 保证自定义动作在动作库 / 肌群筛选 / 器械筛选 / 搜索结果中都置顶。
 */

import {
  listExercises,
  queryByMuscleGroup,
  queryByEquipment,
  searchByName,
} from '@/db/repositories/exerciseRepo';
import type { ExerciseRow } from '@/db/schema';
import type { SQLiteDatabase } from 'expo-sqlite';

interface CapturedCall {
  sql: string;
  args: unknown[];
}

function makeMockDB(rows: ExerciseRow[] = []): {
  db: SQLiteDatabase;
  calls: CapturedCall[];
} {
  const calls: CapturedCall[] = [];
  const db = {
    getAllAsync: jest.fn(async (sql: string, args: unknown[] = []) => {
      calls.push({ sql, args });
      return rows;
    }),
    runAsync: jest.fn(async () => ({ changes: 0, lastInsertRowId: 0 })),
    getFirstAsync: jest.fn(async () => null),
  } as unknown as SQLiteDatabase;
  return { db, calls };
}

describe('exerciseRepo — BL-003 自定义动作置顶', () => {
  it('listExercises 用 is_custom DESC 排序', async () => {
    const { db, calls } = makeMockDB();
    await listExercises(db);

    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toMatch(/ORDER BY is_custom DESC/);
    expect(calls[0].sql).not.toMatch(/is_custom ASC/);
  });

  it('queryByMuscleGroup 用 is_custom DESC 排序', async () => {
    const { db, calls } = makeMockDB();
    await queryByMuscleGroup(db, '胸');

    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toMatch(/ORDER BY is_custom DESC/);
    expect(calls[0].args).toEqual(['胸']);
  });

  it('queryByEquipment 用 is_custom DESC 排序', async () => {
    const { db, calls } = makeMockDB();
    await queryByEquipment(db, '杠铃');

    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toMatch(/ORDER BY is_custom DESC/);
    expect(calls[0].args).toEqual(['杠铃']);
  });

  it('searchByName 用 is_custom DESC 排序,keyword 自动加 %%', async () => {
    const { db, calls } = makeMockDB();
    await searchByName(db, ' 弯举 ');

    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toMatch(/ORDER BY is_custom DESC/);
    // 验证前后空格被 trim
    expect(calls[0].args).toEqual(['%弯举%']);
  });

  it('searchByName 关键词为空时直接走 listExercises 路径', async () => {
    const { db, calls } = makeMockDB();
    await searchByName(db, '   ');

    // listExercises 也会调 getAllAsync,所以 calls.length === 1
    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toMatch(/ORDER BY is_custom DESC/);
    expect(calls[0].sql).not.toMatch(/LIKE/);
  });
});
