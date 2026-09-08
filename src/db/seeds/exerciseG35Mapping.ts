/**
 * G35 §1 — 翻译 30+ 动作
 *
 * 锚点：32 个 seed (src/db/seeds/exercises.ts) × hasaneyldrm 1,324 动作数据集
 * (scripts/audit/exercises-source.json)。
 *
 * 产出 3 张映射表:
 * - EXERCISE_G35_MAPPING: seed(zh) → hasaneyldrm id + 英文名(用于 GIF 关联)
 * - EQUIPMENT_EN_TO_ZH: hasaneyldrm equipment(en) → 项目中文(用于详情页 Badge)
 * - TARGET_EN_TO_CATEGORY_ZH: hasaneyldrm target(en) → 项目中文主肌群
 *
 * 已逐条验证:32/32 全部有 gif_url + 中文 instruction_steps.zh。
 *
 * §2 bundle GIF / §3 schema 迁移 / §4 详情页接入 都会复用本文件的 id 字段。
 *
 * 不入库：
 * - exercises-source.json(临时数据,跑完 G35 可删)
 * - 这个 mapping 文件入 git(它是 §1 的核心交付物 + §3/§4 的 source of truth)
 */

import type { ExerciseSeed } from './exercises';

/** hasaneyldrm 数据集里 32 个 seed 的对应记录。 */
export interface G35ExerciseMapping {
  /** seed 中的中文名(EXERCISE_SEEDS.name) */
  seedName: string;
  /** hasaneyldrm 数据集里的 id('0025' 这种字符串) */
  hasaneyldrmId: string;
  /** hasaneyldrm 数据集里的 name(英文,作 GIF asset key 用) */
  hasaneyldrmName: string;
  /** hasaneyldrm 数据集里的 equipment(en) */
  equipmentEn: string;
  /** hasaneyldrm 数据集里的 target(en) */
  targetEn: string;
  /** hasaneyldrm 数据集里的 gif_url(相对路径,如 'videos/0025-EIeI8Vf.gif') */
  gifUrl: string;
  /**
   * 已 bundle 的 GIF 文件名(就是 gifUrl 的 basename,如 '0025-EIeI8Vf.gif')。
   * 实际文件落在 assets/exercises/{assetFileName},§4 详情页用
   * `require(`../../assets/exercises/${assetFileName}`)` 加载。
   */
  assetFileName: string;
}

