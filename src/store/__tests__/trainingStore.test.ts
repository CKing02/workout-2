import type { ActiveTraining, ActiveSet } from '@/store/trainingStore';

jest.mock('@/db', () => ({ getDatabase: jest.fn(async () => ({
  withTransactionAsync: async (fn: () => Promise<void>) => fn(),
})) }));
jest.mock('@/db/repositories/trainingRepo', () => ({
  createTraining: jest.fn(async () => ({ id: 'next', planId: null, planNameSnapshot: null, startedAt: 1000 })),
  deleteTraining: jest.fn(async () => undefined),
  getTraining: jest.fn(async () => null),
  listTrainings: jest.fn(async () => []),
  updateTraining: jest.fn(),
  updateTrainingInTransaction: jest.fn(async () => undefined),
}));
jest.mock('@/db/repositories/trainingSetRepo', () => ({
  batchInsertTrainingSetsInTransaction: jest.fn(async () => undefined),
  getLastSetsForExercises: jest.fn(async () => ({})),
}));

import { useTrainingStore } from '@/store/trainingStore';
import { updateTrainingInTransaction } from '@/db/repositories/trainingRepo';
import { batchInsertTrainingSetsInTransaction } from '@/db/repositories/trainingSetRepo';

function seed(groups: Array<Array<Partial<ActiveSet>>>) {
  const active: ActiveTraining = {
    id: 'session', planId: null, planNameSnapshot: null, startedAt: Date.now() - 123000,
    exercises: groups.map((sets, i) => ({
      position: i, restSeconds: 60,
      exercise: { id: `ex${i}`, name: `动作${i}`, metricType: 'weight_reps' } as ActiveTraining['exercises'][number]['exercise'],
      sets: sets.map((patch, j) => ({
        clientId: `s${i}${j}`, trainingId: 'session', exerciseId: `ex${i}`,
        exerciseNameSnapshot: `动作${i}`, position: i, setIndex: j + 1,
        weight: null, reps: null, durationSeconds: null, distanceKm: null,
        setType: 'normal', completed: true, ...patch,
      })),
    })),
  };
  useTrainingStore.setState({ activeTraining: active, bestSet: null, completionSummary: null });
  return active;
}

beforeEach(() => {
  jest.clearAllMocks();
  useTrainingStore.setState({ activeTraining: null, bestSet: null, completionSummary: null, history: [] });
});

describe('duration plan targets', () => {
  const timeExercise = {
    id: 'plank',
    name: '平板支撑',
    metricType: 'time',
  } as ActiveTraining['exercises'][number]['exercise'];

  it('keeps the plan duration as a target and starts actual time empty', async () => {
    const active = await useTrainingStore.getState().startTraining({
      planId: 'plan-1',
      planNameSnapshot: '核心训练',
      exercises: [
        {
          exercise: timeExercise,
          restSeconds: 30,
          initialSets: [{ weight: 0, reps: 0, durationSeconds: 90, distanceKm: 0, setType: 'normal' }],
        },
      ],
    });

    expect(active.exercises[0].sets[0]).toMatchObject({
      targetDurationSeconds: 90,
      durationSeconds: null,
      weight: null,
      reps: null,
      distanceKm: null,
      metricTypeSnapshot: 'time',
    });
  });

  it('persists only the measured actual duration when training completes', async () => {
    const active = await useTrainingStore.getState().startTraining({
      planId: 'plan-1',
      planNameSnapshot: '核心训练',
      exercises: [
        {
          exercise: timeExercise,
          restSeconds: 30,
          initialSets: [{ durationSeconds: 90, setType: 'normal' }],
        },
      ],
    });
    const target = active.exercises[0].sets[0];
    useTrainingStore.getState().updateSet(0, target.clientId, {
      durationSeconds: 73,
    });
    useTrainingStore.getState().completeAndAdvance(0, target.clientId);

    await useTrainingStore.getState().completeTraining();

    const written = jest.mocked(batchInsertTrainingSetsInTransaction).mock.calls[0][1][0];
    expect(written.durationSeconds).toBe(73);
    expect(written.metricTypeSnapshot).toBe('time');
    expect(written.weight).toBeNull();
    expect(written.reps).toBeNull();
    expect(written.distanceKm).toBeNull();
    expect(written).not.toHaveProperty('targetDurationSeconds');
  });

  it('没有实际时长时拒绝把时间组标记为完成', async () => {
    const active = await useTrainingStore.getState().startTraining({
      planId: 'plan-1',
      planNameSnapshot: '核心训练',
      exercises: [
        {
          exercise: timeExercise,
          restSeconds: 30,
          initialSets: [{ durationSeconds: 90 }],
        },
      ],
    });
    const target = active.exercises[0].sets[0];
    expect(useTrainingStore.getState().completeAndAdvance(0, target.clientId)).toBe(false);
    expect(useTrainingStore.getState().activeTraining?.exercises[0].sets[0].completed).toBe(false);
  });
});

