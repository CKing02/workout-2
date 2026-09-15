/**
 * G39 — 通用骨架屏组件。
 *
 * 用法:
 *   <Skeleton width={120} height={16} rounded="sm" />
 *   <Skeleton width={180} height={180} rounded="circle" />  // GIF 占位
 *
 * 设计:
 *   - Reanimated 驱动 opacity 脉冲(0.4 ↔ 0.8),不影响 React 渲染
 *   - 走 theme.colors.surfaceMuted / surfaceSubtle 配色,浅深色都跟
 *   - accessibilityRole="none",aria-hidden=true(纯视觉占位,屏幕阅读器跳过)
 *
 * 不依赖业务 store,可被任何"加载中"场景复用(数据加载 / GIF 加载 / 后续 skeleton list)。
 */
import React, { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';

export type SkeletonRounded = 'none' | 'sm' | 'md' | 'circle';

export type SkeletonProps = {
  width: number;
  height: number;
  rounded?: SkeletonRounded;
  /** 脉冲周期(ms)。默认 1200。 */
  durationMs?: number;
  style?: ViewStyle;
};

export function Skeleton({
  width,
  height,
  rounded = 'md',
  durationMs = 1200,
  style,
}: SkeletonProps) {
  const { colors, radius } = useTheme();
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: durationMs / 2, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    return () => {
      opacity.value = 0.6;
    };
  }, [durationMs, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const borderRadius =
    rounded === 'circle'
      ? Math.max(width, height) / 2
      : rounded === 'sm'
      ? radius.sm
      : rounded === 'md'
      ? radius.md
      : 0;

  return (
    <Animated.View
      style={[
        styles.base,
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.surfaceMuted,
        },
        animatedStyle,
        style,
      ]}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      // 让屏幕阅读器 / 测试跳过骨架屏;纯视觉占位
    />
  );
}

const styles = StyleSheet.create({
  base: {
    // 容器默认透明,具体颜色由 theme 注入
  },
});