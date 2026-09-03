/**
 * Toast — global lightweight non-modal feedback (G12).
 *
 * Why Zustand instead of Context: we want the API surface to be tiny
 * (`toast.show(message, variant?)`) callable from inside callbacks / event
 * handlers that are outside React's render tree. A Zustand singleton is the
 * shortest path to that.
 *
 * Auto-dismiss: `show()` schedules a `setTimeout` keyed on the toast's
 * `id` — if a new toast arrives before the previous timer fires, the
 * previous one is cancelled so we never get overlapping dismisses.
 *
 * Single-toast model: only one toast visible at a time (newest wins).
 * Multi-queueing is unnecessary for this app's surface; if you need
 * stacking later, swap the `visible`/`message` pair for an array.
 */

import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface ToastState {
  visible: boolean;
  message: string;
  variant: ToastVariant;
  durationMs: number;
  /**
   * Monotonically increasing token — bumped on every show so the Toast UI
   * can re-trigger the enter animation cleanly even when the message is
   * the same string twice in a row.
   */
  id: number;
}

interface ToastStore extends ToastState {
  _timerHandle: ReturnType<typeof setTimeout> | null;
  show: (message: string, options?: ToastOptions) => void;
  dismiss: () => void;
}

export interface ToastOptions {
  variant?: ToastVariant;
  durationMs?: number;
}

const DEFAULT_DURATION_MS = 2500;

export const useToastStore = create<ToastStore>((set, get) => ({
  visible: false,
  message: '',
  variant: 'info',
  durationMs: DEFAULT_DURATION_MS,
  id: 0,
  _timerHandle: null,

  show: (message, options) => {
    const { variant = 'info', durationMs = DEFAULT_DURATION_MS } = options ?? {};
    const prev = get();
    if (prev._timerHandle) {
      clearTimeout(prev._timerHandle);
    }
    const id = prev.id + 1;
    const handle = setTimeout(() => {
      // Only auto-dismiss if our token is still current (avoid races).
      const latest = get();
      if (latest.id === id) {
        set({ visible: false, _timerHandle: null });
      }
    }, durationMs);
    set({
      visible: true,
      message,
      variant,
      durationMs,
      id,
      _timerHandle: handle,
    });
  },

  dismiss: () => {
    const prev = get();
    if (prev._timerHandle) {
      clearTimeout(prev._timerHandle);
    }
    set({ visible: false, _timerHandle: null });
  },
}));

/**
 * Stable imperative API. Components call `toast.show('已保存', 'success')`.
 *
 * We bind to the store at module-eval time. Since the store is a Zustand
 * singleton this is safe; in tests, calling `useToastStore.setState` resets
 * the state but the `toast` reference continues to dispatch.
 */
export const toast = {
  show: (message: string, variant: ToastVariant = 'info') =>
    useToastStore.getState().show(message, { variant }),
  dismiss: () => useToastStore.getState().dismiss(),
};

/**
 * Convenience hook for components that want to subscribe to the current
 * toast (e.g. the global Toast renderer). Most call sites should use the
 * imperative `toast.show()` API instead.
 *
 * IMPORTANT: the `state` selector returns a fresh object literal on every
 * call. Without `useShallow`, Zustand's default `Object.is` equality check
 * would never see two consecutive results as equal — `useSyncExternalStore`
 * would treat every notification as a change, `forceStoreRerender` would
 * run on every commit, and the resulting `useEffect` flush would re-subscribe
 * and re-trigger the cycle. That's the "Maximum update depth exceeded" crash
 * observed in real-device testing. `useShallow` compares the *fields* of the
 * object, so a render that didn't actually change any of them is a no-op.
 */
export function useToast() {
  return {
    state: useToastStore(
      useShallow((s) => ({
        visible: s.visible,
        message: s.message,
        variant: s.variant,
        id: s.id,
      })),
    ),
    show: useToastStore((s) => s.show),
    dismiss: useToastStore((s) => s.dismiss),
  };
}