export const EXERCISE_G35_MAPPING: G35ExerciseMapping[] = [
  // ===== 胸(6) =====
  { seedName: '杠铃卧推',      hasaneyldrmId: '0025', hasaneyldrmName: 'barbell bench press',                equipmentEn: 'barbell',          targetEn: 'pectorals',  gifUrl: 'videos/0025-EIeI8Vf.gif', assetFileName: '0025-EIeI8Vf.gif' },
  { seedName: '哑铃卧推',      hasaneyldrmId: '0289', hasaneyldrmName: 'dumbbell bench press',               equipmentEn: 'dumbbell',         targetEn: 'pectorals',  gifUrl: 'videos/0289-SpYC0Kp.gif', assetFileName: '0289-SpYC0Kp.gif' },
  { seedName: '哑铃飞鸟',      hasaneyldrmId: '0308', hasaneyldrmName: 'dumbbell fly',                       equipmentEn: 'dumbbell',         targetEn: 'pectorals',  gifUrl: 'videos/0308-yz9nUhF.gif', assetFileName: '0308-yz9nUhF.gif' },
  { seedName: '上斜哑铃推举',  hasaneyldrmId: '0314', hasaneyldrmName: 'dumbbell incline bench press',       equipmentEn: 'dumbbell',         targetEn: 'pectorals',  gifUrl: 'videos/0314-ns0SIbU.gif', assetFileName: '0314-ns0SIbU.gif' },
  { seedName: '器械夹胸',      hasaneyldrmId: '0596', hasaneyldrmName: 'lever seated fly',                   equipmentEn: 'leverage machine', targetEn: 'pectorals',  gifUrl: 'videos/0596-v3xmPAR.gif', assetFileName: '0596-v3xmPAR.gif' },
  { seedName: '龙门架夹胸',    hasaneyldrmId: '0188', hasaneyldrmName: 'cable middle fly',                   equipmentEn: 'cable',            targetEn: 'pectorals',  gifUrl: 'videos/0188-xLYSdtg.gif', assetFileName: '0188-xLYSdtg.gif' },

  // ===== 背(5) =====
  { seedName: '引体向上',      hasaneyldrmId: '0652', hasaneyldrmName: 'pull-up',                            equipmentEn: 'body weight',      targetEn: 'lats',       gifUrl: 'videos/0652-lBDjFxJ.gif', assetFileName: '0652-lBDjFxJ.gif' },
  { seedName: '高位下拉',      hasaneyldrmId: '2330', hasaneyldrmName: 'cable lat pulldown full range of motion', equipmentEn: 'cable',      targetEn: 'lats',       gifUrl: 'videos/2330-LEprlgG.gif', assetFileName: '2330-LEprlgG.gif' },
  { seedName: '杠铃划船',      hasaneyldrmId: '0027', hasaneyldrmName: 'barbell bent over row',              equipmentEn: 'barbell',          targetEn: 'upper back', gifUrl: 'videos/0027-eZyBC3j.gif', assetFileName: '0027-eZyBC3j.gif' },
  { seedName: '哑铃单臂划船',  hasaneyldrmId: '0292', hasaneyldrmName: 'dumbbell one arm bent-over row',     equipmentEn: 'dumbbell',         targetEn: 'upper back', gifUrl: 'videos/0292-C0MA9bC.gif', assetFileName: '0292-C0MA9bC.gif' },
  { seedName: '坐姿绳索划船',  hasaneyldrmId: '0861', hasaneyldrmName: 'cable seated row',                   equipmentEn: 'cable',            targetEn: 'upper back', gifUrl: 'videos/0861-fUBheHs.gif', assetFileName: '0861-fUBheHs.gif' },

  // ===== 肩(4) =====
  { seedName: '杠铃推举',      hasaneyldrmId: '0091', hasaneyldrmName: 'barbell seated overhead press',      equipmentEn: 'barbell',          targetEn: 'delts',      gifUrl: 'videos/0091-kTbSH9h.gif', assetFileName: '0091-kTbSH9h.gif' },
  { seedName: '哑铃侧平举',    hasaneyldrmId: '0334', hasaneyldrmName: 'dumbbell lateral raise',            equipmentEn: 'dumbbell',         targetEn: 'delts',      gifUrl: 'videos/0334-DsgkuIt.gif', assetFileName: '0334-DsgkuIt.gif' },
  { seedName: '俯身飞鸟',      hasaneyldrmId: '0383', hasaneyldrmName: 'dumbbell reverse fly',              equipmentEn: 'dumbbell',         targetEn: 'delts',      gifUrl: 'videos/0383-EAs3xL9.gif', assetFileName: '0383-EAs3xL9.gif' },
  { seedName: '绳索面拉',      hasaneyldrmId: '0203', hasaneyldrmName: 'cable rear delt row (with rope)',   equipmentEn: 'cable',            targetEn: 'delts',      gifUrl: 'videos/0203-wqNPGCg.gif', assetFileName: '0203-wqNPGCg.gif' },

  // ===== 臂(4) =====
  { seedName: '杠铃弯举',      hasaneyldrmId: '0031', hasaneyldrmName: 'barbell curl',                       equipmentEn: 'barbell',          targetEn: 'biceps',     gifUrl: 'videos/0031-25GPyDY.gif', assetFileName: '0031-25GPyDY.gif' },
  { seedName: '哑铃弯举',      hasaneyldrmId: '0285', hasaneyldrmName: 'dumbbell alternate biceps curl',     equipmentEn: 'dumbbell',         targetEn: 'biceps',     gifUrl: 'videos/0285-BU15nH4.gif', assetFileName: '0285-BU15nH4.gif' },
  { seedName: '三头下压',      hasaneyldrmId: '0241', hasaneyldrmName: 'cable triceps pushdown (v-bar)',    equipmentEn: 'cable',            targetEn: 'triceps',    gifUrl: 'videos/0241-gAwDzB3.gif', assetFileName: '0241-gAwDzB3.gif' },
  { seedName: '仰卧臂屈伸',    hasaneyldrmId: '0061', hasaneyldrmName: 'barbell lying triceps extension',    equipmentEn: 'barbell',          targetEn: 'triceps',    gifUrl: 'videos/0061-iZop9xO.gif', assetFileName: '0061-iZop9xO.gif' },

  // ===== 腿(8) =====
  { seedName: '深蹲',          hasaneyldrmId: '0043', hasaneyldrmName: 'barbell full squat',                 equipmentEn: 'barbell',          targetEn: 'glutes',     gifUrl: 'videos/0043-qXTaZnJ.gif', assetFileName: '0043-qXTaZnJ.gif' },
  { seedName: '硬拉',          hasaneyldrmId: '0032', hasaneyldrmName: 'barbell deadlift',                   equipmentEn: 'barbell',          targetEn: 'glutes',     gifUrl: 'videos/0032-ila4NZS.gif', assetFileName: '0032-ila4NZS.gif' },
  { seedName: '腿推',          hasaneyldrmId: '2287', hasaneyldrmName: 'lever alternate leg press',          equipmentEn: 'leverage machine', targetEn: 'quads',      gifUrl: 'videos/2287-V07qpXy.gif', assetFileName: '2287-V07qpXy.gif' },
  { seedName: '腿屈伸',        hasaneyldrmId: '0585', hasaneyldrmName: 'lever leg extension',                equipmentEn: 'leverage machine', targetEn: 'quads',      gifUrl: 'videos/0585-my33uHU.gif', assetFileName: '0585-my33uHU.gif' },
  { seedName: '腿弯举',        hasaneyldrmId: '0586', hasaneyldrmName: 'lever lying leg curl',               equipmentEn: 'leverage machine', targetEn: 'hamstrings', gifUrl: 'videos/0586-17lJ1kr.gif', assetFileName: '0586-17lJ1kr.gif' },
  { seedName: '弓步蹲',        hasaneyldrmId: '0336', hasaneyldrmName: 'dumbbell lunge',                     equipmentEn: 'dumbbell',         targetEn: 'glutes',     gifUrl: 'videos/0336-RRWFUcw.gif', assetFileName: '0336-RRWFUcw.gif' },
  { seedName: '站姿提踵',      hasaneyldrmId: '1373', hasaneyldrmName: 'bodyweight standing calf raise',     equipmentEn: 'body weight',      targetEn: 'calves',     gifUrl: 'videos/1373-bJYHBIN.gif', assetFileName: '1373-bJYHBIN.gif' },
  { seedName: '坐姿提踵',      hasaneyldrmId: '1379', hasaneyldrmName: 'dumbbell seated calf raise',         equipmentEn: 'dumbbell',         targetEn: 'calves',     gifUrl: 'videos/1379-r29jP7S.gif', assetFileName: '1379-r29jP7S.gif' },

  // ===== 核心(3) =====
  { seedName: '平板支撑',      hasaneyldrmId: '0464', hasaneyldrmName: 'front plank with twist',             equipmentEn: 'body weight',      targetEn: 'abs',        gifUrl: 'videos/0464-CosupLu.gif', assetFileName: '0464-CosupLu.gif' },
  { seedName: '卷腹',          hasaneyldrmId: '0274', hasaneyldrmName: 'crunch floor',                       equipmentEn: 'body weight',      targetEn: 'abs',        gifUrl: 'videos/0274-TFqbd8t.gif', assetFileName: '0274-TFqbd8t.gif' },
  { seedName: '悬垂举腿',      hasaneyldrmId: '0472', hasaneyldrmName: 'hanging leg raise',                  equipmentEn: 'body weight',      targetEn: 'abs',        gifUrl: 'videos/0472-I3tsCnC.gif', assetFileName: '0472-I3tsCnC.gif' },

  // ===== 全身(2) =====
  { seedName: '壶铃摇摆',      hasaneyldrmId: '0549', hasaneyldrmName: 'kettlebell swing',                   equipmentEn: 'kettlebell',       targetEn: 'glutes',     gifUrl: 'videos/0549-UHJlbu3.gif', assetFileName: '0549-UHJlbu3.gif' },
  { seedName: '跑步机慢跑',    hasaneyldrmId: '3666', hasaneyldrmName: 'walking on incline treadmill',       equipmentEn: 'leverage machine', targetEn: 'cardiovascular system', gifUrl: 'videos/3666-rjiM4L3.gif', assetFileName: '3666-rjiM4L3.gif' },
];

