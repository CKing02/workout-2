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
import {
  EXERCISE_G35_BY_NAME,
  translateTarget,
} from './exerciseG35Mapping';
import { EXERCISE_ZH_BY_HASANEYLDRM_ID } from './exerciseZhData';

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
    metric_type: 'weight_reps',
  },
  {
    name: '哑铃卧推',
    muscle_group: '胸',
    secondary_muscles: ['三头', '肩'],
    equipment: '哑铃',
    metric_type: 'weight_reps',
  },
  {
    name: '哑铃飞鸟',
    muscle_group: '胸',
    secondary_muscles: ['肩'],
    equipment: '哑铃',
    metric_type: 'weight_reps',
  },
  {
    name: '上斜哑铃推举',
    muscle_group: '胸',
    secondary_muscles: ['肩', '三头'],
    equipment: '哑铃',
    metric_type: 'weight_reps',
  },
  {
    name: '器械夹胸',
    muscle_group: '胸',
    secondary_muscles: ['肩'],
    equipment: '固定器械',
    metric_type: 'weight_reps',
  },
  {
    name: '龙门架夹胸',
    muscle_group: '胸',
    secondary_muscles: ['肩'],
    equipment: '缆绳',
    metric_type: 'weight_reps',
  },

  // ===== 背（5）=====
  {
    name: '引体向上',
    muscle_group: '背',
    secondary_muscles: ['二头', '前臂'],
    equipment: '自重',
    metric_type: 'weight_reps',
  },
  {
    name: '高位下拉',
    muscle_group: '背',
    secondary_muscles: ['二头'],
    equipment: '缆绳',
    metric_type: 'weight_reps',
  },
  {
    name: '杠铃划船',
    muscle_group: '背',
    secondary_muscles: ['二头', '前臂'],
    equipment: '杠铃',
    metric_type: 'weight_reps',
  },
  {
    name: '哑铃单臂划船',
    muscle_group: '背',
    secondary_muscles: ['二头'],
    equipment: '哑铃',
    metric_type: 'weight_reps',
  },
  {
    name: '坐姿绳索划船',
    muscle_group: '背',
    secondary_muscles: ['二头'],
    equipment: '缆绳',
    metric_type: 'weight_reps',
  },

  // ===== 肩（4）=====
  {
    name: '杠铃推举',
    muscle_group: '肩',
    secondary_muscles: ['三头'],
    equipment: '杠铃',
    metric_type: 'weight_reps',
  },
  {
    name: '哑铃侧平举',
    muscle_group: '肩',
    secondary_muscles: [],
    equipment: '哑铃',
    metric_type: 'weight_reps',
  },
  {
    name: '俯身飞鸟',
    muscle_group: '肩',
    secondary_muscles: ['背'],
    equipment: '哑铃',
    metric_type: 'weight_reps',
  },
  {
    name: '绳索面拉',
    muscle_group: '肩',
    secondary_muscles: ['背'],
    equipment: '缆绳',
    metric_type: 'weight_reps',
  },

  // ===== 臂（二头 + 三头 + 前臂）（4）=====
  {
    name: '杠铃弯举',
    muscle_group: '二头',
    secondary_muscles: ['前臂'],
    equipment: '杠铃',
    metric_type: 'weight_reps',
  },
  {
    name: '哑铃弯举',
    muscle_group: '二头',
    secondary_muscles: ['前臂'],
    equipment: '哑铃',
    metric_type: 'weight_reps',
  },
  {
    name: '三头下压',
    muscle_group: '三头',
    secondary_muscles: [],
    equipment: '缆绳',
    metric_type: 'weight_reps',
  },
  {
    name: '仰卧臂屈伸',
    muscle_group: '三头',
    secondary_muscles: [],
    equipment: '杠铃',
    metric_type: 'weight_reps',
  },

  // ===== 腿（7）=====
  {
    name: '深蹲',
    muscle_group: '股四头',
    secondary_muscles: ['臀', '腘绳'],
    equipment: '杠铃',
    metric_type: 'weight_reps',
  },
  {
    name: '硬拉',
    muscle_group: '腘绳',
    secondary_muscles: ['背', '臀'],
    equipment: '杠铃',
    metric_type: 'weight_reps',
  },
  {
    name: '腿推',
    muscle_group: '股四头',
    secondary_muscles: ['臀'],
    equipment: '固定器械',
    metric_type: 'weight_reps',
  },
  {
    name: '腿屈伸',
    muscle_group: '股四头',
    secondary_muscles: [],
    equipment: '固定器械',
    metric_type: 'weight_reps',
  },
  {
    name: '腿弯举',
    muscle_group: '腘绳',
    secondary_muscles: [],
    equipment: '固定器械',
    metric_type: 'weight_reps',
  },
  {
    name: '弓步蹲',
    muscle_group: '股四头',
    secondary_muscles: ['臀', '腘绳'],
    equipment: '哑铃',
    metric_type: 'weight_reps',
  },
  {
    name: '站姿提踵',
    muscle_group: '小腿',
    secondary_muscles: [],
    equipment: '哑铃',
    metric_type: 'weight_reps',
  },
  {
    name: '坐姿提踵',
    muscle_group: '小腿',
    secondary_muscles: [],
    equipment: '哑铃',
    metric_type: 'weight_reps',
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
    metric_type: 'weight_reps',
  },
  {
    name: '悬垂举腿',
    muscle_group: '腹',
    secondary_muscles: ['前臂'],
    equipment: '自重',
    metric_type: 'weight_reps',
  },

  // ===== 全身/有氧（2）=====
  {
    name: '壶铃摇摆',
    muscle_group: '全身',
    secondary_muscles: ['臀', '腘绳', '腹'],
    equipment: '壶铃',
    metric_type: 'weight_reps',
  },
  {
    name: '跑步机慢跑',
    muscle_group: '全身',
    secondary_muscles: [],
    equipment: '固定器械',
    metric_type: 'km',
  },

  // ===== G37 补缺 20 个常用变体(在 G35 32 个基础上扩) =====
  // 胸(+1)
  {
    name: '上斜杠铃卧推',
    muscle_group: '胸',
    secondary_muscles: ['三头', '肩'],
    equipment: '杠铃',
    metric_type: 'weight_reps',
  },
  // 三头(+1) — 双杠臂屈伸
  {
    name: '双杠臂屈伸',
    muscle_group: '三头',
    secondary_muscles: ['胸', '肩'],
    equipment: '自重',
    metric_type: 'weight_reps',
  },
  // 背(+3)
  {
    name: 'T 杠划船',
    muscle_group: '背',
    secondary_muscles: ['二头', '前臂'],
    equipment: '固定器械',
    metric_type: 'weight_reps',
  },
  {
    name: '颈后下拉',
    muscle_group: '背',
    secondary_muscles: ['二头'],
    equipment: '缆绳',
    metric_type: 'weight_reps',
  },
  {
    name: '俯身挺身',
    muscle_group: '背',
    secondary_muscles: ['臀', '腘绳'],
    equipment: '自重',
    metric_type: 'weight_reps',
  },
  // 肩(+4)
  {
    name: '哑铃前平举',
    muscle_group: '肩',
    secondary_muscles: [],
    equipment: '哑铃',
    metric_type: 'weight_reps',
  },
  {
    name: '哑铃耸肩',
    muscle_group: '肩',
    secondary_muscles: [],
    equipment: '哑铃',
    metric_type: 'weight_reps',
  },
  {
    name: '杠铃耸肩',
    muscle_group: '肩',
    secondary_muscles: [],
    equipment: '杠铃',
    metric_type: 'weight_reps',
  },
  {
    name: '反向飞鸟',
    muscle_group: '肩',
    secondary_muscles: ['背'],
    equipment: '弹力带',
    metric_type: 'weight_reps',
  },
  // 二头(+3)
  {
    name: '绳索锤式弯举',
    muscle_group: '二头',
    secondary_muscles: ['前臂'],
    equipment: '缆绳',
    metric_type: 'weight_reps',
  },
  {
    name: '集中弯举',
    muscle_group: '二头',
    secondary_muscles: ['前臂'],
    equipment: '弹力带',
    metric_type: 'weight_reps',
  },
  {
    name: '牧师凳弯举',
    muscle_group: '二头',
    secondary_muscles: ['前臂'],
    equipment: '杠铃',
    metric_type: 'weight_reps',
  },
  // 腿(+4)
  {
    name: '罗马尼亚硬拉',
    muscle_group: '腘绳',
    secondary_muscles: ['背', '臀'],
    equipment: '杠铃',
    metric_type: 'weight_reps',
  },
  {
    name: '单腿硬拉',
    muscle_group: '腘绳',
    secondary_muscles: ['臀'],
    equipment: '杠铃',
    metric_type: 'weight_reps',
  },
  {
    name: '高脚杯深蹲',
    muscle_group: '股四头',
    secondary_muscles: ['臀'],
    equipment: '哑铃',
    metric_type: 'weight_reps',
  },
  {
    name: '颈前深蹲',
    muscle_group: '股四头',
    secondary_muscles: ['臀'],
    equipment: '杠铃',
    metric_type: 'weight_reps',
  },
  // 核心(+3)
  {
    name: '健腹轮',
    muscle_group: '腹',
    secondary_muscles: ['背'],
    equipment: '杠铃',
    metric_type: 'weight_reps',
  },
  {
    name: '俄罗斯转体',
    muscle_group: '腹',
    secondary_muscles: [],
    equipment: '药球',
    metric_type: 'weight_reps',
  },
  {
    name: '仰卧举腿',
    muscle_group: '腹',
    secondary_muscles: [],
    equipment: '辅助器械',
    metric_type: 'weight_reps',
  },
  // 全身/有氧(+1)
  {
    name: '动感单车',
    muscle_group: '全身',
    secondary_muscles: [],
    equipment: '动感单车',
    metric_type: 'km',
  },
];