describe('G48 training summary', () => {
  it('completeTraining 选跨动作 weight × reps 最大的已完成非热身组', async () => {
    seed([[{ weight: 80, reps: 5 }, { weight: 60, reps: 10 }], [{ weight: 50, reps: 15 }]]);
    const result = await useTrainingStore.getState().completeTraining();
    expect(useTrainingStore.getState().bestSet).toEqual({ weight: 50, reps: 15, value: 750 });
    expect(result?.stats).toMatchObject({ totalVolume: 1750, setCount: 3 });
    expect(batchInsertTrainingSetsInTransaction).toHaveBeenCalledTimes(1);
  });

  it('热身和未完成组不参与容量/最佳组；总组数保留所有组', async () => {
    seed([[{ weight: 100, reps: 100, setType: 'warmup' },
      { weight: 200, reps: 100, completed: false }, { weight: 20, reps: 8 }]]);
    const result = await useTrainingStore.getState().completeTraining();
    expect(useTrainingStore.getState().bestSet).toEqual({ weight: 20, reps: 8, value: 160 });
    expect(useTrainingStore.getState().completionSummary?.totalAllSets).toBe(3);
    expect(result?.stats).toMatchObject({ totalVolume: 160, setCount: 2 });
    expect(jest.mocked(batchInsertTrainingSetsInTransaction).mock.calls[0][1]).toHaveLength(2);
  });

  it('动作数只统计至少完成一组的动作', () => {
    seed([[{ weight: 20, reps: 8 }], [{ completed: false }]]);
    const summary = useTrainingStore.getState().prepareTrainingSummary();
    expect(summary?.exerciseCount).toBe(1);
    expect(summary?.setCount).toBe(1);
    expect(summary?.totalAllSets).toBe(2);
  });

  it.each([null, 0, -10, NaN, Infinity])('无有效重量 %s 时最佳组为 null', async (weight) => {
    seed([[{ weight, reps: 10 }]]);
    await useTrainingStore.getState().completeTraining();
    expect(useTrainingStore.getState().bestSet).toBeNull();
    expect(useTrainingStore.getState().completionSummary?.totalVolume).toBe(0);
  });

  it.each([null, 0, -1, NaN, Infinity])('无有效次数 %s 时最佳组为 null', async (reps) => {
    seed([[{ weight: 40, reps }]]);
    await useTrainingStore.getState().completeTraining();
    expect(useTrainingStore.getState().bestSet).toBeNull();
  });

  it('同容量取首组，支持小数重量及递减/力竭组', async () => {
    seed([[{ weight: 12.5, reps: 8, setType: 'dropout' }, { weight: 20, reps: 5, setType: 'failure' }]]);
    await useTrainingStore.getState().completeTraining();
    expect(useTrainingStore.getState().bestSet).toEqual({ weight: 12.5, reps: 8, value: 100 });
  });

  it('入场只定格内存；保存复用时间，不累计停留总结页的时间', async () => {
    seed([[{ weight: 40, reps: 10 }]]);
    const summary = useTrainingStore.getState().prepareTrainingSummary();
    expect(updateTrainingInTransaction).not.toHaveBeenCalled();
    expect(useTrainingStore.getState().prepareTrainingSummary()).toBe(summary);
    const now = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 60000);
    const result = await useTrainingStore.getState().completeTraining();
    now.mockRestore();
    expect(result?.stats.durationSeconds).toBe(summary?.durationSeconds);
    expect(updateTrainingInTransaction).toHaveBeenCalledWith(expect.anything(), 'session',
      expect.objectContaining({ durationSeconds: summary?.durationSeconds, totalVolume: 400 }));
  });

  it('取消和开启下一次训练清空临时最佳组', async () => {
    seed([[{ weight: 40, reps: 10 }]]);
    useTrainingStore.getState().prepareTrainingSummary();
    useTrainingStore.getState().cancelTraining();
    expect(useTrainingStore.getState().bestSet).toBeNull();
    expect(useTrainingStore.getState().completionSummary).toBeNull();
    useTrainingStore.setState({ bestSet: { weight: 99, reps: 99, value: 9801 } });
    await useTrainingStore.getState().startTraining({ planId: null, planNameSnapshot: null, exercises: [] });
    expect(useTrainingStore.getState().bestSet).toBeNull();
  });

  it('无当前训练不保存', async () => {
    expect(await useTrainingStore.getState().completeTraining()).toBeNull();
    expect(updateTrainingInTransaction).not.toHaveBeenCalled();
  });
});
