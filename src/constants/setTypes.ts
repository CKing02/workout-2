/**
 * Built-in set-type constants (附录 B).
 *
 * 组类型用于训练中标记每组（热身/正式/递减/力竭）。`short` 是单字符
 * 标签，渲染在组序号旁（"W1"、"D2"、"F3" 等）。
 */

export type SetTypeValue = 'normal' | 'warmup' | 'dropout' | 'failure';

export interface SetType {
  value: SetTypeValue;
  /** 单字符标签，正式组为空字符串 */
  short: string;
  label: string;
}

export const SET_TYPES: readonly SetType[] = [
  { value: 'normal', short: '', label: '正式组' },
  { value: 'warmup', short: 'W', label: '热身组' },
  { value: 'dropout', short: 'D', label: '递减组' },
  { value: 'failure', short: 'F', label: '力竭组' },
];

export const SET_TYPE_VALUES: readonly SetTypeValue[] = SET_TYPES.map((s) => s.value);

export const SET_TYPE_SET: ReadonlySet<SetTypeValue> = new Set(SET_TYPE_VALUES);

export function isSetType(value: string): value is SetTypeValue {
  return SET_TYPE_SET.has(value as SetTypeValue);
}

export function findSetType(value: string): SetType | undefined {
  return SET_TYPES.find((s) => s.value === value);
}
