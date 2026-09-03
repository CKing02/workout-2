/**
 * G11 — 自由训练（不绑定计划）的共享常量与展示辅助。
 *
 * 自由训练在 DB 里的形态：`trainings.plan_id = NULL`，
 * `trainings.plan_name_snapshot = '自由训练'`（附录 A 允许 plan_id 为 NULL）。
 *
 * 之所以单独抽一个模块：历史列表（G9）、完成页（G8）、锻炼 Tab（G11）
 * 三处都要显示这个名字，也都要能兜住 `plan_name_snapshot` 为 NULL 的旧数据。
 */

/** 自由训练的计划名快照（写入 DB + 历史展示）。 */
export const FREE_TRAINING_NAME = '自由训练';

/**
 * 历史/详情/完成页的标题兜底：
 * `plan_name_snapshot` 为 null / undefined / 空白时统一显示"自由训练"。
 *
 * 这样即便某条记录没有写快照（例如手工插入的数据），列表也不会出现空标题。
 */
export function resolveTrainingTitle(
  planNameSnapshot: string | null | undefined,
): string {
  const trimmed = planNameSnapshot?.trim();
  return trimmed ? trimmed : FREE_TRAINING_NAME;
}

/** 该次训练是否为自由训练（无关联计划）。 */
export function isFreeTraining(planId: string | null | undefined): boolean {
  return !planId;
}
