/**
 * G38.3 latent fix — 跨 store 同步行为测试。
 *
 * 覆盖 initExerciseSync() 的契约:
 *  - useExerciseStore.exercises 变化 → planStore 内的 PlanExerciseDraft.exercise
 *    引用同步刷新,未变的行引用不变(避免无谓重渲染)。
 *  - useExerciseStore.exercises 引用没变(state 里其它字段变,比如 loading)→ no-op。
 *  - trainingStore.activeTraining.exercises[].exercise 同样同步。
 *  - 多次 initExerciseSync() 是幂等的(只一份订阅)。
 *  - teardown 后订阅断开,exerciseStore 变化不再同步到 planStore。
 *
 * 真实拉 repo 太重(要 mock @/db/repositories/*),这里直接走 zustand setState
 * 喂数据,验证的是同步逻辑而不是 store 自身的 CRUD。
 */

import type { Exercise } from '@/db/schema';
import { useExerciseStore } from '@/store/exerciseStore';
import { usePlanStore, type PlanExerciseDraft } from '@/store/planStore';
import { useTrainingStore, type ActiveExercise } from '@/store/trainingStore';
import { initExerciseSync } from '@/store/syncExerciseToStores';

function makeExercise(id: string, overrides: Partial<Exercise> = {}): Exercise {
  return {
    id,
    name: `ex-${id}`,
    muscleGroup: '胸',
    secondaryMuscles: [],
    equipment: '杠铃',
    metricType: 'weight_reps',
    imageUri: null,
    isCustom: true,
    createdAt: 1000,
    instructionsZh: null,
    instructionStepsZh: null,
    gifUrl: null,
    targetMuscle: 'chest',
    attribution: null,
    ...overrides,
  };
}

function makePlanDraft(exercise: Exercise): PlanExerciseDraft {
  return {
    id: `pe-${exercise.id}`,
    planId: 'plan-1',
    exerciseId: exercise.id,
    position: 0,
    restSeconds: 90,
    exercise,
    sets: [],
  };
}

function makeActiveExercise(exercise: Exercise): ActiveExercise {
  return {
    position: 0,
    exercise,
    restSeconds: 90,
    sets: [],
  };
}

function resetStores() {
  useExerciseStore.setState({ exercises: [] });
  usePlanStore.setState({ detailById: {} });
  useTrainingStore.setState({ activeTraining: null });
}

