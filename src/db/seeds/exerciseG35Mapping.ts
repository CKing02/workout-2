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
   *
   * 仅 `bundled === true` 时必填;`bundled === false` 时为 undefined(走 CDN,
   * 见 {@link cdnUrl})。
   */
  assetFileName?: string;
  /**
   * G39: 是否 bundle 进 APK。`true` = 秒开(冷启动可用 / 离线可用);
   * `false` = 走 CDN,首次访问下载到本地 cache。
   *
   * G40: 全部 52 张已 bundle 进 APK,所有 mapping 都为 true。
   *
   * G41: 扩到 302 个动作。新增 250 个 `bundled: false`,走 R2 CDN
   * (Cloudflare R2,pub-xxx.r2.dev/workout2-gifs/exercises/{file}.gif),
   * 首次访问下载到本地 cache,LRU 200MB 阈值(见 exerciseGifCache.ts)。
   * 仅 `bundled === false` 时填;`bundled === true` 时 undefined(走本地 require)。
   */
  bundled: boolean;
  /**
   * G41: CDN URL,当 `bundled === false` 时必填。
   *
   * 形如 `https://pub-abc.r2.dev/workout2-gifs/exercises/0151-7xI5MXA.gif`。
   * 客户端第一次访问时,`ExerciseGifImage` 通过 `getCachedOrDownload` 拉到
   * 沙盒 cache(`Paths.cache/gifs/{basename}.gif`),二次访问秒开。
   *
   * `bundled === true` 时 undefined —— 走本地 require,不走 CDN。
   */
  cdnUrl?: string;
}

