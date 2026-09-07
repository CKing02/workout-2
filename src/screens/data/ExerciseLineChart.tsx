/**
 * G32 — ExerciseLineChart
 *
 * 1RM 趋势线。react-native-svg 手画：折线 + 数据点 + 长按交互。
 *
 * 设计：
 *  - X 轴 = 时间（训练日），Y 轴 = 1RM（kg）
 *  - 1 个点 → 只画圆 + 单点标签，不画折线（避免单点折线段）
 *  - 0 个点 → 由父组件判定（EmptyState）
 *  - X/Y 比例尺用 useMemo 缓存
 *  - 数据点用透明 hit circle 放大命中区（>= 28x28）：
 *    可见 r=4.5 内白点 + r=16 透明 hit；长按 / 短按经 onLongPress / onPress 触发
 *  - 折线用 SVG <Polyline> 一次绘制（避免多段 Line 拼接的视觉断裂）
 */

import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Polyline, Text as SvgText } from 'react-native-svg';

import type { ExerciseHistoryPoint } from '@/hooks/useExerciseHistory';
import { useTheme } from '@/theme';
import { formatWeight } from '@/utils/units';

const PADDING_LEFT = 40;
const PADDING_RIGHT = 12;
const PADDING_TOP = 18;
const PADDING_BOTTOM = 22;

export interface ExerciseLineChartProps {
  points: ExerciseHistoryPoint[];
  width: number;
  height: number;
  /** 当前显示单位（仅影响 label 渲染）。 */
  unitLabel: 'kg' | 'lb';
  /** 长按某个点触发（>= 350ms）。 */
  onLongPressPoint?: (point: ExerciseHistoryPoint) => void;
}

function shortNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n)}`;
}

export function ExerciseLineChart({
  points,
  width,
  height,
  unitLabel,
  onLongPressPoint,
}: ExerciseLineChartProps) {
  const { colors } = useTheme();

  const innerWidth = Math.max(0, width - PADDING_LEFT - PADDING_RIGHT);
  const innerHeight = height - PADDING_TOP - PADDING_BOTTOM;

  const { xAt, yAt, yMin, yMax } = useMemo(() => {
    const dummy = (_: number) => 0;
    if (points.length === 0) {
      return { xAt: dummy, yAt: dummy, yMin: 0, yMax: 0 };
    }
    const dates = points.map((p) => p.date);
    const ones = points.map((p) => p.oneRmMax);
    const dMin = Math.min(...dates);
    const dMax = Math.max(...dates);
    const yLo = Math.max(0, Math.min(...ones) * 0.9);
    const yHi = Math.max(...ones) * 1.1 || 1;
    const xAt = (d: number) =>
      PADDING_LEFT +
      (dMax === dMin
        ? innerWidth / 2
        : ((d - dMin) / (dMax - dMin)) * innerWidth);
    const yAt = (y: number) =>
      PADDING_TOP +
      innerHeight -
      (yHi === yLo ? innerHeight / 2 : ((y - yLo) / (yHi - yLo)) * innerHeight);
    return { xAt, yAt, yMin: yLo, yMax: yHi };
  }, [points, innerWidth, innerHeight]);

  // Y 轴 4 个刻度
  const ticks = useMemo(() => {
    if (points.length === 0) return [0, 0, 0, 0, 0];
    const arr: number[] = [];
    for (let i = 0; i <= 4; i++) arr.push(yMin + ((yMax - yMin) * i) / 4);
    return arr;
  }, [points, yMin, yMax]);

  // Polyline 字符串（仅 ≥ 2 点才有意义）
  const polyPoints = useMemo(() => {
    if (points.length < 2) return '';
    return points
      .map((p) => `${xAt(p.date).toFixed(2)},${yAt(p.oneRmMax).toFixed(2)}`)
      .join(' ');
  }, [points, xAt, yAt]);

  return (
    <View accessible accessibilityRole="image" accessibilityLabel="1RM 趋势线">
      <Svg width={width} height={height}>
        {/* Y 轴刻度线 + 标签 */}
        {ticks.map((t, i) => {
          const y = yAt(t);
          return (
            <G key={`tick-${i}`}>
              <Line
                x1={PADDING_LEFT}
                x2={width - PADDING_RIGHT}
                y1={y}
                y2={y}
                stroke={colors.divider}
                strokeWidth={1}
                strokeDasharray={i === 0 ? undefined : '3 3'}
              />
              <SvgText
                x={PADDING_LEFT - 4}
                y={y + 3}
                fontSize={9}
                fill={colors.textTertiary}
                textAnchor="end"
              >
                {shortNum(t)}
              </SvgText>
            </G>
          );
        })}

        {/* 折线（≥ 2 点才有） */}
        {points.length >= 2 ? (
          <Polyline
            points={polyPoints}
            stroke={colors.primary}
            strokeWidth={2}
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}

        {/* 数据点 + 长按 hit */}
        {points.map((p, i) => {
          const cx = xAt(p.date);
          const cy = yAt(p.oneRmMax);
          return (
            <G key={`pt-${i}`}>
              {/* 透明 hit circle（放大命中区 ≥ 28px） */}
              <Circle
                cx={cx}
                cy={cy}
                r={16}
                fill="transparent"
                onLongPress={() => onLongPressPoint?.(p)}
                delayLongPress={250}
              />
              {/* 可见点 */}
              <Circle cx={cx} cy={cy} r={4.5} fill={colors.primary} />
              <Circle cx={cx} cy={cy} r={2} fill={colors.onPrimary} />
            </G>
          );
        })}

        {/* 仅 1 个点时在图上画一个明显的标签 */}
        {points.length === 1 ? (
          <SvgText
            x={xAt(points[0]!.date) + 8}
            y={yAt(points[0]!.oneRmMax) - 8}
            fontSize={11}
            fill={colors.text}
          >
            {formatWeight(points[0]!.oneRmMax, unitLabel)}
          </SvgText>
        ) : null}
      </Svg>
    </View>
  );
}
