/**
 * G7 — 订阅休息计时器"剩余秒数"的 hook
 *
 * 设计：
 * - **每次 render 同步 derive remaining**（基于 `Date.now() - startedAt`），
 *   不依赖 useState 初始化器。这样 triggerRestTimer 在 RestTimerOverlay
 *   已经 mount 之后启动新 timer 时，第一次 render 拿到的 remaining 立刻
 *   是真实值（≈60），不会再用 mount 时的过期 0 让上层 effect 误以为
 *   "倒计时已结束"立刻 schedule 1s 后 skip（修复 Bug 2）。
 * - useState 仅作为 re-render trigger（dummy state），用 RAF 在每整秒边界
 *   force 一次 commit；后台返回后 `Date.now()` 自动校准，秒数立即正确。
 * - `Math.ceil` 让最后一秒显示 "1" 而不是 "0"，更符合用户预期。
 * - 返回 0 既表示"空闲"也表示"自然完成"，由 `completedAt` 区分。
 */

import { useEffect, useState } from 'react';

import { useRestTimerStore } from './restTimerStore';

function computeRemaining(
  startedAt: number | null,
  durationMs: number | null,
): number {
  if (startedAt === null || durationMs === null) return 0;
  const ms = durationMs - (Date.now() - startedAt);
  return ms > 0 ? Math.ceil(ms / 1000) : 0;
}

export function useRestTimerSecondsRemaining(): number {
  const startedAt = useRestTimerStore((s) => s.startedAt);
  const durationMs = useRestTimerStore((s) => s.durationMs);
  const runId = useRestTimerStore((s) => s.runId);

  // Dummy trigger state — only used to force a re-render each second so the
  // derived `computeRemaining()` value below propagates to consumers. We do
  // NOT store the actual remaining here, because that would re-introduce the
  // "stale init" race described in the doc comment.
  const [, force] = useState(0);

  useEffect(() => {
    if (startedAt === null || durationMs === null) {
      force((v) => v + 1);
      return undefined;
    }

    let raf = 0;
    let lastShown = -1;
    const tick = () => {
      const sec = computeRemaining(startedAt, durationMs);
      if (sec !== lastShown) {
        lastShown = sec;
        force(sec);
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [startedAt, durationMs, runId]);

  return computeRemaining(startedAt, durationMs);
}