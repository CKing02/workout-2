/**
 * restSeconds 端到端流动测试 —— 模拟真实 PlanEditor → save → startTraining 路径。
 *
 * 复现用户报告: "第一次新建计划,设置休息 30s,保存后开始训练,间歇变 60s"。
 */

import { usePlanStore } from '@/store/planStore';
import { useTrainingStore } from '@/store/trainingStore';
import { STUB_NEW_PLAN_ID } from '@/constants/plan';

interface MockDB {
  getAllAsync: jest.Mock;
  getFirstAsync: jest.Mock;
  runAsync: jest.Mock;
  prepareAsync: jest.Mock;
  withTransactionAsync: jest.Mock;
}

function makeMockDB(): { db: MockDB; plans: Map<string, any>; planExercises: Map<string, any>; trainings: Map<string, any>; trainingSets: any[] } {
  const plans = new Map<string, any>();
  const planExercises = new Map<string, any>();
  const trainings = new Map<string, any>();
  let trainingSets: any[] = [];
  const exercisesTable = new Map<string, any>([
    ['ex1', {
      id: 'ex1', name: '深蹲', muscle_group: '腿', secondary_muscles: '[]',
      equipment: '杠铃', metric_type: 'reps', image_uri: null, is_custom: 0,
      created_at: 0, description_zh: null, steps_zh: null, gif_url: null,
      target_zh: null, attribution: null,
    }],
  ]);
  const db: MockDB = {
    getAllAsync: jest.fn(async (sql: string, args: unknown[] = []) => {
      if (/FROM\s+exercises/i.test(sql) && /WHERE\s+id\s+IN/i.test(sql)) {
        return args.map((id) => exercisesTable.get(id as string)).filter(Boolean);
      }
      if (/FROM\s+plan_sets/i.test(sql)) return [];
      if (/FROM\s+trainings/i.test(sql) && /WHERE id\s*=\s*\?/i.test(sql)) {
        const id = args[0] as string;
        return trainings.get(id) ? [trainings.get(id)] : [];
      }
      if (/FROM\s+trainings/i.test(sql)) return Array.from(trainings.values());
      if (/FROM\s+training_sets/i.test(sql)) return trainingSets;
      if (/FROM\s+plans/i.test(sql) && /WHERE id\s*=\s*\?/i.test(sql)) {
        const id = args[0] as string;
        return plans.get(id) ? [plans.get(id)] : [];
      }
      if (/FROM\s+plans/i.test(sql)) return Array.from(plans.values());
      if (/FROM\s+plan_exercises/i.test(sql)) {
        if (/WHERE plan_id\s*=\s*\?/i.test(sql)) {
          const planId = args[0] as string;
          return Array.from(planExercises.values()).filter((pe) => pe.plan_id === planId);
        }
      }
      return [];
    }),
    getFirstAsync: jest.fn(async (sql: string, args: unknown[] = []) => {
      if (/FROM\s+plans/i.test(sql)) return plans.get(args[0] as string) ?? null;
      if (/FROM\s+trainings/i.test(sql)) return trainings.get(args[0] as string) ?? null;
      return null;
    }),
    runAsync: jest.fn(async (sql: string, args: unknown[] = []) => {
      if (/INSERT\s+INTO\s+plans/i.test(sql)) {
        const [id, name, created_at, updated_at] = args as [string, string, number, number];
        plans.set(id, { id, name, created_at, updated_at });
        return { changes: 1, lastInsertRowId: 0 };
      }
      if (/INSERT\s+INTO\s+trainings/i.test(sql)) {
        const [id, plan_id, plan_name_snapshot, started_at] = args as [string, string, string, number];
        trainings.set(id, { id, plan_id, plan_name_snapshot, started_at, ended_at: null });
        return { changes: 1, lastInsertRowId: 0 };
      }
      if (/INSERT\s+INTO\s+training_sets/i.test(sql)) {
        const [id, training_id, exercise_id, exercise_name_snapshot, position, set_index,
              weight, reps, duration_seconds, distance_km, set_type, completed, completed_at] = args as any[];
        trainingSets.push({
          id, training_id, exercise_id, exercise_name_snapshot, position, set_index,
          weight, reps, duration_seconds, distance_km, set_type, completed, completed_at,
        });
        return { changes: 1, lastInsertRowId: 0 };
      }
      if (/DELETE\s+FROM\s+plan_exercises/i.test(sql)) {
        planExercises.delete(args[0] as string);
        return { changes: 1, lastInsertRowId: 0 };
      }
      if (/DELETE\s+FROM\s+training_sets/i.test(sql)) {
        trainingSets = [];
        return { changes: 1, lastInsertRowId: 0 };
      }
      if (/DELETE\s+FROM\s+trainings/i.test(sql)) {
        trainings.delete(args[0] as string);
        return { changes: 1, lastInsertRowId: 0 };
      }
      return { changes: 0, lastInsertRowId: 0 };
    }),
    prepareAsync: jest.fn(async (sql: string) => ({
      executeAsync: jest.fn(async (args: unknown[]) => {
        if (/INSERT\s+INTO\s+plan_exercises/i.test(sql)) {
          const [id, plan_id, exercise_id, position, rest_seconds] = args as [string, string, string, number, number];
          planExercises.set(id, { id, plan_id, exercise_id, position, rest_seconds });
          return { changes: 1, lastInsertRowId: 0 };
        }
        return { changes: 0, lastInsertRowId: 0 };
      }),
      finalizeAsync: jest.fn(async () => undefined),
    })),
    withTransactionAsync: jest.fn(async (fn: () => Promise<void>) => fn()),
  };
  return { db, plans, planExercises, trainings, trainingSets };
}

