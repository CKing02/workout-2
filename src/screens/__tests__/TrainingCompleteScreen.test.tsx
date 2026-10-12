import React from 'react';
import { Alert, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import type { TrainingSummary } from '@/store/trainingStore';

const mockPop = jest.fn();
const mockSave = jest.fn();
const mockCancel = jest.fn();
let mockSummary: TrainingSummary | null = null;
let mockTransitionEnd: (event: { data: { closing: boolean } }) => void;
const mockUnsubscribe = jest.fn();
const mockNavigation = {
  popToTop: mockPop,
  addListener: jest.fn((_name: string, callback: typeof mockTransitionEnd) => {
    mockTransitionEnd = callback;
    return mockUnsubscribe;
  }),
};
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: { trainingId: 'session', durationSeconds: 120,
    totalVolume: 400, exerciseCount: 1, setCount: 2, planNameSnapshot: '测试训练' } }),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@/store/trainingStore', () => ({
  useTrainingStore: (select: (s: unknown) => unknown) => select({
    completeTraining: mockSave, cancelTraining: mockCancel, completionSummary: mockSummary,
  }),
}));
jest.mock('@/utils/haptics', () => ({ haptic: { heavy: jest.fn(), success: jest.fn() } }));
jest.mock('react-native-reanimated', () => {
  const RN = require('react-native');
  const React = require('react');
  const identity = (x: unknown) => x;
  return {
    __esModule: true, default: { View: RN.View },
    useSharedValue: (n: number) => React.useRef({ value: n }).current,
    useAnimatedStyle: (fn: () => unknown) => fn(),
    useAnimatedReaction: () => undefined,
    cancelAnimation: jest.fn(), runOnJS: identity,
    withTiming: (n: number, _config: unknown, cb?: (ok: boolean) => void) => { cb?.(true); return n; },
    withSequence: (...args: number[]) => args[args.length - 1],
    withRepeat: identity, withSpring: identity, interpolateColor: () => '#ffffff',
    Easing: { bezier: () => identity, inOut: identity, quad: identity, cubic: identity },
  };
});

import { TrainingCompleteScreen } from '@/screens/TrainingCompleteScreen';
import { CountUp } from '@/components/CountUp';
import { ConfettiBurst } from '@/components/ConfettiBurst';
import { Button } from '@/components/Button';
import { Sheet } from '@/components/Sheet';
import { Dialog } from '@/components/Dialog';
import { ThemeProvider } from '@/theme';
import { haptic } from '@/utils/haptics';

const mockHeavy = haptic.heavy as jest.Mock;

const screen = () => <ThemeProvider initialMode="light"><TrainingCompleteScreen /></ThemeProvider>;

let tree: TestRenderer.ReactTestRenderer;
function render(ready = true) {
  act(() => { tree = TestRenderer.create(screen()); });
  if (ready) act(() => mockTransitionEnd({ data: { closing: false } }));
  return tree;
}
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockSave.mockResolvedValue({ stats: {} });
  mockSummary = { trainingId: 'session', durationSeconds: 120, totalVolume: 400,
    exerciseCount: 1, setCount: 2, totalAllSets: 3, bestSet: { weight: 40, reps: 10, value: 400 } };
});
afterEach(() => { act(() => tree?.unmount()); jest.clearAllTimers(); jest.useRealTimers(); });

