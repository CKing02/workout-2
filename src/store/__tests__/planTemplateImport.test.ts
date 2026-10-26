jest.mock('@/db', () => ({
  getDatabase: jest.fn(async () => ({})),
}));

jest.mock('@/db/repositories/planRepo', () => ({
  appendSetForPlanExercise: jest.fn(),
  createPlan: jest.fn(),
  deletePlan: jest.fn(async () => undefined),
  getPlan: jest.fn(),
  listPlansWithCount: jest.fn(async () => []),
  removeSetForPlanExerciseByIndex: jest.fn(),
  replaceExercise: jest.fn(),
  replaceSetsForPlanExercise: jest.fn(async () => undefined),
  setExerciseRestSeconds: jest.fn(),
  updatePlan: jest.fn(),
}));

jest.mock('@/db/repositories/exerciseRepo', () => ({
  getExercise: jest.fn(),
}));

import {
  createPlan,
  deletePlan,
  replaceSetsForPlanExercise,
} from '@/db/repositories/planRepo';
import { usePlanStore } from '@/store/planStore';

const mockCreatePlan = createPlan as jest.MockedFunction<typeof createPlan>;
const mockDeletePlan = deletePlan as jest.MockedFunction<typeof deletePlan>;
const mockReplaceSets = replaceSetsForPlanExercise as jest.MockedFunction<
  typeof replaceSetsForPlanExercise
>;

const planResult = {
  id: 'plan-template-copy',
  name: '史密斯上肢力量',
  createdAt: 100,
  updatedAt: 100,
  exerciseCount: 2,
  planExercisePairs: [
    { exerciseId: 'exercise-a', planExerciseId: 'plan-exercise-a' },
    { exerciseId: 'exercise-b', planExerciseId: 'plan-exercise-b' },
  ],
};

const input = {
  name: '史密斯上肢力量',
  exercises: [
    {
      exerciseId: 'exercise-a',
      restSeconds: 90,
      sets: [
        {
          setType: 'normal' as const,
          weight: 0,
          reps: 8,
          durationSeconds: 0,
          distanceKm: 0,
        },
      ],
    },
    {
      exerciseId: 'exercise-b',
      restSeconds: 60,
      sets: [
        {
          setType: 'normal' as const,
          weight: 0,
          reps: 12,
          durationSeconds: 0,
          distanceKm: 0,
        },
      ],
    },
  ],
};

describe('planStore.createFromTemplate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePlanStore.setState({ plans: [], detailById: {}, activePlanId: null });
    mockCreatePlan.mockResolvedValue(planResult);
    mockReplaceSets.mockResolvedValue(undefined);
  });

  it('copies exercises, rest intervals and set prescriptions into a private plan', async () => {
    await usePlanStore.getState().createFromTemplate(input);

    expect(mockCreatePlan).toHaveBeenCalledWith(
      expect.anything(),
      {
        name: input.name,
        exerciseIds: ['exercise-a', 'exercise-b'],
        restSecondsByExerciseId: {
          'exercise-a': 90,
          'exercise-b': 60,
        },
      },
    );
    expect(mockReplaceSets).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      'plan-exercise-a',
      input.exercises[0].sets,
    );
    expect(mockReplaceSets).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      'plan-exercise-b',
      input.exercises[1].sets,
    );
    expect(usePlanStore.getState().plans[0]).toMatchObject({
      id: planResult.id,
      name: planResult.name,
      exerciseCount: 2,
    });
  });

  it('removes the partial plan if a prescription write fails', async () => {
    mockReplaceSets
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('set write failed'));

    await expect(
      usePlanStore.getState().createFromTemplate(input),
    ).rejects.toThrow('set write failed');
    expect(mockDeletePlan).toHaveBeenCalledWith(
      expect.anything(),
      planResult.id,
    );
    expect(usePlanStore.getState().plans).toEqual([]);
  });
});
