/**
 * G18 — 共享 hook：一次性加载所有数据可视化的聚合结果。
 *
 * 4 个屏（CalendarHeatmap / VolumeTrend / MuscleGroupDistribution /
 * OneRMRecords）都需要同样原始数据（trainings + joined sets），用
 * 这个 hook 在屏 mount 时一次性拉，避免重复查询。
 *
 * 2026-09-09 修：tab 切换不会重新 mount（RN tab 默认 keep-mounted），
 * 删完数据切回首页热力图残留旧缓存。改用 `useFocusEffect` 在每次获焦
 * 时重拉；mount 时的 `useEffect` 保留为冷启动入口（focusEffect 在
 * mount 时也会触发一次,所以实际不会重复拉,但保留 mount 拉是防御性）。
 */

import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { getDatabase } from '@/db';
import {
  aggregateDailyVolume,
  aggregateMuscleGroup,
  aggregateOneRM,
  aggregateWeeklyVolume,
  listCompletedTrainings,
  listJoinedCompletedSets,
  type DailyVolume,
  type JoinedSetRow,
  type MuscleGroupSlice,
  type OneRMRecord,
  type WeeklyVolume,
} from '@/features/data/aggregations';

export interface DataAggregates {
  daily: DailyVolume[];
  weekly: WeeklyVolume[];
  muscleGroups: MuscleGroupSlice[];
  oneRm: OneRMRecord[];
  /** 全部 join 行（4 屏之外可能也用到，例如未来"高强度日"）。 */
  joined: JoinedSetRow[];
}

export function useDataAggregates(): {
  data: DataAggregates | null;
  loading: boolean;
  reload: () => Promise<void>;
} {
  const [data, setData] = useState<DataAggregates | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const db = await getDatabase();
      const [trainings, joined] = await Promise.all([
        listCompletedTrainings(db),
        listJoinedCompletedSets(db),
      ]);
      setData({
        daily: aggregateDailyVolume(trainings),
        weekly: aggregateWeeklyVolume(trainings),
        muscleGroups: aggregateMuscleGroup(joined),
        oneRm: aggregateOneRM(joined),
        joined,
      });
    } catch (err) {
      // 上层组件 toast；这里只吞掉防止 render 崩。
      // eslint-disable-next-line no-console
      console.error('[useDataAggregates] failed:', err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // tab 切换场景:从其他 tab 删完训练/身体数据切回,需要重拉;
  // focusEffect 在 mount 后也会触发一次,所以 cold start 不会重复拉
  // (useEffect 在 mount 时跑,focusEffect 在 mount 之后第一次获焦时跑,
  // 实际有 ~1 帧的顺序,但 reload() 是 idempotent,SQLite 查询幂等)。
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return { data, loading, reload };
}