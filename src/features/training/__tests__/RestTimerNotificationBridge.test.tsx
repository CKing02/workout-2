/**
 * G42 hotfix #2 — RestTimerNotificationBridge consumeExpired 监听单测
 *
 * 验证三件事:
 *  1. bridge mount 时调一次 `consumeExpiredRestTimerNotification()`
 *  2. AppState 'active' 时再调一次(锁屏 / 后台 → active 触发 consume)
 *  3. consume 返回 > 0 且 store 里剩余 ≤ 0 时,store 立即被清空(overlay 消失)
 *     —— 这是关键:receiver 唤起写 SP,JS 端在回前台时拿标记让 App 内
 *     `RestTimerOverlay` 立刻消失,而不是等 RAF tick 推进 state。
 *
 * 防御:
 *  - consume 返回 0(无 receiver 触发) → 不动 store
 *  - consume > 0 但 store 处于"新一轮进行中"(remaining > 0) → 不清 store,
 *    防止新轮被旧 expired 误杀
 *  - consume > 0 但 store 已 idle(startedAt=null) → 不动
 *
 * 断言策略:不用 jest.spyOn —— spy 会跨测试累积导致 flake。
 * 改成读 store 状态:markCompleted + skip 之后 store 字段全 null,
 * 通过断言 `startedAt === null && exerciseName === null && runId 不变`
 * 验证 skip 被调过(runId 单调增可作 marker:start 过一次后 runId≥1,
 * 若 skip 未调过 exerciseName 保留,若调过则清空)。
 *
 * 实现注:RN 0.86 + React 19 下,TestRenderer.create 会触发 "not wrapped in act"
 * warning(React 19 internal scheduler 把 initial render 视为 update),
 * 所有 TestRenderer.create 都包在 `act()` 里。
 */

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import type { AppStateStatus } from 'react-native';

/* ---- captured AppState listeners ----------------------------------------- */
type AppStateListener = (state: AppStateStatus) => void;
const appStateListeners: AppStateListener[] = [];
const mockAddEventListener = jest.fn(
  (_type: 'change', cb: AppStateListener) => {
    appStateListeners.push(cb);
    return {
      remove: () => {
        const i = appStateListeners.indexOf(cb);
        if (i >= 0) appStateListeners.splice(i, 1);
      },
    };
  },
);

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: (...args: unknown[]) =>
      (mockAddEventListener as unknown as (...a: unknown[]) => unknown)(...args),
  },
  Platform: {
    get OS() {
      return 'android';
    },
  },
}));

/* ---- mock restTimerNotification ---------------------------------------- */
const mockEnsureChannelAndPermissions = jest.fn();
const mockShowOrUpdate = jest.fn();
const mockDismiss = jest.fn();
const mockConsumeExpired = jest.fn();

jest.mock('../restTimerNotification', () => ({
  ensureChannelAndPermissions: (...args: unknown[]) =>
    mockEnsureChannelAndPermissions(...args),
  showOrUpdateRestTimerNotification: (...args: unknown[]) =>
    mockShowOrUpdate(...args),
  dismissRestTimerNotification: (...args: unknown[]) => mockDismiss(...args),
  consumeExpiredRestTimerNotification: (...args: unknown[]) =>
    mockConsumeExpired(...args),
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
}));

jest.mock('@/theme', () => ({
  useTheme: () => ({
    scheme: 'light',
    colors: { primary: '#FF6B35' },
  }),
}));

import { RestTimerNotificationBridge } from '../RestTimerNotificationBridge';
import { useRestTimerStore } from '../restTimerStore';

function flushAsync(): Promise<void> {
  // 让 useEffect 内的 async consume() 跑到 await 之后
  return new Promise((resolve) => setImmediate(resolve));
}

async function renderBridge(): Promise<void> {
  await act(async () => {
    TestRenderer.create(<RestTimerNotificationBridge />);
    // 等 mount 内 async (consumeExpired) 落地
    await flushAsync();
  });
}

function simulateAppState(state: AppStateStatus): void {
  act(() => {
    for (const cb of appStateListeners) cb(state);
  });
}

function resetStoreToIdle(): void {
  // 包在 act 里:React 19 的 internal scheduler 把 store 推送视为 update,
  // 不包 act 会触发 "not wrapped in act" warning。
  act(() => {
    useRestTimerStore.setState({
      startedAt: null,
      durationMs: null,
      completedAt: null,
      runId: 0,
      exerciseName: null,
    });
  });
}

