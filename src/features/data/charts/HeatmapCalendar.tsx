/**
 * G18 — HeatmapCalendar
 *
 * 过去 N 周 × 7 天 的热力图。颜色深度 = 当日总训练量 / 最大值。
 *
 * 设计：
 * - 默认 12 周（84 格）；X 轴 = 周（一周一列），Y 轴 = 周一→周日。
 * - 缺失日期 / 未来日期用 surfaceMuted（透明灰）填充。
 * - 训练量越大 → 颜色越深（primary alpha 渐进）。
 * - 4 个色阶：0 (空) / 1..33% / 34..66% / 67..100%。
 */

import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

import { dayKey } from '@/features/data/aggregations';
import { useTheme } from '@/theme';

export interface HeatmapDay {
  /** YYYY-MM-DD */
  day: string;
  volume: number;
}

interface HeatmapCalendarProps {
  data: HeatmapDay[];
  width: number;
  weeks?: number;
  cellSize?: number;
  gap?: number;
}

const DEFAULT_WEEKS = 12;
const DEFAULT_CELL = 18;
const DEFAULT_GAP = 3;
const ROW_LABEL_WIDTH = 22;

export function HeatmapCalendar({
  data,
  width,
  weeks = DEFAULT_WEEKS,
  cellSize = DEFAULT_CELL,
  gap = DEFAULT_GAP,
}: HeatmapCalendarProps) {
  const { colors, typography } = useTheme();

  // 计算网格起点：今天的本地 0 点，往回数 (weeks-1) 周 = 网格第一列（周一）。
  const { startMs, maxVolume, volumeByDay } = useMemo(() => {
    const map = new Map<string, number>();
    let max = 0;
    for (const d of data) {
      map.set(d.day, (map.get(d.day) ?? 0) + d.volume);
      if (d.volume > max) max = d.volume;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // 今天所在周的周一
    const day = today.getDay();
    const diffToMonday = (day + 6) % 7;
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() - diffToMonday);
    // 第一列 = thisMonday - (weeks-1) 周
    const start = new Date(thisMonday);
    start.setDate(thisMonday.getDate() - (weeks - 1) * 7);
    return { startMs: start.getTime(), maxVolume: max, volumeByDay: map };
  }, [data, weeks]);

  const innerWidth = Math.max(0, width - ROW_LABEL_WIDTH - 4);
  const slot = innerWidth / weeks;
  const cell = Math.min(cellSize, slot - gap);
  const gridHeight = 7 * (cell + gap);

  // 4 段色阶辅助
  function cellFill(volume: number): string {
    if (volume <= 0 || maxVolume <= 0) return colors.surfaceMuted;
    const ratio = volume / maxVolume;
    if (ratio <= 0.33) return colors.primaryMuted;
    if (ratio <= 0.66) return colors.primary;
    return colors.primaryPressed;
  }

  // 行标签：周一..周日（中文）
  const ROW_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

  // 构造 cells：[weekIdx][dayIdx]
  const cells: Array<Array<{ x: number; y: number; volume: number; day: string; isFuture: boolean }>> = [];
  for (let w = 0; w < weeks; w++) {
    const col: typeof cells[number][number][] = [];
    for (let d = 0; d < 7; d++) {
      const ms = startMs + (w * 7 + d) * 86_400_000;
      const isFuture = ms > Date.now();
      const day = dayKey(ms);
      col.push({
        x: ROW_LABEL_WIDTH + 4 + w * slot + (slot - cell) / 2,
        y: d * (cell + gap),
        volume: volumeByDay.get(day) ?? 0,
        day,
        isFuture,
      });
    }
    cells.push(col);
  }

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${weeks} 周训练热力图，共 ${data.length} 个训练日`}
    >
      <Svg width={width} height={gridHeight}>
        {ROW_LABELS.map((label, i) => (
          <SvgText
            key={`row-${i}`}
            x={ROW_LABEL_WIDTH - 4}
            y={i * (cell + gap) + cell / 2 + 4}
            fontSize={9}
            fill={colors.textTertiary}
            textAnchor="end"
          >
            {label}
          </SvgText>
        ))}
        {cells.flat().map((c, idx) => (
          <Rect
            key={`cell-${idx}`}
            x={c.x}
            y={c.y}
            width={cell}
            height={cell}
            rx={3}
            fill={c.isFuture ? colors.surface : cellFill(c.volume)}
            opacity={c.isFuture ? 0.35 : 1}
          />
        ))}
      </Svg>
    </View>
  );
}