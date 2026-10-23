/**
 * §13.1 — `buildBackupPayload` 的**计划处方导出**回归测。
 *
 * 与 importDataDbWrite.test.ts 互为另一半：
 *   那边管「payload 里有组 → 真的写进 plan_sets」，
 *   这边管「DB 里有组 → payload 里真的带了」。
 *
 * 缺任何一半，同一个用户可见的 bug（导出→导入丢处方）都能复活：
 * 只测导入端的话，将来有人把这条 LEFT JOIN 改回单表 SELECT，
 * 导入端测试照样全绿 —— 因为 payload 里本来就没有 sets 可写。
 *
 * ⚠️ 不要整体 mock `expo-modules-core`（原因见 avatarFile.test.ts 顶部）。
 */

/** 记下导出端实际发出的 SQL，便于断言 JOIN 还在。 */
const mockQueries: { sql: string; params?: unknown[] }[] = [];

/** 这条查询的结果 —— 由每个用例设。 */
let joinRows: unknown[] = [];

const mockDb = {
  getAllAsync: async (sql: string, params?: unknown[]) => {
    mockQueries.push({ sql, params });
    if (sql.includes('FROM plan_exercises')) return joinRows as never;
    return [] as never;
  },
};

jest.mock('@/db', () => ({
  __esModule: true,
  getDatabase: async () => mockDb,
}));

// 其余 6 张表不是本文件的被测对象，直接给空 —— 这样只有 plan_exercises
// 那条 JOIN 会走到 mockDb，断言不用跟别的查询抢。
jest.mock('@/db/repositories/exerciseRepo', () => ({ listExercises: async () => [] }));
jest.mock('@/db/repositories/planRepo', () => ({ listPlansWithCount: async () => [] }));
jest.mock('@/db/repositories/trainingRepo', () => ({ listTrainings: async () => [] }));
jest.mock('@/db/repositories/settingsRepo', () => ({ listSettings: async () => ({}) }));
jest.mock('@/db/repositories/errorLogRepo', () => ({ listErrors: async () => [] }));
jest.mock('@/db/repositories/bodyMeasurementRepo', () => ({ listBodyMeasurements: async () => [] }));
jest.mock('@/db/repositories/trainingSetRepo', () => ({ listSetsByTraining: async () => [] }));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { buildBackupPayload, CURRENT_SCHEMA_VERSION } =
  require('@/utils/exportData') as typeof import('@/utils/exportData');

/** LEFT JOIN 拉平后的一行：一个 plan_exercise 的一个 set。 */
function joinRow(overrides: Record<string, unknown> = {}) {
  return {
    plan_id: 'p1',
    exercise_id: 'e1',
    position: 1,
    rest_seconds: 90,
    set_index: 1,
    set_type: 'normal',
    weight: 60,
    reps: 10,
    duration_seconds: 0,
    distance_km: 0,
    ...overrides,
  };
}

beforeEach(() => {
  mockQueries.length = 0;
  joinRows = [];
});

describe('buildBackupPayload — 计划处方导出', () => {
  it('schemaVersion 是 3（历史组携带 metricTypeSnapshot）', async () => {
    const payload = await buildBackupPayload();
    expect(CURRENT_SCHEMA_VERSION).toBe(3);
    expect(payload.schemaVersion).toBe(3);
  });

  it('取计划动作那条 SQL 必须 JOIN plan_sets 且带 rest_seconds', async () => {
    await buildBackupPayload();

    const q = mockQueries.find((m) => m.sql.includes('FROM plan_exercises'));
    expect(q).toBeDefined();
    // 拆掉 JOIN 就退回「导出端不带你」的老 bug
    expect(q!.sql).toContain('plan_sets');
    expect(q!.sql).toContain('LEFT JOIN');
    expect(q!.sql).toContain('rest_seconds');
  });

  it('同一 link 的多个组归到一项，按 setIndex 升序、值原样带出', async () => {
    joinRows = [
      joinRow({ set_index: 1, set_type: 'warmup', weight: 20, reps: 12 }),
      joinRow({ set_index: 2, set_type: 'normal', weight: 60, reps: 10 }),
      joinRow({ set_index: 3, set_type: 'failure', weight: 80, reps: 6 }),
    ];

    const payload = await buildBackupPayload();

    expect(payload.planExercises).toHaveLength(1);
    const link = payload.planExercises[0]!;
    expect(link).toMatchObject({ planId: 'p1', exerciseId: 'e1', position: 1, restSeconds: 90 });
    expect(link.sets).toEqual([
      { setIndex: 1, setType: 'warmup', weight: 20, reps: 12, durationSeconds: 0, distanceKm: 0 },
      { setIndex: 2, setType: 'normal', weight: 60, reps: 10, durationSeconds: 0, distanceKm: 0 },
      { setIndex: 3, setType: 'failure', weight: 80, reps: 6, durationSeconds: 0, distanceKm: 0 },
    ]);
    expect(payload.counts.planSets).toBe(3);
  });

  it('restSeconds 带的是用户设的值，不是常量 60', async () => {
    joinRows = [joinRow({ rest_seconds: 150 })];
    const payload = await buildBackupPayload();
    expect(payload.planExercises[0]!.restSeconds).toBe(150);
  });

  it('⋯ duration / distance 类动作也带出来', async () => {
    joinRows = [joinRow({ duration_seconds: 45, distance_km: 1.5, weight: 0, reps: 0 })];
    const payload = await buildBackupPayload();
    expect(payload.planExercises[0]!.sets[0]).toMatchObject({
      durationSeconds: 45,
      distanceKm: 1.5,
    });
  });

  it('还没配组的 link（LEFT JOIN 出 NULL 行）→ sets 为空数组且该 link 仍在', async () => {
    joinRows = [
      joinRow({ set_index: null, set_type: null, weight: null, reps: null, duration_seconds: null, distance_km: null }),
    ];

    const payload = await buildBackupPayload();

    expect(payload.planExercises).toHaveLength(1);
    expect(payload.planExercises[0]!.sets).toEqual([]);
    expect(payload.planExercises[0]!.restSeconds).toBe(90);
    expect(payload.counts.planSets).toBe(0);
  });

  it('同计划里同一动作排两次（position 不同）→ 各归各的组', async () => {
    joinRows = [
      joinRow({ position: 1, set_index: 1, weight: 60 }),
      joinRow({ position: 2, set_index: 1, weight: 40 }),
    ];

    const payload = await buildBackupPayload();

    expect(payload.planExercises).toHaveLength(2);
    expect(payload.planExercises.map((pe) => pe.sets[0]!.weight)).toEqual([60, 40]);
    expect(payload.planExercises.map((pe) => pe.position)).toEqual([1, 2]);
  });

  it('空库也能导出：planExercises 是 []，结构完整', async () => {
    const payload = await buildBackupPayload();
    expect(payload.planExercises).toEqual([]);
    expect(payload.counts.planSets).toBe(0);
  });
});
