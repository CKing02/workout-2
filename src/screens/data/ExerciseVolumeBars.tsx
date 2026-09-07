/**
 * G32 — ExerciseVolumeBars
 *
 * 容量柱状图。每日一根柱，X 轴日期（短标签 MM/DD），Y 轴容量 Σ weight × reps。
 *
 * 设计：
 *  - 复用 BarChart 的视觉语法（niceMax + Y 轴 4 刻度），但更轻量：只
 *    关心"横轴每点 = 一天"的密度更高的场景。
 *  - 当 points 数 ≤ 12：标签水平显示；> 12：标签旋转 45° 避免重叠。
 *    （柱状图点数少时旋转是噪音。）
 *  - 颜色用 `colors.primaryMuted` 软填充 + `colors.primary` 顶部细线。
 */

import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';

import type { ExerciseHistoryPoint } from '@/hooks/useExerciseHistory';
import { useTheme } from '@/theme';

const PADDING_LEFT = 40;
const PADDING_RIGHT = 12;
const PADDING_TOP = 18;
const PADDING_BOTTOM = 36;

export interface ExerciseVolumeBarsProps {
  points: ExerciseHistoryPoint[];
  width: number;
  height: number;
  /** 长按某个柱触发。 */
  onLongPressPoint?: (point: ExerciseHistoryPoint) => void;
}

function niceMax(value: number): number {
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

function shortNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n)}`;
}

function shortDate(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

export function ExerciseVolumeBars({
  points,
  width,
  height,
  onLongPressPoint,
}: ExerciseVolumeBarsProps) {
  const { colors } = useTheme();

  const innerWidth = Math.max(0, width - PADDING_LEFT - PADDING_RIGHT);
  const innerHeight = height - PADDING_TOP - PADDING_BOTTOM;

  const maxValue = useMemo(
    () => niceMax(Math.max(0, ...points.map((p) => p.volume))),
    [points],
  );
  const slot = points.length > 0 ? innerWidth / points.length : 0;
  const barWidth = Math.max(2, Math.min(28, slot * 0.6));

  const ticks = useMemo(() => {
    const arr: number[] = [];
    for (let i = 0; i <= 4; i++) arr.push((maxValue * i) / 4);
    return arr;
  }, [maxValue]);

  // > 12 点 → 旋转 45°；否则水平
  const rotateLabels = points.length > 12;

  return (
    <View accessible accessibilityRole="image" accessibilityLabel="容量柱状图">
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
                fontSize={9}
                fill={colors.textTertiary}
                textAnchor="end"
              >
                {shortNum(t)}
              </SvgText>
            </G>
          );
        })}

        {/* 柱 + 长按 hit */}
        {points.map((p, i) => {
          const slotX = PADDING_LEFT + i * slot;
          const cx = slotX + slot / 2;
          const h = maxValue > 0 ? (p.volume / maxValue) * innerHeight : 0;
          const y = PADDING_TOP + innerHeight - h;
          return (
            <G key={`bar-${i}`}>
              {/* 透明 hit rect（覆盖整个 slot，确保长按命中） */}
              <Rect
                x={slotX}
                y={PADDING_TOP}
                width={slot}
                height={innerHeight}
                fill="transparent"
                onLongPress={() => onLongPressPoint?.(p)}
                delayLongPress={250}
              />
              {/* 柱体 */}
              <Rect
                x={cx - barWidth / 2}
                y={y}
                width={barWidth}
                height={Math.max(0, h)}
                rx={3}
                fill={p.volume > 0 ? colors.primaryMuted : colors.surfaceMuted}
              />
              {/* 顶部细线（accent） */}
              {p.volume > 0 ? (
                <Line
                  x1={cx - barWidth / 2}
                  y1={y}
                  x2={cx + barWidth / 2}
                  y2={y}
                  stroke={colors.primary}
                  strokeWidth={2}
                />
              ) : null}
              {/* 日期标签 */}
              <SvgText
                x={cx}
                y={height - (rotateLabels ? 6 : 12)}
                fontSize={9}
                fill={colors.textTertiary}
                textAnchor={rotateLabels ? 'end' : 'middle'}
                rotation={rotateLabels ? -45 : 0}
                originX={cx}
                originY={height - (rotateLabels ? 6 : 12)}
              >
                {shortDate(p.date)}
              </SvgText>
            </G>
          );
        })}
      </Svg>
    </View>
  );
}
