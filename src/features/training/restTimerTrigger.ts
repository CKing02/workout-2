/**
 * G7 + 通知栏动作名 — 触发休息计时器的入口。
 *
 * 设计：
 * - 模块级 Zustand mini-store（`restTimerStore`）承担状态；本文件只是触发点。
 * - 如果 store 里已有进行中的计时，新的 `start()` 会**覆盖**它（PRD：快速
 *   连续完成多组时不重叠）。
 * - `exerciseName`（可选）：把"刚做完的动作名"传给 store；通知栏会显示成
 *   "休息中 — 杠铃卧推"。不传或空串都按匿名处理。
 * - `onComplete`（可选）：在自然到达 0 时触发；用户跳过不会触发。
 *   G6 训练屏幕目前不传 `onComplete`，但保留这个 API 以便后续 G11/G8 复用。
 * - 返回的 `dispose()` 用于提前取消订阅（无 onComplete 时是 no-op）。
 */

import { useRestTimerStore, type RestTimerState } from './restTimerStore';

/**
 * 启动休息倒计时；返回 `dispose` 用于取消 onComplete 订阅。
 *
 * @param durationSeconds 休息时长（秒）；≤0 或非有限数 no-op
 * @param exerciseName   触发本轮的动作名（用于通知栏展示）；可选
 * @param onComplete     自然到达 0 时回调；用户跳过不触发
 */
export function triggerRestTimer(
  durationSeconds: number,
  exerciseName?: string | null,
  onComplete?: () => void,
): () => void {
  // 0 或负数直接 no-op
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return () => undefined;
  }

  // 启动新一轮（store.start 内部会 clamp + normalize exerciseName）
  useRestTimerStore.getState().start(durationSeconds, exerciseName);

  // 没有 onComplete 就直接返回 no-op dispose
  if (!onComplete) {
    return () => undefined;
  }

  // 监听 "自然完成" 事件（completedAt 由 overlay 设置）
  let fired = false;
  const unsub = useRestTimerStore.subscribe(
    (state: RestTimerState, prev: RestTimerState) => {
      if (fired) return;
      if (state.completedAt !== null && prev.completedAt === null) {
        fired = true;
        // 同步触发；onComplete 通常很短，不阻塞渲染
        try {
          onComplete();
        } catch {
          /* swallow — onComplete 抛错不应影响计时器 */
        }
        unsub();
      }
    },
  );

  return unsub;
}