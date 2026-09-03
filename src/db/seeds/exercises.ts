/**
 * Built-in exercise seed data (附录 C 起步集合，扩展至 ≥30)。
 *
 * 每条记录的字段对应 `exercises` 表 schema。`secondary_muscles` 已
 * 序列化为 JSON 字符串，调用 `seedExercises` 时直接传入。
 *
 * 命名约定：
 * - 中文为主，方便 C 端用户识别
 * - 同一肌群内动作按难度/常见度排序
 */

import type { ExerciseRow } from '../schema';

export interface ExerciseSeed {
  name: string;
  muscle_group: string;
  secondary_muscles: string[];
  equipment: string;
  metric_type: string;
}

/**
 * ≥30 个内置动作。每个肌群（胸/背/肩/臂/腿/核心/全身）≥2 个。
 * 覆盖附录 C 全部建议项并补足常见动作。
 */
export const EXERCISE_SEEDS: ExerciseSeed[] = [
  // ===== 胸（5）=====
  {
    name: '杠铃卧推',
    muscle_group: '胸',
    secondary_muscles: ['三头', '肩'],
    equipment: '杠铃',
    metric_type: 'reps',
  },
  {
    name: '哑铃卧推',
    muscle_group: '胸',
    secondary_muscles: ['三头', '肩'],
    equipment: '哑铃',
    metric_type: 'reps',
  },
  {
    name: '哑铃飞鸟',
    muscle_group: '胸',
    secondary_muscles: ['肩'],
    equipment: '哑铃',
    metric_type: 'reps',
  },
  {
    name: '上斜哑铃推举',
    muscle_group: '胸',
    secondary_muscles: ['肩', '三头'],
    equipment: '哑铃',
    metric_type: 'reps',
  },
  {
    name: '器械夹胸',
    muscle_group: '胸',
    secondary_muscles: ['肩'],
    equipment: '固定器械',
    metric_type: 'reps',
  },
  {
    name: '龙门架夹胸',
    muscle_group: '胸',
    secondary_muscles: ['肩'],
    equipment: '缆绳',
    metric_type: 'reps',
  },

  // ===== 背（5）=====
  {
    name: '引体向上',
    muscle_group: '背',
    secondary_muscles: ['二头', '前臂'],
    equipment: '自重',
    metric_type: 'reps',
  },
  {
    name: '高位下拉',
    muscle_group: '背',
    secondary_muscles: ['二头'],
    equipment: '缆绳',
    metric_type: 'reps',
  },
  {
    name: '杠铃划船',
    muscle_group: '背',
    secondary_muscles: ['二头', '前臂'],
    equipment: '杠铃',
    metric_type: 'reps',
  },
  {
    name: '哑铃单臂划船',
    muscle_group: '背',
    secondary_muscles: ['二头'],
    equipment: '哑铃',
    metric_type: 'reps',
  },
  {
    name: '坐姿绳索划船',
    muscle_group: '背',
    secondary_muscles: ['二头'],
    equipment: '缆绳',
    metric_type: 'reps',
  },

  // ===== 肩（4）=====
  {
    name: '杠铃推举',
    muscle_group: '肩',
    secondary_muscles: ['三头'],
    equipment: '杠铃',
    metric_type: 'reps',
  },
  {
    name: '哑铃侧平举',
    muscle_group: '肩',
    secondary_muscles: [],
    equipment: '哑铃',
    metric_type: 'reps',
  },
  {
    name: '俯身飞鸟',
    muscle_group: '肩',
    secondary_muscles: ['背'],
    equipment: '哑铃',
    metric_type: 'reps',
  },
  {
    name: '绳索面拉',
    muscle_group: '肩',
    secondary_muscles: ['背'],
    equipment: '缆绳',
    metric_type: 'reps',
  },

  // ===== 臂（二头 + 三头 + 前臂）（4）=====
  {
    name: '杠铃弯举',
    muscle_group: '二头',
    secondary_muscles: ['前臂'],
    equipment: '杠铃',
    metric_type: 'reps',
  },
  {
    name: '哑铃弯举',
    muscle_group: '二头',
    secondary_muscles: ['前臂'],
    equipment: '哑铃',
    metric_type: 'reps',
  },
  {
    name: '三头下压',
    muscle_group: '三头',
    secondary_muscles: [],
    equipment: '缆绳',
    metric_type: 'reps',
  },
  {
    name: '仰卧臂屈伸',
    muscle_group: '三头',
    secondary_muscles: [],
    equipment: '杠铃',
    metric_type: 'reps',
  },

  // ===== 腿（7）=====
  {
    name: '深蹲',
    muscle_group: '股四头',
    secondary_muscles: ['臀', '腘绳'],
    equipment: '杠铃',
    metric_type: 'reps',
  },
  {
    name: '硬拉',
    muscle_group: '腘绳',
    secondary_muscles: ['背', '臀'],
    equipment: '杠铃',
    metric_type: 'reps',
  },
  {
    name: '腿推',
    muscle_group: '股四头',
    secondary_muscles: ['臀'],
    equipment: '固定器械',
    metric_type: 'reps',
  },
  {
    name: '腿屈伸',
    muscle_group: '股四头',
    secondary_muscles: [],
    equipment: '固定器械',
    metric_type: 'reps',
  },
  {
    name: '腿弯举',
    muscle_group: '腘绳',
    secondary_muscles: [],
    equipment: '固定器械',
    metric_type: 'reps',
  },
  {
    name: '弓步蹲',
    muscle_group: '股四头',
    secondary_muscles: ['臀', '腘绳'],
    equipment: '哑铃',
    metric_type: 'reps',
  },
  {
    name: '站姿提踵',
    muscle_group: '小腿',
    secondary_muscles: [],
    equipment: '哑铃',
    metric_type: 'reps',
  },
  {
    name: '坐姿提踵',
    muscle_group: '小腿',
    secondary_muscles: [],
    equipment: '哑铃',
    metric_type: 'reps',
  },

  // ===== 核心/腹（3）=====
  {
    name: '平板支撑',
    muscle_group: '腹',
    secondary_muscles: ['全身'],
    equipment: '自重',
    metric_type: 'time',
  },
  {
    name: '卷腹',
    muscle_group: '腹',
    secondary_muscles: [],
    equipment: '自重',
    metric_type: 'reps',
  },
  {
    name: '悬垂举腿',
    muscle_group: '腹',
    secondary_muscles: ['前臂'],
    equipment: '自重',
    metric_type: 'reps',
  },

  // ===== 全身/有氧（2）=====
  {
    name: '壶铃摇摆',
    muscle_group: '全身',
    secondary_muscles: ['臀', '腘绳', '腹'],
    equipment: '壶铃',
    metric_type: 'reps',
  },
  {
    name: '跑步机慢跑',
    muscle_group: '全身',
    secondary_muscles: [],
    equipment: '固定器械',
    metric_type: 'km',
  },
];

/**
 * Convert seed entries to rows ready for INSERT.
 * `id` / `is_custom` / `created_at` 在调用方填充（保证幂等 + 时间一致）。
 */
export function toExerciseRows(now: number): Omit<ExerciseRow, 'id'>[] {
  return EXERCISE_SEEDS.map((seed) => ({
    name: seed.name,
    muscle_group: seed.muscle_group,
    secondary_muscles: JSON.stringify(seed.secondary_muscles),
    equipment: seed.equipment,
    metric_type: seed.metric_type,
    image_uri: null,
    is_custom: 0,
    created_at: now,
  }));
}
