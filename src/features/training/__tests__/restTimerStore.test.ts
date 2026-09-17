/**
 * restTimerStore 单测 — 锁定 extend / start / skip / markCompleted 的 store 行为
 *
 * 不涉及 UI / React,直接驱动 store 验证 mutate 后状态字段。
 * G38.1 真机报"+15s 不能用",先验证 store 端逻辑,排除 store 自身 bug。
 */

import { useRestTimerStore, getRemainingMs } from '../restTimerStore';

describe('G7 restTimerStore', () => {
  beforeEach(() => {
    // 重置 store 到 idle
    useRestTimerStore.getState().skip();
  });

  it('start:写入 startedAt/durationMs/completedAt=null,runId 单调增', () => {
    const before = useRestTimerStore.getState();
    useRestTimerStore.getState().start(60);
    const after = useRestTimerStore.getState();
    expect(after.startedAt).toBeGreaterThan(0);
    expect(after.durationMs).toBe(60_000);
    expect(after.completedAt).toBeNull();
    expect(after.runId).toBe(before.runId + 1);
    // 默认匿名(没传 exerciseName) → exerciseName=null
    expect(after.exerciseName).toBeNull();
  });

  it('start:传 exerciseName → 写入 store,trim 空白', () => {
    useRestTimerStore.getState().start(60, '  杠铃卧推  ');
    expect(useRestTimerStore.getState().exerciseName).toBe('杠铃卧推');

    useRestTimerStore.getState().start(30, '哑铃划船');
    expect(useRestTimerStore.getState().exerciseName).toBe('哑铃划船');
  });

  it('start:空串 / 全空白 exerciseName → 规范化成 null', () => {
    useRestTimerStore.getState().start(60, '');
    expect(useRestTimerStore.getState().exerciseName).toBeNull();

    useRestTimerStore.getState().start(30, '   ');
    expect(useRestTimerStore.getState().exerciseName).toBeNull();
  });

  it('start:不传 exerciseName(原签名) → 不报错,exerciseName=null', () => {
    // 兼容既有调用点(无第二个参数的旧用法)
    useRestTimerStore.getState().start(60);
    expect(useRestTimerStore.getState().exerciseName).toBeNull();
  });

  it('extend:动作名保留(extend 不算换动作)', () => {
    useRestTimerStore.getState().start(60, '杠铃卧推');
    useRestTimerStore.getState().extend(15);
    expect(useRestTimerStore.getState().exerciseName).toBe('杠铃卧推');
  });

  it('skip:清空 exerciseName', () => {
    useRestTimerStore.getState().start(60, '杠铃卧推');
    useRestTimerStore.getState().skip();
    expect(useRestTimerStore.getState().exerciseName).toBeNull();
  });

  it('extend:进行中 → 只 durationMs += 15000, startedAt 不动', () => {
    useRestTimerStore.getState().start(60);
    const before = useRestTimerStore.getState();
    const beforeRemaining = getRemainingMs(before);

    useRestTimerStore.getState().extend(15);
    const after = useRestTimerStore.getState();

    // G38.1 修复:只动 durationMs,startedAt 不动(否则 remaining 相抵 no-op)
    expect(after.startedAt).toBe(before.startedAt);
    expect(after.durationMs).toBe(before.durationMs! + 15_000);
    // 剩余时间应该 +15s(G38.1 修复前是 0,真机报 +15s 不能用就是这个 bug)
    const remainingDelta = getRemainingMs(after) - beforeRemaining;
    expect(remainingDelta).toBeGreaterThanOrEqual(14_000);
    expect(remainingDelta).toBeLessThanOrEqual(16_000);
    // runId 不变(extend 不算新一轮)
    expect(after.runId).toBe(before.runId);
  });

  it('extend:已完成(completedAt 翻 number)→ 重置为新 15s 计时', () => {
    useRestTimerStore.getState().start(60);
    // 模拟"自然到 0":手工 markCompleted
    useRestTimerStore.setState({ completedAt: Date.now() });

    useRestTimerStore.getState().extend(15);
    const after = useRestTimerStore.getState();
    // 重新计 15s
    expect(after.durationMs).toBe(15_000);
    expect(after.completedAt).toBeNull();
    // startedAt 应该接近 now
    expect(after.startedAt!).toBeGreaterThan(Date.now() - 1000);
  });

  it('extend:idle(startedAt/durationMs 都 null) → no-op', () => {
    // skip 后 store 是 idle
    const beforeRunId = useRestTimerStore.getState().runId;
    useRestTimerStore.getState().extend(15);
    const after = useRestTimerStore.getState();
    expect(after.startedAt).toBeNull();
    expect(after.durationMs).toBeNull();
    // runId 是单调递增的,跨测试累加是 by-design;这里只断言 extend 不增 runId
    expect(after.runId).toBe(beforeRunId);
  });

  it('skip:idle → no-op', () => {
    // idle 状态再 skip
    const before = useRestTimerStore.getState();
    useRestTimerStore.getState().skip();
    const after = useRestTimerStore.getState();
    expect(after).toEqual(before);
  });
});
