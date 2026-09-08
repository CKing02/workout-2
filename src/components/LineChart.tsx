/**
 * US-12c — 泛化的 LineChart 组件。
 *
 * 从 G32 `ExerciseLineChart` 抽出。G32 是 1RM 趋势,这一版是任意
 * `(x, y) → number` 数据集的折线图。语义只有"x 轴 + y 轴 + 折线 +
 * 数据点 + 长按交互",不绑定 Brzycki / kg / 时间单位。
 *
 * 设计:
 *  - `x` / `y` 都是 `number`,具体含义由调用方通过 label formatter 渲染。
 *    x 通常是 timestamp(Date.now()),y 通常是测量值。
 *  - `yLabelFormat` / `xLabelFormat` 留给调用方。G32 给 `formatWeight`,
 *    US-12 趋势给 `formatWeight` 或体脂百分比格式化。
 *  - 视觉规则沿用 G32:1 点 → 单点标签(不画折线段);≥2 点 → 折线 +
 *    4 段虚线刻度 + Y 轴 label。
 *  - 长按命中圈 ≥ 28px,沿用 G32 的透明 hit circle 模式。
 *  - `payload` 是 generic 透传字段,G32 用它传 TrainingSet 详情;
 *    US-12 用它传 BodyMeasurement 完整对象。
 *
 * 不抽"折线颜色 / 数据点形状"等:本应用所有 LineChart 都是单一序列,
 * 颜色直接读 `colors.primary` 即可。多序列是未来需求。
 */

import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { useTheme } from '@/theme';

const PADDING_LEFT = 40;
const PADDING_RIGHT = 12;
const PADDING_TOP = 18;
const PADDING_BOTTOM = 22;

export interface LineChartPoint {
  /** x 坐标(通常 timestamp ms)。 */
  x: number;
  /** y 坐标(测量值,含义由调用方定义)。 */
  y: number;
  /** 仅 1 点时显示在图上的标签文本。 */
  label?: string;
  /** 长按回调透传给 onLongPressPoint,本组件不解析。 */
  payload?: unknown;
}

export interface LineChartProps {
  points: LineChartPoint[];
  width: number;
  height: number;
  /** Y 轴刻度 label 渲染(如把 100 → "100.0 kg")。 */
  yLabelFormat: (y: number) => string;
  /** X 轴刻度 label 渲染(默认:timestamp → "MM-DD")。 */
  xLabelFormat?: (x: number) => string;
  /** 长按某个点触发(>= 250ms)。 */
  onLongPressPoint?: (point: LineChartPoint) => void;
  /** 屏幕阅读器 label,默认 "趋势线"。 */
  accessibilityLabel?: string;
}

/** 默认 X 轴 label:timestamp → "MM-DD"。 */
function defaultXFormat(x: number): string {
  const d = new Date(x);
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Y 轴 label 短数字(用于刻度 tick):≥1000 → "1.2k",否则四舍五入。 */
function shortNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n)}`;
}

export function LineChart({
  points,
  width,
  height,
  yLabelFormat,
  xLabelFormat = defaultXFormat,
  onLongPressPoint,
  accessibilityLabel = '趋势线',
}: LineChartProps) {
  const { colors } = useTheme();

  const innerWidth = Math.max(0, width - PADDING_LEFT - PADDING_RIGHT);
  const innerHeight = height - PADDING_TOP - PADDING_BOTTOM;

  const { xAt, yAt, yMin, yMax } = useMemo(() => {
    const dummy = (_: number) => 0;
    if (points.length === 0) {
      return { xAt: dummy, yAt: dummy, yMin: 0, yMax: 0 };
    }
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const yLo = Math.max(0, Math.min(...ys) * 0.9);
    const yHi = Math.max(...ys) * 1.1 || 1;
    const xAt = (x: number) =>
      PADDING_LEFT +
      (xMax === xMin
        ? innerWidth / 2
        : ((x - xMin) / (xMax - xMin)) * innerWidth);
    const yAt = (y: number) =>
      PADDING_TOP +
      innerHeight -
      (yHi === yLo ? innerHeight / 2 : ((y - yLo) / (yHi - yLo)) * innerHeight);
    return { xAt, yAt, yMin: yLo, yMax: yHi };
  }, [points, innerWidth, innerHeight]);

  // Y 轴 4 段刻度(5 个 tick 数)
  const yTicks = useMemo(() => {
    if (points.length === 0) return [];
    const arr: number[] = [];
    for (let i = 0; i <= 4; i++) arr.push(yMin + ((yMax - yMin) * i) / 4);
    return arr;
  }, [points, yMin, yMax]);

  // X 轴两端刻度(避免太多 label 挤一起)
  const xTicks = useMemo(() => {
    if (points.length === 0) return [];
    if (points.length === 1) return [points[0]!.x];
    return [points[0]!.x, points[points.length - 1]!.x];
  }, [points]);

  // Polyline 字符串(≥ 2 点才有意义)
  const polyPoints = useMemo(() => {
    if (points.length < 2) return '';
    return points
      .map((p) => `${xAt(p.x).toFixed(2)},${yAt(p.y).toFixed(2)}`)
      .join(' ');
  }, [points, xAt, yAt]);

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <Svg width={width} height={height}>
        {/* Y 轴刻度线 + label */}
        {yTicks.map((t, i) => {
          const y = yAt(t);
          return (
            <G key={`ytick-${i}`}>
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

        {/* X 轴刻度 label(两端) */}
        {xTicks.map((x, i) => {
          const px = xAt(x);
          return (
            <SvgText
              key={`xtick-${i}`}
              x={px}
              y={height - 6}
              fontSize={9}
              fill={colors.textTertiary}
              textAnchor={i === 0 ? 'start' : 'end'}
            >
              {xLabelFormat(x)}
            </SvgText>
          );
        })}

        {/* 折线(≥ 2 点才有) */}
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
          const cx = xAt(p.x);
          const cy = yAt(p.y);
          return (
            <G key={`pt-${i}`}>
              {/* 透明 hit circle(放大命中区 ≥ 28px) */}
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
            x={xAt(points[0]!.x) + 8}
            y={yAt(points[0]!.y) - 8}
            fontSize={11}
            fill={colors.text}
          >
            {points[0]!.label ?? yLabelFormat(points[0]!.y)}
          </SvgText>
        ) : null}
      </Svg>
    </View>
  );
}