jest.mock('@/db', () => ({ getDatabase: jest.fn() }));
import { getDatabase } from '@/db';
const mockGetDatabase = getDatabase as jest.Mock;

describe('restSeconds 端到端: 新建计划 → 设置 rest → 保存 → 训练中', () => {
  beforeEach(() => {
    usePlanStore.setState({ plans: [], detailById: {}, activePlanId: null });
    useTrainingStore.setState({
      activeTraining: null,
      history: [],
      completionSummary: null,
      currentExerciseIndex: 0,
      currentSetIndex: 0,
      bestSet: null,
      lastSetsByExerciseId: {},
    });
    jest.clearAllMocks();
  });

  it('防御性显式透传: 用户在 PlanEditor 把 rest 从 60 改成 30,handleSave 显式传 restSecondsByExerciseId,DB 写入 30', async () => {
    const { db, planExercises } = makeMockDB();
    mockGetDatabase.mockResolvedValue(db);

    // 1. 模拟 PlanEditor 写入 STUB_NEW_PLAN_ID
    usePlanStore.setState((state) => ({
      ...state,
      detailById: {
        ...state.detailById,
        [STUB_NEW_PLAN_ID]: {
          exercises: [{
            id: 'tmp_pe1_aaa',
            planId: STUB_NEW_PLAN_ID,
            exerciseId: 'ex1',
            position: 0,
            restSeconds: 30,  // ← 用户改了 30s
            exercise: { id: 'ex1', name: '深蹲', muscleGroup: '腿' } as any,
            sets: [],
          }],
          exerciseIds: ['ex1'],
        },
      },
      activePlanId: STUB_NEW_PLAN_ID,
    }));

    // 2. handleSave 的调用 — 模拟显式构造 restSecondsByExerciseId 并传 createPlan
    const detail = usePlanStore.getState().detailById[STUB_NEW_PLAN_ID];
    const restSecondsByExerciseId: Record<string, number> = {};
    for (const pe of detail?.exercises ?? []) {
      restSecondsByExerciseId[pe.exerciseId] = pe.restSeconds;
    }

    // 调用 planStore.create (显式传 restSecondsByExerciseId)
    const created = await usePlanStore.getState().create({
      name: '腿日',
      exerciseIds: detail.exerciseIds,
      restSecondsByExerciseId,
    });
    expect(created).toBeTruthy();

    // 3. DB 写入 = 30
    const dbPEs = Array.from(planExercises.values());
    expect(dbPEs).toHaveLength(1);
    expect(dbPEs[0].rest_seconds).toBe(30);

    // 4. loadDetail 读回 30
    const loaded = await usePlanStore.getState().loadDetail(created.id);
    expect(loaded!.exercises[0].restSeconds).toBe(30);

    // 5. startTraining 写入 activeTraining.restSeconds=30
    await useTrainingStore.getState().startTraining({
      planId: created.id,
      planNameSnapshot: '腿日',
      exercises: loaded!.exercises.map((pe) => ({
        exercise: pe.exercise,
        restSeconds: pe.restSeconds,
      })),
    });

    const active = useTrainingStore.getState().activeTraining!;
    expect(active.exercises[0].restSeconds).toBe(30);
  });
});