describe('initExerciseSync', () => {
  beforeEach(() => {
    // teardown 上一次的订阅,避免跨测试污染
    teardownLast();
    resetStores();
  });

  afterAll(() => {
    teardownLast();
  });

  function teardownLast() {
    // 通过 teardown 函数解绑,本测试文件里 keep 一个 module-level handle
    if (currentTeardown) {
      currentTeardown();
      currentTeardown = null;
    }
  }

  let currentTeardown: (() => void) | null = null;
  function setup() {
    currentTeardown = initExerciseSync();
  }

  it('idempotent: 多次 initExerciseSync 只装一份订阅(且返回同一个 teardown)', () => {
    setup();
    const first = currentTeardown;
    const second = initExerciseSync();
    const third = initExerciseSync();
    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  it('exerciseStore 更新 → planStore.detailById 里 snapshot 引用换新', () => {
    const oldEx = makeExercise('A', { metricType: 'weight_reps' });
    const newEx = makeExercise('A', { metricType: 'time' });
    useExerciseStore.setState({ exercises: [oldEx] });
    usePlanStore.setState({
      detailById: { 'plan-1': { exercises: [makePlanDraft(oldEx)], exerciseIds: ['A'] } },
    });

    setup();

    // 触发 change:exercises 引用变了
    useExerciseStore.setState({ exercises: [newEx] });

    const synced = usePlanStore.getState().detailById['plan-1'].exercises[0].exercise;
    expect(synced).toBe(newEx);
    expect(synced.metricType).toBe('time');
  });

  it('exerciseStore 引用没变(只变 loading 之类) → planStore no-op,引用不刷新', () => {
    const ex = makeExercise('A');
    useExerciseStore.setState({ exercises: [ex] });
    usePlanStore.setState({
      detailById: { 'plan-1': { exercises: [makePlanDraft(ex)], exerciseIds: ['A'] } },
    });

    setup();

    const before = usePlanStore.getState().detailById['plan-1'].exercises[0];
    // 改 loading 但 exercises 引用没变
    useExerciseStore.setState({ loading: true });
    const after = usePlanStore.getState().detailById['plan-1'].exercises[0];

    expect(after).toBe(before);
    expect(after.exercise).toBe(ex);
  });

  it('planStore 里多 plan / 多 draft,只 refresh 真变的行', () => {
    const a = makeExercise('A', { metricType: 'weight_reps' });
    const b = makeExercise('B', { metricType: 'time' });
    const a_v2 = makeExercise('A', { metricType: 'km' });
    useExerciseStore.setState({ exercises: [a, b] });
    usePlanStore.setState({
      detailById: {
        plan1: { exercises: [makePlanDraft(a), makePlanDraft(b)], exerciseIds: ['A', 'B'] },
        plan2: { exercises: [makePlanDraft(b)], exerciseIds: ['B'] },
      },
    });

    setup();

    // 只 A 变了,B 不变
    useExerciseStore.setState({ exercises: [a_v2, b] });

    const p1 = usePlanStore.getState().detailById['plan1'].exercises;
    const p2 = usePlanStore.getState().detailById['plan2'].exercises;
    expect(p1[0].exercise).toBe(a_v2);
    expect(p1[1].exercise).toBe(b);
    expect(p2[0].exercise).toBe(b);
  });

  it('exercise 被删(byId.get 返 undefined)→ 保持旧 snapshot,不抛', () => {
    const a = makeExercise('A');
    useExerciseStore.setState({ exercises: [a] });
    usePlanStore.setState({
      detailById: { 'plan-1': { exercises: [makePlanDraft(a)], exerciseIds: ['A'] } },
    });

    setup();

    // 删了 A,exercises 引用变了
    useExerciseStore.setState({ exercises: [] });

    const still = usePlanStore.getState().detailById['plan-1'].exercises[0];
    expect(still.exercise).toBe(a);
  });

  it('exerciseStore 更新 → trainingStore.activeTraining.exercises 也同步', () => {
    const oldEx = makeExercise('A', { metricType: 'weight_reps' });
    const newEx = makeExercise('A', { metricType: 'time' });
    useExerciseStore.setState({ exercises: [oldEx] });
    useTrainingStore.setState({
      activeTraining: {
        id: 't1',
        planId: 'plan-1',
        planNameSnapshot: 'P',
        startedAt: 100,
        exercises: [makeActiveExercise(oldEx)],
      },
    });

    setup();

    useExerciseStore.setState({ exercises: [newEx] });

    const active = useTrainingStore.getState().activeTraining!.exercises[0];
    expect(active.exercise).toBe(newEx);
  });

  it('trainingStore.activeTraining 是 null → no-op', () => {
    useExerciseStore.setState({ exercises: [makeExercise('A')] });
    useTrainingStore.setState({ activeTraining: null });

    setup();

    // 触发变化,不应该报错也不应该改 state
    expect(() =>
      useExerciseStore.setState({ exercises: [makeExercise('A', { metricType: 'km' })] }),
    ).not.toThrow();
    expect(useTrainingStore.getState().activeTraining).toBeNull();
  });

  it('teardown 后订阅断开,exerciseStore 变化不再同步', () => {
    const a = makeExercise('A');
    const a_v2 = makeExercise('A', { metricType: 'time' });
    useExerciseStore.setState({ exercises: [a] });
    usePlanStore.setState({
      detailById: { 'plan-1': { exercises: [makePlanDraft(a)], exerciseIds: ['A'] } },
    });

    setup();
    teardownLast();

    useExerciseStore.setState({ exercises: [a_v2] });

    const still = usePlanStore.getState().detailById['plan-1'].exercises[0];
    expect(still.exercise).toBe(a); // 还是旧的
  });

  it('init 时立即同步一次(boot 阶段 reload 已完成场景)', () => {
    const a = makeExercise('A');
    useExerciseStore.setState({ exercises: [a] });
    usePlanStore.setState({
      detailById: { 'plan-1': { exercises: [makePlanDraft(a)], exerciseIds: ['A'] } },
    });

    // 不调用 setState 触发,直接 initExerciseSync,应当 no-op(已经是 live 引用)
    setup();

    const still = usePlanStore.getState().detailById['plan-1'].exercises[0];
    expect(still.exercise).toBe(a);
  });
});
