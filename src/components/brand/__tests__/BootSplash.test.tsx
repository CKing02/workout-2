import React from 'react';
import { StyleSheet, View } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

const mockHide = jest.fn();
let mockReduceMotion = false;
let mockExit: ((finished: boolean) => void) | undefined;
const mockDelay = jest.fn((_delay: number, value: number) => value);
const mockCancel = jest.fn();
const mockSpring = jest.fn((value: number) => value);
const mockTiming = jest.fn((value: number, _config: unknown, cb?: (finished: boolean) => void) => {
  if (cb) mockExit = cb;
  return value;
});

jest.mock('../nativeSplash', () => ({ hideNativeSplash: () => mockHide() }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('@/theme', () => ({
  spacing: { xxl: 32, xl: 24 }, typography: { h2: {} },
}));
jest.mock('react-native-reanimated', () => {
  const ReactModule = require('react');
  return {
    __esModule: true,
    default: { View: require('react-native').View },
    useSharedValue: (value: number) => ReactModule.useRef({ value }).current,
    useReducedMotion: () => mockReduceMotion,
    useAnimatedStyle: (updater: () => unknown) => updater(),
    withDelay: (delay: number, value: number) => mockDelay(delay, value),
    withTiming: (value: number, config: unknown, cb?: (finished: boolean) => void) => mockTiming(value, config, cb),
    withSpring: (value: number) => mockSpring(value),
    withSequence: (...values: number[]) => values[values.length - 1],
    cancelAnimation: (value: unknown) => mockCancel(value),
    runOnJS: (fn: () => void) => fn,
    ReduceMotion: { Never: 'never' },
    Easing: { out: (fn: unknown) => fn, in: (fn: unknown) => fn, quad: 'quad', cubic: 'cubic' },
  };
});

import { BootSplash, type BootSplashProps } from '../BootSplash';

function render(props: BootSplashProps) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<BootSplash {...props} />); });
  return tree;
}

function field(tree: TestRenderer.ReactTestRenderer) {
  return tree.root.findAllByType(View).find(node => node.props.accessibilityRole === 'progressbar')!;
}

describe('品牌启动屏交接和退出', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReduceMotion = false;
    mockExit = undefined;
  });

  it('首帧隐藏字标/进度，布局前保留原生页，重复布局只隐藏一次', () => {
    const tree = render({ progress: 0, visible: true });
    expect(mockHide).not.toHaveBeenCalled();
    expect(mockDelay).not.toHaveBeenCalled();
    expect(mockSpring).not.toHaveBeenCalled();
    const wordmark = tree.root.findAllByType(View).find(node =>
      Array.isArray(node.props.style) === false && node.props.style?.opacity === 0 && node.props.style?.transform,
    );
    expect(wordmark).toBeDefined();
    act(() => field(tree).props.onLayout());
    act(() => field(tree).props.onLayout());
    expect(mockHide).toHaveBeenCalledTimes(1);
    expect(mockDelay.mock.calls.map(call => call[0])).toEqual([90, 150, 330]);
    act(() => tree.unmount());
  });

  it('快速启动在布局前已就绪：跳过入场，布局交接后退出', () => {
    const onHidden = jest.fn();
    const tree = render({ progress: 1, visible: false, onHidden });
    expect(mockExit).toBeUndefined();
    act(() => field(tree).props.onLayout());
    expect(mockHide).toHaveBeenCalledTimes(1);
    expect(mockDelay).not.toHaveBeenCalled();
    act(() => mockExit?.(true));
    expect(onHidden).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  it('淡出不被进度/回调更新重启，完成时调用最新回调一次', () => {
    const first = jest.fn();
    const latest = jest.fn();
    const tree = render({ progress: 0.2, visible: true, onHidden: first });
    act(() => field(tree).props.onLayout());
    act(() => tree.update(<BootSplash progress={0.8} visible={false} onHidden={first} />));
    const exit = mockExit;
    mockTiming.mockClear();
    act(() => tree.update(<BootSplash progress={1} visible={false} onHidden={latest} />));
    expect(mockTiming.mock.calls.some(call => call[2] !== undefined)).toBe(false);
    act(() => exit?.(false));
    expect(latest).not.toHaveBeenCalled();
    act(() => { exit?.(true); exit?.(true); });
    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledTimes(1);
    expect(field(tree).props.pointerEvents).toBe('none');
    expect(field(tree).props.importantForAccessibility).toBe('no-hide-descendants');
    act(() => tree.unmount());
  });

  it('卸载取消动画，迟到的完成回调不通知调用方', () => {
    const onHidden = jest.fn();
    const tree = render({ progress: 1, visible: false, onHidden });
    act(() => field(tree).props.onLayout());
    const exit = mockExit;
    act(() => tree.unmount());
    expect(mockCancel).toHaveBeenCalled();
    act(() => exit?.(true));
    expect(onHidden).not.toHaveBeenCalled();
  });

  it('减少动态效果时没有装片/位移，退出无需等待', () => {
    mockReduceMotion = true;
    const tree = render({ progress: 0.2, visible: true });
    act(() => field(tree).props.onLayout());
    expect(mockSpring).not.toHaveBeenCalled();
    expect(mockDelay.mock.calls.map(call => call[0])).not.toContain(90);
    const transforms = tree.root.findAllByType(View).flatMap(node =>
      StyleSheet.flatten(node.props.style)?.transform ?? [],
    );
    expect(transforms.filter(transform => 'translateY' in transform)).toEqual([{ translateY: 0 }]);
    act(() => tree.update(<BootSplash progress={1} visible={false} />));
    expect(mockTiming.mock.calls.find(call => call[2])?.[1]).toEqual(expect.objectContaining({ duration: 0 }));
    act(() => tree.unmount());
  });

  it.each([[2, 100], [-1, 0], [NaN, 0]])('进度 %s 被约束为 %s%%，无障碍与可见进度一致', (progress, expected) => {
    const tree = render({ progress, visible: true, statusLabel: '设置' });
    expect(field(tree).props.accessibilityValue.now).toBe(expected);
    expect(field(tree).props.accessibilityLabel).toBe('正在启动：设置');
    act(() => tree.unmount());
  });
});
