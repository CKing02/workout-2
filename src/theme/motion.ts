/**
 * G46 — Design Tokens · Motion（动效 token）。
 *
 * 这是「质感打磨 · 第一阶段」新增的动效 Design Token 层，只导出**纯值**——任何
 * 业务调用点用 `withTiming(value, { duration: motion.duration.base, easing: motion.easing.standard })`
 * 或 `withSpring(value, motion.springs.gentle)` 即可。本文件无 React hook、无副作用、无
 * worklet；**G47** 才把它接到现有 21 处硬编码上。
 *
 * 设计参考：Material 3 motion spec（https://m3.material.io/styles/motion/overview）。
 * 核心精神是「克制、聚焦、避免动画分散注意力」。
 *
 * ------
 *
 * ## 为何选 260ms 作为 `duration.base`？
 *
 * Material 3 的中位过渡时长是 200–300ms。健身场景有特殊性：用户手上有汗/粉/戴手套，
 * 弹性动画（bounce / overshoot）会干扰判断 —— "它到底停没停？"这种疑问在训练中
 * 翻动"组数 / 重量 / 用时"等数字时会让人分神。
 *
 * 因此 base = **260ms**：比 Material 典型中位略长，让数字「翻得动」、看得出过程；
 * 又比 400ms 慢速动作快，跟得上训练节拍。
 *
 * ## 为何 default spring 选 `gentle`（无 bounce）？
 *
 * iOS HIG 的 spring（Reanimated 4 `WigglySpringConfig` damping=90 / stiffness=900）
 * 有明显 overshoot —— 好看，但对力量训练场景是干扰：用户看到数字翻动 / PR 抖动 / 卡片
 * 切换时，overshoot 会让人怀疑「它没停稳」。我们用 **临界阻尼**
 * (`damping=20, stiffness=180`) —— 完全无 bounce，落位即完成。
 *
 * `snappy` (`damping=15, stiffness=300`) 给按钮按下用：响应更快、给出"已确认"
 * 的物理反馈，但仍无 overshoot（over-critical damping）。
 *
 * 健身场景共同的判据：**响应要快、回弹要稳**。这就是 G46 不学 iOS HIG 的根本原因。
 */

import { Easing } from 'react-native-reanimated';

/** 过渡时长（毫秒）。 */
export const duration = {
  /** 状态切换（如 selected → pressed），最快但仍可见。 */
  instant: 100,
  /** 按钮按下、小元素反馈。 */
  fast: 180,
  /** 标准过渡（默认，作用于绝大多数交互元素）。 */
  base: 260,
  /** 强调动作（卡片展开 / 模态入场）。 */
  slow: 400,
  /** 横幅、对话框、训练完成页入场。 */
  emphasis: 600,
} as const;

export type DurationKey = keyof typeof duration;

/**
 * Material 3 标准 cubic-bezier 曲线。
 *
 * 注意：Reanimated 4 下 `Easing.bezier(...)` 返回 **`EasingFunctionFactory`**
 * （worklet 端会通过 `.factory()` 解包），请保持原样赋值，**不要**手动解包。
 */
export const easing = {
  /** 默认：标准过渡。`cubic-bezier(0.2, 0, 0, 1)`。 */
  standard: Easing.bezier(0.2, 0, 0, 1),
  /** 入场（屏幕 / 元素进入）。`cubic-bezier(0, 0, 0, 1)`。 */
  decelerate: Easing.bezier(0, 0, 0, 1),
  /** 离场（屏幕 / 元素退出）。`cubic-bezier(0.3, 0, 1, 1)`。 */
  accelerate: Easing.bezier(0.3, 0, 1, 1),
} as const;

export type EasingKey = keyof typeof easing;

/** Spring 配置：临界阻尼，无 overshoot。 */
export const springs = {
  /** 默认：温和、稳定。无 bounce —— 数字/卡片落位即停。 */
  gentle: { damping: 20, stiffness: 180 },
  /** 按钮按下：响应更快，仍无 overshoot（over-critical damping）。 */
  snappy: { damping: 15, stiffness: 300 },
} as const;

export type SpringKey = keyof typeof springs;

/** 顶层 namespace —— 业务代码优先用 `motion.xxx`。 */
export const motion = { duration, easing, springs } as const;
