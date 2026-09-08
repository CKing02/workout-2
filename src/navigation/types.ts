/**
 * Navigation param lists.
 *
 * Single source of truth so screens and navigators share the same type
 * expectations. Importing this module is dependency-free (only `@react-navigation/native`).
 */

import type { NavigatorScreenParams } from '@react-navigation/native';

export type ExerciseLibraryMode = 'single' | 'multiple' | 'browse';

export interface ExerciseLibraryParams {
  /** Selection mode. Defaults to `'multiple'` in G4. */
  mode?: ExerciseLibraryMode;
  /** Pre-selected exercise IDs (used by G5 to re-open and add more). */
  initialSelectedIds?: string[];
  /**
   * Header title override. G11 opens the library as a picker titled
   * "选择训练动作"; omitting it keeps the default "动作库".
   */
  title?: string;
  /**
   * Optional callback when used as a picker. If provided, the screen will
   * invoke this with the selected IDs and pop instead of round-tripping
   * via Tabs.params (which is what G4 used for G5 integration).
   *
   * Picker mode also requires ≥1 selection before 完成 becomes enabled
   * (G11 AC-11.1) — the G4 round-trip path still allows an empty array.
   *
   * NOTE: functions in route params are non-serializable, so React
   * Navigation logs a dev-only warning. Acceptable here because this app
   * never persists/restores navigation state (see 已知问题 in the G11 report).
   */
  onSelect?: (selectedIds: string[]) => void;
}

/** Bottom-tab destinations. */
export type TabParamList = {
  Home: undefined;
  /**
   * Training tab — receives `selectedExerciseIds` after a round-trip to
   * the exercise library. The screen displays an Alert (G4 acceptance) and
   * G5 will hook this into the plan editor.
   */
  Training: { selectedExerciseIds?: string[] } | undefined;
  Profile: undefined;
};

/**
 * Plan editor route params.
 * - `planId` omitted  -> create a new plan
 * - `planId` provided -> edit the existing plan with that id
 */
export interface PlanEditorParams {
  planId?: string;
}

/**
 * G8: 训练完成总结页 params.
 *
 * 完成训练后 `navigation.replace('TrainingComplete', params)` 进入.
 * 页内不调用 DB —— 数据已经由 `completeTraining()` 写入历史.
 */
export interface TrainingCompleteParams {
  trainingId: string;
  /** 时长（秒）。 */
  durationSeconds: number;
  /** 总训练量（kg）。 */
  totalVolume: number;
  /** 动作数. */
  exerciseCount: number;
  /** 完成组数（仅统计 `completed=true` 的组）。 */
  setCount: number;
  /** 计划名快照，便于摘要展示。 */
  planNameSnapshot?: string | null;
}

/** Root native-stack destinations. */
export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  ExerciseLibrary: ExerciseLibraryParams | undefined;
  /** G10: 设置（Stack 屏，从"我的" Tab 进入）。 */
  Settings: undefined;
  /** G13: 诊断面板 — 查看应用内自动捕获的 JS / Promise 错误。 */
  Diagnostics: undefined;
  /** G5: 新建 / 编辑计划（锻炼 Tab 进入）。 */
  PlanEditor: PlanEditorParams | undefined;
  /** G6: 训练中页（全屏沉浸；Tab 之上的一层）。 */
  ActiveTraining: ActiveTrainingParams | undefined;
  /** G8: 训练完成总结页（全屏沉浸；必须在 ActiveTraining 之上）。 */
  TrainingComplete: TrainingCompleteParams;
  /** G9: 训练详情（首页 Tab 点击历史训练进入；只读）。 */
  TrainingDetail: TrainingDetailParams | undefined;
  /**
   * G20: 组件 Showcase（开发期自检页）。从 Profile 屏幕底部版本号
   * 进入；普通用户不会发现。**不进入生产 build** 的开关建议后续用
   * `__DEV__` 守卫或 release channel 控制。
   */
  Showcase: undefined;
  /** G18: 数据可视化总览（从 Profile 进入）。 */
  DataOverview: undefined;
  /** G18: 日历热力图（过去 12 周每日训练量）。 */
  CalendarHeatmap: undefined;
  /** G18: 训练量趋势（按周柱状）。 */
  VolumeTrend: undefined;
  /** G18: 肌群分布（按总训练量占比饼图）。 */
  MuscleGroupDistribution: undefined;
  /** G18: 1RM 记录（按动作聚合最高估算 1RM）。 */
  OneRMRecords: undefined;
  /**
   * G32: 单动作历史下钻（1RM 趋势线 + 容量柱状 + 时间区间切换）。
   * 入口：我的 → 数据概览 → 「按动作」Tab → 点动作行。
   */
  ExerciseHistory: { exerciseId: string };
  /**
   * G35 §4: 动作详情正式屏（接 32 个 seed 的 GIF + 中文步骤 + 署名）。
   * 入口:
   *   - 我的 → 「动作详情」(ProfileScreen 替掉原 G34 Pilot 入口)
   *   - 动作库(browse mode)→ 点任意一行 → navigate('ExerciseDetail', { exerciseId })
   */
  ExerciseDetail: { exerciseId: string };
};

/**
 * G6: Active training route params.
 *
 * - `planId`        — start training based on a saved plan (the typical
 *                     Training-tab entry). `loadDetail` pulls exercises +
 *                     in-memory sets; if there are no editor sets, we
 *                     seed one empty set per exercise.
 * - `exerciseIds`   — explicit list (free-training preview; G6 forwards as
 *                     a hint only). Unused by G11 — see `mode` below.
 * - `mode`          — `'free'` marks a G11 自由训练 session. In that case
 *                     `TrainingScreen` has **already** called
 *                     `trainingStore.startTraining({ planId: null, ... })`
 *                     before navigating, so the screen finds a non-null
 *                     `activeTraining` on mount and skips its plan
 *                     bootstrap entirely (no `planId` needed).
 *                     Defaults to `'plan'` when omitted.
 */
export interface ActiveTrainingParams {
  planId?: string;
  exerciseIds?: string[];
  mode?: 'plan' | 'free';
}

/**
 * G9: Training-detail route params.
 *
 * - `trainingId` — the row in `trainings` to render (read-only).
 */
export interface TrainingDetailParams {
  trainingId: string;
}