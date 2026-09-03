/**
 * G20 — aggregations.ts 单元测试（G18 自检核心）。
 *
 * 测试范围：8 个纯同步函数（dayKey / weekStartMs / weekKey /
 * aggregateDailyVolume / aggregateWeeklyVolume / aggregateMuscleGroup /
 * aggregateOneRM）。DB-bound 的 `listJoinedCompletedSets` /
 * `listCompletedTrainings` 需要 SQLiteDatabase mock，留给 G20.x。
 *
 * ⚠️ 已知 doc drift（commit 时 flag）：
 *   aggregateOneRM 的实现仅在 `oneRm > existing.oneRm` 时覆盖，**严格大于**
 *   才替换。doc-comment 说"ties go to most recent trainingStartedAt"。
 *   测试先固化当前行为（首次出现胜出），由用户决定是否改代码或改文档。
 */

import {
  aggregateDailyVolume,
  aggregateMuscleGroup,
  aggregateOneRM,
  aggregateWeeklyVolume,
  dayKey,
  weekKey,
  weekStartMs,
  type JoinedSetRow,
} from '@/features/data/aggregations';
import type { Exercise, Training, TrainingSet } from '@/db/schema';

// --------- 测试 fixtures ---------

function makeTraining(over: Partial<Training> = {}): Training {
  return {
    id: 't1',
    planId: null,
    planNameSnapshot: '自由训练',
    startedAt: Date.UTC(2024, 5, 15, 10, 0, 0),
    endedAt: Date.UTC(2024, 5, 15, 11, 0, 0),
    durationSeconds: 3600,
    totalVolume: 1000,
    exerciseCount: 3,
    setCount: 9,
    ...over,
  };
}

function makeExercise(over: Partial<Exercise> = {}): Exercise {
  return {
    id: 'e1',
    name: '杠铃卧推',
    muscleGroup: '胸',
    secondaryMuscles: ['三头'],
    equipment: '杠铃',
    metricType: 'kg',
    imageUri: null,
    isCustom: false,
    createdAt: 0,
    ...over,
  };
}

