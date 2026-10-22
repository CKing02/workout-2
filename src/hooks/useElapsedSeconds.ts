/**
 * useElapsedSeconds — wall-clock based seconds counter.
 *
 * Returns `Math.floor((Date.now() - startedAt) / 1000)`, updated on the
 * next wall-clock second boundary. We derive from `Date.now()` rather than
 * incrementing a counter, so backgrounding the app or pausing the JS thread
 * cannot make the displayed time drift.
 *
 * Use cases (G6 / G7 / G8):
 *  - training header timer (mm:ss elapsed since `startedAt`)
 *  - rest timer countdown
 *
 * Re-renders happen at most once per second. This matters on the active
 * training screen, where a frame-rate RAF loop previously woke the JS thread
 * about 60 times per second even though the visible value only changed at 1Hz.
 *
 * Pattern: force-trigger + synchronous derive.
 *
 * The previous version used `useState(() => derived)` to seed `elapsed`,
 * which races against prop updates that flip `startedAt` from null to a
 * real value after mount (e.g. ActiveTrainingScreen bootstrap). `useState`
 * initializers only run once at mount — so even though the function re-runs
 * on prop change, the captured `elapsed` state stays at its initial 0
 * until the next `setElapsed` lands. That's the same stale-init pattern
 * `useRestTimerSecondsRemaining` was fixed for; mirror it here so the
 * two timer hooks behave identically. See memory:
 * "useRestTimerSecondsRemaining 派生值要同步 derive".
 */

import { useEffect, useState } from 'react';

function computeElapsed(startedAt: number | null | undefined): number {
  if (!startedAt) return 0;
  const diff = Date.now() - startedAt;
  return diff > 0 ? Math.floor(diff / 1000) : 0;
}

export function useElapsedSeconds(
  startedAt: number | null | undefined,
): number {
  // Dummy trigger state — only used to force a re-render so the
  // synchronously-derived `computeElapsed()` value below propagates to
  // consumers. We do NOT store the actual elapsed here (see doc comment).
  const [, force] = useState(0);

  useEffect(() => {
    if (!startedAt) {
      force((v) => v + 1);
      return undefined;
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const tick = () => {
      const sec = computeElapsed(startedAt);
      force(sec);
      const remainder = Math.max(0, (Date.now() - startedAt) % 1000);
      timeoutId = setTimeout(tick, Math.max(16, 1000 - remainder));
    };

    tick();
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [startedAt]);

  return computeElapsed(startedAt);
}

/** Format seconds as `mm:ss` (or `h:mm:ss` for >= 1 hour). */
export function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}
