/**
 * G46 — `CountUp` 数字翻动组件。
 *
 * **用途**：把"训练完成时的总组数 / 总时长 / 总容量"等数字从 0 翻到目标值。
 *           让"完成"的物理感更强 —— 数字"啪嗒"一下不是机械出现，是有过程。
 *
 * **设计动机**：
 * Material 3 motion design 的"feedback via motion"原则 —— 用户在被动接收结果时
 * （训练总结页），数字用 260ms（`duration.base`）的 `withTiming` 翻到位，比
 * 闪现出结果多了一层"信息可在过程中确认"的安心感。同时避免用 spring
 * （overshoot = 干扰判断），见 motion.ts 顶部说明。
 *
 * **Props**（AC-5 类型签名稳定）：
 *   - `value: number`             —— 目标值（必填）。整数或小数均可，0 / 负数也可。
 *   - `duration?: number`         —— 翻动时长（毫秒），默认 `motion.duration.base` (260ms)。
 *   - `format?: (n: number) => string` —— 数字渲染字符串，默认 `n => n.toFixed(0)`。
 *   - `onComplete?: () => void`   —— 翻动到目标值时触发一次。
 *
 * **单元测试覆盖**（AC-6）：从 0 → 100 后最终值渲染正确。详见 CountUp.test.tsx。
 *
 * **不在本节做**（Scope Lock）：
 *   - 不接入任何业务页 —— 留给 G48。
 *   - 不做 disabled 状态的视觉变体 —— 默认总展示。
 *   - 不做千分位 / 千位格式化 —— 留给业务调 format。
 * G48 经用户授权修复：中间帧通过 useAnimatedReaction + runOnJS 发布。
 *
 * **实现**：
 * `useSharedValue` + `withTiming` 触发 `sharedProgress` 由 0 走到 `value`。
 * UI worklet 只读取/传递数值；format、setText 和 onComplete 经 runOnJS
 * 回 JS 线程执行。卸载时取消动画并忽略排队中的回调。
 *
 * **为什么 onComplete 不放进 useEffect deps？**
 * `onComplete` 是父组件渲染时新建的函数引用，React 每次 re-render 都会是新身份。
 * 如果放进 deps，setText 触发的 re-render 会让 useEffect 重新跑 → withTiming
 * 完成回调再次触发 → onComplete 被叫 2 次。用 `useRef` 持"最新 onComplete"
 * 绕过这个 React 闭包陷阱，同时保持 setText 单独跑的 useEffect 不依赖它。
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { cancelAnimation, runOnJS, useAnimatedReaction, useSharedValue, withTiming } from 'react-native-reanimated';

import { motion } from '@/theme/motion';

export interface CountUpProps {
  /** 目标值（整数或小数，可为 0 / 负数）。 */
  value: number;
  /** 翻动时长（毫秒）。默认 `motion.duration.base` = 260ms。 */
  duration?: number;
  /** 把当前数字渲染成字符串。默认 `n => n.toFixed(0)`（"100"）。 */
  format?: (n: number) => string;
  /** 翻动到目标值时触发一次（中途值变化不重触发）。 */
  onComplete?: () => void;
  /** 透传样式。 */
  style?: StyleProp<TextStyle>;
  /** 测试锚点。 */
  testID?: string;
}

const defaultFormat = (n: number): string => n.toFixed(0);

/** sharedProgress + withTiming 驱动；保持 G46 的 props 签名。 */
export function CountUp({
  value,
  duration = motion.duration.base,
  format = defaultFormat,
  onComplete,
  style,
  testID,
}: CountUpProps) {
  const sharedProgress = useSharedValue(0);

  // 显示文本在 JS 线程由中间帧和最终帧更新。
  const [text, setText] = useState<string>(format(0));

  // 用 ref 持"最新的 onComplete"—— 避免把它放进 useEffect deps（每次父组件 re-render
  // onComplete 身份变，会触发 withTiming 重跑、回调被叫 2 次）。
  const onCompleteRef = useRef<(() => void) | undefined>(onComplete);
  const formatRef = useRef(format);
  const activeRef = useRef(false);
  formatRef.current = format;
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // G48 授权最小修复：worklet 只传数值，格式化与 React 更新都回 JS 线程。
  const publish = useCallback((n: number) => {
    if (activeRef.current) setText(formatRef.current(n));
  }, []);
  const finish = useCallback((n: number) => {
    if (!activeRef.current) return;
    setText(formatRef.current(n));
    onCompleteRef.current?.();
  }, []);
  useAnimatedReaction(
    () => sharedProgress.value,
    (current, previous) => {
      if (current !== previous) runOnJS(publish)(current);
    },
    [publish],
  );

  useEffect(() => {
    activeRef.current = true;
    setText(formatRef.current(0));
    sharedProgress.value = 0;
    if (duration <= 0) {
      sharedProgress.value = value;
      finish(value);
      return () => { activeRef.current = false; };
    }
    sharedProgress.value = withTiming(
      value,
      { duration, easing: motion.easing.standard },
      (finished) => {
        // finished: false 通常是组件已 unmount 或 value 被快速重置；
        // 不调 onComplete，避免"假完成"漏到业务。
        if (finished) runOnJS(finish)(value);
      },
    );
    return () => {
      activeRef.current = false;
      cancelAnimation(sharedProgress);
    };
  }, [value, duration, sharedProgress, finish]);

  return (
    <Text
      testID={testID}
      style={style}
      // numberOfLines 保底：极端长内容不撑爆布局。
      numberOfLines={1}
    >
      {text}
    </Text>
  );
}

export default CountUp;
