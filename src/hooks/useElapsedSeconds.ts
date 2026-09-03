/**
 * useElapsedSeconds — wall-clock based seconds counter.
 *
 * Returns `Math.floor((Date.now() - startedAt) / 1000)`, updated every
 * animation frame. We deliberately do NOT use `setInterval` so that
 * backgrounding the app, receiving a phone call, or the JS thread being
 * paused does not stall the timer — wall-clock time keeps moving.
 *
 * Use cases (G6 / G7 / G8):
 *  - training header timer (mm:ss elapsed since `startedAt`)
 *  - rest timer countdown
 *
 * Re-renders happen at most ~60 Hz when the screen is active; when the
 * screen is off, RAF callbacks don't fire and there's no state churn —
 * but the very next call after the screen wakes up reads `Date.now()`
 * again and reports the true elapsed time.
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

    let rafId = 0;
    let lastShown = -1;
    const tick = () => {
      const sec = computeElapsed(startedAt);
      if (sec !== lastShown) {
        lastShown = sec;
        force(sec);
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
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