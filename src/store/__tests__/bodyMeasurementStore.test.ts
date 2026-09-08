/**
 * US-12d — `useBodyMeasurementStore` mutate 行为测试。
 *
 * 项目惯例：纯函数 + 集成覆盖；zustand store 没有现存测试 pattern。
 * 这里 mock `@/db` 的 `getDatabase` + 复用真 repo,验证 store 缓存逻辑。
 *
 * 覆盖:
 *  - load: 拉数据填 store,设置 loaded=true
 *  - create: 新建的项放在 measurements 头部
 *  - update: 同 id 替换,顺序保持
 *  - remove: 删除后 store 不再包含
 */

import type { BodyMeasurement } from '@/db/schema';

const fakeRows: BodyMeasurement[] = [
  {
    id: '1',
    measuredDate: '2026-09-01',
    weightKg: 70,
    bodyFatPct: 18,
    note: null,
    createdAt: 1000,
    updatedAt: 1000,
  },
];

jest.mock('@/db/repositories/bodyMeasurementRepo', () => ({
  bodyMeasurementRepo: {
    listAll: jest.fn(async () => fakeRows),
    getById: jest.fn(),
    create: jest.fn(async (_db: unknown, input: any) => ({
      id: 'new-id',
      measuredDate: input.measuredDate,
      weightKg: input.weightKg,
      bodyFatPct: input.bodyFatPct,
      note: input.note,
      createdAt: 9000,
      updatedAt: 9000,
    })),
    update: jest.fn(async (_db: unknown, id: string, patch: any) => {
      const found = fakeRows.find((r) => r.id === id);
      if (!found) throw new Error('not found');
      return { ...found, ...patch, updatedAt: 9500 };
    }),
    delete: jest.fn(async () => undefined),
  },
}));

// mock getDatabase 返一个空 SQLiteDatabase 占位(repo 函数不直接用它,只过类型)
jest.mock('@/db', () => ({
  getDatabase: jest.fn(async () => ({})),
}));

import { useBodyMeasurementStore } from '@/store/bodyMeasurementStore';

beforeEach(() => {
  useBodyMeasurementStore.getState().resetForTests();
  fakeRows.length = 0;
  fakeRows.push({
    id: '1',
    measuredDate: '2026-09-01',
    weightKg: 70,
    bodyFatPct: 18,
    note: null,
    createdAt: 1000,
    updatedAt: 1000,
  });
});

describe('store/bodyMeasurementStore', () => {
  it('初始 state: 空 + loaded=false', () => {
    const s = useBodyMeasurementStore.getState();
    expect(s.measurements).toEqual([]);
    expect(s.loaded).toBe(false);
  });

  it('load: 拉到缓存 + loaded=true', async () => {
    await useBodyMeasurementStore.getState().load();
    const s = useBodyMeasurementStore.getState();
    expect(s.loaded).toBe(true);
    expect(s.measurements).toHaveLength(1);
    expect(s.measurements[0]!.id).toBe('1');
  });

  it('create: 新行放在最前', async () => {
    await useBodyMeasurementStore.getState().load();
    const created = await useBodyMeasurementStore.getState().create({
      measuredDate: '2026-09-08',
      weightKg: 72,
      bodyFatPct: null,
      note: '晨',
    });
    expect(created.id).toBe('new-id');
    const s = useBodyMeasurementStore.getState();
    expect(s.measurements).toHaveLength(2);
    expect(s.measurements[0]!.id).toBe('new-id');
  });

  it('update: 同 id 替换,其它不变', async () => {
    await useBodyMeasurementStore.getState().load();
    await useBodyMeasurementStore.getState().update('1', { weightKg: 71 });
    const s = useBodyMeasurementStore.getState();
    expect(s.measurements).toHaveLength(1);
    expect(s.measurements[0]!.weightKg).toBe(71);
    expect(s.measurements[0]!.bodyFatPct).toBe(18);
    expect(s.measurements[0]!.updatedAt).toBe(9500);
  });

  it('remove: 删除后 store 不再包含', async () => {
    await useBodyMeasurementStore.getState().load();
    await useBodyMeasurementStore.getState().remove('1');
    const s = useBodyMeasurementStore.getState();
    expect(s.measurements).toHaveLength(0);
  });

  it('同日多条保留(测试 create 多次后顺序)', async () => {
    await useBodyMeasurementStore.getState().load();
    await useBodyMeasurementStore.getState().create({
      measuredDate: '2026-09-08',
      weightKg: 70,
      bodyFatPct: null,
      note: '晨',
    });
    await useBodyMeasurementStore.getState().create({
      measuredDate: '2026-09-08',
      weightKg: 71,
      bodyFatPct: null,
      note: '晚',
    });
    const s = useBodyMeasurementStore.getState();
    expect(s.measurements).toHaveLength(3);
    // 新插入的在最前
    expect(s.measurements[0]!.note).toBe('晚');
    expect(s.measurements[1]!.note).toBe('晨');
  });
});
