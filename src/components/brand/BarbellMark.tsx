/**
 * 器材标记（横杠 + 配重片）—— 品牌图形标识的 RN 实现。
 *
 * 用 5 个圆角 View 拼，而不是 react-native-svg：标记本身就是圆角矩形，
 * View + borderRadius 已经够，而且 transform 动画跑 reanimated 的 UI 线程
 * 是最稳的路径（SVG 那套要用 useAnimatedProps 去驱动 x/y，多一层不值得）。
 * 几何全部来自 `markGeometry.ts`，和 SVG / PNG 同源。
 *
 * 关于 t=0 那一帧：启动屏要求本组件在 `outerPlateOffset === 0` 时画出来的
 * 东西，要与原生启动页 PNG 使用同一份几何与显示宽度。所以默认值必须是 0、而且没有任何
 * 入场动画挂在组件内部 —— 入场动画由调用方（BootSplash）控时序，
 * 目的是让首帧严格等于原生那一帧，之后才开始动。
 */
import React from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

import {
  MARK_ASPECT,
  MARK_BBOX,
  MARK_SHAPES,
  MARK_UNIT_HEIGHT,
  markScale,
} from './markGeometry';

export type BarbellMarkProps = {
  /** 标记实心区域宽度（dp）。启动屏必须传 SPLASH_MARK_WIDTH。 */
  width: number;
  color: string;
  /**
   * 外侧两块配重片沿 x 轴**向外**的额外位移，单位是 **SVG 单位**（不是 dp）——
   * 这样位移量随标记尺寸等比缩放，同一个数值在任何宽度下观感一致。
   *
   * 不传则是静态标记（位移恒为 0）。传 SharedValue 时不触发 React 重渲染。
   */
  outerPlateOffset?: SharedValue<number>;
};

export function BarbellMark({ width, color, outerPlateOffset }: BarbellMarkProps) {
  const scale = markScale(width);
  const height = MARK_UNIT_HEIGHT * scale;

  // 必须无条件调用 hook：没传 offset 时用一个恒为 0 的 shared value 顶上。
  const idleOffset = useSharedValue(0);
  const offset = outerPlateOffset ?? idleOffset;

  // 左片向外 = x 变小 = 负向；右片对称取正。
  // 用 useAnimatedStyle 而不是直接读 .value：读 .value 是在 JS 线程求值，
  // 每一帧都要过一次 React，动画会掉帧。
  const leftOuterStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -offset.value * scale }],
  }));
  const rightOuterStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value * scale }],
  }));

  return (
    <View
      style={{ width, height: height || width * MARK_ASPECT }}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {MARK_SHAPES.map((shape) => {
        const box = {
          position: 'absolute' as const,
          left: (shape.x - MARK_BBOX.x0) * scale,
          top: (shape.y - MARK_BBOX.y0) * scale,
          width: shape.w * scale,
          height: shape.h * scale,
          borderRadius: shape.r * scale,
          backgroundColor: color,
        };
        if (!shape.outer) return <View key={shape.key} style={box} />;
        return (
          <Animated.View
            key={shape.key}
            style={[box, shape.key === 'leftOuter' ? leftOuterStyle : rightOuterStyle]}
          />
        );
      })}
    </View>
  );
}
