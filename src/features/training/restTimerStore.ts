/**
 * G7 — 休息计时器 Store（模块级 Zustand mini-store）
 *
 * 设计要点：
 * - **模块级单例**：跨屏幕共享，Overlay 的 unmount/remount 不会丢失计时状态
 *   （如 ActiveTrainingScreen 短暂离开再回来，计时继续）。
 * - **时间戳驱动**：`startedAt + durationMs` 表达"何时开始、持续多久"，所有
 *   剩余时间都用 `Date.now() - startedAt` 推导；setInterval / setTimeout
 *   只用来驱动 UI 重渲染，不参与计时真值——后台/锁屏期间自动补偿。
 * - **`runId` 单调递增**：每次 `start()` 加 1；订阅方（TimerRing 的 `key`）
 *   用以区分"新一轮"vs"续命"——extend 不变更 runId，视觉连续；start 重置。
 * - **`completedAt`**：自然到达 0 的 wall-clock 时间戳，用于"延迟 1s 自动
 *   收起"。Overlay 检测到 `remaining ≤ 0` 时 setState 该字段，然后 setTimeout。
 * - **`extend(deltaSeconds)`**：把 `startedAt` 往前推 deltaMs，同时把
 *   `durationMs` 也加 deltaMs——`remaining = durationMs - (now - startedAt)`
 *   自然 +deltaSeconds，且 elapsed/duration 比例不变 → TimerRing 圆环动画
 *   不会"跳"。`completedAt` 顺手清空，便于"完成后再 +15"重置流程。
 *
 * 备注：`markCompleted` 只在 overlay 的 useEffect 里调用一次（受
 * `completedAt === null` 守护），保证 setState 是幂等的。
 */

import { create } from 'zustand';

export interface RestTimerState {
  /** 本轮启动的 wall-clock 时间戳（ms）。`null` = 空闲。 */
  startedAt: number | null;
  /** 本轮总时长（ms）。`null` = 空闲。 */
  durationMs: number | null;
  /** 自然到达 0 的时刻（ms）；用于 1 秒延迟收起。`null` = 未完成 / 进行中。 */
  completedAt: number | null;
  /** 单调递增 id；订阅方用以区分不同轮（start 重置；extend 不变）。 */
  runId: number;

  // -- actions ----------------------------------------------------------------
  /** 启动新一轮；如果已有计时，会覆盖（PRD：快速连续完成多组）。 */
  start: (seconds: number) => void;
  /** 立即结束当前轮（"跳过" 按钮 / 完成态 1s 后自动收起）。 */
  skip: () => void;
  /** 给当前轮增加 deltaSeconds（>0）；如果已完成或空闲，无操作。 */
  extend: (deltaSeconds: number) => void;
  /** Overlay 检测到 `remaining ≤ 0` 时调用一次，标记"自然完成"。 */
  markCompleted: () => void;
}

/** 把任意输入夹到 1..3600s 区间，避免负数 / 极大值导致 NaN 渲染。 */
const clampSeconds = (s: number) =>
  Math.max(1, Math.min(3600, Math.floor(s)));

export const useRestTimerStore = create<RestTimerState>((set, get) => ({
  startedAt: null,
  durationMs: null,
  completedAt: null,
  runId: 0,

  start: (seconds) => {
    const ms = clampSeconds(seconds) * 1000;
    set((s) => ({
      startedAt: Date.now(),
      durationMs: ms,
      completedAt: null,
      runId: s.runId + 1,
    }));
  },

  skip: () => {
    const { startedAt, durationMs, completedAt } = get();
    if (startedAt === null && durationMs === null && completedAt === null) {
      return;
    }
    set({
      startedAt: null,
      durationMs: null,
      completedAt: null,
    });
  },

  extend: (deltaSeconds) => {
    const { startedAt, durationMs, completedAt } = get();
    if (startedAt === null || durationMs === null) return;
    // 已完成的轮 +15 → 重新计 15s 倒计时（completedAt 清掉，durationMs 替换）
    if (completedAt !== null) {
      set({
        startedAt: Date.now(),
        durationMs: clampSeconds(deltaSeconds) * 1000,
        completedAt: null,
      });
      return;
    }
    const deltaMs = clampSeconds(deltaSeconds) * 1000;
    set({
      startedAt: startedAt - deltaMs,
      durationMs: durationMs + deltaMs,
    });
  },

  markCompleted: () => {
    const { startedAt, durationMs, completedAt } = get();
    if (startedAt === null || durationMs === null) return;
    if (completedAt !== null) return; // 已标记过
    set({ completedAt: Date.now() });
  },
}));

/* -------------------------------------------------------------------------- */
/* Pure helpers — 不订阅 store，可直接用于一次性计算。                        */
/* -------------------------------------------------------------------------- */

/**
 * 给定 state 推导剩余毫秒数。已用 `Date.now()` 校准，因此后台返回后立即正确。
 */
export function getRemainingMs(state: RestTimerState): number {
  if (state.startedAt === null || state.durationMs === null) return 0;
  const ms = state.durationMs - (Date.now() - state.startedAt);
  return ms > 0 ? ms : 0;
}

/** 给定 state 推导"是否处于计时状态"（用于不订阅场景的纯函数判断）。 */
export function isRestTimerActive(state: RestTimerState): boolean {
  return state.startedAt !== null && state.durationMs !== null;
}