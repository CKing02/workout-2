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
    equipment: '健腹轮',
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
  // ===== G41 扩 250 个 CDN 动作 =====
  // ----- 胸(35)-----
  { name: '缆绳卧推', muscle_group: '胸', secondary_muscles: ['三头', '肩'], equipment: '缆绳', metric_type: 'weight_reps' },
  { name: '缆绳下斜飞鸟', muscle_group: '胸', secondary_muscles: ['三头', '肩'], equipment: '缆绳', metric_type: 'weight_reps' },
  { name: '缆绳上斜飞鸟', muscle_group: '胸', secondary_muscles: ['三头', '肩'], equipment: '缆绳', metric_type: 'weight_reps' },
  { name: '低位缆绳飞鸟', muscle_group: '胸', secondary_muscles: ['三头', '肩'], equipment: '缆绳', metric_type: 'weight_reps' },
  { name: '仰卧缆绳飞鸟', muscle_group: '胸', secondary_muscles: ['三头', '肩'], equipment: '缆绳', metric_type: 'weight_reps' },
  { name: '站姿缆绳飞鸟', muscle_group: '胸', secondary_muscles: ['三头', '肩'], equipment: '缆绳', metric_type: 'weight_reps' },
  { name: '双杠臂屈伸(胸版)', muscle_group: '胸', secondary_muscles: ['三头', '肩'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '时钟俯卧撑', muscle_group: '胸', secondary_muscles: ['三头', '肩'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '下斜俯卧撑', muscle_group: '胸', secondary_muscles: ['三头', '肩'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '哑铃下斜飞鸟', muscle_group: '胸', secondary_muscles: ['三头', '肩'], equipment: '哑铃', metric_type: 'weight_reps' },
  { name: '哑铃上斜飞鸟', muscle_group: '胸', secondary_muscles: ['三头', '肩'], equipment: '哑铃', metric_type: 'weight_reps' },
  { name: '哑铃仰卧上拉', muscle_group: '胸', secondary_muscles: ['三头', '肩'], equipment: '哑铃', metric_type: 'weight_reps' },
  { name: '上斜俯卧撑', muscle_group: '胸', secondary_muscles: ['三头', '肩'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '等长雨刷', muscle_group: '胸', secondary_muscles: ['三头', '肩'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '靠墙俯卧撑 V2', muscle_group: '胸', secondary_muscles: ['三头', '肩'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '靠墙俯卧撑', muscle_group: '胸', secondary_muscles: ['三头', '肩'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '标准俯卧撑', muscle_group: '胸', secondary_muscles: ['三头', '肩'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '拍肩俯卧撑', muscle_group: '胸', secondary_muscles: ['三头', '肩'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '单臂俯卧撑', muscle_group: '胸', secondary_muscles: ['三头', '肩'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '超人俯卧撑', muscle_group: '胸', secondary_muscles: ['三头', '肩'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '悬挂俯卧撑', muscle_group: '胸', secondary_muscles: ['三头', '肩'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '缆绳下斜推举', muscle_group: '胸', secondary_muscles: ['三头', '肩'], equipment: '缆绳', metric_type: 'weight_reps' },
  { name: '击掌俯卧撑', muscle_group: '胸', secondary_muscles: ['三头', '肩'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '深度俯卧撑', muscle_group: '胸', secondary_muscles: ['三头', '肩'], equipment: '哑铃', metric_type: 'weight_reps' },
  { name: '下放俯卧撑', muscle_group: '胸', secondary_muscles: ['三头', '肩'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '等长夹胸', muscle_group: '胸', secondary_muscles: ['三头', '肩'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '爆发俯卧撑', muscle_group: '胸', secondary_muscles: ['三头', '肩'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '宽距俯卧撑', muscle_group: '胸', secondary_muscles: ['三头', '肩'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '上斜肩胛俯卧撑', muscle_group: '胸', secondary_muscles: ['腹'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '肩胛俯卧撑', muscle_group: '胸', secondary_muscles: ['腹'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '加长俯卧撑', muscle_group: '胸', secondary_muscles: ['三头', '肩'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '高位哑铃飞鸟', muscle_group: '胸', secondary_muscles: ['三头', '肩'], equipment: '哑铃', metric_type: 'weight_reps' },
  { name: '韩式臂屈伸', muscle_group: '胸', secondary_muscles: ['三头', '肩'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '弓箭手俯卧撑', muscle_group: '胸', secondary_muscles: ['三头', '肩'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '全水平俯卧撑', muscle_group: '胸', secondary_muscles: ['三头', '肩'], equipment: '自重', metric_type: 'weight_reps' },

  // ----- 背(40)-----
  { name: '杠铃上斜划船', muscle_group: '背', secondary_muscles: ['二头', '肩'], equipment: '杠铃', metric_type: 'weight_reps' },
  { name: '杠铃仰卧上拉', muscle_group: '背', secondary_muscles: ['二头'], equipment: '杠铃', metric_type: 'weight_reps' },
  { name: '缆绳低位坐姿划船', muscle_group: '背', secondary_muscles: ['二头', '肩'], equipment: '缆绳', metric_type: 'weight_reps' },
  { name: '缆绳下拉', muscle_group: '背', secondary_muscles: ['二头'], equipment: '缆绳', metric_type: 'weight_reps' },
  { name: '缆绳后下拉', muscle_group: '背', secondary_muscles: ['二头'], equipment: '缆绳', metric_type: 'weight_reps' },
  { name: '缆绳耸肩', muscle_group: '背', secondary_muscles: ['肩'], equipment: '缆绳', metric_type: 'weight_reps' },
  { name: '缆绳旋转下拉', muscle_group: '背', secondary_muscles: ['二头'], equipment: '缆绳', metric_type: 'weight_reps' },
  { name: '背屈伸', muscle_group: '背', secondary_muscles: ['核心'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '反向划船 V2', muscle_group: '背', secondary_muscles: ['二头', '肩'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '反向划船', muscle_group: '背', secondary_muscles: ['二头', '肩'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '摆动双力臂', muscle_group: '背', secondary_muscles: ['二头'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '杠杆俯身划船', muscle_group: '背', secondary_muscles: ['二头', '肩'], equipment: '杠铃', metric_type: 'weight_reps' },
  { name: '正反握引体', muscle_group: '背', secondary_muscles: ['二头'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '双力臂', muscle_group: '背', secondary_muscles: ['二头'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '单臂反握引体', muscle_group: '背', secondary_muscles: ['二头'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '后拉引体向上', muscle_group: '背', secondary_muscles: ['二头'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '肩胛引体向上', muscle_group: '背', secondary_muscles: ['肩'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '侧摆反握引体', muscle_group: '背', secondary_muscles: ['二头'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '悬挂划船', muscle_group: '背', secondary_muscles: ['二头', '肩'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '缆绳高位划船', muscle_group: '背', secondary_muscles: ['二头', '肩'], equipment: '缆绳', metric_type: 'weight_reps' },
  { name: '反握引体向上', muscle_group: '背', secondary_muscles: ['二头'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '窄距反握引体', muscle_group: '背', secondary_muscles: ['二头'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '下背卷曲', muscle_group: '背', secondary_muscles: ['核心'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '狮身人面式', muscle_group: '背', secondary_muscles: ['核心'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '脊柱拉伸', muscle_group: '背', secondary_muscles: ['核心'], equipment: '自重', metric_type: 'time' },
  { name: '上背拉伸', muscle_group: '背', secondary_muscles: ['二头', '肩'], equipment: '自重', metric_type: 'time' },
  { name: '上犬式', muscle_group: '背', secondary_muscles: ['核心'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '背阔肌拉伸', muscle_group: '背', secondary_muscles: ['二头'], equipment: '自重', metric_type: 'time' },
  { name: '宽距引体向上', muscle_group: '背', secondary_muscles: ['二头'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '单臂毛巾划船', muscle_group: '背', secondary_muscles: ['二头', '肩'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '肩胛下压', muscle_group: '背', secondary_muscles: ['肩'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '杠铃潘德雷划船', muscle_group: '背', secondary_muscles: ['二头', '肩'], equipment: '杠铃', metric_type: 'weight_reps' },
  { name: '仰卧引体向上', muscle_group: '背', secondary_muscles: ['二头'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '引体升降', muscle_group: '背', secondary_muscles: ['二头', '肩'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '弓箭手引体', muscle_group: '背', secondary_muscles: ['二头'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '前水平悬垂(动态)', muscle_group: '背', secondary_muscles: ['二头', '肩'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '水平后悬垂', muscle_group: '背', secondary_muscles: ['二头', '肩'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '猫式旋转', muscle_group: '背', secondary_muscles: ['二头', '肩'], equipment: '自重', metric_type: 'weight_reps' },
  { name: 'L 形引体向上', muscle_group: '背', secondary_muscles: ['二头'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '站姿弓箭手', muscle_group: '背', secondary_muscles: ['二头', '肩'], equipment: '自重', metric_type: 'weight_reps' },
  // G35 user-motion extra — 哑铃俯身划船(双臂 dumbbell bent over row)
  { name: '哑铃俯身划船', muscle_group: '背', secondary_muscles: ['二头', '前臂'], equipment: '哑铃', metric_type: 'weight_reps' },

  // ----- 肩(30)-----
  { name: '杠铃前平举', muscle_group: '肩', secondary_muscles: ['三头', '胸'], equipment: '杠铃', metric_type: 'weight_reps' },
  { name: '杠铃单臂抓举', muscle_group: '肩', secondary_muscles: ['三头', '胸'], equipment: '杠铃', metric_type: 'weight_reps' },
  { name: '杠铃俯身侧平举', muscle_group: '肩', secondary_muscles: ['三头', '胸'], equipment: '杠铃', metric_type: 'weight_reps' },
  { name: '杠铃俯身划船', muscle_group: '肩', secondary_muscles: ['三头', '胸'], equipment: '杠铃', metric_type: 'weight_reps' },
  { name: '杠铃滑雪式', muscle_group: '肩', secondary_muscles: ['三头', '胸'], equipment: '杠铃', metric_type: 'weight_reps' },
  { name: '杠铃直立划船 V2', muscle_group: '肩', secondary_muscles: ['三头', '胸'], equipment: '杠铃', metric_type: 'weight_reps' },
  { name: '杠铃直立划船', muscle_group: '肩', secondary_muscles: ['三头', '胸'], equipment: '杠铃', metric_type: 'weight_reps' },
  { name: '杠铃直立划船 V3', muscle_group: '肩', secondary_muscles: ['三头', '胸'], equipment: '杠铃', metric_type: 'weight_reps' },
  { name: '缆绳前举', muscle_group: '肩', secondary_muscles: ['三头', '胸'], equipment: '缆绳', metric_type: 'weight_reps' },
  { name: '缆绳前平举', muscle_group: '肩', secondary_muscles: ['三头', '胸'], equipment: '缆绳', metric_type: 'weight_reps' },
  { name: '缆绳侧平举', muscle_group: '肩', secondary_muscles: ['三头', '胸'], equipment: '缆绳', metric_type: 'weight_reps' },
  { name: '缆绳肩推', muscle_group: '肩', secondary_muscles: ['三头', '胸'], equipment: '缆绳', metric_type: 'weight_reps' },
  { name: '缆绳仰卧后飞鸟', muscle_group: '肩', secondary_muscles: ['三头', '胸'], equipment: '缆绳', metric_type: 'weight_reps' },
  { name: '缆绳直立划船', muscle_group: '肩', secondary_muscles: ['三头', '胸'], equipment: '缆绳', metric_type: 'weight_reps' },
  { name: '哑铃古巴推举', muscle_group: '肩', secondary_muscles: ['三头', '胸'], equipment: '哑铃', metric_type: 'weight_reps' },
  { name: '哑铃上斜前举', muscle_group: '肩', secondary_muscles: ['三头', '胸'], equipment: '哑铃', metric_type: 'weight_reps' },
  { name: '哑铃铁十字', muscle_group: '肩', secondary_muscles: ['三头', '胸'], equipment: '哑铃', metric_type: 'weight_reps' },
  { name: '哑铃前举', muscle_group: '肩', secondary_muscles: ['三头', '胸'], equipment: '哑铃', metric_type: 'weight_reps' },
  { name: '哑铃俯身后飞鸟', muscle_group: '肩', secondary_muscles: ['三头', '胸'], equipment: '哑铃', metric_type: 'weight_reps' },
  { name: '哑铃直立划船', muscle_group: '肩', secondary_muscles: ['三头', '胸'], equipment: '哑铃', metric_type: 'weight_reps' },
  { name: '哑铃 W 推举', muscle_group: '肩', secondary_muscles: ['三头', '胸'], equipment: '哑铃', metric_type: 'weight_reps' },
  { name: '后束三角肌拉伸', muscle_group: '肩', secondary_muscles: ['三头', '胸'], equipment: '自重', metric_type: 'time' },
  { name: '哑铃借力推', muscle_group: '肩', secondary_muscles: ['三头', '胸'], equipment: '哑铃', metric_type: 'weight_reps' },
  { name: '哑铃阿诺德推举', muscle_group: '肩', secondary_muscles: ['三头', '胸'], equipment: '哑铃', metric_type: 'weight_reps' },
  { name: '左勾拳', muscle_group: '肩', secondary_muscles: ['三头', '胸'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '哑铃俯身侧平举', muscle_group: '肩', secondary_muscles: ['三头', '胸'], equipment: '哑铃', metric_type: 'weight_reps' },
  { name: '哑铃斯科特推举', muscle_group: '肩', secondary_muscles: ['三头', '胸'], equipment: '哑铃', metric_type: 'weight_reps' },
  { name: '地雷管侧平举', muscle_group: '肩', secondary_muscles: ['三头', '胸'], equipment: '杠铃', metric_type: 'weight_reps' },
  { name: '杠铃借力推', muscle_group: '肩', secondary_muscles: ['三头', '胸'], equipment: '杠铃', metric_type: 'weight_reps' },
  { name: '哑铃上斜 T 举', muscle_group: '肩', secondary_muscles: ['三头', '胸'], equipment: '哑铃', metric_type: 'weight_reps' },

  // ----- 臂(上臂)(50)-----
  { name: '杠铃拖拽弯举', muscle_group: '二头', secondary_muscles: ['前臂'], equipment: '杠铃', metric_type: 'weight_reps' },
  { name: '杠铃 JM 卧推', muscle_group: '三头', secondary_muscles: ['肩', '胸'], equipment: '杠铃', metric_type: 'weight_reps' },
  { name: '杠铃仰卧臂屈伸', muscle_group: '三头', secondary_muscles: ['肩', '胸'], equipment: '杠铃', metric_type: 'weight_reps' },
  { name: '杠铃反握弯举', muscle_group: '二头', secondary_muscles: ['前臂'], equipment: '杠铃', metric_type: 'weight_reps' },
  { name: '屈膝长凳臂屈伸', muscle_group: '三头', secondary_muscles: ['肩', '胸'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '俯撑起身', muscle_group: '三头', secondary_muscles: ['肩', '胸'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '窄距二头引体', muscle_group: '二头', secondary_muscles: ['前臂'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '二头引体', muscle_group: '二头', secondary_muscles: ['前臂'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '缆绳单臂弯举', muscle_group: '二头', secondary_muscles: ['前臂'], equipment: '缆绳', metric_type: 'weight_reps' },
  { name: '缆绳牧师凳弯举', muscle_group: '二头', secondary_muscles: ['前臂'], equipment: '缆绳', metric_type: 'weight_reps' },
  { name: '缆绳下压', muscle_group: '三头', secondary_muscles: ['肩', '胸'], equipment: '缆绳', metric_type: 'weight_reps' },
  { name: '缆绳后驱', muscle_group: '三头', secondary_muscles: ['肩', '胸'], equipment: '缆绳', metric_type: 'weight_reps' },
  { name: '缆绳反握弯举', muscle_group: '二头', secondary_muscles: ['前臂'], equipment: '缆绳', metric_type: 'weight_reps' },
  { name: '窄距俯卧撑', muscle_group: '三头', secondary_muscles: ['肩', '胸'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '钻石俯卧撑', muscle_group: '三头', secondary_muscles: ['肩', '胸'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '哑铃标准弯举', muscle_group: '二头', secondary_muscles: ['前臂'], equipment: '哑铃', metric_type: 'weight_reps' },
  { name: '哑铃锤式弯举', muscle_group: '二头', secondary_muscles: ['前臂'], equipment: '哑铃', metric_type: 'weight_reps' },
  { name: '上斜哑铃弯举', muscle_group: '二头', secondary_muscles: ['前臂'], equipment: '哑铃', metric_type: 'weight_reps' },
  { name: '哑铃后踢', muscle_group: '三头', secondary_muscles: ['肩', '胸'], equipment: '哑铃', metric_type: 'weight_reps' },
  { name: '哑铃牧师凳弯举', muscle_group: '二头', secondary_muscles: ['前臂'], equipment: '哑铃', metric_type: 'weight_reps' },
  { name: '坐姿哑铃弯举', muscle_group: '二头', secondary_muscles: ['前臂'], equipment: '哑铃', metric_type: 'weight_reps' },
  { name: '哑铃泰特推举', muscle_group: '三头', secondary_muscles: ['肩', '胸'], equipment: '哑铃', metric_type: 'weight_reps' },
  { name: '哑铃佐特曼弯举', muscle_group: '二头', secondary_muscles: ['前臂'], equipment: '哑铃', metric_type: 'weight_reps' },
  { name: '倒立俯卧撑', muscle_group: '三头', secondary_muscles: ['肩', '胸'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '单臂臂屈伸', muscle_group: '三头', secondary_muscles: ['肩', '胸'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '反握臂屈伸', muscle_group: '三头', secondary_muscles: ['肩', '胸'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '吊环臂屈伸', muscle_group: '三头', secondary_muscles: ['肩', '胸'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '侧身俯卧撑', muscle_group: '三头', secondary_muscles: ['肩', '胸'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '长凳腿屈伸臂屈伸', muscle_group: '三头', secondary_muscles: ['肩', '胸'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '三头肌臂屈伸', muscle_group: '三头', secondary_muscles: ['肩', '胸'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '地面三头肌臂屈伸', muscle_group: '三头', secondary_muscles: ['肩', '胸'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '三头肌推举', muscle_group: '三头', secondary_muscles: ['肩', '胸'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '三头肌拉伸', muscle_group: '三头', secondary_muscles: ['肩', '胸'], equipment: '自重', metric_type: 'time' },
  { name: '缆绳后踢', muscle_group: '三头', secondary_muscles: ['肩', '胸'], equipment: '缆绳', metric_type: 'weight_reps' },
  { name: '缆绳弯举', muscle_group: '二头', secondary_muscles: ['前臂'], equipment: '缆绳', metric_type: 'weight_reps' },
  { name: '地面长凳臂屈伸', muscle_group: '三头', secondary_muscles: ['肩', '胸'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '前臂俯卧撑', muscle_group: '三头', secondary_muscles: ['肩', '胸'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '缆绳窄距弯举', muscle_group: '二头', secondary_muscles: ['前臂'], equipment: '缆绳', metric_type: 'weight_reps' },
  { name: '缆绳集中弯举', muscle_group: '二头', secondary_muscles: ['前臂'], equipment: '缆绳', metric_type: 'weight_reps' },
  { name: '缆绳拖拽弯举', muscle_group: '二头', secondary_muscles: ['前臂'], equipment: '缆绳', metric_type: 'weight_reps' },
  { name: '缆绳仰卧弯举', muscle_group: '二头', secondary_muscles: ['前臂'], equipment: '缆绳', metric_type: 'weight_reps' },
  { name: '缆绳过头弯举', muscle_group: '二头', secondary_muscles: ['前臂'], equipment: '缆绳', metric_type: 'weight_reps' },
  { name: '坐姿缆绳弯举', muscle_group: '二头', secondary_muscles: ['前臂'], equipment: '缆绳', metric_type: 'weight_reps' },
  { name: '缆绳深蹲弯举', muscle_group: '二头', secondary_muscles: ['前臂'], equipment: '缆绳', metric_type: 'weight_reps' },
  { name: '哑铃高弯举', muscle_group: '二头', secondary_muscles: ['前臂'], equipment: '哑铃', metric_type: 'weight_reps' },
  { name: '杠铃架上推举', muscle_group: '三头', secondary_muscles: ['肩', '胸'], equipment: '杠铃', metric_type: 'weight_reps' },
  { name: '三凳臂屈伸', muscle_group: '三头', secondary_muscles: ['肩', '胸'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '极限臂屈伸', muscle_group: '三头', secondary_muscles: ['肩', '胸'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '施塔德推举', muscle_group: '三头', secondary_muscles: ['肩', '胸'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '倒立', muscle_group: '三头', secondary_muscles: ['肩', '胸'], equipment: '自重', metric_type: 'weight_reps' },

  // ----- 腿(股四/臀/腘)(45)-----
  { name: '平衡板', muscle_group: '股四头', secondary_muscles: ['臀', '腘绳'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '杠铃卧式深蹲', muscle_group: '股四头', secondary_muscles: ['臀', '腘绳'], equipment: '杠铃', metric_type: 'weight_reps' },
  { name: '杠铃前蹲', muscle_group: '臀', secondary_muscles: ['腘绳', '股四头'], equipment: '杠铃', metric_type: 'weight_reps' },
  { name: '杠铃反向深蹲', muscle_group: '臀', secondary_muscles: ['腘绳', '股四头'], equipment: '杠铃', metric_type: 'weight_reps' },
  { name: '杠铃跳跃深蹲', muscle_group: '臀', secondary_muscles: ['腘绳', '股四头'], equipment: '杠铃', metric_type: 'weight_reps' },
  { name: '杠铃弓步蹲', muscle_group: '臀', secondary_muscles: ['腘绳', '股四头'], equipment: '杠铃', metric_type: 'weight_reps' },
  { name: '杠铃架上硬拉', muscle_group: '臀', secondary_muscles: ['腘绳', '股四头'], equipment: '杠铃', metric_type: 'weight_reps' },
  { name: '杠铃后弓步', muscle_group: '臀', secondary_muscles: ['腘绳', '股四头'], equipment: '杠铃', metric_type: 'weight_reps' },
  { name: '杠铃速度深蹲', muscle_group: '臀', secondary_muscles: ['腘绳', '股四头'], equipment: '杠铃', metric_type: 'weight_reps' },
  { name: '杠铃上阶', muscle_group: '臀', secondary_muscles: ['腘绳', '股四头'], equipment: '杠铃', metric_type: 'weight_reps' },
  { name: '杠铃宽距深蹲', muscle_group: '股四头', secondary_muscles: ['臀', '腘绳'], equipment: '杠铃', metric_type: 'weight_reps' },
  { name: '缆绳硬拉', muscle_group: '臀', secondary_muscles: ['腘绳', '股四头'], equipment: '缆绳', metric_type: 'weight_reps' },
  { name: '哑铃高翻', muscle_group: '臀', secondary_muscles: ['腘绳', '股四头'], equipment: '哑铃', metric_type: 'weight_reps' },
  { name: '哑铃硬拉', muscle_group: '臀', secondary_muscles: ['腘绳', '股四头'], equipment: '哑铃', metric_type: 'weight_reps' },
  { name: '哑铃深蹲', muscle_group: '臀', secondary_muscles: ['腘绳', '股四头'], equipment: '哑铃', metric_type: 'weight_reps' },
  { name: '哑铃上阶', muscle_group: '臀', secondary_muscles: ['腘绳', '股四头'], equipment: '哑铃', metric_type: 'weight_reps' },
  { name: '踢腿', muscle_group: '臀', secondary_muscles: ['腘绳', '股四头'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '跳跃深蹲 V2', muscle_group: '臀', secondary_muscles: ['腘绳', '股四头'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '跳跃深蹲', muscle_group: '臀', secondary_muscles: ['腘绳', '股四头'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '坐姿外摆腿', muscle_group: '腘绳', secondary_muscles: ['臀', '股四头'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '靠墙踏步', muscle_group: '臀', secondary_muscles: ['腘绳', '股四头'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '怪兽步', muscle_group: '臀', secondary_muscles: ['腘绳', '股四头'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '高翻', muscle_group: '腘绳', secondary_muscles: ['臀', '股四头'], equipment: '杠铃', metric_type: 'weight_reps' },
  { name: '侧向外展', muscle_group: '臀', secondary_muscles: ['股四头'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '抓举式硬拉', muscle_group: '股四头', secondary_muscles: ['臀', '腘绳'], equipment: '杠铃', metric_type: 'weight_reps' },
  { name: '借力挺蹲举', muscle_group: '股四头', secondary_muscles: ['臀', '腘绳'], equipment: '杠铃', metric_type: 'weight_reps' },
  { name: '抱膝贴胸', muscle_group: '臀', secondary_muscles: ['腘绳', '股四头'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '铁十字拉伸', muscle_group: '臀', secondary_muscles: ['腘绳', '股四头'], equipment: '自重', metric_type: 'time' },
  { name: '行走弓步蹲', muscle_group: '臀', secondary_muscles: ['腘绳', '股四头'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '扭转臀桥', muscle_group: '臀', secondary_muscles: ['腘绳', '股四头'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '前向跳跃', muscle_group: '股四头', secondary_muscles: ['臀', '腘绳'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '后向跳跃', muscle_group: '股四头', secondary_muscles: ['臀', '腘绳'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '单腿深蹲', muscle_group: '臀', secondary_muscles: ['腘绳', '股四头'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '西式深蹲', muscle_group: '股四头', secondary_muscles: ['臀', '腘绳'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '腘绳肌拉伸', muscle_group: '腘绳', secondary_muscles: ['臀', '股四头'], equipment: '自重', metric_type: 'time' },
  { name: '跑者拉伸', muscle_group: '腘绳', secondary_muscles: ['臀', '股四头'], equipment: '自重', metric_type: 'time' },
  { name: '农夫行走', muscle_group: '股四头', secondary_muscles: ['臀', '腘绳'], equipment: '哑铃', metric_type: 'weight_reps' },
  { name: '分腿蹲', muscle_group: '股四头', secondary_muscles: ['臀', '腘绳'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '腿弯举臀桥', muscle_group: '腘绳', secondary_muscles: ['臀', '股四头'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '弗兰肯斯坦深蹲', muscle_group: '臀', secondary_muscles: ['腘绳', '股四头'], equipment: '杠铃', metric_type: 'weight_reps' },
  { name: '股四头肌拉伸', muscle_group: '股四头', secondary_muscles: ['臀', '腘绳'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '快速步伐 V2', muscle_group: '股四头', secondary_muscles: ['臀', '腘绳'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '臀桥踏步', muscle_group: '臀', secondary_muscles: ['腘绳', '股四头'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '跳跃弓步', muscle_group: '臀', secondary_muscles: ['腘绳', '股四头'], equipment: '自重', metric_type: 'weight_reps' },
  { name: '屈膝礼深蹲', muscle_group: '臀', secondary_muscles: ['腘绳', '股四头'], equipment: '自重', metric_type: 'weight_reps' },
  // G35 user-motion extra — 哑铃罗马尼亚硬拉 + 杠铃臀桥(哑铃臀桥 source 数据无对应,最相似用 杠铃版)
  { name: '哑铃罗马尼亚硬拉', muscle_group: '腘绳', secondary_muscles: ['背', '臀'], equipment: '哑铃', metric_type: 'weight_reps' },
  { name: '杠铃臀桥', muscle_group: '臀', secondary_muscles: ['腘绳', '股四头'], equipment: '杠铃', metric_type: 'weight_reps' },

  // ----- 腿(小腿)(12)-----
  { name: '坐姿杠铃提踵', muscle_group: '小腿', secondary_muscles: [], equipment: '杠铃', metric_type: 'weight_reps' },
  { name: '膝盖环绕拉伸', muscle_group: '小腿', secondary_muscles: [], equipment: '自重', metric_type: 'time' },
  { name: '驴式提踵', muscle_group: '小腿', secondary_muscles: [], equipment: '自重', metric_type: 'weight_reps' },
  { name: '脚踝环绕', muscle_group: '小腿', secondary_muscles: [], equipment: '自重', metric_type: 'weight_reps' },
  { name: '杠铃地面提踵', muscle_group: '小腿', secondary_muscles: [], equipment: '杠铃', metric_type: 'weight_reps' },
  { name: '坐姿杠铃提踵 V2', muscle_group: '小腿', secondary_muscles: [], equipment: '杠铃', metric_type: 'weight_reps' },
  { name: '杠铃站姿提踵', muscle_group: '小腿', secondary_muscles: [], equipment: '杠铃', metric_type: 'weight_reps' },
  { name: '缆绳站姿提踵', muscle_group: '小腿', secondary_muscles: [], equipment: '缆绳', metric_type: 'weight_reps' },
  { name: '单腿驴式提踵', muscle_group: '小腿', secondary_muscles: [], equipment: '自重', metric_type: 'weight_reps' },
  { name: '单腿地面提踵', muscle_group: '小腿', secondary_muscles: [], equipment: '自重', metric_type: 'weight_reps' },
  { name: '坐姿小腿拉伸', muscle_group: '小腿', secondary_muscles: [], equipment: '自重', metric_type: 'time' },
  { name: '站姿提踵(快速)', muscle_group: '小腿', secondary_muscles: [], equipment: '自重', metric_type: 'weight_reps' },

  // ----- 核心(30)-----
  { name: '四分之三仰卧起坐', muscle_group: '腹', secondary_muscles: [], equipment: '自重', metric_type: 'weight_reps' },
  { name: '45 度侧弯', muscle_group: '腹', secondary_muscles: [], equipment: '自重', metric_type: 'weight_reps' },
  { name: '空中自行车', muscle_group: '腹', secondary_muscles: [], equipment: '自重', metric_type: 'weight_reps' },
  { name: '仰卧抬腿', muscle_group: '腹', secondary_muscles: [], equipment: '自重', metric_type: 'weight_reps' },
  { name: '缆绳扭转', muscle_group: '腹', secondary_muscles: [], equipment: '缆绳', metric_type: 'weight_reps' },
  { name: '蜷腹抱膝', muscle_group: '腹', secondary_muscles: [], equipment: '自重', metric_type: 'weight_reps' },
  { name: '死虫式', muscle_group: '腹', secondary_muscles: [], equipment: '自重', metric_type: 'weight_reps' },
  { name: '猩猩抬腿', muscle_group: '腹', secondary_muscles: [], equipment: '自重', metric_type: 'weight_reps' },
  { name: '腹股沟卷腹', muscle_group: '腹', secondary_muscles: [], equipment: '自重', metric_type: 'weight_reps' },
  { name: '悬挂收腿', muscle_group: '腹', secondary_muscles: [], equipment: '自重', metric_type: 'weight_reps' },
  { name: '扬达仰卧起坐', muscle_group: '腹', secondary_muscles: [], equipment: '自重', metric_type: 'weight_reps' },
  { name: '地雷管 180', muscle_group: '腹', secondary_muscles: [], equipment: '杠铃', metric_type: 'weight_reps' },
  { name: '仰卧起坐 V2', muscle_group: '腹', secondary_muscles: [], equipment: '自重', metric_type: 'weight_reps' },
  { name: '咒语者', muscle_group: '腹', secondary_muscles: [], equipment: '哑铃', metric_type: 'weight_reps' },
  { name: '冲刺跑', muscle_group: '腹', secondary_muscles: [], equipment: '自重', metric_type: 'weight_reps' },
  { name: '臀顶', muscle_group: '腹', secondary_muscles: [], equipment: '自重', metric_type: 'weight_reps' },
  { name: '团身卷腹', muscle_group: '腹', secondary_muscles: [], equipment: '自重', metric_type: 'weight_reps' },
  { name: '虫爬', muscle_group: '腹', secondary_muscles: [], equipment: '自重', metric_type: 'weight_reps' },
  { name: '脊柱扭转', muscle_group: '腹', secondary_muscles: [], equipment: '自重', metric_type: 'weight_reps' },
  { name: '蛙式卷腹', muscle_group: '腹', secondary_muscles: [], equipment: '自重', metric_type: 'weight_reps' },
  { name: '卷身起坐', muscle_group: '腹', secondary_muscles: [], equipment: '自重', metric_type: 'weight_reps' },
  { name: '蹲厕式深蹲', muscle_group: '腹', secondary_muscles: [], equipment: '自重', metric_type: 'weight_reps' },
  { name: '骨盆倾斜', muscle_group: '腹', secondary_muscles: [], equipment: '自重', metric_type: 'weight_reps' },
  { name: '前水平悬垂', muscle_group: '腹', secondary_muscles: [], equipment: '自重', metric_type: 'weight_reps' },
  { name: '全水平支撑', muscle_group: '腹', secondary_muscles: [], equipment: '自重', metric_type: 'weight_reps' },
  { name: '倾斜水平支撑', muscle_group: '腹', secondary_muscles: [], equipment: '自重', metric_type: 'weight_reps' },
  { name: '蛙式水平', muscle_group: '腹', secondary_muscles: [], equipment: '自重', metric_type: 'weight_reps' },
  { name: '人旗', muscle_group: '腹', secondary_muscles: [], equipment: '自重', metric_type: 'weight_reps' },
  { name: '全马尔他式', muscle_group: '腹', secondary_muscles: [], equipment: '自重', metric_type: 'weight_reps' },
  { name: '肩触地', muscle_group: '腹', secondary_muscles: [], equipment: '自重', metric_type: 'weight_reps' },
  // G35 user-motion extra — 跪姿健腹轮(标准双膝跪地 ab wheel rollout)
  { name: '跪姿健腹轮', muscle_group: '腹', secondary_muscles: ['背'], equipment: '健腹轮', metric_type: 'weight_reps' },

  // ----- 有氧(8)-----
  { name: '开合跳波比', muscle_group: '全身', secondary_muscles: [], equipment: '自重', metric_type: 'time' },
  { name: '跑步', muscle_group: '全身', secondary_muscles: [], equipment: '自重', metric_type: 'km' },
  { name: '波比跳', muscle_group: '全身', secondary_muscles: [], equipment: '自重', metric_type: 'time' },
  { name: '360 度摆荡', muscle_group: '全身', secondary_muscles: [], equipment: '自重', metric_type: 'time' },
  { name: '熊爬', muscle_group: '全身', secondary_muscles: [], equipment: '自重', metric_type: 'time' },
  { name: '车轮跑', muscle_group: '全身', secondary_muscles: [], equipment: '自重', metric_type: 'km' },
  { name: '推起跑', muscle_group: '全身', secondary_muscles: [], equipment: '自重', metric_type: 'km' },
  { name: '滑雪步', muscle_group: '全身', secondary_muscles: [], equipment: '自重', metric_type: 'time' },

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
      //   bundled === false → cdnUrl(原始 https URL),走 getCachedOrDownload
      //
      // G41: 250 个 bundled:false 入库 → gif_url 是 R2 完整 URL,首次访问由
      // ExerciseGifImage 走 LRU cache(200MB 阈值),二次秒开。
      gif_url: mapping.bundled
        ? (mapping.assetFileName ? `asset:${mapping.assetFileName}` : null)
        : (mapping.cdnUrl ?? null),
      target_zh: translateTarget(mapping.targetEn),
      attribution: '© Gym visual — https://gymvisual.com/',
    };
  });
}
