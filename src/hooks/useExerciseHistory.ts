/**
 * G32 — useExerciseHistory
 *
 * 单动作历史下钻的主 hook：
 *  - 入参：`exerciseId` + 时间区间 `range`
 *  - 出参：`points` (按训练日聚合的 1RM / volume / top set) + meta + loading
 *
 * 设计：
 *  - 走 `getDatabase()` + `exerciseHistoryRepo.listSetsByExerciseInRange`
 *  - 应用层 group-by trainingStartedAt，算 max Brzycki 1RM、volume、top set
 *  - 切换 `range` 触发 reload；不在 hook 内缓存，避免训练中实时刷新产生
 *    数据不一致（用户在详情页看到的应是 DB 当前快照）。
 */

import { useCallback, useEffect, useState } from 'react';

import { getDatabase } from '@/db';
import {
  listSetsByExerciseInRange,
  type ExerciseHistorySetRow,
} from '@/db/repositories/exerciseHistoryRepo';
import { brzycki } from '@/utils/oneRm';

export type Range = '4w' | '3m' | '1y' | 'all';

export interface TopSet {
  weight: number;
  reps: number;
}

export interface ExerciseHistoryPoint {
  /** 该次训练的 `started_at`（毫秒）—— 横轴时间。 */
  date: number;
  /** 该次训练的训练 ID —— 长按跳详情用。 */
  trainingId: string;
  /** 该次训练中所有 normal set 的最大 Brzycki 1RM（kg）。 */
  oneRmMax: number;
  /** 该次训练中所有 normal set 的容量 Σ weight × reps。 */
  volume: number;
  /** 取该 1RM 的那一组 weight × reps（用于长按预览和趋势线提示）。 */
  topSet: TopSet;
}

export interface ExerciseHistoryMeta {
  totalTrainings: number;
  maxOneRm: number;
}

export interface ExerciseHistoryState {
  points: ExerciseHistoryPoint[];
  meta: ExerciseHistoryMeta;
  loading: boolean;
  error: string | null;
}

const ONE_DAY_MS = 86_400_000;

/** Range → sinceMs；'all' 返回 0 表示不限。 */
function rangeToSinceMs(range: Range): number {
  if (range === 'all') return 0;
  const now = Date.now();
  switch (range) {
    case '4w':
      return now - 4 * 7 * ONE_DAY_MS;
    case '3m':
      return now - 90 * ONE_DAY_MS;
    case '1y':
      return now - 365 * ONE_DAY_MS;
  }
}

/**
 * 把同一训练的 set 聚合成一个 ExerciseHistoryPoint。
 * pure function，方便测试。
 */
export function groupSetsByTraining(
  rows: ExerciseHistorySetRow[],
): ExerciseHistoryPoint[] {
  const byTraining = new Map<string, ExerciseHistoryPoint>();
  for (const r of rows) {
    let point = byTraining.get(r.trainingId);
    if (!point) {
      point = {
        date: r.trainingStartedAt,
        trainingId: r.trainingId,
        oneRmMax: 0,
        volume: 0,
        topSet: { weight: 0, reps: 0 },
      };
      byTraining.set(r.trainingId, point);
    }
    const w = r.weight ?? 0;
    const reps = r.reps ?? 0;
    if (w <= 0 || reps <= 0) continue;
    point.volume += w * reps;
    const oneRm = brzycki(w, reps);
    if (oneRm > point.oneRmMax) {
      point.oneRmMax = oneRm;
      point.topSet = { weight: w, reps };
    }
  }
  return Array.from(byTraining.values()).sort((a, b) => a.date - b.date);
}

const EMPTY_META: ExerciseHistoryMeta = { totalTrainings: 0, maxOneRm: 0 };

export function useExerciseHistory(
  exerciseId: string | undefined,
  range: Range,
): ExerciseHistoryState {
  const [points, setPoints] = useState<ExerciseHistoryPoint[]>([]);
  const [meta, setMeta] = useState<ExerciseHistoryMeta>(EMPTY_META);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!exerciseId) {
      setPoints([]);
      setMeta(EMPTY_META);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const db = await getDatabase();
      const sinceMs = rangeToSinceMs(range);
      const rows = await listSetsByExerciseInRange(db, exerciseId, sinceMs);
      const grouped = groupSetsByTraining(rows);
      const maxOneRm = grouped.reduce((m, p) => Math.max(m, p.oneRmMax), 0);
      setPoints(grouped);
      setMeta({ totalTrainings: grouped.length, maxOneRm });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.error('[useExerciseHistory] failed:', err);
      setError(msg);
      setPoints([]);
      setMeta(EMPTY_META);
    } finally {
      setLoading(false);
    }
  }, [exerciseId, range]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { points, meta, loading, error };
}