/** 按 seedName 索引的快查表。 */
export const EXERCISE_G35_BY_NAME: ReadonlyMap<string, G35ExerciseMapping> = new Map(
  EXERCISE_G35_MAPPING.map((m) => [m.seedName, m]),
);

/** 32 条 seed ↔ 32 条 mapping 一一对应(开发期断言,不一致立即报错)。 */
export function assertMappingComplete(seeds: readonly ExerciseSeed[]): void {
  const seedNames = new Set(seeds.map((s) => s.name));
  const mappingNames = new Set(EXERCISE_G35_MAPPING.map((m) => m.seedName));
  for (const s of seedNames) {
    if (!mappingNames.has(s)) {
      throw new Error(`[G35] seed "${s}" missing from EXERCISE_G35_MAPPING`);
    }
  }
  for (const m of mappingNames) {
    if (!seedNames.has(m)) {
      throw new Error(`[G35] mapping "${m}" not in EXERCISE_SEEDS — stale`);
    }
  }
}

/* -------------------------------------------------------------------------- */
/* equipment(en) → zh                                                         */
/* -------------------------------------------------------------------------- */

/**
 * hasaneyldrm equipment(en) → 项目中文。
 * 覆盖 32 个 seed 用到的全部 6 个值 + 留几个常见占位,详情页 Badge 渲染用。
 */
