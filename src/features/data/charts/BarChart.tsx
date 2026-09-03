/**
 * G18 — BarChart
 *
 * 基于 react-native-svg 的纯 SVG 柱状图。用途：周训练量趋势。
 *
 * 设计要点：
 * - 接受一组数值 + 可选标签；自适应宽高（父容器给定 width）。
 * - Y 轴 0..max 自动取整到"漂亮的整数"（含 0）。
 * - 最高柱顶部留 4px 余量，避免触顶。
 * - 颜色 / 间距 全部走 Design Token，确保浅深色美观。
 * - 柱顶部显示数值（短格式：1000 → "1k"）。
 */

import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';

import { useTheme } from '@/theme';

export interface BarChartDatum {
  label: string;
  value: number;
}

interface BarChartProps {
  data: BarChartDatum[];
  /** 父容器宽度（由 onLayout 测得或固定值）。 */
  width: number;
  /** 图表高度（不含 X 轴标签行）。 */
  height?: number;
  /** X 轴标签是否显示（默认 true；数据点很多时可关）。 */
  showLabels?: boolean;
  /** 顶部留出空间用于显示数值。 */
  showValues?: boolean;
}

const DEFAULT_HEIGHT = 160;
const PADDING_LEFT = 36;
const PADDING_RIGHT = 8;
const PADDING_TOP = 18;
const PADDING_BOTTOM = 20;

/** "漂亮" 的 Y 轴最大值：从 1/2/5 × 10^n 里挑一个 ≥ max。 */
export function niceMax(value: number): number {
  if (value <= 0) return 10;
  const exp = Math.floor(Math.log10(value));
  const base = Math.pow(10, exp);
  const ratio = value / base;
  let nice: number;
  if (ratio <= 1) nice = 1;
  else if (ratio <= 2) nice = 2;
  else if (ratio <= 5) nice = 5;
  else nice = 10;
  return nice * base;
}

/** 短格式数值：1234 → "1.2k"；999 → "999"。 */
function shortNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${Math.round(n)}`;
}

export function BarChart({
  data,
  width,
  height = DEFAULT_HEIGHT,
  showLabels = true,
  showValues = true,
}: BarChartProps) {
  const { colors, typography } = useTheme();

  const innerWidth = Math.max(0, width - PADDING_LEFT - PADDING_RIGHT);
  const innerHeight = height - PADDING_TOP - PADDING_BOTTOM;

  const maxValue = useMemo(() => niceMax(Math.max(0, ...data.map((d) => d.value))), [data]);
  const slot = data.length > 0 ? innerWidth / data.length : 0;
  const barWidth = Math.max(2, Math.min(28, slot * -0.6));

  // Y 轴 4 个刻度（0, 25%, 50%, 75%, 100%）
  const ticks = useMemo(() => {
    const arr: number[] = [];
    for (let i = 0; i <= 4; i++) arr.push((maxValue * i) / 4);
    return arr;
  }, [maxValue]);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`柱状图，共 ${data.length} 项`}
    >
      <Svg width={width} height={height}>
        {/* Y 轴刻度线 + 标签 */}
        {ticks.map((t, i) => {
          const y = PADDING_TOP + innerHeight - (t / maxValue) * innerHeight;
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
                fontSize={10}
                fill={colors.textTertiary}
                textAnchor="end"
              >
                {shortNumber(t)}
              </SvgText>
            </G>
          );
        })}

        {/* 柱子 */}
        {data.map((d, i) => {
          const slotX = PADDING_LEFT + i * slot;
          const cx = slotX + slot / 2;
          const h = maxValue > 0 ? (d.value / maxValue) * innerHeight : 0;
          const y = PADDING_TOP + innerHeight - h;
          return (
            <G key={`bar-${i}`}>
              <Rect
                x={cx - barWidth / 2}
                y={y}
                width={barWidth}
                height={Math.max(0, h)}
                rx={3}
                fill={d.value > 0 ? colors.primary : colors.surfaceMuted}
              />
              {showValues && d.value > 0 ? (
                <SvgText
                  x={cx}
                  y={Math.max(PADDING_TOP + 10, y - 4)}
                  fontSize={9}
                  fill={colors.textSecondary}
                  textAnchor="middle"
                >
                  {shortNumber(d.value)}
                </SvgText>
              ) : null}
              {showLabels ? (
                <SvgText
                  x={cx}
                  y={height - 6}
                  fontSize={9}
                  fill={colors.textTertiary}
                  textAnchor="middle"
                >
                  {d.label}
                </SvgText>
              ) : null}
            </G>
          );
        })}
      </Svg>
    </View>
  );
}