/**
 * Convert seed entries to rows ready for INSERT.
 * `id` / `is_custom` / `created_at` 在调用方填充（保证幂等 + 时间一致）。
 *
 * G35 §3: 32 个 seed 都有 mapping + 中文数据,自动注入:
 *  - description_zh:hasaneyldrm instructions.zh
 *  - steps_zh:JSON(hasaneyldrm instruction_steps.zh)
 *  - gif_url:本地 bundle 路径('assets/exercises/{assetFileName}')
 *  - target_zh:translateTarget(targetEn) 结果
 *  - attribution:Gym Visual 版权声明
 *
 * 老 seeds(seed 里没 mapping 匹配)的 5 字段会置 null,但现在 32/32 全映射,
 * assertMappingComplete 在编译期就拦下不一致。
 */
export function toExerciseRows(now: number): Omit<ExerciseRow, 'id'>[] {
  return EXERCISE_SEEDS.map((seed) => {
    const mapping = EXERCISE_G35_BY_NAME.get(seed.name);
    // 调用方(seedRunner)总是 seedExercisesIfEmpty 后才跑这步,
    // 而 assertMappingComplete 在 seedRunner.test 已经把不一致拦截了。
    if (!mapping) {
      throw new Error(`[G35] seed "${seed.name}" missing mapping in toExerciseRows`);
    }
    const zh = EXERCISE_ZH_BY_HASANEYLDRM_ID[mapping.hasaneyldrmId];
    return {
      name: seed.name,
      muscle_group: seed.muscle_group,
      secondary_muscles: JSON.stringify(seed.secondary_muscles),
      equipment: seed.equipment,
      metric_type: seed.metric_type,
      image_uri: null,
      is_custom: 0,
      created_at: now,
      description_zh: zh?.description ?? null,
      steps_zh: zh ? JSON.stringify(zh.steps) : null,
      // G39: gif_url 改为带前缀的语义。
      //   bundled === true  → 'asset:{filename}',走本地 require() 秒开
      //   bundled === false → null(等 R2 配齐后由后续脚本回填 https:// URL)
      gif_url:
        mapping.bundled && mapping.assetFileName
          ? `asset:${mapping.assetFileName}`
          : null,
      target_zh: translateTarget(mapping.targetEn),
      attribution: '© Gym visual — https://gymvisual.com/',
    };
  });
}
