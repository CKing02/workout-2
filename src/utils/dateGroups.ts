/**
 * dateGroups — 历史记录按日期分组（G9）
 *
 * 分组规则：
 *  - "今天"   : startedAt 与今天同一自然日
 *  - "昨天"   : startedAt 与昨天同一自然日
 *  - "本周"   : 同一 ISO 周（周一为周首），排除今天/昨天
 *  - "上周"   : 上一个 ISO 周
 *  - "更早"   : 再之前的所有
 *
 * 输入必须是已经倒序（startedAt DESC）的数组。
 *
 * 返回的顺序固定：今天 → 昨天 → 本周 → 上周 → 更早。
 * 每组内的训练按传入顺序保持倒序。
 */

import type { Training } from '@/db/schema';

export type HistoryGroupKey =
  | 'today'
  | 'yesterday'
  | 'thisWeek'
  | 'lastWeek'
  | 'earlier';

export interface HistoryGroup {
  key: HistoryGroupKey;
  title: string;
  data: Training[];
}

export const HISTORY_GROUP_TITLES: Record<HistoryGroupKey, string> = {
  today: '今天',
  yesterday: '昨天',
  thisWeek: '本周',
  lastWeek: '上周',
  earlier: '更早',
};

/** 本地时区下，去掉时分秒，只比较日期。 */
function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** 周一首日的本地零点。 */
function startOfIsoWeek(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  // JS 周日为 0；按 ISO（周一为周首）调整为 1..7
  const dow = d.getDay() === 0 ? 7 : d.getDay();
  d.setDate(d.getDate() - (dow - 1));
  return d.getTime();
}

export function groupHistoryByDate(history: Training[]): HistoryGroup[] {
  const now = Date.now();
  const todayStart = startOfLocalDay(now);
  const yesterdayStart = todayStart - 86400000;
  const thisWeekStart = startOfIsoWeek(now);
  const lastWeekStart = thisWeekStart - 7 * 86400000;

  const buckets: Record<HistoryGroupKey, Training[]> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    lastWeek: [],
    earlier: [],
  };

  for (const t of history) {
    const start = startOfLocalDay(t.startedAt);
    if (start === todayStart) {
      buckets.today.push(t);
    } else if (start === yesterdayStart) {
      buckets.yesterday.push(t);
    } else if (t.startedAt >= thisWeekStart) {
      buckets.thisWeek.push(t);
    } else if (t.startedAt >= lastWeekStart) {
      buckets.lastWeek.push(t);
    } else {
      buckets.earlier.push(t);
    }
  }

  const ordered: HistoryGroupKey[] = [
    'today',
    'yesterday',
    'thisWeek',
    'lastWeek',
    'earlier',
  ];

  return ordered
    .filter((k) => buckets[k].length > 0)
    .map((k) => ({ key: k, title: HISTORY_GROUP_TITLES[k], data: buckets[k] }));
}

/** 训练卡片用的简短开始时间（HH:MM）。 */
export function formatStartHHMM(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** 时长 mm:ss（小于 1 小时）或 h:mm:ss。 */
export function formatDurationShort(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || !Number.isFinite(totalSeconds)) return '—';
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${minutes}:${pad(seconds)}`;
}

/**
 * Compute set-count fallback when DB row hasn't been finalized (training row
 * created but `completeTraining` not yet called). We use it only as a UX hint
 * on the home card; the canonical source remains the DB row.
 */
export function displayExerciseCount(t: Training, fallback: number | null): number {
  return t.exerciseCount ?? fallback ?? 0;
}

export function displaySetCount(t: Training, fallback: number | null): number {
  return t.setCount ?? fallback ?? 0;
}
