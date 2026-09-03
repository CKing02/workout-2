/**
 * G18 — DonutChart
 *
 * 简化的环形饼图：N 个 slice，中心留白放总值。
 *
 * 用 react-native-svg 的 Circle + strokeDasharray 实现：把一个
 * viewBox 的 circle 的 stroke 当作饼环，用 `strokeDasharray` 控制
 * 每段长度、`strokeDashoffset` 控制起点偏移。比 Path 简单很多，
 * 适合 slice ≤ 8 的场景（肌群通常 7-8 个）。
 *
 * 颜色：从 palette.primary 按 hue 递增取不到——这里直接轮询
 * 5 个固定的 theme token，保持浅深色都美观。
 */

import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Text as SvgText } from 'react-native-svg';

import { useTheme } from '@/theme';

export interface DonutSlice {
  label: string;
  value: number;
}

interface DonutChartProps {
  data: DonutSlice[];
  /** 直径（含 px。 */
  size: number;
  strokeWidth?: number;
  /** 中央展示的总值（如 "总训练量 12.3k kg"）。 */
  centerLabel?: string;
  centerSubLabel?: string;
}

interface Palette {
  primary: string;
  success: string;
  warning: string;
  info: string;
  danger: string;
  /** 占位用 muted 色（>5 slice 时循环）。 */
  muted: string;
}

export function DonutChart({
  data,
  size,
  strokeWidth = 18,
  centerLabel,
  centerSubLabel,
}: DonutChartProps) {
  const { colors, typography } = useTheme();
  const palette: Palette = useMemo(
    () => ({
      primary: colors.primary,
      success: colors.success,
      warning: colors.warning,
      info: colors.info,
      danger: colors.danger,
      muted: colors.primaryMuted,
    }),
    [colors],
  );

  const total = data.reduce((sum, d) => sum + Math.max(0, d.value), 0);

  // 半径：用 (size - strokeWidth) / 2 留出描边空间
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  // 圆周长
  const circumference = 2 * Math.PI * r;

  // 计算每段 dasharray / offset
  const segments = useMemo(() => {
    if (total <= 0) return [];
    let cursor = 0; // 已经走过的弧长
    return data.map((d, i) => {
      const ratio = d.value / total;
      const length = ratio * circumference;
      const segment = {
        color: pickColor(i, palette),
        dasharray: `${length} ${circumference - length}`,
        offset: -cursor,
      };
      cursor += length;
      return segment;
    });
  }, [data, total, circumference, palette]);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`饼图，共 ${data.length} 项`}
    >
      <Svg width={size} height={size}>
        {/* 背景圆环：让空数据也能看见轨道 */}
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={colors.surfaceMuted}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* 数据段：旋转 -90° 让起点在 12 点钟方向 */}
        <G rotation={-90} originX={cx} originY={cy}>
          {segments.map((s, i) => (
            <Circle
              key={`seg-${i}`}
              cx={cx}
              cy={cy}
              r={r}
              stroke={s.color}
              strokeWidth={strokeWidth}
              strokeDasharray={s.dasharray}
              strokeDashoffset={s.offset}
              strokeLinecap="butt"
              fill="none"
            />
          ))}
        </G>
        {/* 中心文字 */}
        {centerLabel ? (
          <SvgText
            x={cx}
            y={cy - 2}
            fontSize={16}
            fontWeight="700"
            fill={colors.text}
            textAnchor="middle"
          >
            {centerLabel}
          </SvgText>
        ) : null}
        {centerSubLabel ? (
          <SvgText
            x={cx}
            y={cy + 14}
            fontSize={10}
            fill={colors.textTertiary}
            textAnchor="middle"
          >
            {centerSubLabel}
          </SvgText>
        ) : null}
      </Svg>
    </View>
  );
}

/** 按 index 轮询 5 色 + muted，超过循环回 muted。 */
function pickColor(i: number, p: Palette): string {
  const colors = [p.primary, p.success, p.warning, p.info, p.danger, p.muted];
  return colors[i % colors.length];
}