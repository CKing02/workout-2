/**
 * Built-in metric-type constants (附录 B).
 *
 * 字段说明：
 * - `value`：数据库存储值（也用作 React key）
 * - `label`：UI 显示中文标签
 * - `fields`：训练中需要录入的字段集合，决定 SetTable 渲染哪些输入框
 */

export type MetricField = 'weight' | 'reps' | 'duration_seconds' | 'distance_km';

export interface MetricType {
  value: string;
  label: string;
  fields: MetricField[];
}

export const METRIC_TYPES: readonly MetricType[] = [
  { value: 'reps', label: '次数', fields: ['weight', 'reps'] },
  { value: 'kg', label: '重量', fields: ['weight'] },
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
