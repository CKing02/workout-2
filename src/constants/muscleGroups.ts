/**
 * Built-in muscle group constants (附录 B).
 *
 * 主/次肌群共用此列表。Agent 可按需追加，但需同步到 `exercise.muscle_group`
 * 已有数据；新增项目建议在 G3+ 阶段通过 schema 迁移 (G2 不强制)。
 */

export const MUSCLE_GROUPS = [
  '胸',
  '背',
  '肩',
  '二头',
  '三头',
  '前臂',
  '腹',
  '股四头',
  '腘绳',
  '臀',
  '小腿',
  '全身',
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

/** A set of valid muscle groups — useful for filtering / search results. */
export const MUSCLE_GROUP_SET: ReadonlySet<MuscleGroup> = new Set(MUSCLE_GROUPS);

/** Type guard for runtime strings. */
export function isMuscleGroup(value: string): value is MuscleGroup {
  return MUSCLE_GROUP_SET.has(value as MuscleGroup);
}
