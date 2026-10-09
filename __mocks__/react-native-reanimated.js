/**
 * G46 — 全局 manual mock for `react-native-reanimated`。
 *
 * 详见 `jest.setup.js` 顶部说明。简单手动 mock 出 `motion.ts` 真正需要
 * 的 API（特别是 `Easing.bezier`）+ 一组无害的 hook 占位，避免真实模块
 * 加载时触发 native `loadUnpackers` 链。
 *
 * 不导出真正的 worklet 行为 —— 只为让"非交互型"测试（theme / theme-derived 等）
 * 也能通过。需要 Reanimated worklet 真实行为的测试（CountUp / ConfettiBurst）
 * 应当在自己 test file 里 `jest.mock('react-native-reanimated', ...)` 覆盖本
 * manual mock —— jest 会以测试自己的更详细的 mock 替换本文件。
 *
 * ⚠ 不要整体 mock `expo-modules-core`（原因见 avatarFile.test.ts 顶部）。
 */

'use strict';

function sentinelEasing(x1, y1, x2, y2) {
  return {
    __mockEasing: true,
    x1,
    y1,
    x2,
    y2,
    factory: () => () => 0,
  };
}

module.exports = {
  __esModule: true,
  Easing: {
    bezier: sentinelEasing,
    bezierFn: sentinelEasing,
    linear: () => 0,
    in: (easing) => easing || (() => 0),
    out: (easing) => easing || (() => 0),
    inOut: (easing) => easing || (() => 0),
    poly: () => 0,
    elastic: () => 0,
    sin: () => 0,
    circle: () => 0,
    exp: () => 0,
    steps: () => 0,
    back: () => 0,
    steps6: () => 0,
    quad: () => 0,
    cubic: () => 0,
  },
  useSharedValue: (init) => ({ value: init }),
  useAnimatedStyle: () => ({}),
  useAnimatedProps: () => ({}),
  useAnimatedReaction: () => undefined,
  useDerivedValue: (init) => ({ value: typeof init === 'function' ? init() : init }),
  runOnJS: (fn) => fn,
  withTiming: (v) => v,
  withSpring: (v) => v,
  withDelay: (v) => v,
  withSequence: (...args) => args[args.length - 1],
  withRepeat: (v) => v,
  withDecay: (v) => v,
  cancelAnimation: () => undefined,
  default: {},
};