function makeSet(over: Partial<TrainingSet> = {}): TrainingSet {
  return {
    id: 's1',
    trainingId: 't1',
    exerciseId: 'e1',
    exerciseNameSnapshot: '杠铃卧推',
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

function makeJoined(
  set: Partial<TrainingSet>,
  exercise: Partial<Exercise>,
  trainingStartedAt: number,
): JoinedSetRow {
  return {
    set: makeSet(set),
    exercise: makeExercise(exercise),
    trainingStartedAt,
  };
}

// --------- dayKey ---------

describe('aggregations/dayKey', () => {
  it('UTC 时间戳 → 本地 YYYY-MM-DD（TZ=UTC）', () => {
    // TZ=UTC 时，本地 = UTC
    expect(dayKey(Date.UTC(2024, 0, 15, 0, 0, 0))).toBe('2024-01-15');
  });

  it('月份/日期补零', () => {
    expect(dayKey(Date.UTC(2024, 0, 5, 12, 0, 0))).toBe('2024-01-05');
  });

  it('同一天不同时刻 → 同一 dayKey', () => {
    const morning = Date.UTC(2024, 5, 15, 1, 0, 0);
    const evening = Date.UTC(2024, 5, 15, 23, 59, 59);
    expect(dayKey(morning)).toBe(dayKey(evening));
  });
});

// --------- weekStartMs ---------

describe('aggregations/weekStartMs', () => {
  it('周一（getDay=1）→ 自身当天 00:00', () => {
    // 2024-06-17 是周一（UTC）
    const ms = Date.UTC(2024, 5, 17, 14, 30, 0);
    const monday = weekStartMs(ms);
    expect(dayKey(monday)).toBe('2024-06-17');
    // 小时被清零
    expect(new Date(monday).getUTCHours()).toBe(0);
  });

  it('周日（getDay=0）→ 本周一（不是上周）', () => {
    // 2024-06-16 是周日 → 它的"本周一"是 2024-06-10
    const sunday = Date.UTC(2024, 5, 16, 12, 0, 0);
    const monday = weekStartMs(sunday);
    expect(dayKey(monday)).toBe('2024-06-10');
  });

  it('周三 → 本周一（往前 2 天）', () => {
    // 2024-06-19 周三 → 2024-06-17 周一
    const wed = Date.UTC(2024, 5, 19, 12, 0, 0);
    expect(dayKey(weekStartMs(wed))).toBe('2024-06-17');
  });
});

// --------- weekKey ---------

describe('aggregations/weekKey', () => {
  it('weekKey = dayKey(weekStartMs(ms))', () => {
    const wed = Date.UTC(2024, 5, 19, 12, 0, 0);
    expect(weekKey(wed)).toBe(dayKey(weekStartMs(wed)));
  });
});

// --------- aggregateDailyVolume ---------

describe('aggregations/aggregateDailyVolume', () => {
  it('空数组 → 空数组', () => {
    expect(aggregateDailyVolume([])).toEqual([]);
  });

  it('跳过 endedAt === null 的训练', () => {
    const ts = [
      makeTraining({ id: 'a', totalVolume: 100 }),
      makeTraining({ id: 'b', endedAt: null, totalVolume: 999 }),
    ];
    const result = aggregateDailyVolume(ts);
    expect(result).toHaveLength(1);
    expect(result[0].volume).toBe(100);
  });

  it('跳过 totalVolume === null 的训练', () => {
    const ts = [
      makeTraining({ id: 'a', totalVolume: 100 }),
      makeTraining({ id: 'b', totalVolume: null }),
    ];
    const result = aggregateDailyVolume(ts);
    expect(result).toHaveLength(1);
    expect(result[0].volume).toBe(100);
  });

  it('同日多条训练累加 volume', () => {
    const ts = [
      makeTraining({ id: 'a', totalVolume: 100, startedAt: Date.UTC(2024, 5, 15, 9, 0, 0) }),
      makeTraining({ id: 'b', totalVolume: 250, startedAt: Date.UTC(2024, 5, 15, 18, 0, 0) }),
    ];
    const result = aggregateDailyVolume(ts);
    expect(result).toEqual([{ day: '2024-06-15', volume: 350 }]);
  });

  it('结果按 day 升序', () => {
    const ts = [
      makeTraining({ id: 'a', totalVolume: 100, startedAt: Date.UTC(2024, 5, 17, 9) }),
      makeTraining({ id: 'b', totalVolume: 200, startedAt: Date.UTC(2024, 5, 15, 9) }),
      makeTraining({ id: 'c', totalVolume: 300, startedAt: Date.UTC(2024, 5, 16, 9) }),
    ];
    const result = aggregateDailyVolume(ts);
    expect(result.map((r) => r.day)).toEqual([
      '2024-06-15',
      '2024-06-16',
      '2024-06-17',
    ]);
  });
});

// --------- aggregateWeeklyVolume ---------

describe('aggregations/aggregateWeeklyVolume', () => {
  it('跳过未完成训练', () => {
    const ts = [
      makeTraining({ id: 'a', totalVolume: 100, endedAt: null }),
    ];
    expect(aggregateWeeklyVolume(ts)).toEqual([]);
  });

  it('按 week key 聚合（同周累加）', () => {
    const ts = [
      makeTraining({ id: 'a', totalVolume: 100, startedAt: Date.UTC(2024, 5, 17, 9) }), // 周一
      makeTraining({ id: 'b', totalVolume: 200, startedAt: Date.UTC(2024, 5, 19, 9) }), // 周三
    ];
    const result = aggregateWeeklyVolume(ts);
    expect(result).toEqual([{ week: '2024-06-17', volume: 300 }]);
  });
});

// --------- aggregateMuscleGroup ---------

describe('aggregations/aggregateMuscleGroup', () => {
  it('空数组 → 空数组', () => {
    expect(aggregateMuscleGroup([])).toEqual([]);
  });

  it('跳过 weight <= 0 或 reps <= 0 的 set', () => {
    const rows = [
      makeJoined({ weight: 100, reps: 5 }, { id: 'e1', muscleGroup: '胸' }, 0),
      makeJoined({ weight: 0, reps: 5 }, { id: 'e2', muscleGroup: '背' }, 0),
      makeJoined({ weight: 100, reps: 0 }, { id: 'e3', muscleGroup: '肩' }, 0),
      makeJoined({ weight: -10, reps: 5 }, { id: 'e4', muscleGroup: '腿' }, 0),
    ];
    const result = aggregateMuscleGroup(rows);
    expect(result).toEqual([{ muscleGroup: '胸', volume: 500 }]);
  });

  it('按 volume DESC 排序', () => {
    const rows = [
      makeJoined({ weight: 50, reps: 5 }, { id: 'e1', muscleGroup: '胸' }, 0),
      makeJoined({ weight: 100, reps: 5 }, { id: 'e2', muscleGroup: '背' }, 0),
      makeJoined({ weight: 80, reps: 5 }, { id: 'e3', muscleGroup: '腿' }, 0),
    ];
    const result = aggregateMuscleGroup(rows);
    expect(result.map((r) => r.muscleGroup)).toEqual(['背', '腿', '胸']);
    expect(result.map((r) => r.volume)).toEqual([500, 400, 250]);
  });
});

// --------- aggregateOneRM ---------

describe('aggregations/aggregateOneRM', () => {
  it('Epley: 100kg × 5 reps → 116.67 1RM', () => {
    const rows = [makeJoined({ weight: 100, reps: 5 }, {}, 0)];
    const result = aggregateOneRM(rows);
    expect(result).toHaveLength(1);
    expect(result[0].oneRm).toBeCloseTo(116.67, 2);
    expect(result[0].weight).toBe(100);
    expect(result[0].reps).toBe(5);
  });

  it('跳过 weight/reps <= 0 的 set', () => {
    const rows = [
      makeJoined({ weight: 0, reps: 5 }, {}, 0),
      makeJoined({ weight: 100, reps: 0 }, {}, 0),
      makeJoined({ weight: 100, reps: 5 }, {}, 0),
    ];
    const result = aggregateOneRM(rows);
    expect(result).toHaveLength(1);
    expect(result[0].oneRm).toBeCloseTo(116.67, 2);
  });

  it('同动作多条：保留最高 1RM', () => {
    const rows = [
      makeJoined({ weight: 100, reps: 5 }, { id: 'e1', name: '卧推' }, 1000), // 1RM=116.67
      makeJoined({ weight: 110, reps: 3 }, { id: 'e1', name: '卧推' }, 2000), // 1RM=121
      makeJoined({ weight: 90, reps: 8 }, { id: 'e1', name: '卧推' }, 3000),  // 1RM=114
    ];
    const result = aggregateOneRM(rows);
    expect(result).toHaveLength(1);
    expect(result[0].oneRm).toBeCloseTo(121, 2);
    expect(result[0].weight).toBe(110);
    expect(result[0].reps).toBe(3);
    expect(result[0].achievedAt).toBe(2000);
  });

  it('按 1RM DESC 排序多动作', () => {
    const rows = [
      makeJoined({ weight: 100, reps: 5 }, { id: 'e1' }, 0),
      makeJoined({ weight: 200, reps: 1 }, { id: 'e2' }, 0),
    ];
    const result = aggregateOneRM(rows);
    // Epley: 200 * (1 + 1/30) = 206.67, 100 * (1 + 5/30) = 116.67
    expect(result).toHaveLength(2);
    expect(result[0].oneRm).toBeCloseTo(206.67, 2);
    expect(result[1].oneRm).toBeCloseTo(116.67, 2);
  });

  it('⚠️ 平局行为：当前实现保留首次出现（strictly greater 才覆盖）', () => {
    // 两次 100kg × 5 reps 都是 116.67 1RM，achievedAt 不同
    const rows = [
      makeJoined({ weight: 100, reps: 5 }, { id: 'e1' }, 1000), // 早
      makeJoined({ weight: 100, reps: 5 }, { id: 'e1' }, 2000), // 晚
    ];
    const result = aggregateOneRM(rows);
    expect(result).toHaveLength(1);
    // 严格大于才覆盖 → 早的胜出
    expect(result[0].achievedAt).toBe(1000);
    // doc-comment 说"ties go to most recent"，但实现是"first wins"。
    // 留待用户决定是否修复。
  });
});