/**
 * Built-in metric-type constants (附录 B).
 *
 * 字段说明：
 * - `value`：数据库存储值（也用作 React key）
 * - `label`：UI 显示中文标签
 * - `fields`：训练中需要录入的字段集合，决定 SetTable / SetRow 渲染哪些输入框
 *
 * 语义约定（gG ⋯ 计划组数据按 metricType 动态渲染）：
 * - `reps`        — 自重次数（俯卧撑 / 卷腹 / 仰卧举腿 等）：只渲染「个」
 * - `kg`          — 纯重量（农夫走等）：只渲染「kg」
 * - `weight_reps` — 重量 × 次数（杠铃卧推 / 哑铃弯举 等负重训练）
 * - `+kg` / `-kg` — 渐进 / 递减重量：同 `weight_reps`，语义区分
 * - `time`        — 时间（平板支撑 / 跑步 时长）：只渲染「min」（内部存秒）
 * - `km`          — 距离（跑步机慢跑 / 动感单车）：只渲染「km」
 *
 * 历史：早期 `reps` 含 `['weight','reps']`，seed 58 条负重动作都标 `reps`，
 * 但 UI 无脑渲染 kg + 次，与用户「俯卧撑只需显示个数」的诉求不符。v8 起拆为
 * 语义明确的两个枚举：`reps`（自重）/`weight_reps`（负重），seed 与历史 is_custom=0
 * 行通过 migration v8 自动迁移。
 */

export type MetricField = 'weight' | 'reps' | 'duration_seconds' | 'distance_km';

export interface MetricType {
  value: string;
  label: string;
  fields: MetricField[];
}

export const METRIC_TYPES: readonly MetricType[] = [
  { value: 'reps', label: '次数', fields: ['reps'] },
  { value: 'kg', label: '重量', fields: ['weight'] },
  { value: 'weight_reps', label: '重量×次数', fields: ['weight', 'reps'] },
  { value: '+kg', label: '递增', fields: ['weight', 'reps'] },
  { value: '-kg', label: '递减', fields: ['weight', 'reps'] },
  { value: 'time', label: '时间', fields: ['duration_seconds'] },
  { value: 'km', label: '距离', fields: ['distance_km'] },
];

export const METRIC_TYPE_VALUES: readonly string[] = METRIC_TYPES.map((m) => m.value);

export const METRIC_TYPE_SET: ReadonlySet<string> = new Set(METRIC_TYPE_VALUES);

export function isMetricType(value: string): value is MetricType['value'] {
  return METRIC_TYPE_SET.has(value);
}

/** 根据 value 查找 MetricType；找不到返回 undefined。 */
export function findMetricType(value: string): MetricType | undefined {
  return METRIC_TYPES.find((m) => m.value === value);
}
