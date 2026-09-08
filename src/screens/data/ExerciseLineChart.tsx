/**
 * G32 — ExerciseLineChart (wrapper over US-12c LineChart).
 *
 * G32 实现的 1RM 趋势线抽到通用 `components/LineChart.tsx` 后,这里
 * 改成薄 wrapper:把 `ExerciseHistoryPoint` 映射成 LineChart 的
 * `LineChartPoint`,`yLabelFormat` 接到 `formatWeight`,保持原 API 不变。
 *
 * 调用方(`ExerciseHistoryScreen.tsx`)不需要任何改动。
 */

import React from 'react';

import { LineChart, type LineChartPoint } from '@/components/LineChart';
import type { ExerciseHistoryPoint } from '@/hooks/useExerciseHistory';
import { formatWeight } from '@/utils/units';

export interface ExerciseLineChartProps {
  points: ExerciseHistoryPoint[];
  width: number;
  height: number;
  /** 当前显示单位（仅影响 label 渲染）。 */
  unitLabel: 'kg' | 'lb';
  /** 长按某个点触发（>= 250ms）。 */
  onLongPressPoint?: (point: ExerciseHistoryPoint) => void;
}

export function ExerciseLineChart({
  points,
  width,
  height,
  unitLabel,
  onLongPressPoint,
}: ExerciseLineChartProps) {
  const mapped: LineChartPoint[] = points.map((p) => ({
    x: p.date,
    y: p.oneRmMax,
    label: formatWeight(p.oneRmMax, unitLabel),
    payload: p,
  }));

  return (
    <LineChart
      points={mapped}
      width={width}
      height={height}
      yLabelFormat={(y) => formatWeight(y, unitLabel)}
      accessibilityLabel="1RM 趋势线"
      onLongPressPoint={(pt) => {
        if (onLongPressPoint && pt.payload) {
          onLongPressPoint(pt.payload as ExerciseHistoryPoint);
        }
      }}
    />
  );
}
