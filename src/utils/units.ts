/**
 * 重量单位换算工具（G10）。
 *
 * 设计决策：
 * - **底层存储统一使用 kg**：所有重量在 SQLite / Zustand store 中都是 kg。
 * - 单位设置 `settingsStore.unit` 只影响 *显示*（NumberInput / 历史详情）。
 * - 后续 G6 / G9 接入：将 NumberInput 的 `unitLabel` 切换为当前单位，
 *   写入前用 `lbToKg()` 反向换算回 kg 存储；详情渲染前用 `formatWeight()` 即可。
 *
 * 换算系数（与 G10 文档一致）：
 * - 1 kg = 2.2046 lb   → kgToLb(kg) = kg * 2.2046
 * - 1 lb = 0.4536 kg   → lbToKg(lb) = lb * 0.4536
 *
 * 数值精度：formatWeight 在 kg/lb 下都保留 1 位小数（视觉一致）；
 * 反向解析 `parseWeightInput` 返回 kg（Number，未取整），由 store 自行裁剪。
 */

import type { Unit } from '@/store/settingsStore';

export const KG_PER_LB = 0.4536;
export const LB_PER_KG = 2.2046;

/**
 * 把 kg 转成 lb。`1 kg = 2.2046 lb`。
 */
export function kgToLb(kg: number): number {
  if (!Number.isFinite(kg)) return 0;
  return kg * LB_PER_KG;
}

/**
 * 把 lb 转成 kg。`1 lb = 0.4536 kg`。
 */
export function lbToKg(lb: number): number {
  if (!Number.isFinite(lb)) return 0;
  return lb * KG_PER_LB;
}

/**
 * 格式化显示重量。kg / lb 都保留 1 位小数 + 单位后缀。
 *
 * - `formatWeight(100, 'kg')` → `'100.0 kg'`
 * - `formatWeight(100, 'lb')` → `'220.5 lb'`
 */
export function formatWeight(weight: number, unit: Unit): string {
  const safe = Number.isFinite(weight) ? weight : 0;
  return `${safe.toFixed(1)} ${unit}`;
}

/**
 * 解析用户在当前单位下输入的文本，转回 kg 存储。
 *
 * - 接受任意空格、单位后缀（'kg'/'lb'），大小写不敏感
 * - 解析失败返回 NaN（调用方负责兜底）
 */
export function parseWeightInput(text: string, unit: Unit): number {
  const trimmed = text.trim().replace(/\s*(kg|lb)\s*$/i, '');
  if (trimmed === '') return NaN;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return NaN;
  return unit === 'kg' ? n : lbToKg(n);
}