export const EQUIPMENT_EN_TO_ZH: Readonly<Record<string, string>> = {
  'barbell':          '杠铃',
  'dumbbell':         '哑铃',
  'cable':            '缆绳',
  'body weight':      '自重',
  'leverage machine': '固定器械',
  'kettlebell':       '壶铃',
  // 详情页未来可能见到,但 32 个 seed 不覆盖:
  'smith machine':    '史密斯机',
  'ez barbell':       'EZ 杠',
  'band':             '弹力带',
  'resistance band':  '弹力带',
  'medicine ball':    '药球',
  'stability ball':   '健身球',
  'olympic barbell':  '奥林匹克杠铃',
  'trap bar':         '六角杠铃',
  'rope':             '战绳',
  'sled machine':     '推橇机',
  'bosu ball':        '波速球',
  'roller':           '泡沫轴',
  'hammer':           '锤',
  'tire':             '轮胎',
  'weighted':         '负重',
  'assisted':         '辅助',
};

/** 缺省兜底:有 en 但没翻译的器械,原样显示。 */
export function translateEquipment(en: string): string {
  return EQUIPMENT_EN_TO_ZH[en] ?? en;
}

/* -------------------------------------------------------------------------- */
/* target(en) → category(zh)                                                  */
/* -------------------------------------------------------------------------- */

/**
 * hasaneyldrm target(en) → 项目中文主肌群。
 * 判定:`target` 是 hasaneyldrm 里"真实主肌"字段(`muscle_group` 语义混乱不用),
 * 映射到项目已有 muscle_group 中文集合。
 */
export const TARGET_EN_TO_CATEGORY_ZH: Readonly<Record<string, string>> = {
  'pectorals':              '胸',
  'lats':                   '背',
  'upper back':             '背',
  'delts':                  '肩',
  'biceps':                 '二头',
  'triceps':                '三头',
  'forearms':               '前臂',
  'quads':                  '股四头',
  'hamstrings':             '腘绳',
  'glutes':                 '臀',
  'calves':                 '小腿',
  'abs':                    '腹',
  'cardiovascular system':  '全身',
  // 详情页未来可能见到,但 32 个 seed 不覆盖:
  'spine':                  '背',
  'traps':                  '背',
  'serratus anterior':      '胸',
  'adductors':              '股四头',
  'abductors':              '臀',
  'levator scapulae':       '肩',
};

/** 缺省兜底:有 target 但没翻译的肌群,原样显示。 */
export function translateTarget(en: string): string {
  return TARGET_EN_TO_CATEGORY_ZH[en] ?? en;
}