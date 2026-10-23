import type { SQLiteDatabase } from 'expo-sqlite';

import { CURRENT_VERSION, MIGRATIONS } from '@/db/migrations';

describe('migration v12 — training set metric snapshot', () => {
  const migration = MIGRATIONS.find((item) => item.version === 12);

  it('是当前最新 migration，并同时加列和回填', () => {
    expect(CURRENT_VERSION).toBe(12);
    expect(migration).toBeDefined();
    expect(migration?.sql).toContain('metric_type_snapshot');
    expect(migration?.sql).toContain('exercises');
  });

  it('旧库加列成功后按 exercise_id 回填 metric_type', async () => {
    const execAsync = jest.fn(async () => undefined);
    const runAsync = jest.fn(async () => ({ changes: 1, lastInsertRowId: 0 }));
    const db = { execAsync, runAsync } as unknown as SQLiteDatabase;

    await migration?.run?.(db);

    expect(execAsync).toHaveBeenCalledWith(
      expect.stringContaining('ADD COLUMN metric_type_snapshot'),
    );
    expect(runAsync).toHaveBeenCalledWith(expect.stringContaining('e.metric_type'));
  });

  it('新库列已存在时仍继续执行回填，保持幂等', async () => {
    const execAsync = jest.fn(async () => {
      throw new Error('duplicate column name: metric_type_snapshot');
    });
    const runAsync = jest.fn(async () => ({ changes: 0, lastInsertRowId: 0 }));
    const db = { execAsync, runAsync } as unknown as SQLiteDatabase;

    await expect(migration?.run?.(db)).resolves.toBeUndefined();
    expect(runAsync).toHaveBeenCalledTimes(1);
  });
});