export const EXERCISE_G35_MAPPING: G35ExerciseMapping[] = [
  // ===== 胸(bundled 7) =====
  { seedName: '杠铃卧推',      hasaneyldrmId: '0025', hasaneyldrmName: 'barbell bench press',                equipmentEn: 'barbell',          targetEn: 'pectorals',  gifUrl: 'videos/0025-EIeI8Vf.gif', assetFileName: '0025-EIeI8Vf.gif', bundled: true },
  { seedName: '哑铃卧推',      hasaneyldrmId: '0289', hasaneyldrmName: 'dumbbell bench press',               equipmentEn: 'dumbbell',         targetEn: 'pectorals',  gifUrl: 'videos/0289-SpYC0Kp.gif', assetFileName: '0289-SpYC0Kp.gif', bundled: true },
  { seedName: '哑铃飞鸟',      hasaneyldrmId: '0308', hasaneyldrmName: 'dumbbell fly',                       equipmentEn: 'dumbbell',         targetEn: 'pectorals',  gifUrl: 'videos/0308-yz9nUhF.gif', assetFileName: '0308-yz9nUhF.gif', bundled: true },
  { seedName: '上斜哑铃推举',  hasaneyldrmId: '0314', hasaneyldrmName: 'dumbbell incline bench press',       equipmentEn: 'dumbbell',         targetEn: 'pectorals',  gifUrl: 'videos/0314-ns0SIbU.gif', assetFileName: '0314-ns0SIbU.gif', bundled: true },
  { seedName: '器械夹胸',      hasaneyldrmId: '0596', hasaneyldrmName: 'lever seated fly',                   equipmentEn: 'leverage machine', targetEn: 'pectorals',  gifUrl: 'videos/0596-v3xmPAR.gif', assetFileName: '0596-v3xmPAR.gif', bundled: true },
  { seedName: '龙门架夹胸',    hasaneyldrmId: '0188', hasaneyldrmName: 'cable middle fly',                   equipmentEn: 'cable',            targetEn: 'pectorals',  gifUrl: 'videos/0188-xLYSdtg.gif', assetFileName: '0188-xLYSdtg.gif', bundled: true },

  // ===== 背(bundled 8) =====
  { seedName: '引体向上',      hasaneyldrmId: '0652', hasaneyldrmName: 'pull-up',                            equipmentEn: 'body weight',      targetEn: 'lats',       gifUrl: 'videos/0652-lBDjFxJ.gif', assetFileName: '0652-lBDjFxJ.gif', bundled: true },
  { seedName: '高位下拉',      hasaneyldrmId: '2330', hasaneyldrmName: 'cable lat pulldown full range of motion', equipmentEn: 'cable',      targetEn: 'lats',       gifUrl: 'videos/2330-LEprlgG.gif', assetFileName: '2330-LEprlgG.gif', bundled: true },
  { seedName: '杠铃划船',      hasaneyldrmId: '0027', hasaneyldrmName: 'barbell bent over row',              equipmentEn: 'barbell',          targetEn: 'upper back', gifUrl: 'videos/0027-eZyBC3j.gif', assetFileName: '0027-eZyBC3j.gif', bundled: true },
  { seedName: '哑铃单臂划船',  hasaneyldrmId: '0292', hasaneyldrmName: 'dumbbell one arm bent-over row',     equipmentEn: 'dumbbell',         targetEn: 'upper back', gifUrl: 'videos/0292-C0MA9bC.gif', assetFileName: '0292-C0MA9bC.gif', bundled: true },
  { seedName: '坐姿绳索划船',  hasaneyldrmId: '0861', hasaneyldrmName: 'cable seated row',                   equipmentEn: 'cable',            targetEn: 'upper back', gifUrl: 'videos/0861-fUBheHs.gif', assetFileName: '0861-fUBheHs.gif', bundled: true },

  // ===== 肩(bundled 8) =====
  { seedName: '杠铃推举',      hasaneyldrmId: '0091', hasaneyldrmName: 'barbell seated overhead press',      equipmentEn: 'barbell',          targetEn: 'delts',      gifUrl: 'videos/0091-kTbSH9h.gif', assetFileName: '0091-kTbSH9h.gif', bundled: true },
  { seedName: '哑铃侧平举',    hasaneyldrmId: '0334', hasaneyldrmName: 'dumbbell lateral raise',            equipmentEn: 'dumbbell',         targetEn: 'delts',      gifUrl: 'videos/0334-DsgkuIt.gif', assetFileName: '0334-DsgkuIt.gif', bundled: true },
  { seedName: '俯身飞鸟',      hasaneyldrmId: '0383', hasaneyldrmName: 'dumbbell reverse fly',              equipmentEn: 'dumbbell',         targetEn: 'delts',      gifUrl: 'videos/0383-EAs3xL9.gif', assetFileName: '0383-EAs3xL9.gif', bundled: true },
  { seedName: '绳索面拉',      hasaneyldrmId: '0203', hasaneyldrmName: 'cable rear delt row (with rope)',   equipmentEn: 'cable',            targetEn: 'delts',      gifUrl: 'videos/0203-wqNPGCg.gif', assetFileName: '0203-wqNPGCg.gif', bundled: true },

  // ===== 臂(bundled 8) =====
  { seedName: '杠铃弯举',      hasaneyldrmId: '0031', hasaneyldrmName: 'barbell curl',                       equipmentEn: 'barbell',          targetEn: 'biceps',     gifUrl: 'videos/0031-25GPyDY.gif', assetFileName: '0031-25GPyDY.gif', bundled: true },
  { seedName: '哑铃弯举',      hasaneyldrmId: '0285', hasaneyldrmName: 'dumbbell alternate biceps curl',     equipmentEn: 'dumbbell',         targetEn: 'biceps',     gifUrl: 'videos/0285-BU15nH4.gif', assetFileName: '0285-BU15nH4.gif', bundled: true },
  { seedName: '三头下压',      hasaneyldrmId: '0241', hasaneyldrmName: 'cable triceps pushdown (v-bar)',    equipmentEn: 'cable',            targetEn: 'triceps',    gifUrl: 'videos/0241-gAwDzB3.gif', assetFileName: '0241-gAwDzB3.gif', bundled: true },
  { seedName: '仰卧臂屈伸',    hasaneyldrmId: '0061', hasaneyldrmName: 'barbell lying triceps extension',    equipmentEn: 'barbell',          targetEn: 'triceps',    gifUrl: 'videos/0061-iZop9xO.gif', assetFileName: '0061-iZop9xO.gif', bundled: true },

  // ===== 腿(bundled 12) =====
  { seedName: '深蹲',          hasaneyldrmId: '0043', hasaneyldrmName: 'barbell full squat',                 equipmentEn: 'barbell',          targetEn: 'glutes',     gifUrl: 'videos/0043-qXTaZnJ.gif', assetFileName: '0043-qXTaZnJ.gif', bundled: true },
  { seedName: '硬拉',          hasaneyldrmId: '0032', hasaneyldrmName: 'barbell deadlift',                   equipmentEn: 'barbell',          targetEn: 'glutes',     gifUrl: 'videos/0032-ila4NZS.gif', assetFileName: '0032-ila4NZS.gif', bundled: true },
  { seedName: '腿推',          hasaneyldrmId: '2287', hasaneyldrmName: 'lever alternate leg press',          equipmentEn: 'leverage machine', targetEn: 'quads',      gifUrl: 'videos/2287-V07qpXy.gif', assetFileName: '2287-V07qpXy.gif', bundled: true },
  { seedName: '腿屈伸',        hasaneyldrmId: '0585', hasaneyldrmName: 'lever leg extension',                equipmentEn: 'leverage machine', targetEn: 'quads',      gifUrl: 'videos/0585-my33uHU.gif', assetFileName: '0585-my33uHU.gif', bundled: true },
  { seedName: '腿弯举',        hasaneyldrmId: '0586', hasaneyldrmName: 'lever lying leg curl',               equipmentEn: 'leverage machine', targetEn: 'hamstrings', gifUrl: 'videos/0586-17lJ1kr.gif', assetFileName: '0586-17lJ1kr.gif', bundled: true },
  { seedName: '弓步蹲',        hasaneyldrmId: '0336', hasaneyldrmName: 'dumbbell lunge',                     equipmentEn: 'dumbbell',         targetEn: 'glutes',     gifUrl: 'videos/0336-RRWFUcw.gif', assetFileName: '0336-RRWFUcw.gif', bundled: true },
  { seedName: '站姿提踵',      hasaneyldrmId: '1373', hasaneyldrmName: 'bodyweight standing calf raise',     equipmentEn: 'body weight',      targetEn: 'calves',     gifUrl: 'videos/1373-bJYHBIN.gif', assetFileName: '1373-bJYHBIN.gif', bundled: true },
  { seedName: '坐姿提踵',      hasaneyldrmId: '1379', hasaneyldrmName: 'dumbbell seated calf raise',         equipmentEn: 'dumbbell',         targetEn: 'calves',     gifUrl: 'videos/1379-r29jP7S.gif', assetFileName: '1379-r29jP7S.gif', bundled: true },

  // ===== 核心(bundled 6) =====
  { seedName: '平板支撑',      hasaneyldrmId: '0464', hasaneyldrmName: 'front plank with twist',             equipmentEn: 'body weight',      targetEn: 'abs',        gifUrl: 'videos/0464-CosupLu.gif', assetFileName: '0464-CosupLu.gif', bundled: true },
  { seedName: '卷腹',          hasaneyldrmId: '0274', hasaneyldrmName: 'crunch floor',                       equipmentEn: 'body weight',      targetEn: 'abs',        gifUrl: 'videos/0274-TFqbd8t.gif', assetFileName: '0274-TFqbd8t.gif', bundled: true },
  { seedName: '悬垂举腿',      hasaneyldrmId: '0472', hasaneyldrmName: 'hanging leg raise',                  equipmentEn: 'body weight',      targetEn: 'abs',        gifUrl: 'videos/0472-I3tsCnC.gif', assetFileName: '0472-I3tsCnC.gif', bundled: true },

  // ===== 全身(bundled 2) =====
  { seedName: '壶铃摇摆',      hasaneyldrmId: '0549', hasaneyldrmName: 'kettlebell swing',                   equipmentEn: 'kettlebell',       targetEn: 'glutes',     gifUrl: 'videos/0549-UHJlbu3.gif', assetFileName: '0549-UHJlbu3.gif', bundled: true },
  { seedName: '跑步机慢跑',    hasaneyldrmId: '3666', hasaneyldrmName: 'walking on incline treadmill',       equipmentEn: 'leverage machine', targetEn: 'cardiovascular system', gifUrl: 'videos/3666-rjiM4L3.gif', assetFileName: '3666-rjiM4L3.gif', bundled: true },

  // ===== G37 补缺 20 个常用变体(bundled 20) =====
  // 胸(+1) — 上斜杠铃卧推(G35 已有 0314 上斜哑铃)
  { seedName: '上斜杠铃卧推',  hasaneyldrmId: '0047', hasaneyldrmName: 'barbell incline bench press',       equipmentEn: 'barbell',          targetEn: 'pectorals',  gifUrl: 'videos/0047-3TZduzM.gif', assetFileName: '0047-3TZduzM.gif', bundled: true },
  { seedName: '双杠臂屈伸',    hasaneyldrmId: '3287', hasaneyldrmName: 'elbow dips',                        equipmentEn: 'body weight',      targetEn: 'triceps',    gifUrl: 'videos/3287-LkoAWAE.gif', assetFileName: '3287-LkoAWAE.gif', bundled: true },

  // 背(+3) — T 杠划船 / 颈后下拉 / 俯身挺身
  { seedName: 'T 杠划船',      hasaneyldrmId: '0606', hasaneyldrmName: 'lever t bar row',                   equipmentEn: 'leverage machine', targetEn: 'upper back', gifUrl: 'videos/0606-aaXr7ld.gif', assetFileName: '0606-aaXr7ld.gif', bundled: true },
  { seedName: '颈后下拉',      hasaneyldrmId: '1325', hasaneyldrmName: 'cable wide grip rear pulldown behind neck', equipmentEn: 'cable',      targetEn: 'lats',       gifUrl: 'videos/1325-CmEr4pM.gif', assetFileName: '1325-CmEr4pM.gif', bundled: true },
  { seedName: '俯身挺身',      hasaneyldrmId: '0488', hasaneyldrmName: 'hyperextension (on bench)',         equipmentEn: 'body weight',      targetEn: 'spine',      gifUrl: 'videos/0488-zkgRrbK.gif', assetFileName: '0488-zkgRrbK.gif', bundled: true },

  // 肩(+4) — 哑铃前平举 / 哑铃耸肩 / 杠铃耸肩 / 反向飞鸟
  { seedName: '哑铃前平举',    hasaneyldrmId: '0310', hasaneyldrmName: 'dumbbell front raise',              equipmentEn: 'dumbbell',         targetEn: 'delts',      gifUrl: 'videos/0310-3eGE2JC.gif', assetFileName: '0310-3eGE2JC.gif', bundled: true },
  { seedName: '哑铃耸肩',      hasaneyldrmId: '0406', hasaneyldrmName: 'dumbbell shrug',                    equipmentEn: 'dumbbell',         targetEn: 'traps',      gifUrl: 'videos/0406-NJzBsGJ.gif', assetFileName: '0406-NJzBsGJ.gif', bundled: true },
  { seedName: '杠铃耸肩',      hasaneyldrmId: '0095', hasaneyldrmName: 'barbell shrug',                     equipmentEn: 'barbell',          targetEn: 'traps',      gifUrl: 'videos/0095-dG7tG5y.gif', assetFileName: '0095-dG7tG5y.gif', bundled: true },
  { seedName: '反向飞鸟',      hasaneyldrmId: '0993', hasaneyldrmName: 'band reverse fly',                  equipmentEn: 'band',             targetEn: 'delts',      gifUrl: 'videos/0993-sTfvVsG.gif', assetFileName: '0993-sTfvVsG.gif', bundled: true },

  // 臂(+3) — 绳索锤式弯举 / 集中弯举 / 牧师凳弯举
  { seedName: '绳索锤式弯举',  hasaneyldrmId: '0165', hasaneyldrmName: 'cable hammer curl (with rope)',     equipmentEn: 'cable',            targetEn: 'biceps',     gifUrl: 'videos/0165-HPlPoQA.gif', assetFileName: '0165-HPlPoQA.gif', bundled: true },
  { seedName: '集中弯举',      hasaneyldrmId: '0976', hasaneyldrmName: 'band concentration curl',           equipmentEn: 'band',             targetEn: 'biceps',     gifUrl: 'videos/0976-kmVVAfu.gif', assetFileName: '0976-kmVVAfu.gif', bundled: true },
  { seedName: '牧师凳弯举',    hasaneyldrmId: '0070', hasaneyldrmName: 'barbell preacher curl',             equipmentEn: 'barbell',          targetEn: 'biceps',     gifUrl: 'videos/0070-qOgPVf6.gif', assetFileName: '0070-qOgPVf6.gif', bundled: true },

  // 腿(+4) — 罗马尼亚硬拉 / 单腿硬拉 / 高脚杯深蹲 / 颈前深蹲
  { seedName: '罗马尼亚硬拉',  hasaneyldrmId: '0085', hasaneyldrmName: 'barbell romanian deadlift',         equipmentEn: 'barbell',          targetEn: 'glutes',     gifUrl: 'videos/0085-wQ2c4XD.gif', assetFileName: '0085-wQ2c4XD.gif', bundled: true },
  { seedName: '单腿硬拉',      hasaneyldrmId: '1756', hasaneyldrmName: 'barbell single leg deadlift',       equipmentEn: 'barbell',          targetEn: 'glutes',     gifUrl: 'videos/1756-gEyURal.gif', assetFileName: '1756-gEyURal.gif', bundled: true },
  { seedName: '高脚杯深蹲',    hasaneyldrmId: '1760', hasaneyldrmName: 'dumbbell goblet squat',             equipmentEn: 'dumbbell',         targetEn: 'quads',      gifUrl: 'videos/1760-yn8yg1r.gif', assetFileName: '1760-yn8yg1r.gif', bundled: true },
  { seedName: '颈前深蹲',      hasaneyldrmId: '0024', hasaneyldrmName: 'barbell bench front squat',         equipmentEn: 'barbell',          targetEn: 'quads',      gifUrl: 'videos/0024-Y7YcmIJ.gif', assetFileName: '0024-Y7YcmIJ.gif', bundled: true },

  // 核心(+3) — 健腹轮 / 俄罗斯转体 / 仰卧举腿
  { seedName: '健腹轮',        hasaneyldrmId: '0103', hasaneyldrmName: 'barbell standing ab rollerout',     equipmentEn: 'wheel roller',     targetEn: 'abs',        gifUrl: 'videos/0103-xnInPfE.gif', assetFileName: '0103-xnInPfE.gif', bundled: true },
  { seedName: '俄罗斯转体',    hasaneyldrmId: '0014', hasaneyldrmName: 'assisted motion russian twist',     equipmentEn: 'medicine ball',    targetEn: 'abs',        gifUrl: 'videos/0014-r7cT9YD.gif', assetFileName: '0014-r7cT9YD.gif', bundled: true },
  { seedName: '仰卧举腿',      hasaneyldrmId: '0012', hasaneyldrmName: 'assisted lying leg raise with lateral throw down', equipmentEn: 'assisted',    targetEn: 'abs',        gifUrl: 'videos/0012-UGhRD1A.gif', assetFileName: '0012-UGhRD1A.gif', bundled: true },

  // 有氧(+1) — 动感单车
  { seedName: '动感单车',      hasaneyldrmId: '2138', hasaneyldrmName: 'stationary bike run v. 3',          equipmentEn: 'stationary bike',  targetEn: 'cardiovascular system', gifUrl: 'videos/2138-H1PESYI.gif', assetFileName: '2138-H1PESYI.gif', bundled: true },
  // ===== G41 扩 250 个 CDN 动作(bundled:false,走 https 拉取)=====
  // 命名约定:seedName = zhNames[id],cdnUrl = R2 pub URL + gif basename
  // 50 个最常用已写 instruction_steps_zh;其余 200 在 EXERCISE_ZH_BY_HASANEYLDRM_ID 无条目 → 详情页 fallback 到 GIF

  // ----- 胸(35)-----
  { seedName: '缆绳卧推', hasaneyldrmId: '0151', hasaneyldrmName: 'cable bench press', equipmentEn: 'cable', targetEn: 'pectorals', gifUrl: 'videos/0151-7xI5MXA.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0151-7xI5MXA.gif' },
  { seedName: '缆绳下斜飞鸟', hasaneyldrmId: '0158', hasaneyldrmName: 'cable decline fly', equipmentEn: 'cable', targetEn: 'pectorals', gifUrl: 'videos/0158-7saC5zz.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0158-7saC5zz.gif' },
  { seedName: '缆绳上斜飞鸟', hasaneyldrmId: '0171', hasaneyldrmName: 'cable incline fly', equipmentEn: 'cable', targetEn: 'pectorals', gifUrl: 'videos/0171-tBWXbIT.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0171-tBWXbIT.gif' },
  { seedName: '低位缆绳飞鸟', hasaneyldrmId: '0179', hasaneyldrmName: 'cable low fly', equipmentEn: 'cable', targetEn: 'pectorals', gifUrl: 'videos/0179-FVmZVhk.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0179-FVmZVhk.gif' },
  { seedName: '仰卧缆绳飞鸟', hasaneyldrmId: '0185', hasaneyldrmName: 'cable lying fly', equipmentEn: 'cable', targetEn: 'pectorals', gifUrl: 'videos/0185-lJJ7Yq8.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0185-lJJ7Yq8.gif' },
  { seedName: '站姿缆绳飞鸟', hasaneyldrmId: '0227', hasaneyldrmName: 'cable standing fly', equipmentEn: 'cable', targetEn: 'pectorals', gifUrl: 'videos/0227-Pr9Rhf4.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0227-Pr9Rhf4.gif' },
  { seedName: '双杠臂屈伸(胸版)', hasaneyldrmId: '0251', hasaneyldrmName: 'chest dip', equipmentEn: 'body weight', targetEn: 'pectorals', gifUrl: 'videos/0251-9WTm7dq.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0251-9WTm7dq.gif' },
  { seedName: '时钟俯卧撑', hasaneyldrmId: '0258', hasaneyldrmName: 'clock push-up', equipmentEn: 'body weight', targetEn: 'pectorals', gifUrl: 'videos/0258-CMAxnsG.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0258-CMAxnsG.gif' },
  { seedName: '下斜俯卧撑', hasaneyldrmId: '0279', hasaneyldrmName: 'decline push-up', equipmentEn: 'body weight', targetEn: 'pectorals', gifUrl: 'videos/0279-i5cEhka.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0279-i5cEhka.gif' },
  { seedName: '哑铃下斜飞鸟', hasaneyldrmId: '0302', hasaneyldrmName: 'dumbbell decline fly', equipmentEn: 'dumbbell', targetEn: 'pectorals', gifUrl: 'videos/0302-xXm4nYq.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0302-xXm4nYq.gif' },
  { seedName: '哑铃上斜飞鸟', hasaneyldrmId: '0319', hasaneyldrmName: 'dumbbell incline fly', equipmentEn: 'dumbbell', targetEn: 'pectorals', gifUrl: 'videos/0319-ESOd5Pl.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0319-ESOd5Pl.gif' },
  { seedName: '哑铃仰卧上拉', hasaneyldrmId: '0375', hasaneyldrmName: 'dumbbell pullover', equipmentEn: 'dumbbell', targetEn: 'pectorals', gifUrl: 'videos/0375-9XjtHvS.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0375-9XjtHvS.gif' },
  { seedName: '上斜俯卧撑', hasaneyldrmId: '0493', hasaneyldrmName: 'incline push-up', equipmentEn: 'body weight', targetEn: 'pectorals', gifUrl: 'videos/0493-B1EVP9F.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0493-B1EVP9F.gif' },
  { seedName: '等长雨刷', hasaneyldrmId: '0500', hasaneyldrmName: 'isometric wipers', equipmentEn: 'body weight', targetEn: 'pectorals', gifUrl: 'videos/0500-11wrviz.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0500-11wrviz.gif' },
  { seedName: '靠墙俯卧撑 V2', hasaneyldrmId: '0658', hasaneyldrmName: 'push-up (wall) v. 2', equipmentEn: 'body weight', targetEn: 'pectorals', gifUrl: 'videos/0658-NCmbLCw.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0658-NCmbLCw.gif' },
  { seedName: '靠墙俯卧撑', hasaneyldrmId: '0659', hasaneyldrmName: 'push-up (wall)', equipmentEn: 'body weight', targetEn: 'pectorals', gifUrl: 'videos/0659-LEH9jxP.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0659-LEH9jxP.gif' },
  { seedName: '标准俯卧撑', hasaneyldrmId: '0662', hasaneyldrmName: 'push-up', equipmentEn: 'body weight', targetEn: 'pectorals', gifUrl: 'videos/0662-I4hDWkc.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0662-I4hDWkc.gif' },
  { seedName: '拍肩俯卧撑', hasaneyldrmId: '0699', hasaneyldrmName: 'shoulder tap push-up', equipmentEn: 'body weight', targetEn: 'pectorals', gifUrl: 'videos/0699-qEse6fe.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0699-qEse6fe.gif' },
  { seedName: '单臂俯卧撑', hasaneyldrmId: '0725', hasaneyldrmName: 'single arm push-up', equipmentEn: 'body weight', targetEn: 'pectorals', gifUrl: 'videos/0725-MUic5zN.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0725-MUic5zN.gif' },
  { seedName: '超人俯卧撑', hasaneyldrmId: '0803', hasaneyldrmName: 'superman push-up', equipmentEn: 'body weight', targetEn: 'pectorals', gifUrl: 'videos/0803-4GqRrAk.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0803-4GqRrAk.gif' },
  { seedName: '悬挂俯卧撑', hasaneyldrmId: '0806', hasaneyldrmName: 'suspended push-up', equipmentEn: 'body weight', targetEn: 'pectorals', gifUrl: 'videos/0806-IaGQCrC.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0806-IaGQCrC.gif' },
  { seedName: '缆绳下斜推举', hasaneyldrmId: '1261', hasaneyldrmName: 'cable decline press', equipmentEn: 'cable', targetEn: 'pectorals', gifUrl: 'videos/1261-2Pya1cP.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1261-2Pya1cP.gif' },
  { seedName: '击掌俯卧撑', hasaneyldrmId: '1273', hasaneyldrmName: 'clap push up', equipmentEn: 'body weight', targetEn: 'pectorals', gifUrl: 'videos/1273-wigSg76.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1273-wigSg76.gif' },
  { seedName: '深度俯卧撑', hasaneyldrmId: '1274', hasaneyldrmName: 'deep push up', equipmentEn: 'dumbbell', targetEn: 'pectorals', gifUrl: 'videos/1274-vptOQ4N.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1274-vptOQ4N.gif' },
  { seedName: '下放俯卧撑', hasaneyldrmId: '1275', hasaneyldrmName: 'drop push up', equipmentEn: 'body weight', targetEn: 'pectorals', gifUrl: 'videos/1275-Q497lAE.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1275-Q497lAE.gif' },
  { seedName: '等长夹胸', hasaneyldrmId: '1297', hasaneyldrmName: 'isometric chest squeeze', equipmentEn: 'body weight', targetEn: 'pectorals', gifUrl: 'videos/1297-HbSG1Pw.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1297-HbSG1Pw.gif' },
  { seedName: '爆发俯卧撑', hasaneyldrmId: '1306', hasaneyldrmName: 'plyo push up', equipmentEn: 'body weight', targetEn: 'pectorals', gifUrl: 'videos/1306-Snj1wSv.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1306-Snj1wSv.gif' },
  { seedName: '宽距俯卧撑', hasaneyldrmId: '1311', hasaneyldrmName: 'wide hand push up', equipmentEn: 'body weight', targetEn: 'pectorals', gifUrl: 'videos/1311-JmMVpR3.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1311-JmMVpR3.gif' },
  { seedName: '上斜肩胛俯卧撑', hasaneyldrmId: '3011', hasaneyldrmName: 'incline scapula push up', equipmentEn: 'body weight', targetEn: 'serratus anterior', gifUrl: 'videos/3011-GdMa1ET.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/3011-GdMa1ET.gif' },
  { seedName: '肩胛俯卧撑', hasaneyldrmId: '3021', hasaneyldrmName: 'scapula push-up', equipmentEn: 'body weight', targetEn: 'serratus anterior', gifUrl: 'videos/3021-jV65tKx.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/3021-jV65tKx.gif' },
  { seedName: '加长俯卧撑', hasaneyldrmId: '3145', hasaneyldrmName: 'push-up plus', equipmentEn: 'body weight', targetEn: 'pectorals', gifUrl: 'videos/3145-pvBMLHA.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/3145-pvBMLHA.gif' },
  { seedName: '高位哑铃飞鸟', hasaneyldrmId: '3234', hasaneyldrmName: 'hyght dumbbell fly', equipmentEn: 'dumbbell', targetEn: 'pectorals', gifUrl: 'videos/3234-P9ZRyLT.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/3234-P9ZRyLT.gif' },
  { seedName: '韩式臂屈伸', hasaneyldrmId: '3288', hasaneyldrmName: 'korean dips', equipmentEn: 'body weight', targetEn: 'pectorals', gifUrl: 'videos/3288-rWoBmi5.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/3288-rWoBmi5.gif' },
  { seedName: '弓箭手俯卧撑', hasaneyldrmId: '3294', hasaneyldrmName: 'archer push up', equipmentEn: 'body weight', targetEn: 'pectorals', gifUrl: 'videos/3294-A9qxk2F.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/3294-A9qxk2F.gif' },
  { seedName: '全水平俯卧撑', hasaneyldrmId: '3327', hasaneyldrmName: 'full planche push-up', equipmentEn: 'body weight', targetEn: 'pectorals', gifUrl: 'videos/3327-gw9PqGk.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/3327-gw9PqGk.gif' },

  // ----- 背(40)-----
  { seedName: '杠铃上斜划船', hasaneyldrmId: '0049', hasaneyldrmName: 'barbell incline row', equipmentEn: 'barbell', targetEn: 'upper back', gifUrl: 'videos/0049-dmgMp3n.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0049-dmgMp3n.gif' },
  { seedName: '杠铃仰卧上拉', hasaneyldrmId: '0073', hasaneyldrmName: 'barbell pullover', equipmentEn: 'barbell', targetEn: 'lats', gifUrl: 'videos/0073-i6LWjok.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0073-i6LWjok.gif' },
  { seedName: '缆绳低位坐姿划船', hasaneyldrmId: '0180', hasaneyldrmName: 'cable low seated row', equipmentEn: 'cable', targetEn: 'upper back', gifUrl: 'videos/0180-hvV79Si.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0180-hvV79Si.gif' },
  { seedName: '缆绳下拉', hasaneyldrmId: '0198', hasaneyldrmName: 'cable pulldown', equipmentEn: 'cable', targetEn: 'lats', gifUrl: 'videos/0198-RVwzP10.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0198-RVwzP10.gif' },
  { seedName: '缆绳后下拉', hasaneyldrmId: '0205', hasaneyldrmName: 'cable rear pulldown', equipmentEn: 'cable', targetEn: 'lats', gifUrl: 'videos/0205-SpsOSXk.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0205-SpsOSXk.gif' },
  { seedName: '缆绳耸肩', hasaneyldrmId: '0220', hasaneyldrmName: 'cable shrug', equipmentEn: 'cable', targetEn: 'traps', gifUrl: 'videos/0220-Eg98Ft9.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0220-Eg98Ft9.gif' },
  { seedName: '缆绳旋转下拉', hasaneyldrmId: '0244', hasaneyldrmName: 'cable twisting pull', equipmentEn: 'cable', targetEn: 'lats', gifUrl: 'videos/0244-zCgxPbV.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0244-zCgxPbV.gif' },
  { seedName: '背屈伸', hasaneyldrmId: '0489', hasaneyldrmName: 'hyperextension', equipmentEn: 'body weight', targetEn: 'spine', gifUrl: 'videos/0489-zhMwOwE.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0489-zhMwOwE.gif' },
  { seedName: '反向划船 V2', hasaneyldrmId: '0497', hasaneyldrmName: 'inverted row v. 2', equipmentEn: 'body weight', targetEn: 'upper back', gifUrl: 'videos/0497-uX3sUBz.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0497-uX3sUBz.gif' },
  { seedName: '反向划船', hasaneyldrmId: '0499', hasaneyldrmName: 'inverted row', equipmentEn: 'body weight', targetEn: 'upper back', gifUrl: 'videos/0499-bZGHsAZ.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0499-bZGHsAZ.gif' },
  { seedName: '摆动双力臂', hasaneyldrmId: '0558', hasaneyldrmName: 'kipping muscle up', equipmentEn: 'body weight', targetEn: 'lats', gifUrl: 'videos/0558-pM07UxU.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0558-pM07UxU.gif' },
  { seedName: '杠杆俯身划船', hasaneyldrmId: '0574', hasaneyldrmName: 'lever bent over row', equipmentEn: 'barbell', targetEn: 'upper back', gifUrl: 'videos/0574-X3cqyXz.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0574-X3cqyXz.gif' },
  { seedName: '正反握引体', hasaneyldrmId: '0627', hasaneyldrmName: 'mixed grip chin-up', equipmentEn: 'body weight', targetEn: 'lats', gifUrl: 'videos/0627-T8UpLkb.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0627-T8UpLkb.gif' },
  { seedName: '双力臂', hasaneyldrmId: '0631', hasaneyldrmName: 'muscle up', equipmentEn: 'body weight', targetEn: 'lats', gifUrl: 'videos/0631-yJUHKTn.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0631-yJUHKTn.gif' },
  { seedName: '单臂反握引体', hasaneyldrmId: '0638', hasaneyldrmName: 'one arm chin-up', equipmentEn: 'body weight', targetEn: 'lats', gifUrl: 'videos/0638-HjdqmZa.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0638-HjdqmZa.gif' },
  { seedName: '后拉引体向上', hasaneyldrmId: '0670', hasaneyldrmName: 'rear pull-up', equipmentEn: 'body weight', targetEn: 'lats', gifUrl: 'videos/0670-CbFSYC1.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0670-CbFSYC1.gif' },
  { seedName: '肩胛引体向上', hasaneyldrmId: '0688', hasaneyldrmName: 'scapular pull-up', equipmentEn: 'body weight', targetEn: 'traps', gifUrl: 'videos/0688-uTBt1HV.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0688-uTBt1HV.gif' },
  { seedName: '侧摆反握引体', hasaneyldrmId: '0720', hasaneyldrmName: 'side-to-side chin', equipmentEn: 'body weight', targetEn: 'lats', gifUrl: 'videos/0720-isAAZWA.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0720-isAAZWA.gif' },
  { seedName: '悬挂划船', hasaneyldrmId: '0808', hasaneyldrmName: 'suspended row', equipmentEn: 'body weight', targetEn: 'upper back', gifUrl: 'videos/0808-4OaumBr.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0808-4OaumBr.gif' },
  { seedName: '缆绳高位划船', hasaneyldrmId: '1324', hasaneyldrmName: 'cable upper row', equipmentEn: 'cable', targetEn: 'upper back', gifUrl: 'videos/1324-PQStVXH.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1324-PQStVXH.gif' },
  { seedName: '反握引体向上', hasaneyldrmId: '1326', hasaneyldrmName: 'chin-up', equipmentEn: 'body weight', targetEn: 'lats', gifUrl: 'videos/1326-T2mxWqc.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1326-T2mxWqc.gif' },
  { seedName: '窄距反握引体', hasaneyldrmId: '1327', hasaneyldrmName: 'close grip chin-up', equipmentEn: 'body weight', targetEn: 'lats', gifUrl: 'videos/1327-VnfUNW7.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1327-VnfUNW7.gif' },
  { seedName: '下背卷曲', hasaneyldrmId: '1352', hasaneyldrmName: 'lower back curl', equipmentEn: 'body weight', targetEn: 'spine', gifUrl: 'videos/1352-ANbbry2.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1352-ANbbry2.gif' },
  { seedName: '狮身人面式', hasaneyldrmId: '1362', hasaneyldrmName: 'sphinx', equipmentEn: 'body weight', targetEn: 'spine', gifUrl: 'videos/1362-DIVyqrU.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1362-DIVyqrU.gif' },
  { seedName: '脊柱拉伸', hasaneyldrmId: '1363', hasaneyldrmName: 'spine stretch', equipmentEn: 'body weight', targetEn: 'spine', gifUrl: 'videos/1363-JbC2iaV.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1363-JbC2iaV.gif' },
  { seedName: '上背拉伸', hasaneyldrmId: '1365', hasaneyldrmName: 'upper back stretch', equipmentEn: 'body weight', targetEn: 'upper back', gifUrl: 'videos/1365-GSDioYu.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1365-GSDioYu.gif' },
  { seedName: '上犬式', hasaneyldrmId: '1366', hasaneyldrmName: 'upward facing dog', equipmentEn: 'body weight', targetEn: 'spine', gifUrl: 'videos/1366-01qpYSe.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1366-01qpYSe.gif' },
  { seedName: '背阔肌拉伸', hasaneyldrmId: '1405', hasaneyldrmName: 'back pec stretch', equipmentEn: 'body weight', targetEn: 'lats', gifUrl: 'videos/1405-chfnQnM.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1405-chfnQnM.gif' },
  { seedName: '宽距引体向上', hasaneyldrmId: '1429', hasaneyldrmName: 'wide grip pull-up', equipmentEn: 'body weight', targetEn: 'lats', gifUrl: 'videos/1429-Qqi7bko.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1429-Qqi7bko.gif' },
  { seedName: '单臂毛巾划船', hasaneyldrmId: '1773', hasaneyldrmName: 'one arm towel row', equipmentEn: 'body weight', targetEn: 'upper back', gifUrl: 'videos/1773-bKWbrTA.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1773-bKWbrTA.gif' },
  { seedName: '肩胛下压', hasaneyldrmId: '3012', hasaneyldrmName: 'scapula dips', equipmentEn: 'body weight', targetEn: 'traps', gifUrl: 'videos/3012-7xeukSt.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/3012-7xeukSt.gif' },
  { seedName: '杠铃潘德雷划船', hasaneyldrmId: '3017', hasaneyldrmName: 'barbell pendlay row', equipmentEn: 'barbell', targetEn: 'upper back', gifUrl: 'videos/3017-r0z6xzQ.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/3017-r0z6xzQ.gif' },
  { seedName: '仰卧引体向上', hasaneyldrmId: '3019', hasaneyldrmName: 'bench pull-ups', equipmentEn: 'body weight', targetEn: 'lats', gifUrl: 'videos/3019-mExgrF9.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/3019-mExgrF9.gif' },
  { seedName: '引体升降', hasaneyldrmId: '3292', hasaneyldrmName: 'elevator', equipmentEn: 'body weight', targetEn: 'upper back', gifUrl: 'videos/3292-zYmNaoY.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/3292-zYmNaoY.gif' },
  { seedName: '弓箭手引体', hasaneyldrmId: '3293', hasaneyldrmName: 'archer pull up', equipmentEn: 'body weight', targetEn: 'lats', gifUrl: 'videos/3293-72BC5Za.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/3293-72BC5Za.gif' },
  { seedName: '前水平悬垂(动态)', hasaneyldrmId: '3295', hasaneyldrmName: 'front lever reps', equipmentEn: 'body weight', targetEn: 'upper back', gifUrl: 'videos/3295-hbY9wqG.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/3295-hbY9wqG.gif' },
  { seedName: '水平后悬垂', hasaneyldrmId: '3297', hasaneyldrmName: 'back lever', equipmentEn: 'body weight', targetEn: 'upper back', gifUrl: 'videos/3297-GaSzzuh.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/3297-GaSzzuh.gif' },
  { seedName: '猫式旋转', hasaneyldrmId: '3304', hasaneyldrmName: 'skin the cat', equipmentEn: 'body weight', targetEn: 'upper back', gifUrl: 'videos/3304-MSfvriJ.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/3304-MSfvriJ.gif' },
  { seedName: 'L 形引体向上', hasaneyldrmId: '3418', hasaneyldrmName: 'l-pull-up', equipmentEn: 'body weight', targetEn: 'lats', gifUrl: 'videos/3418-d1GgzTU.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/3418-d1GgzTU.gif' },
  { seedName: '站姿弓箭手', hasaneyldrmId: '3669', hasaneyldrmName: 'standing archer', equipmentEn: 'body weight', targetEn: 'upper back', gifUrl: 'videos/3669-JF8AkMX.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/3669-JF8AkMX.gif' },
  // G35 user-motion extra — 哑铃俯身划船
  { seedName: '哑铃俯身划船', hasaneyldrmId: '0293', hasaneyldrmName: 'dumbbell bent over row', equipmentEn: 'dumbbell', targetEn: 'upper back', gifUrl: 'videos/0293-BJ0Hz5L.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0293-BJ0Hz5L.gif' },

  // ----- 肩(30)-----
  { seedName: '杠铃前平举', hasaneyldrmId: '0041', hasaneyldrmName: 'barbell front raise', equipmentEn: 'barbell', targetEn: 'delts', gifUrl: 'videos/0041-b2Uoz54.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0041-b2Uoz54.gif' },
  { seedName: '杠铃单臂抓举', hasaneyldrmId: '0067', hasaneyldrmName: 'barbell one arm snatch', equipmentEn: 'barbell', targetEn: 'delts', gifUrl: 'videos/0067-xHKN2s8.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0067-xHKN2s8.gif' },
  { seedName: '杠铃俯身侧平举', hasaneyldrmId: '0075', hasaneyldrmName: 'barbell rear delt raise', equipmentEn: 'barbell', targetEn: 'delts', gifUrl: 'videos/0075-Ln9iTbU.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0075-Ln9iTbU.gif' },
  { seedName: '杠铃俯身划船', hasaneyldrmId: '0076', hasaneyldrmName: 'barbell rear delt row', equipmentEn: 'barbell', targetEn: 'delts', gifUrl: 'videos/0076-S9zHIvU.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0076-S9zHIvU.gif' },
  { seedName: '杠铃滑雪式', hasaneyldrmId: '0100', hasaneyldrmName: 'barbell skier', equipmentEn: 'barbell', targetEn: 'delts', gifUrl: 'videos/0100-4Leypho.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0100-4Leypho.gif' },
  { seedName: '杠铃直立划船 V2', hasaneyldrmId: '0119', hasaneyldrmName: 'barbell upright row v. 2', equipmentEn: 'barbell', targetEn: 'delts', gifUrl: 'videos/0119-83HoW9X.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0119-83HoW9X.gif' },
  { seedName: '杠铃直立划船', hasaneyldrmId: '0120', hasaneyldrmName: 'barbell upright row', equipmentEn: 'barbell', targetEn: 'delts', gifUrl: 'videos/0120-UDlhcO8.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0120-UDlhcO8.gif' },
  { seedName: '杠铃直立划船 V3', hasaneyldrmId: '0121', hasaneyldrmName: 'barbell upright row v. 3', equipmentEn: 'barbell', targetEn: 'delts', gifUrl: 'videos/0121-fI18Rbc.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0121-fI18Rbc.gif' },
  { seedName: '缆绳前举', hasaneyldrmId: '0161', hasaneyldrmName: 'cable forward raise', equipmentEn: 'cable', targetEn: 'delts', gifUrl: 'videos/0161-hvHhCv8.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0161-hvHhCv8.gif' },
  { seedName: '缆绳前平举', hasaneyldrmId: '0162', hasaneyldrmName: 'cable front raise', equipmentEn: 'cable', targetEn: 'delts', gifUrl: 'videos/0162-u2X71Np.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0162-u2X71Np.gif' },
  { seedName: '缆绳侧平举', hasaneyldrmId: '0178', hasaneyldrmName: 'cable lateral raise', equipmentEn: 'cable', targetEn: 'delts', gifUrl: 'videos/0178-goJ6ezq.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0178-goJ6ezq.gif' },
  { seedName: '缆绳肩推', hasaneyldrmId: '0219', hasaneyldrmName: 'cable shoulder press', equipmentEn: 'cable', targetEn: 'delts', gifUrl: 'videos/0219-PzQanLE.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0219-PzQanLE.gif' },
  { seedName: '缆绳仰卧后飞鸟', hasaneyldrmId: '0240', hasaneyldrmName: 'cable supine reverse fly', equipmentEn: 'cable', targetEn: 'delts', gifUrl: 'videos/0240-PQcUlDi.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0240-PQcUlDi.gif' },
  { seedName: '缆绳直立划船', hasaneyldrmId: '0246', hasaneyldrmName: 'cable upright row', equipmentEn: 'cable', targetEn: 'delts', gifUrl: 'videos/0246-cALKspW.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0246-cALKspW.gif' },
  { seedName: '哑铃古巴推举', hasaneyldrmId: '0299', hasaneyldrmName: 'dumbbell cuban press', equipmentEn: 'dumbbell', targetEn: 'delts', gifUrl: 'videos/0299-QfAKy1G.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0299-QfAKy1G.gif' },
  { seedName: '哑铃上斜前举', hasaneyldrmId: '0325', hasaneyldrmName: 'dumbbell incline raise', equipmentEn: 'dumbbell', targetEn: 'delts', gifUrl: 'videos/0325-nxW6BkN.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0325-nxW6BkN.gif' },
  { seedName: '哑铃铁十字', hasaneyldrmId: '0332', hasaneyldrmName: 'dumbbell iron cross', equipmentEn: 'dumbbell', targetEn: 'delts', gifUrl: 'videos/0332-cALkHHX.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0332-cALkHHX.gif' },
  { seedName: '哑铃前举', hasaneyldrmId: '0376', hasaneyldrmName: 'dumbbell raise', equipmentEn: 'dumbbell', targetEn: 'delts', gifUrl: 'videos/0376-c9MnDRp.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0376-c9MnDRp.gif' },
  { seedName: '哑铃俯身后飞鸟', hasaneyldrmId: '0378', hasaneyldrmName: 'dumbbell rear fly', equipmentEn: 'dumbbell', targetEn: 'delts', gifUrl: 'videos/0378-8DiFDVA.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0378-8DiFDVA.gif' },
  { seedName: '哑铃直立划船', hasaneyldrmId: '0437', hasaneyldrmName: 'dumbbell upright row', equipmentEn: 'dumbbell', targetEn: 'delts', gifUrl: 'videos/0437-ainizkb.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0437-ainizkb.gif' },
  { seedName: '哑铃 W 推举', hasaneyldrmId: '0438', hasaneyldrmName: 'dumbbell w-press', equipmentEn: 'dumbbell', targetEn: 'delts', gifUrl: 'videos/0438-vmwLyCg.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0438-vmwLyCg.gif' },
  { seedName: '后束三角肌拉伸', hasaneyldrmId: '0669', hasaneyldrmName: 'rear deltoid stretch', equipmentEn: 'body weight', targetEn: 'delts', gifUrl: 'videos/0669-xifhB5W.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0669-xifhB5W.gif' },
  { seedName: '哑铃借力推', hasaneyldrmId: '1700', hasaneyldrmName: 'dumbbell push press', equipmentEn: 'dumbbell', targetEn: 'delts', gifUrl: 'videos/1700-FS63wTN.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1700-FS63wTN.gif' },
  { seedName: '哑铃阿诺德推举', hasaneyldrmId: '2137', hasaneyldrmName: 'dumbbell arnold press', equipmentEn: 'dumbbell', targetEn: 'delts', gifUrl: 'videos/2137-Xy4jlWA.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/2137-Xy4jlWA.gif' },
  { seedName: '左勾拳', hasaneyldrmId: '2271', hasaneyldrmName: 'left hook. boxing', equipmentEn: 'body weight', targetEn: 'delts', gifUrl: 'videos/2271-hoXt6wv.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/2271-hoXt6wv.gif' },
  { seedName: '哑铃俯身侧平举', hasaneyldrmId: '2292', hasaneyldrmName: 'dumbbell rear delt raise', equipmentEn: 'dumbbell', targetEn: 'delts', gifUrl: 'videos/2292-mu5Guxt.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/2292-mu5Guxt.gif' },
  { seedName: '哑铃斯科特推举', hasaneyldrmId: '2397', hasaneyldrmName: 'dumbbell scott press', equipmentEn: 'dumbbell', targetEn: 'delts', gifUrl: 'videos/2397-5vfAI0I.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/2397-5vfAI0I.gif' },
  { seedName: '地雷管侧平举', hasaneyldrmId: '3237', hasaneyldrmName: 'landmine lateral raise', equipmentEn: 'barbell', targetEn: 'delts', gifUrl: 'videos/3237-eXMFHww.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/3237-eXMFHww.gif' },
  { seedName: '杠铃借力推', hasaneyldrmId: '3305', hasaneyldrmName: 'barbell thruster', equipmentEn: 'barbell', targetEn: 'delts', gifUrl: 'videos/3305-f7Y9eDZ.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/3305-f7Y9eDZ.gif' },
  { seedName: '哑铃上斜 T 举', hasaneyldrmId: '3542', hasaneyldrmName: 'dumbbell incline t-raise', equipmentEn: 'dumbbell', targetEn: 'delts', gifUrl: 'videos/3542-jgbvVJ0.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/3542-jgbvVJ0.gif' },

  // ----- 臂(上臂)(50)-----
  { seedName: '杠铃拖拽弯举', hasaneyldrmId: '0038', hasaneyldrmName: 'barbell drag curl', equipmentEn: 'barbell', targetEn: 'biceps', gifUrl: 'videos/0038-IENzBdA.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0038-IENzBdA.gif' },
  { seedName: '杠铃 JM 卧推', hasaneyldrmId: '0052', hasaneyldrmName: 'barbell jm bench press', equipmentEn: 'barbell', targetEn: 'triceps', gifUrl: 'videos/0052-ZsiqXYa.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0052-ZsiqXYa.gif' },
  { seedName: '杠铃仰卧臂屈伸', hasaneyldrmId: '0057', hasaneyldrmName: 'barbell lying extension', equipmentEn: 'barbell', targetEn: 'triceps', gifUrl: 'videos/0057-EMpUwRI.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0057-EMpUwRI.gif' },
  { seedName: '杠铃反握弯举', hasaneyldrmId: '0080', hasaneyldrmName: 'barbell reverse curl', equipmentEn: 'barbell', targetEn: 'biceps', gifUrl: 'videos/0080-xNrS20v.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0080-xNrS20v.gif' },
  { seedName: '屈膝长凳臂屈伸', hasaneyldrmId: '0129', hasaneyldrmName: 'bench dip (knees bent)', equipmentEn: 'body weight', targetEn: 'triceps', gifUrl: 'videos/0129-RrLske5.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0129-RrLske5.gif' },
  { seedName: '俯撑起身', hasaneyldrmId: '0137', hasaneyldrmName: 'body-up', equipmentEn: 'body weight', targetEn: 'triceps', gifUrl: 'videos/0137-U6G2gk9.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0137-U6G2gk9.gif' },
  { seedName: '窄距二头引体', hasaneyldrmId: '0139', hasaneyldrmName: 'biceps narrow pull-ups', equipmentEn: 'body weight', targetEn: 'biceps', gifUrl: 'videos/0139-50BETrz.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0139-50BETrz.gif' },
  { seedName: '二头引体', hasaneyldrmId: '0140', hasaneyldrmName: 'biceps pull-up', equipmentEn: 'body weight', targetEn: 'biceps', gifUrl: 'videos/0140-guT8YnS.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0140-guT8YnS.gif' },
  { seedName: '缆绳单臂弯举', hasaneyldrmId: '0190', hasaneyldrmName: 'cable one arm curl', equipmentEn: 'cable', targetEn: 'biceps', gifUrl: 'videos/0190-YTur5nR.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0190-YTur5nR.gif' },
  { seedName: '缆绳牧师凳弯举', hasaneyldrmId: '0195', hasaneyldrmName: 'cable preacher curl', equipmentEn: 'cable', targetEn: 'biceps', gifUrl: 'videos/0195-P2lNrGL.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0195-P2lNrGL.gif' },
  { seedName: '缆绳下压', hasaneyldrmId: '0201', hasaneyldrmName: 'cable pushdown', equipmentEn: 'cable', targetEn: 'triceps', gifUrl: 'videos/0201-3ZflifB.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0201-3ZflifB.gif' },
  { seedName: '缆绳后驱', hasaneyldrmId: '0204', hasaneyldrmName: 'cable rear drive', equipmentEn: 'cable', targetEn: 'triceps', gifUrl: 'videos/0204-c3QQLPi.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0204-c3QQLPi.gif' },
  { seedName: '缆绳反握弯举', hasaneyldrmId: '0206', hasaneyldrmName: 'cable reverse curl', equipmentEn: 'cable', targetEn: 'biceps', gifUrl: 'videos/0206-eOG0r6v.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0206-eOG0r6v.gif' },
  { seedName: '窄距俯卧撑', hasaneyldrmId: '0259', hasaneyldrmName: 'close-grip push-up', equipmentEn: 'body weight', targetEn: 'triceps', gifUrl: 'videos/0259-x6KpKpq.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0259-x6KpKpq.gif' },
  { seedName: '钻石俯卧撑', hasaneyldrmId: '0283', hasaneyldrmName: 'diamond push-up', equipmentEn: 'body weight', targetEn: 'triceps', gifUrl: 'videos/0283-soIB2rj.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0283-soIB2rj.gif' },
  { seedName: '哑铃标准弯举', hasaneyldrmId: '0294', hasaneyldrmName: 'dumbbell biceps curl', equipmentEn: 'dumbbell', targetEn: 'biceps', gifUrl: 'videos/0294-NbVPDMW.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0294-NbVPDMW.gif' },
  { seedName: '哑铃锤式弯举', hasaneyldrmId: '0313', hasaneyldrmName: 'dumbbell hammer curl', equipmentEn: 'dumbbell', targetEn: 'biceps', gifUrl: 'videos/0313-slDvUAU.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0313-slDvUAU.gif' },
  { seedName: '上斜哑铃弯举', hasaneyldrmId: '0318', hasaneyldrmName: 'dumbbell incline curl', equipmentEn: 'dumbbell', targetEn: 'biceps', gifUrl: 'videos/0318-ae9UoXQ.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0318-ae9UoXQ.gif' },
  { seedName: '哑铃后踢', hasaneyldrmId: '0333', hasaneyldrmName: 'dumbbell kickback', equipmentEn: 'dumbbell', targetEn: 'triceps', gifUrl: 'videos/0333-W6PxUkg.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0333-W6PxUkg.gif' },
  { seedName: '哑铃牧师凳弯举', hasaneyldrmId: '0372', hasaneyldrmName: 'dumbbell preacher curl', equipmentEn: 'dumbbell', targetEn: 'biceps', gifUrl: 'videos/0372-jivWf8n.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0372-jivWf8n.gif' },
  { seedName: '坐姿哑铃弯举', hasaneyldrmId: '0391', hasaneyldrmName: 'dumbbell seated curl', equipmentEn: 'dumbbell', targetEn: 'biceps', gifUrl: 'videos/0391-TiaZTxx.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0391-TiaZTxx.gif' },
  { seedName: '哑铃泰特推举', hasaneyldrmId: '0436', hasaneyldrmName: 'dumbbell tate press', equipmentEn: 'dumbbell', targetEn: 'triceps', gifUrl: 'videos/0436-s5PdDyY.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0436-s5PdDyY.gif' },
  { seedName: '哑铃佐特曼弯举', hasaneyldrmId: '0439', hasaneyldrmName: 'dumbbell zottman curl', equipmentEn: 'dumbbell', targetEn: 'biceps', gifUrl: 'videos/0439-kXaIn5A.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0439-kXaIn5A.gif' },
  { seedName: '倒立俯卧撑', hasaneyldrmId: '0471', hasaneyldrmName: 'handstand push-up', equipmentEn: 'body weight', targetEn: 'triceps', gifUrl: 'videos/0471-rQxwMxO.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0471-rQxwMxO.gif' },
  { seedName: '单臂臂屈伸', hasaneyldrmId: '0639', hasaneyldrmName: 'one arm dip', equipmentEn: 'body weight', targetEn: 'triceps', gifUrl: 'videos/0639-FAoIFMw.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0639-FAoIFMw.gif' },
  { seedName: '反握臂屈伸', hasaneyldrmId: '0672', hasaneyldrmName: 'reverse dip', equipmentEn: 'body weight', targetEn: 'triceps', gifUrl: 'videos/0672-NZ5Qqkz.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0672-NZ5Qqkz.gif' },
  { seedName: '吊环臂屈伸', hasaneyldrmId: '0677', hasaneyldrmName: 'ring dips', equipmentEn: 'body weight', targetEn: 'triceps', gifUrl: 'videos/0677-ezTvXcr.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0677-ezTvXcr.gif' },
  { seedName: '侧身俯卧撑', hasaneyldrmId: '0717', hasaneyldrmName: 'side push-up', equipmentEn: 'body weight', targetEn: 'triceps', gifUrl: 'videos/0717-wpbD28t.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0717-wpbD28t.gif' },
  { seedName: '长凳腿屈伸臂屈伸', hasaneyldrmId: '0812', hasaneyldrmName: 'triceps dip (bench leg)', equipmentEn: 'body weight', targetEn: 'triceps', gifUrl: 'videos/0812-VuoerH0.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0812-VuoerH0.gif' },
  { seedName: '三头肌臂屈伸', hasaneyldrmId: '0814', hasaneyldrmName: 'triceps dip', equipmentEn: 'body weight', targetEn: 'triceps', gifUrl: 'videos/0814-X6C6i5Y.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0814-X6C6i5Y.gif' },
  { seedName: '地面三头肌臂屈伸', hasaneyldrmId: '0815', hasaneyldrmName: 'triceps dips floor', equipmentEn: 'body weight', targetEn: 'triceps', gifUrl: 'videos/0815-7aVz15j.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0815-7aVz15j.gif' },
  { seedName: '三头肌推举', hasaneyldrmId: '0816', hasaneyldrmName: 'triceps press', equipmentEn: 'body weight', targetEn: 'triceps', gifUrl: 'videos/0816-fSrPP6B.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0816-fSrPP6B.gif' },
  { seedName: '三头肌拉伸', hasaneyldrmId: '0817', hasaneyldrmName: 'triceps stretch', equipmentEn: 'body weight', targetEn: 'triceps', gifUrl: 'videos/0817-uOV3Itw.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0817-uOV3Itw.gif' },
  { seedName: '缆绳后踢', hasaneyldrmId: '0860', hasaneyldrmName: 'cable kickback', equipmentEn: 'cable', targetEn: 'triceps', gifUrl: 'videos/0860-HEJ6DIX.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0860-HEJ6DIX.gif' },
  { seedName: '缆绳弯举', hasaneyldrmId: '0868', hasaneyldrmName: 'cable curl', equipmentEn: 'cable', targetEn: 'biceps', gifUrl: 'videos/0868-G08RZcQ.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0868-G08RZcQ.gif' },
  { seedName: '地面长凳臂屈伸', hasaneyldrmId: '1399', hasaneyldrmName: 'bench dip on floor', equipmentEn: 'body weight', targetEn: 'triceps', gifUrl: 'videos/1399-9RT8oQW.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1399-9RT8oQW.gif' },
  { seedName: '前臂俯卧撑', hasaneyldrmId: '1467', hasaneyldrmName: 'push-up on lower arms', equipmentEn: 'body weight', targetEn: 'triceps', gifUrl: 'videos/1467-4Jt8QsQ.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1467-4Jt8QsQ.gif' },
  { seedName: '缆绳窄距弯举', hasaneyldrmId: '1630', hasaneyldrmName: 'cable close grip curl', equipmentEn: 'cable', targetEn: 'biceps', gifUrl: 'videos/1630-BCGQ6J5.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1630-BCGQ6J5.gif' },
  { seedName: '缆绳集中弯举', hasaneyldrmId: '1631', hasaneyldrmName: 'cable concentration curl', equipmentEn: 'cable', targetEn: 'biceps', gifUrl: 'videos/1631-NvfE43H.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1631-NvfE43H.gif' },
  { seedName: '缆绳拖拽弯举', hasaneyldrmId: '1632', hasaneyldrmName: 'cable drag curl', equipmentEn: 'cable', targetEn: 'biceps', gifUrl: 'videos/1632-dXz8zjF.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1632-dXz8zjF.gif' },
  { seedName: '缆绳仰卧弯举', hasaneyldrmId: '1634', hasaneyldrmName: 'cable lying bicep curl', equipmentEn: 'cable', targetEn: 'biceps', gifUrl: 'videos/1634-otqIxU4.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1634-otqIxU4.gif' },
  { seedName: '缆绳过头弯举', hasaneyldrmId: '1636', hasaneyldrmName: 'cable overhead curl', equipmentEn: 'cable', targetEn: 'biceps', gifUrl: 'videos/1636-wDUqY2u.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1636-wDUqY2u.gif' },
  { seedName: '坐姿缆绳弯举', hasaneyldrmId: '1641', hasaneyldrmName: 'cable seated curl', equipmentEn: 'cable', targetEn: 'biceps', gifUrl: 'videos/1641-8oYqOt9.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1641-8oYqOt9.gif' },
  { seedName: '缆绳深蹲弯举', hasaneyldrmId: '1644', hasaneyldrmName: 'cable squatting curl', equipmentEn: 'cable', targetEn: 'biceps', gifUrl: 'videos/1644-3XFdb1Z.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1644-3XFdb1Z.gif' },
  { seedName: '哑铃高弯举', hasaneyldrmId: '1664', hasaneyldrmName: 'dumbbell high curl', equipmentEn: 'dumbbell', targetEn: 'biceps', gifUrl: 'videos/1664-qAmNMJY.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1664-qAmNMJY.gif' },
  { seedName: '杠铃架上推举', hasaneyldrmId: '1751', hasaneyldrmName: 'barbell pin presses', equipmentEn: 'barbell', targetEn: 'triceps', gifUrl: 'videos/1751-bndCa3Q.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1751-bndCa3Q.gif' },
  { seedName: '三凳臂屈伸', hasaneyldrmId: '1753', hasaneyldrmName: 'three bench dip', equipmentEn: 'body weight', targetEn: 'triceps', gifUrl: 'videos/1753-DQ0cqkT.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1753-DQ0cqkT.gif' },
  { seedName: '极限臂屈伸', hasaneyldrmId: '3289', hasaneyldrmName: 'impossible dips', equipmentEn: 'body weight', targetEn: 'triceps', gifUrl: 'videos/3289-05Cf2v8.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/3289-05Cf2v8.gif' },
  { seedName: '施塔德推举', hasaneyldrmId: '3291', hasaneyldrmName: 'stalder press', equipmentEn: 'body weight', targetEn: 'triceps', gifUrl: 'videos/3291-zd4P4B2.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/3291-zd4P4B2.gif' },
  { seedName: '倒立', hasaneyldrmId: '3302', hasaneyldrmName: 'handstand', equipmentEn: 'body weight', targetEn: 'triceps', gifUrl: 'videos/3302-XooAdhl.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/3302-XooAdhl.gif' },

  // ----- 腿(股四/臀/腘)(45)-----
  { seedName: '平衡板', hasaneyldrmId: '0020', hasaneyldrmName: 'balance board', equipmentEn: 'body weight', targetEn: 'quads', gifUrl: 'videos/0020-xAySMB0.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0020-xAySMB0.gif' },
  { seedName: '杠铃卧式深蹲', hasaneyldrmId: '0026', hasaneyldrmName: 'barbell bench squat', equipmentEn: 'barbell', targetEn: 'quads', gifUrl: 'videos/0026-W9pFVv1.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0026-W9pFVv1.gif' },
  { seedName: '杠铃前蹲', hasaneyldrmId: '0042', hasaneyldrmName: 'barbell front squat', equipmentEn: 'barbell', targetEn: 'glutes', gifUrl: 'videos/0042-zG0zs85.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0042-zG0zs85.gif' },
  { seedName: '杠铃反向深蹲', hasaneyldrmId: '0046', hasaneyldrmName: 'barbell hack squat', equipmentEn: 'barbell', targetEn: 'glutes', gifUrl: 'videos/0046-5VCj6iH.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0046-5VCj6iH.gif' },
  { seedName: '杠铃跳跃深蹲', hasaneyldrmId: '0053', hasaneyldrmName: 'barbell jump squat', equipmentEn: 'barbell', targetEn: 'glutes', gifUrl: 'videos/0053-1gFNTZV.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0053-1gFNTZV.gif' },
  { seedName: '杠铃弓步蹲', hasaneyldrmId: '0054', hasaneyldrmName: 'barbell lunge', equipmentEn: 'barbell', targetEn: 'glutes', gifUrl: 'videos/0054-t8iSghb.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0054-t8iSghb.gif' },
  { seedName: '杠铃架上硬拉', hasaneyldrmId: '0074', hasaneyldrmName: 'barbell rack pull', equipmentEn: 'barbell', targetEn: 'glutes', gifUrl: 'videos/0074-za9Ni4z.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0074-za9Ni4z.gif' },
  { seedName: '杠铃后弓步', hasaneyldrmId: '0078', hasaneyldrmName: 'barbell rear lunge', equipmentEn: 'barbell', targetEn: 'glutes', gifUrl: 'videos/0078-VaP75jl.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0078-VaP75jl.gif' },
  { seedName: '杠铃速度深蹲', hasaneyldrmId: '0101', hasaneyldrmName: 'barbell speed squat', equipmentEn: 'barbell', targetEn: 'glutes', gifUrl: 'videos/0101-euI1BwR.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0101-euI1BwR.gif' },
  { seedName: '杠铃上阶', hasaneyldrmId: '0114', hasaneyldrmName: 'barbell step-up', equipmentEn: 'barbell', targetEn: 'glutes', gifUrl: 'videos/0114-Kxquu2E.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0114-Kxquu2E.gif' },
  { seedName: '杠铃宽距深蹲', hasaneyldrmId: '0124', hasaneyldrmName: 'barbell wide squat', equipmentEn: 'barbell', targetEn: 'quads', gifUrl: 'videos/0124-s7HX1BY.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0124-s7HX1BY.gif' },
  { seedName: '缆绳硬拉', hasaneyldrmId: '0157', hasaneyldrmName: 'cable deadlift', equipmentEn: 'cable', targetEn: 'glutes', gifUrl: 'videos/0157-eGDudUV.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0157-eGDudUV.gif' },
  { seedName: '哑铃高翻', hasaneyldrmId: '0295', hasaneyldrmName: 'dumbbell clean', equipmentEn: 'dumbbell', targetEn: 'glutes', gifUrl: 'videos/0295-7Hg55JG.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0295-7Hg55JG.gif' },
  { seedName: '哑铃硬拉', hasaneyldrmId: '0300', hasaneyldrmName: 'dumbbell deadlift', equipmentEn: 'dumbbell', targetEn: 'glutes', gifUrl: 'videos/0300-nUwVh7b.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0300-nUwVh7b.gif' },
  { seedName: '哑铃深蹲', hasaneyldrmId: '0413', hasaneyldrmName: 'dumbbell squat', equipmentEn: 'dumbbell', targetEn: 'glutes', gifUrl: 'videos/0413-HsvHqgf.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0413-HsvHqgf.gif' },
  { seedName: '哑铃上阶', hasaneyldrmId: '0431', hasaneyldrmName: 'dumbbell step-up', equipmentEn: 'dumbbell', targetEn: 'glutes', gifUrl: 'videos/0431-aXtJhlg.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0431-aXtJhlg.gif' },
  { seedName: '踢腿', hasaneyldrmId: '0459', hasaneyldrmName: 'flutter kicks', equipmentEn: 'body weight', targetEn: 'glutes', gifUrl: 'videos/0459-UVo2Qs2.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0459-UVo2Qs2.gif' },
  { seedName: '跳跃深蹲 V2', hasaneyldrmId: '0513', hasaneyldrmName: 'jump squat v. 2', equipmentEn: 'body weight', targetEn: 'glutes', gifUrl: 'videos/0513-TDYiji6.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0513-TDYiji6.gif' },
  { seedName: '跳跃深蹲', hasaneyldrmId: '0514', hasaneyldrmName: 'jump squat', equipmentEn: 'body weight', targetEn: 'glutes', gifUrl: 'videos/0514-LIlE5Tn.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0514-LIlE5Tn.gif' },
  { seedName: '坐姿外摆腿', hasaneyldrmId: '0555', hasaneyldrmName: 'kick out sit', equipmentEn: 'body weight', targetEn: 'hamstrings', gifUrl: 'videos/0555-v7p5bYl.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0555-v7p5bYl.gif' },
  { seedName: '靠墙踏步', hasaneyldrmId: '0624', hasaneyldrmName: 'march sit (wall)', equipmentEn: 'body weight', targetEn: 'glutes', gifUrl: 'videos/0624-sVQCCeG.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0624-sVQCCeG.gif' },
  { seedName: '怪兽步', hasaneyldrmId: '0628', hasaneyldrmName: 'monster walk', equipmentEn: 'body weight', targetEn: 'glutes', gifUrl: 'videos/0628-O95afRA.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0628-O95afRA.gif' },
  { seedName: '高翻', hasaneyldrmId: '0648', hasaneyldrmName: 'power clean', equipmentEn: 'barbell', targetEn: 'hamstrings', gifUrl: 'videos/0648-SiWCcTN.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0648-SiWCcTN.gif' },
  { seedName: '侧向外展', hasaneyldrmId: '0710', hasaneyldrmName: 'side hip abduction', equipmentEn: 'body weight', targetEn: 'abductors', gifUrl: 'videos/0710-7WaDzyL.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0710-7WaDzyL.gif' },
  { seedName: '抓举式硬拉', hasaneyldrmId: '0776', hasaneyldrmName: 'snatch pull', equipmentEn: 'barbell', targetEn: 'quads', gifUrl: 'videos/0776-dG5Smob.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0776-dG5Smob.gif' },
  { seedName: '借力挺蹲举', hasaneyldrmId: '0786', hasaneyldrmName: 'squat jerk', equipmentEn: 'barbell', targetEn: 'quads', gifUrl: 'videos/0786-IMRsOCn.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0786-IMRsOCn.gif' },
  { seedName: '抱膝贴胸', hasaneyldrmId: '1418', hasaneyldrmName: 'hug keens to chest', equipmentEn: 'body weight', targetEn: 'glutes', gifUrl: 'videos/1418-znP9SIh.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1418-znP9SIh.gif' },
  { seedName: '铁十字拉伸', hasaneyldrmId: '1419', hasaneyldrmName: 'iron cross stretch', equipmentEn: 'body weight', targetEn: 'glutes', gifUrl: 'videos/1419-pZwUsKB.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1419-pZwUsKB.gif' },
  { seedName: '行走弓步蹲', hasaneyldrmId: '1460', hasaneyldrmName: 'walking lunge', equipmentEn: 'body weight', targetEn: 'glutes', gifUrl: 'videos/1460-IZVHb27.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1460-IZVHb27.gif' },
  { seedName: '扭转臀桥', hasaneyldrmId: '1466', hasaneyldrmName: 'twist hip lift', equipmentEn: 'body weight', targetEn: 'glutes', gifUrl: 'videos/1466-AX1kB0o.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1466-AX1kB0o.gif' },
  { seedName: '前向跳跃', hasaneyldrmId: '1472', hasaneyldrmName: 'forward jump', equipmentEn: 'body weight', targetEn: 'quads', gifUrl: 'videos/1472-uZKq7lo.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1472-uZKq7lo.gif' },
  { seedName: '后向跳跃', hasaneyldrmId: '1473', hasaneyldrmName: 'backward jump', equipmentEn: 'body weight', targetEn: 'quads', gifUrl: 'videos/1473-SaDOwk7.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1473-SaDOwk7.gif' },
  { seedName: '单腿深蹲', hasaneyldrmId: '1476', hasaneyldrmName: 'one leg squat', equipmentEn: 'body weight', targetEn: 'glutes', gifUrl: 'videos/1476-C31LMnP.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1476-C31LMnP.gif' },
  { seedName: '西式深蹲', hasaneyldrmId: '1489', hasaneyldrmName: 'sissy squat', equipmentEn: 'body weight', targetEn: 'quads', gifUrl: 'videos/1489-xdYPUtE.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1489-xdYPUtE.gif' },
  { seedName: '腘绳肌拉伸', hasaneyldrmId: '1511', hasaneyldrmName: 'hamstring stretch', equipmentEn: 'body weight', targetEn: 'hamstrings', gifUrl: 'videos/1511-99rWm7w.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1511-99rWm7w.gif' },
  { seedName: '跑者拉伸', hasaneyldrmId: '1585', hasaneyldrmName: 'runners stretch', equipmentEn: 'body weight', targetEn: 'hamstrings', gifUrl: 'videos/1585-0mB6wHO.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1585-0mB6wHO.gif' },
  { seedName: '农夫行走', hasaneyldrmId: '2133', hasaneyldrmName: 'farmers walk', equipmentEn: 'dumbbell', targetEn: 'quads', gifUrl: 'videos/2133-qPEzJjA.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/2133-qPEzJjA.gif' },
  { seedName: '分腿蹲', hasaneyldrmId: '2368', hasaneyldrmName: 'split squats', equipmentEn: 'body weight', targetEn: 'quads', gifUrl: 'videos/2368-9E25EOx.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/2368-9E25EOx.gif' },
  { seedName: '腿弯举臀桥', hasaneyldrmId: '3193', hasaneyldrmName: 'glute-ham raise', equipmentEn: 'body weight', targetEn: 'hamstrings', gifUrl: 'videos/3193-Vvwjz6N.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/3193-Vvwjz6N.gif' },
  { seedName: '弗兰肯斯坦深蹲', hasaneyldrmId: '3194', hasaneyldrmName: 'frankenstein squat', equipmentEn: 'barbell', targetEn: 'glutes', gifUrl: 'videos/3194-bdWcbaU.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/3194-bdWcbaU.gif' },
  { seedName: '股四头肌拉伸', hasaneyldrmId: '3533', hasaneyldrmName: 'quads', equipmentEn: 'body weight', targetEn: 'quads', gifUrl: 'videos/3533-6YUfHPL.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/3533-6YUfHPL.gif' },
  { seedName: '快速步伐 V2', hasaneyldrmId: '3552', hasaneyldrmName: 'quick feet v. 2', equipmentEn: 'body weight', targetEn: 'quads', gifUrl: 'videos/3552-mweqJin.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/3552-mweqJin.gif' },
  { seedName: '臀桥踏步', hasaneyldrmId: '3561', hasaneyldrmName: 'glute bridge march', equipmentEn: 'body weight', targetEn: 'glutes', gifUrl: 'videos/3561-GibBPPg.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/3561-GibBPPg.gif' },
  { seedName: '跳跃弓步', hasaneyldrmId: '3582', hasaneyldrmName: 'lunge with jump', equipmentEn: 'body weight', targetEn: 'glutes', gifUrl: 'videos/3582-PM1PZjg.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/3582-PM1PZjg.gif' },
  { seedName: '屈膝礼深蹲', hasaneyldrmId: '3769', hasaneyldrmName: 'curtsey squat', equipmentEn: 'body weight', targetEn: 'glutes', gifUrl: 'videos/3769-gUjqdei.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/3769-gUjqdei.gif' },
  // G35 user-motion extra — 哑铃罗马尼亚硬拉 + 杠铃臀桥(source 数据里无 哑铃臀桥,最相似用 杠铃版)
  { seedName: '哑铃罗马尼亚硬拉', hasaneyldrmId: '1459', hasaneyldrmName: 'dumbbell romanian deadlift', equipmentEn: 'dumbbell', targetEn: 'glutes', gifUrl: 'videos/1459-rR0LJzx.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1459-rR0LJzx.gif' },
  { seedName: '杠铃臀桥', hasaneyldrmId: '1409', hasaneyldrmName: 'barbell glute bridge', equipmentEn: 'barbell', targetEn: 'glutes', gifUrl: 'videos/1409-qKBpF7I.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1409-qKBpF7I.gif' },

  // ----- 腿(小腿)(12)-----
  { seedName: '坐姿杠铃提踵', hasaneyldrmId: '0088', hasaneyldrmName: 'barbell seated calf raise', equipmentEn: 'barbell', targetEn: 'calves', gifUrl: 'videos/0088-ktsFQAZ.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0088-ktsFQAZ.gif' },
  { seedName: '膝盖环绕拉伸', hasaneyldrmId: '0257', hasaneyldrmName: 'circles knee stretch', equipmentEn: 'body weight', targetEn: 'calves', gifUrl: 'videos/0257-X7jbxra.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0257-X7jbxra.gif' },
  { seedName: '驴式提踵', hasaneyldrmId: '0284', hasaneyldrmName: 'donkey calf raise', equipmentEn: 'body weight', targetEn: 'calves', gifUrl: 'videos/0284-u5ESqzH.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0284-u5ESqzH.gif' },
  { seedName: '脚踝环绕', hasaneyldrmId: '1368', hasaneyldrmName: 'ankle circles', equipmentEn: 'body weight', targetEn: 'calves', gifUrl: 'videos/1368-uL9CsKm.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1368-uL9CsKm.gif' },
  { seedName: '杠铃地面提踵', hasaneyldrmId: '1370', hasaneyldrmName: 'barbell floor calf raise', equipmentEn: 'barbell', targetEn: 'calves', gifUrl: 'videos/1370-2IHEa2T.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1370-2IHEa2T.gif' },
  { seedName: '坐姿杠铃提踵 V2', hasaneyldrmId: '1371', hasaneyldrmName: 'barbell seated calf raise', equipmentEn: 'barbell', targetEn: 'calves', gifUrl: 'videos/1371-ipvgBnC.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1371-ipvgBnC.gif' },
  { seedName: '杠铃站姿提踵', hasaneyldrmId: '1372', hasaneyldrmName: 'barbell standing calf raise', equipmentEn: 'barbell', targetEn: 'calves', gifUrl: 'videos/1372-8ozhUIZ.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1372-8ozhUIZ.gif' },
  { seedName: '缆绳站姿提踵', hasaneyldrmId: '1375', hasaneyldrmName: 'cable standing calf raise', equipmentEn: 'cable', targetEn: 'calves', gifUrl: 'videos/1375-yl2IYyy.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1375-yl2IYyy.gif' },
  { seedName: '单腿驴式提踵', hasaneyldrmId: '1386', hasaneyldrmName: 'one leg donkey calf raise', equipmentEn: 'body weight', targetEn: 'calves', gifUrl: 'videos/1386-A2upspL.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1386-A2upspL.gif' },
  { seedName: '单腿地面提踵', hasaneyldrmId: '1387', hasaneyldrmName: 'one leg floor calf raise', equipmentEn: 'body weight', targetEn: 'calves', gifUrl: 'videos/1387-0jp9Rlz.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1387-0jp9Rlz.gif' },
  { seedName: '坐姿小腿拉伸', hasaneyldrmId: '1390', hasaneyldrmName: 'seated calf stretch (male)', equipmentEn: 'body weight', targetEn: 'calves', gifUrl: 'videos/1390-17bqEXD.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1390-17bqEXD.gif' },
  { seedName: '站姿提踵(快速)', hasaneyldrmId: '1397', hasaneyldrmName: 'standing calves', equipmentEn: 'body weight', targetEn: 'calves', gifUrl: 'videos/1397-XIHEoCG.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1397-XIHEoCG.gif' },

  // ----- 核心(30)-----
  { seedName: '四分之三仰卧起坐', hasaneyldrmId: '0001', hasaneyldrmName: '3/4 sit-up', equipmentEn: 'body weight', targetEn: 'abs', gifUrl: 'videos/0001-2gPfomN.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0001-2gPfomN.gif' },
  { seedName: '45 度侧弯', hasaneyldrmId: '0002', hasaneyldrmName: '45° side bend', equipmentEn: 'body weight', targetEn: 'abs', gifUrl: 'videos/0002-Hy9D21L.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0002-Hy9D21L.gif' },
  { seedName: '空中自行车', hasaneyldrmId: '0003', hasaneyldrmName: 'air bike', equipmentEn: 'body weight', targetEn: 'abs', gifUrl: 'videos/0003-1ZFqTDN.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0003-1ZFqTDN.gif' },
  { seedName: '仰卧抬腿', hasaneyldrmId: '0138', hasaneyldrmName: 'bottoms-up', equipmentEn: 'body weight', targetEn: 'abs', gifUrl: 'videos/0138-CI6baTY.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0138-CI6baTY.gif' },
  { seedName: '缆绳扭转', hasaneyldrmId: '0243', hasaneyldrmName: 'cable twist', equipmentEn: 'cable', targetEn: 'abs', gifUrl: 'videos/0243-aVs3BR3.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0243-aVs3BR3.gif' },
  { seedName: '蜷腹抱膝', hasaneyldrmId: '0260', hasaneyldrmName: 'cocoons', equipmentEn: 'body weight', targetEn: 'abs', gifUrl: 'videos/0260-SLKj2pX.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0260-SLKj2pX.gif' },
  { seedName: '死虫式', hasaneyldrmId: '0276', hasaneyldrmName: 'dead bug', equipmentEn: 'body weight', targetEn: 'abs', gifUrl: 'videos/0276-iny3m5y.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0276-iny3m5y.gif' },
  { seedName: '猩猩抬腿', hasaneyldrmId: '0467', hasaneyldrmName: 'gorilla chin', equipmentEn: 'body weight', targetEn: 'abs', gifUrl: 'videos/0467-bmwlYvD.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0467-bmwlYvD.gif' },
  { seedName: '腹股沟卷腹', hasaneyldrmId: '0469', hasaneyldrmName: 'groin crunch', equipmentEn: 'body weight', targetEn: 'abs', gifUrl: 'videos/0469-mWppALS.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0469-mWppALS.gif' },
  { seedName: '悬挂收腿', hasaneyldrmId: '0473', hasaneyldrmName: 'hanging pike', equipmentEn: 'body weight', targetEn: 'abs', gifUrl: 'videos/0473-nuBF9MO.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0473-nuBF9MO.gif' },
  { seedName: '扬达仰卧起坐', hasaneyldrmId: '0508', hasaneyldrmName: 'janda sit-up', equipmentEn: 'body weight', targetEn: 'abs', gifUrl: 'videos/0508-1GPHRyK.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0508-1GPHRyK.gif' },
  { seedName: '地雷管 180', hasaneyldrmId: '0562', hasaneyldrmName: 'landmine 180', equipmentEn: 'barbell', targetEn: 'abs', gifUrl: 'videos/0562-QYysSLV.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0562-QYysSLV.gif' },
  { seedName: '仰卧起坐 V2', hasaneyldrmId: '0735', hasaneyldrmName: 'sit-up v. 2', equipmentEn: 'body weight', targetEn: 'abs', gifUrl: 'videos/0735-Bn6TXyO.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0735-Bn6TXyO.gif' },
  { seedName: '咒语者', hasaneyldrmId: '0777', hasaneyldrmName: 'spell caster', equipmentEn: 'dumbbell', targetEn: 'abs', gifUrl: 'videos/0777-p9cCe2r.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0777-p9cCe2r.gif' },
  { seedName: '冲刺跑', hasaneyldrmId: '0858', hasaneyldrmName: 'wind sprints', equipmentEn: 'body weight', targetEn: 'abs', gifUrl: 'videos/0858-Qoujh3Q.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0858-Qoujh3Q.gif' },
  { seedName: '臀顶', hasaneyldrmId: '0870', hasaneyldrmName: 'butt-ups', equipmentEn: 'body weight', targetEn: 'abs', gifUrl: 'videos/0870-qcNN2FN.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0870-qcNN2FN.gif' },
  { seedName: '团身卷腹', hasaneyldrmId: '0871', hasaneyldrmName: 'tuck crunch', equipmentEn: 'body weight', targetEn: 'abs', gifUrl: 'videos/0871-BMMolZ3.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0871-BMMolZ3.gif' },
  { seedName: '虫爬', hasaneyldrmId: '1471', hasaneyldrmName: 'inchworm', equipmentEn: 'body weight', targetEn: 'abs', gifUrl: 'videos/1471-ZgsNQ6d.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1471-ZgsNQ6d.gif' },
  { seedName: '脊柱扭转', hasaneyldrmId: '2329', hasaneyldrmName: 'spine twist', equipmentEn: 'body weight', targetEn: 'abs', gifUrl: 'videos/2329-2jl9K55.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/2329-2jl9K55.gif' },
  { seedName: '蛙式卷腹', hasaneyldrmId: '2429', hasaneyldrmName: 'frog crunch', equipmentEn: 'body weight', targetEn: 'abs', gifUrl: 'videos/2429-FFRP97T.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/2429-FFRP97T.gif' },
  { seedName: '卷身起坐', hasaneyldrmId: '3016', hasaneyldrmName: 'curl-up', equipmentEn: 'body weight', targetEn: 'abs', gifUrl: 'videos/3016-g2oKspu.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/3016-g2oKspu.gif' },
  { seedName: '蹲厕式深蹲', hasaneyldrmId: '3119', hasaneyldrmName: 'potty squat', equipmentEn: 'body weight', targetEn: 'abs', gifUrl: 'videos/3119-75Bgtjy.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/3119-75Bgtjy.gif' },
  { seedName: '骨盆倾斜', hasaneyldrmId: '3147', hasaneyldrmName: 'pelvic tilt', equipmentEn: 'body weight', targetEn: 'abs', gifUrl: 'videos/3147-NKJ8o6x.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/3147-NKJ8o6x.gif' },
  { seedName: '前水平悬垂', hasaneyldrmId: '3296', hasaneyldrmName: 'front lever', equipmentEn: 'body weight', targetEn: 'abs', gifUrl: 'videos/3296-PkCN2lv.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/3296-PkCN2lv.gif' },
  { seedName: '全水平支撑', hasaneyldrmId: '3299', hasaneyldrmName: 'full planche', equipmentEn: 'body weight', targetEn: 'abs', gifUrl: 'videos/3299-YZ4961r.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/3299-YZ4961r.gif' },
  { seedName: '倾斜水平支撑', hasaneyldrmId: '3300', hasaneyldrmName: 'lean planche', equipmentEn: 'body weight', targetEn: 'abs', gifUrl: 'videos/3300-LYJodFS.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/3300-LYJodFS.gif' },
  { seedName: '蛙式水平', hasaneyldrmId: '3301', hasaneyldrmName: 'frog planche', equipmentEn: 'body weight', targetEn: 'abs', gifUrl: 'videos/3301-rQhGcin.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/3301-rQhGcin.gif' },
  { seedName: '人旗', hasaneyldrmId: '3303', hasaneyldrmName: 'flag', equipmentEn: 'body weight', targetEn: 'abs', gifUrl: 'videos/3303-pQ0Mx1Z.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/3303-pQ0Mx1Z.gif' },
  { seedName: '全马尔他式', hasaneyldrmId: '3315', hasaneyldrmName: 'full maltese', equipmentEn: 'body weight', targetEn: 'abs', gifUrl: 'videos/3315-YRaCa5Y.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/3315-YRaCa5Y.gif' },
  { seedName: '肩触地', hasaneyldrmId: '3699', hasaneyldrmName: 'shoulder tap', equipmentEn: 'body weight', targetEn: 'abs', gifUrl: 'videos/3699-yRpV5TC.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/3699-yRpV5TC.gif' },
  // G35 user-motion extra — 跪姿健腹轮
  { seedName: '跪姿健腹轮', hasaneyldrmId: '0857', hasaneyldrmName: 'wheel rollerout', equipmentEn: 'wheel roller', targetEn: 'abs', gifUrl: 'videos/0857-NAgVB3t.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0857-NAgVB3t.gif' },

  // ----- 有氧(8)-----
  { seedName: '开合跳波比', hasaneyldrmId: '0501', hasaneyldrmName: 'jack burpee', equipmentEn: 'body weight', targetEn: 'cardiovascular system', gifUrl: 'videos/0501-mr7pkqP.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0501-mr7pkqP.gif' },
  { seedName: '跑步', hasaneyldrmId: '0685', hasaneyldrmName: 'run', equipmentEn: 'body weight', targetEn: 'cardiovascular system', gifUrl: 'videos/0685-oLrKqDH.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/0685-oLrKqDH.gif' },
  { seedName: '波比跳', hasaneyldrmId: '1160', hasaneyldrmName: 'burpee', equipmentEn: 'body weight', targetEn: 'cardiovascular system', gifUrl: 'videos/1160-dK9394r.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/1160-dK9394r.gif' },
  { seedName: '360 度摆荡', hasaneyldrmId: '3318', hasaneyldrmName: 'swing 360', equipmentEn: 'body weight', targetEn: 'cardiovascular system', gifUrl: 'videos/3318-tnaj0mT.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/3318-tnaj0mT.gif' },
  { seedName: '熊爬', hasaneyldrmId: '3360', hasaneyldrmName: 'bear crawl', equipmentEn: 'body weight', targetEn: 'cardiovascular system', gifUrl: 'videos/3360-0Yz8WdV.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/3360-0Yz8WdV.gif' },
  { seedName: '车轮跑', hasaneyldrmId: '3637', hasaneyldrmName: 'wheel run', equipmentEn: 'body weight', targetEn: 'cardiovascular system', gifUrl: 'videos/3637-km2Ljzj.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/3637-km2Ljzj.gif' },
  { seedName: '推起跑', hasaneyldrmId: '3638', hasaneyldrmName: 'push to run', equipmentEn: 'body weight', targetEn: 'cardiovascular system', gifUrl: 'videos/3638-PrQbjvB.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/3638-PrQbjvB.gif' },
  { seedName: '滑雪步', hasaneyldrmId: '3671', hasaneyldrmName: 'ski step', equipmentEn: 'body weight', targetEn: 'cardiovascular system', gifUrl: 'videos/3671-5MRH8H2.gif', bundled: false, cdnUrl: 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/3671-5MRH8H2.gif' },

  // ----- G56 史密斯机动作(9) -----
  { seedName: '史密斯卧推', hasaneyldrmId: '0748', hasaneyldrmName: 'smith bench press', equipmentEn: 'smith machine', targetEn: 'pectorals', gifUrl: 'videos/0748-trqKQv2.gif', assetFileName: '0748-trqKQv2.gif', bundled: true },
  { seedName: '史密斯上斜卧推', hasaneyldrmId: '0757', hasaneyldrmName: 'smith incline bench press', equipmentEn: 'smith machine', targetEn: 'pectorals', gifUrl: 'videos/0757-5v7KYld.gif', assetFileName: '0757-5v7KYld.gif', bundled: true },
  { seedName: '史密斯俯身划船', hasaneyldrmId: '1359', hasaneyldrmName: 'smith bent over row', equipmentEn: 'smith machine', targetEn: 'upper back', gifUrl: 'videos/1359-ZX9UZmj.gif', assetFileName: '1359-ZX9UZmj.gif', bundled: true },
  { seedName: '史密斯坐姿肩推', hasaneyldrmId: '0765', hasaneyldrmName: 'smith seated shoulder press', equipmentEn: 'smith machine', targetEn: 'delts', gifUrl: 'videos/0765-xUwnBMT.gif', assetFileName: '0765-xUwnBMT.gif', bundled: true },
  { seedName: '史密斯深蹲', hasaneyldrmId: '0770', hasaneyldrmName: 'smith squat', equipmentEn: 'smith machine', targetEn: 'glutes', gifUrl: 'videos/0770-jFtipLl.gif', assetFileName: '0770-jFtipLl.gif', bundled: true },
  { seedName: '史密斯硬拉', hasaneyldrmId: '0752', hasaneyldrmName: 'smith deadlift', equipmentEn: 'smith machine', targetEn: 'glutes', gifUrl: 'videos/0752-UfePqpx.gif', assetFileName: '0752-UfePqpx.gif', bundled: true },
  { seedName: '史密斯哈克深蹲', hasaneyldrmId: '0755', hasaneyldrmName: 'smith hack squat', equipmentEn: 'smith machine', targetEn: 'glutes', gifUrl: 'videos/0755-ZuPXtCK.gif', assetFileName: '0755-ZuPXtCK.gif', bundled: true },
  { seedName: '史密斯分腿蹲', hasaneyldrmId: '0768', hasaneyldrmName: 'smith single leg split squat', equipmentEn: 'smith machine', targetEn: 'quads', gifUrl: 'videos/0768-wWFspEi.gif', assetFileName: '0768-wWFspEi.gif', bundled: true },
  { seedName: '史密斯站姿提踵', hasaneyldrmId: '0773', hasaneyldrmName: 'smith standing leg calf raise', equipmentEn: 'smith machine', targetEn: 'calves', gifUrl: 'videos/0773-6MaEjVA.gif', assetFileName: '0773-6MaEjVA.gif', bundled: true },

  // ----- G56 跪姿动作(8) -----
  { seedName: '跪姿单臂弹力带下拉', hasaneyldrmId: '0983', hasaneyldrmName: 'band kneeling one arm pulldown', equipmentEn: 'band', targetEn: 'lats', gifUrl: 'videos/0983-pmnrOp0.gif', assetFileName: '0983-pmnrOp0.gif', bundled: true },
  { seedName: '跪姿高位划船', hasaneyldrmId: '0167', hasaneyldrmName: 'cable high row (kneeling)', equipmentEn: 'cable', targetEn: 'upper back', gifUrl: 'videos/0167-ZSJNetl.gif', assetFileName: '0167-ZSJNetl.gif', bundled: true },
  { seedName: '跪姿绳索卷腹', hasaneyldrmId: '0175', hasaneyldrmName: 'cable kneeling crunch', equipmentEn: 'cable', targetEn: 'abs', gifUrl: 'videos/0175-WW95auq.gif', assetFileName: '0175-WW95auq.gif', bundled: true },
  { seedName: '跪姿绳索后束划船', hasaneyldrmId: '3697', hasaneyldrmName: 'cable kneeling rear delt row (with rope) (male)', equipmentEn: 'cable', targetEn: 'delts', gifUrl: 'videos/3697-G61cXLk.gif', assetFileName: '3697-G61cXLk.gif', bundled: true },
  { seedName: '跪姿绳索三头伸展', hasaneyldrmId: '0176', hasaneyldrmName: 'cable kneeling triceps extension', equipmentEn: 'cable', targetEn: 'triceps', gifUrl: 'videos/0176-KWdF2JI.gif', assetFileName: '0176-KWdF2JI.gif', bundled: true },
  { seedName: '跪姿自重三头伸展', hasaneyldrmId: '1771', hasaneyldrmName: 'bodyweight kneeling triceps extension', equipmentEn: 'body weight', targetEn: 'triceps', gifUrl: 'videos/1771-s0HKO2I.gif', assetFileName: '1771-s0HKO2I.gif', bundled: true },
  { seedName: '跪姿俯卧撑', hasaneyldrmId: '3211', hasaneyldrmName: 'kneeling push-up (male)', equipmentEn: 'body weight', targetEn: 'pectorals', gifUrl: 'videos/3211-ZOuKWir.gif', assetFileName: '3211-ZOuKWir.gif', bundled: true },
  { seedName: '跪姿背阔肌拉伸', hasaneyldrmId: '1346', hasaneyldrmName: 'kneeling lat stretch', equipmentEn: 'body weight', targetEn: 'lats', gifUrl: 'videos/1346-f38OEuO.gif', assetFileName: '1346-f38OEuO.gif', bundled: true },

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
  'stationary bike':  '动感单车',
  'wheel roller':     '健腹轮',
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
