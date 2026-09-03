/**
 * G18 — 共享 hook：一次性加载所有数据可视化的聚合结果。
 *
 * 4 个屏（CalendarHeatmap / VolumeTrend / MuscleGroupDistribution /
 * OneRMRecords）都需要同样原始数据（trainings + joined sets），用
 * 这个 hook 在屏 mount 时一次性拉，避免重复查询。
 */

import { useCallback, useEffect, useState } from 'react';

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

  return { data, loading, reload };
}