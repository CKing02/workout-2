/**
 * G32 — useExerciseHistory.groupSetsByTraining 单元测试。
 *
 * 覆盖：
 *  - 空输入 → 空数组
 *  - 单组训练 → 单 point，volume / 1RM / topSet 正确
 *  - 多组训练 → 按 date ASC 排序，volume 累加，1RM 取最大
 *  - 同训练跨 set：Brzycki 取最大，topSet 记录该组的 weight × reps
 *  - 跳过 weight<=0 或 reps<=0 的 set
 */

import { groupSetsByTraining } from '@/hooks/useExerciseHistory';
import type { ExerciseHistorySetRow } from '@/db/repositories/exerciseHistoryRepo';

function makeRow(
  over: Partial<ExerciseHistorySetRow> & {
    trainingId: string;
    trainingStartedAt: number;
  },
): ExerciseHistorySetRow {
  return {
    id: 's',
    exerciseId: 'e',
    exerciseNameSnapshot: '卧推',
    metricTypeSnapshot: 'weight_reps',
    position: 0,
    setIndex: 0,
    weight: 100,
    reps: 5,
    durationSeconds: null,
    distanceKm: null,
    setType: 'normal',
    completed: true,
    ...over,
  };
}

describe('useExerciseHistory/groupSetsByTraining', () => {
  it('空数组 → 空数组', () => {
    expect(groupSetsByTraining([])).toEqual([]);
  });

  it('单组训练 → 单 point', () => {
    const rows = [
      makeRow({ trainingId: 't1', trainingStartedAt: 1000, weight: 100, reps: 5 }),
    ];
    const [p] = groupSetsByTraining(rows);
    expect(p).toBeDefined();
    expect(p!.trainingId).toBe('t1');
    expect(p!.date).toBe(1000);
    expect(p!.volume).toBe(500);
    // Brzycki: 100 * 36 / 32 = 112.5
    expect(p!.oneRmMax).toBeCloseTo(112.5, 5);
    expect(p!.topSet).toEqual({ weight: 100, reps: 5 });
  });

  it('多组训练 → 按 date ASC 排序', () => {
    const rows = [
      makeRow({ trainingId: 't2', trainingStartedAt: 2000, weight: 80, reps: 5 }),
      makeRow({ trainingId: 't1', trainingStartedAt: 1000, weight: 90, reps: 3 }),
    ];
    const points = groupSetsByTraining(rows);
    expect(points.map((p) => p.trainingId)).toEqual(['t1', 't2']);
  });

  it('同一训练多 set：volume 累加，1RM 取最大（Brzycki），topSet 记录 max 那一组', () => {
    const rows = [
      makeRow({ trainingId: 't1', trainingStartedAt: 1000, setIndex: 0, weight: 100, reps: 5 }),
      makeRow({ trainingId: 't1', trainingStartedAt: 1000, setIndex: 1, weight: 110, reps: 3 }),
      makeRow({ trainingId: 't1', trainingStartedAt: 1000, setIndex: 2, weight: 90, reps: 8 }),
    ];
    const [p] = groupSetsByTraining(rows);
    expect(p).toBeDefined();
    // volume = 100*5 + 110*3 + 90*8 = 500 + 330 + 720 = 1550
    expect(p!.volume).toBe(1550);
    // 1RM: 110 * 36 / 34 ≈ 116.47（最大）
    expect(p!.oneRmMax).toBeCloseTo(116.4706, 3);
    expect(p!.topSet).toEqual({ weight: 110, reps: 3 });
  });

  it('跳过 weight<=0 / reps<=0 的 set', () => {
    const rows = [
      makeRow({ trainingId: 't1', trainingStartedAt: 1000, weight: 0, reps: 5 }),
      makeRow({ trainingId: 't1', trainingStartedAt: 1000, weight: 100, reps: 0 }),
      makeRow({ trainingId: 't1', trainingStartedAt: 1000, weight: 80, reps: 5 }),
    ];
    const [p] = groupSetsByTraining(rows);
    expect(p).toBeDefined();
    expect(p!.volume).toBe(400);
    // Brzycki: 80 * 36 / 32 = 90
    expect(p!.oneRmMax).toBeCloseTo(90, 5);
    expect(p!.topSet).toEqual({ weight: 80, reps: 5 });
  });

  it('weight / reps 为 null → 跳过该 set', () => {
    const rows = [
      makeRow({ trainingId: 't1', trainingStartedAt: 1000, weight: null, reps: 5 }),
      makeRow({ trainingId: 't1', trainingStartedAt: 1000, weight: 100, reps: null }),
    ];
    const points = groupSetsByTraining(rows);
    expect(points).toHaveLength(1);
    expect(points[0]!.volume).toBe(0);
    expect(points[0]!.oneRmMax).toBe(0);
    expect(points[0]!.topSet).toEqual({ weight: 0, reps: 0 });
  });
});