describe('G42 consumeExpired:bridge mount + AppState active 监听', () => {
  beforeEach(() => {
    mockEnsureChannelAndPermissions.mockReset();
    mockShowOrUpdate.mockReset();
    mockDismiss.mockReset();
    mockConsumeExpired.mockReset();
    appStateListeners.length = 0;
    mockEnsureChannelAndPermissions.mockResolvedValue(undefined);
    mockShowOrUpdate.mockResolvedValue(undefined);
    mockDismiss.mockResolvedValue(undefined);
    mockConsumeExpired.mockResolvedValue(0); // 默认:无 expired

    // store 重置到 idle
    resetStoreToIdle();
  });

  it('mount:调一次 consumeExpiredRestTimerNotification', async () => {
    await renderBridge();
    expect(mockConsumeExpired).toHaveBeenCalledTimes(1);
  });

  it('consume 返回 0(无 receiver 触发)→ 不动 store', async () => {
    mockConsumeExpired.mockResolvedValue(0);

    // 模拟 store 里有进行中的轮
    useRestTimerStore.getState().start(60, '杠铃卧推');
    const startedAtBefore = useRestTimerStore.getState().startedAt;
    const runIdBefore = useRestTimerStore.getState().runId;

    await renderBridge();

    // store 不应被清空(startedAt 保留 + exerciseName 保留)
    const state = useRestTimerStore.getState();
    expect(state.completedAt).toBeNull();
    expect(state.startedAt).toBe(startedAtBefore);
    expect(state.exerciseName).toBe('杠铃卧推');
    expect(state.runId).toBe(runIdBefore);
  });

  it('consume > 0 + store 已 expired(remaining ≤ 0)→ store 立即被清空', async () => {
    mockConsumeExpired.mockResolvedValue(987654321);

    // 模拟"receiver 唤起前已经开启的轮"——startedAt 设为很久以前,
    // durationMs 设得相对很小,所以 remaining = durationMs - (now - startedAt)
    // 早已 ≤ 0
    useRestTimerStore.setState({
      startedAt: Date.now() - 100_000,
      durationMs: 30_000,
      completedAt: null,
      runId: 1,
      exerciseName: '杠铃卧推',
    });

    await renderBridge();

    expect(mockConsumeExpired).toHaveBeenCalledTimes(1);
    // markCompleted + skip 之后 store 应被清空(startedAt/durationMs/exerciseName 全 null)
    const state = useRestTimerStore.getState();
    expect(state.startedAt).toBeNull();
    expect(state.durationMs).toBeNull();
    expect(state.completedAt).toBeNull();
    expect(state.exerciseName).toBeNull();
  });

  it('consume > 0 + 新轮进行中(remaining > 0)→ 不清 store(保护新轮)', async () => {
    mockConsumeExpired.mockResolvedValue(987654321);

    // 模拟"receiver 唤起后用户开启了新轮"——
    // startedAt 设为现在,durationMs 足够大 → remaining > 0
    useRestTimerStore.getState().start(120, '哑铃划船');
    const startedAtBefore = useRestTimerStore.getState().startedAt;

    await renderBridge();

    // 防御生效:新轮不应被旧 expired 干掉
    const state = useRestTimerStore.getState();
    expect(state.exerciseName).toBe('哑铃划船');
    expect(state.startedAt).toBe(startedAtBefore);
    expect(state.durationMs).toBe(120_000);
    expect(state.completedAt).toBeNull();
  });

  it('consume > 0 + store 已 idle(startedAt=null)→ 不动', async () => {
    mockConsumeExpired.mockResolvedValue(987654321);

    // store 已在 idle 态(没 start 过)
    expect(useRestTimerStore.getState().startedAt).toBeNull();

    await renderBridge();

    // 没在跑的 timer → 不动 store
    const state = useRestTimerStore.getState();
    expect(state.startedAt).toBeNull();
    expect(state.durationMs).toBeNull();
    expect(state.exerciseName).toBeNull();
    expect(state.completedAt).toBeNull();
  });

  it('AppState active:再次调 consumeExpired', async () => {
    await renderBridge();
    expect(mockConsumeExpired).toHaveBeenCalledTimes(1); // mount

    // 模拟锁屏 → 解锁
    simulateAppState('active');
    await act(async () => {
      await flushAsync();
    });

    expect(mockConsumeExpired).toHaveBeenCalledTimes(2);
  });

  it('AppState background → 不调 consumeExpired(只 active 才触发)', async () => {
    await renderBridge();
    expect(mockConsumeExpired).toHaveBeenCalledTimes(1); // mount

    simulateAppState('background');
    await act(async () => {
      await flushAsync();
    });
    expect(mockConsumeExpired).toHaveBeenCalledTimes(1); // 不增

    simulateAppState('inactive');
    await act(async () => {
      await flushAsync();
    });
    expect(mockConsumeExpired).toHaveBeenCalledTimes(1); // 仍不增

    // 再来一次 active 才增
    simulateAppState('active');
    await act(async () => {
      await flushAsync();
    });
    expect(mockConsumeExpired).toHaveBeenCalledTimes(2);
  });

  it('AppState active + consume > 0 + expired → store 清空', async () => {
    await renderBridge();
    expect(mockConsumeExpired).toHaveBeenCalledTimes(1);

    // 切回前台时让 consume 返回 expired
    mockConsumeExpired.mockResolvedValueOnce(111111111);
    useRestTimerStore.setState({
      startedAt: Date.now() - 100_000,
      durationMs: 30_000,
      completedAt: null,
      runId: 5,
      exerciseName: '杠铃卧推',
    });

    simulateAppState('active');
    await act(async () => {
      await flushAsync();
    });

    expect(mockConsumeExpired).toHaveBeenCalledTimes(2);
    expect(useRestTimerStore.getState().startedAt).toBeNull();
    expect(useRestTimerStore.getState().exerciseName).toBeNull();
  });

  it('unmount:AppState listener 被 remove,后续 broadcast 不触发 consume', async () => {
    let tree: TestRenderer.ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(<RestTimerNotificationBridge />);
      await flushAsync();
    });
    expect(mockConsumeExpired).toHaveBeenCalledTimes(1);

    await act(async () => {
      tree?.unmount();
    });

    // unmount 后 listener 应已被 remove;appStateListeners 数组为空。
    expect(appStateListeners.length).toBe(0);

    // 模拟一个"广播" — 不会触发任何 consume 调用(因为没有 listener)
    simulateAppState('active');
    await act(async () => {
      await flushAsync();
    });
    expect(mockConsumeExpired).toHaveBeenCalledTimes(1); // 仍是 1
  });
});