describe('G48 completion integration', () => {
  it('原生淡入结束后才启动计数与庆祝，退出及重复事件不重播', () => {
    render(false);
    expect(tree.root.findAllByType(CountUp).map((n) => n.props.value)).toEqual([0, 0, 0]);
    expect(tree.root.findAllByType(ConfettiBurst)).toHaveLength(0);
    expect(mockHeavy).not.toHaveBeenCalled();
    act(() => mockTransitionEnd({ data: { closing: true } }));
    expect(mockHeavy).not.toHaveBeenCalled();
    act(() => mockTransitionEnd({ data: { closing: false } }));
    expect(tree.root.findAllByType(CountUp).map((n) => n.props.value)).toEqual([120, 400, 3]);
    expect(mockHeavy).toHaveBeenCalledTimes(1);
    act(() => mockTransitionEnd({ data: { closing: false } }));
    expect(mockHeavy).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
  it('三处真实 CountUp 目标值来自 store，260ms，最终格式正确', () => {
    render();
    const counters = tree.root.findAllByType(CountUp);
    expect(counters.map((n) => n.props.value)).toEqual([120, 400, 3]);
    expect(counters.every((n) => n.props.duration === 260)).toBe(true);
    for (const [id, value] of [['summary-duration', '02:00'], ['summary-volume', '400'], ['summary-sets', '3']]) {
      const node = tree.root.findAllByType(Text).find((n) => n.props.testID === id);
      expect(node?.props.children).toBe(value);
    }
  });

  it('有重量入场撒一次，重渲染和打开详情不再 heavy', () => {
    render();
    expect(tree.root.findByType(ConfettiBurst).props.trigger).toBe(400);
    expect(mockHeavy).toHaveBeenCalledTimes(1);
    act(() => tree.update(screen()));
    const details = tree.root.findAllByType(Button).find((n) => n.props.accessibilityLabel === '查看本次最佳组')!;
    act(() => details.props.onPress());
    expect(tree.root.findByType(Sheet).props.visible).toBe(true);
    expect(mockHeavy).toHaveBeenCalledTimes(1);
    act(() => tree.root.findByType(Sheet).props.onClose());
    expect(tree.root.findByType(Sheet).props.visible).toBe(false);
  });

  it('无重量安静完成，仍显示三个统计数字', () => {
    mockSummary = { ...mockSummary!, bestSet: null, totalVolume: 0 };
    render();
    expect(tree.root.findAllByType(ConfettiBurst)).toHaveLength(0);
    expect(tree.root.findAllByType(Sheet)).toHaveLength(0);
    expect(mockHeavy).not.toHaveBeenCalled();
    expect(tree.root.findAllByType(CountUp)).toHaveLength(3);
  });

  it('上次训练的内存最佳组不会泄漏到本次页面', () => {
    mockSummary = { ...mockSummary!, trainingId: 'previous' };
    render();
    expect(tree.root.findAllByType(ConfettiBurst)).toHaveLength(0);
    expect(mockHeavy).not.toHaveBeenCalled();
    expect(tree.root.findAllByType(CountUp).map((n) => n.props.value)).toEqual([120, 400, 2]);
  });

  it('显式保存成功显示 saved，再返回首页', async () => {
    render();
    const save = tree.root.findAll((n) => n.props.accessibilityLabel === '保存训练记录' && n.props.onPress)[0];
    await act(async () => { await save.props.onPress(); });
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockPop).not.toHaveBeenCalled();
    expect(tree.root.findAll((n) => n.props.accessibilityLabel === '已保存训练记录').length).toBeGreaterThan(0);
    act(() => jest.advanceTimersByTime(900));
    expect(mockPop).toHaveBeenCalledTimes(1);
  });

  it('保存失败保留总结，允许重试', async () => {
    mockSave.mockRejectedValueOnce(new Error('磁盘已满'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    render();
    const save = tree.root.findAll((n) => n.props.accessibilityLabel === '保存训练记录' && n.props.onPress)[0];
    await act(async () => { await save.props.onPress(); });
    expect(alert).toHaveBeenCalledWith('保存失败', '磁盘已满');
    expect(mockPop).not.toHaveBeenCalled();
    expect(mockHeavy).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });

  it('不保存需要确认，确认后取消并返回首页', () => {
    render();
    const discard = tree.root.findAllByType(Button).find((n) => n.props.accessibilityLabel === '不保存训练记录')!;
    act(() => discard.props.onPress());
    expect(tree.root.findByType(Dialog).props.visible).toBe(true);
    expect(mockCancel).not.toHaveBeenCalled();
    act(() => tree.root.findByType(Dialog).props.onConfirm());
    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(mockSave).not.toHaveBeenCalled();
    expect(mockPop).toHaveBeenCalledTimes(1);
  });
});
