/**
 * G32 — Brzycki 1RM 估算公式。
 *
 * 公式: 1RM ≈ weight × (36 / (37 − reps))
 *
 * 边界:
 *  - reps ≥ 37     → 分母 ≤ 0，公式溢出；按任务约定 cap 为 `weight × 1`（等同 weight）。
 *  - reps ≤ 0      → 无意义的输入（不可能做 0 reps），返回 0。
 *  - weight ≤ 0    → 同上，返回 0。
 *  - reps === 1    → 1RM === weight（公式精确成立：36 / (37-1) = 36/36 = 1）。
 *
 * 设计决策：
 *  - Brzycki vs Epley：G18 的 `aggregateOneRM` 用 Epley（`weight × (1+reps/30)`）。
 *    G32 任务要求单动作历史用 Brzycki，因为它对 **高 reps 区间更保守**，
 *    适合「趋势线」这种连续观察场景。两个公式并存：全局概览用 Epley，
 *    单动作详情用 Brzycki，文档已在 GOALS.md G32 节中确认。
 *  - 不修改既有 `aggregateOneRM`（G18 的 1RM 记录屏和 OneRMRecordsScreen
 *    仍依赖 Epley），避免行为漂移。
 *  - `weight` / `reps` 非有限数（NaN / Infinity）也按 0 处理，
 *    与 `aggregateOneRM` 中的 `if (w <= 0 || reps <= 0) continue` 兜底一致。
 */

export function brzycki(weight: number, reps: number): number {
  if (!Number.isFinite(weight) || !Number.isFinite(reps)) return 0;
  if (weight <= 0 || reps <= 0) return 0;
  // reps >= 37 时分母 ≤ 0 → 按约定 cap 为 weight × 1
  if (reps >= 37) return weight;
  // reps === 1 → 36/36 === 1 → 结果就是 weight；公式依然成立，无需特判。
  return weight * (36 / (37 - reps));
}
