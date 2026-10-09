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
 *   - 不做 per-frame 中间帧显示 —— 当前实现提交最终值；中间帧如有视觉需求留给
 *     G48 在接入页时按需引入 `useAnimatedReaction` + `runOnJS`。
 *
 * **实现**：
 * `useSharedValue` + `withTiming` 触发 `sharedProgress` 由 0 走到 `value`。
 * `withTiming` 完成回调（finished=true）在 JS 线程同步触发，
 * 直接 `setText(format(value))` —— 不需要 `runOnJS`。
 *
 * **为什么 onComplete 不放进 useEffect deps？**
 * `onComplete` 是父组件渲染时新建的函数引用，React 每次 re-render 都会是新身份。
 * 如果放进 deps，setText 触发的 re-render 会让 useEffect 重新跑 → withTiming
 * 完成回调再次触发 → onComplete 被叫 2 次。用 `useRef` 持"最新 onComplete"
 * 绕过这个 React 闭包陷阱，同时保持 setText 单独跑的 useEffect 不依赖它。
 */

import React, { useEffect, useRef, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useSharedValue, withTiming } from 'react-native-reanimated';

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

/**
 * G46 CountUp: sharedProgress + withTiming 驱动，最简化实现。
 *
 * 完成回调在 JS 线程同步触发 —— 直接 setState，不需要 runOnJS 中转。
 */
export function CountUp({
  value,
  duration = motion.duration.base,
  format = defaultFormat,
  onComplete,
  style,
  testID,
}: CountUpProps) {
  const sharedProgress = useSharedValue(0);

  // 当前显示文本：初始 format(0)，withTiming 完成回调里同步替换为 format(value)。
  const [text, setText] = useState<string>(format(0));

  // 用 ref 持"最新的 onComplete"—— 避免把它放进 useEffect deps（每次父组件 re-render
  // onComplete 身份变，会触发 withTiming 重跑、回调被叫 2 次）。
  const onCompleteRef = useRef<(() => void) | undefined>(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    let cancelled = false;
    sharedProgress.value = 0;
    sharedProgress.value = withTiming(
      value,
      { duration: Math.max(0, duration) },
      (finished) => {
        // finished: false 通常是组件已 unmount 或 value 被快速重置；
        // 不调 onComplete，避免"假完成"漏到业务。
        if (cancelled || !finished) return;
        setText(format(value));
        onCompleteRef.current?.();
      },
    );
    return () => {
      cancelled = true;
    };
  }, [value, duration, sharedProgress]);

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
