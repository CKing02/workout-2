/**
 * In-app error capture for the diagnostics panel.
 *
 * Installs two global hooks before the React tree mounts:
 *  1. `ErrorUtils.setGlobalHandler` — wraps (does not replace) the RN
 *     default handler so LogBox / red box behavior is preserved. Captured
 *     events are persisted via `errorLogRepo.record` when the DB is ready,
 *     or buffered in memory while it isn't.
 *  2. `HermesInternal.enablePromiseRejectionTracker` — same idea for
 *     unhandled promise rejections. We override the tracker with our own
 *     `onUnhandled`; the default tracker doesn't expose a clean extension
 *     hook so we replace it, but we only *observe* (we don't change GC
 *     behavior).
 *
 * IMPORTANT — handler invariants:
 *  - **Never throw.** Every code path here is wrapped in try/catch and
 *    failures are silently swallowed. A bug in the diagnostics pipeline
 *    must not crash the app.
 *  - **Pre-DB buffering.** The app boots before SQLite is ready, so we
 *    keep an in-memory ring buffer (`MAX_BUFFER = 200`, FIFO drop-oldest).
 *    `bindDatabase(db)` drains it asynchronously once the DB is online.
 *
 * NOTE — Type: `ErrorUtils` is exported as an interface by `react-native`
 * but the *value* is only attached to `globalThis` at runtime, so we read
 * it through `globalThis` and narrow with the imported type.
 */

import type { SQLiteDatabase } from 'expo-sqlite';
import type { ErrorUtils } from 'react-native';

import { errorLogRepo, type ErrorLogInput } from '@/db/repositories/errorLogRepo';

/** Max events buffered before the DB is online. Older entries are dropped. */
const MAX_BUFFER = 200;

/**
 * Hermes-only surface. Not part of the public RN types; we declare a
 * minimal shape for what we actually call.
 */
interface HermesInternalLike {
  enablePromiseRejectionTracker?: (opts: {
    allRejections: boolean;
    onUnhandled: (id: number, error: unknown) => void;
  }) => void;
}

const buffer: ErrorLogInput[] = [];
let dbHandle: SQLiteDatabase | null = null;
let installed = false;
let flushing = false;

/**
 * Re-entrancy flag. Set while we're inside `console.error` so the patched
 * handler doesn't observe its own writes as additional warnings (would
 * otherwise explode into a feedback loop).
 */
let inHandler = false;

/** Install both global hooks. Idempotent — repeated calls are no-ops. */
export function installErrorHandlers(): void {
  if (installed) return;
  installed = true;

  installJsErrorHandler();
  installPromiseRejectionHandler();
  installConsoleErrorHandler();
}

/**
 * Bind the live database so subsequent events flush immediately. Also
 * drains any events captured before the DB was ready. Safe to call
 * multiple times — the latest db wins.
 */
export function bindDatabase(db: SQLiteDatabase): void {
  dbHandle = db;
  void flushBuffer();
}

function installJsErrorHandler(): void {
  const ErrorUtils = (globalThis as { ErrorUtils?: ErrorUtils }).ErrorUtils;
  if (!ErrorUtils?.setGlobalHandler) return;

  const prev = ErrorUtils.getGlobalHandler?.();
  ErrorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
    enqueue({ source: 'js', error, isFatal: !!isFatal });
    try {
      prev?.(error, isFatal);
    } catch {
      // The previous handler (LogBox) threw — never let that block our
      // own persistence path.
    }
  });
}

function installPromiseRejectionHandler(): void {
  const HermesInternal = (globalThis as { HermesInternal?: HermesInternalLike })
    .HermesInternal;
  if (!HermesInternal?.enablePromiseRejectionTracker) return;
  HermesInternal.enablePromiseRejectionTracker({
    allRejections: true,
    onUnhandled: (_id: number, error: unknown) => {
      enqueue({ source: 'promise', error, isFatal: false });
    },
  });
}

/**
 * DEBUGGING AID — capture React warnings that fire through `console.error`
 * (e.g. "Text strings must be rendered within a <Text> component"). These
 * aren't real JS errors so they bypass ErrorUtils; the diagnostics panel
 * needs them to surface React-only bugs during real-device testing.
 *
 * Filter: only React-rendered warnings go through; we identify them by the
 * leading "Warning: " prefix and stash the whole message + any captured
 * stack into the error_logs table. We also tag these as `isFatal=false`
 * because warnings don't actually crash the app.
 *
 * Bug-1 fix — *preserve React's original stack*:
 * The previous implementation built a synthetic `Error` whose `.stack`
 * was overwritten with `componentStack ?? message`, which meant LogBox
 * (and the error_logs `stack` column) always pointed at
 * `installErrorHandlers.ts:160` — the line that calls `original(...args)`
 * — instead of the actual component that emitted the warning. This made
 * every React warning look like it came from the diagnostics hook itself,
 * hiding the real source. We now build the Error from the raw `args` so
 * `name = 'ReactWarning'` and `stack` carries both the warning message
 * and React's component stack without dropping either.
 *
 * Reentrancy guarded by `inHandler` so the patched handler doesn't observe
 * its own writes (which would otherwise recurse via console.error → ...).
 */
function installConsoleErrorHandler(): void {
  const consoleRef = (globalThis as { console?: typeof console }).console;
  if (!consoleRef?.error) return;
  const original = consoleRef.error.bind(consoleRef);
  consoleRef.error = (...args: unknown[]) => {
    if (!inHandler) {
      try {
        const first = args[0];
        if (
          typeof first === 'string' &&
          (first.startsWith('Warning: ') ||
            first.includes('Text strings must be rendered') ||
            // G21 dup-key hunt: React's `warnOnInvalidKey` is fired via
            // `console.error` but the message does NOT start with "Warning: "
            // and is not a TextStrings warning, so it slipped through the
            // previous filter and was never persisted to error_logs. We
            // explicitly include it so the next export-to-JSON run carries
            // the offending key string + a captured native JS stack —
            // critical for pinpointing which `.map()` is rendering it.
            first.includes('Encountered two children with the same key'))
        ) {
          // Build a synthetic Error whose `.stack` mirrors what the original
          // `console.error` would have shown LogBox: the warning message
          // followed by React's component stack. We do NOT overwrite
          // `new Error()`'s native `.stack` — we explicitly construct one
          // from `args`, so the source frame is the offending component,
          // not the line in this file.
          const message = args
            .map((a) => (typeof a === 'string' ? a : safeStringify(a)))
            .join(' ')
            .slice(0, 2048);
          // G21 dup-key hunt (3rd half): `args[1]` semantics differ by
          // warning class. For most React warnings it's the component
          // stack (a multi-line string starting with `    in <Foo>`). For
          // `warnOnInvalidKey` it's the offending key itself (a single
          // 36-char UUID or short id), which is *not* a component stack
          // and gives no signal as to which `.map()` produced it. We
          // distinguish by shape:
          //  - looks like a component stack → use as componentStack
          //  - looks like a key (no newline, no leading whitespace) →
          //    pass through as `keyValue` and fall back to a captured
          //    native JS stack for source attribution.
          const arg1 = typeof args[1] === 'string' ? args[1] : null;
          const arg1IsComponentStack =
            arg1 != null && (arg1.includes('\n') || /^\s+in\s</.test(arg1));
          const componentStack =
            arg1IsComponentStack && arg1 != null ? arg1.slice(0, 6000) : null;
          const dupKeyValue =
            !arg1IsComponentStack && arg1 != null ? arg1 : null;
          // G21 dup-key hunt (2nd half): for warnings that DON'T ship a
          // componentStack (notably `Encountered two children with the same
          // key`, which fires from React internals with no usable
          // componentStack), capture a NATIVE JS stack at the
          // console.error call site. RN's LogBox usually gets a
          // source-frame from React that points at anonymous internals;
          // a raw JS stack taken right here will still hit React's
          // internals, but filtering it down to frames inside the
          // project's `src/` directory gives us a much tighter
          // signature — a real `.map()` call site is the first frame
          // under `src/` before any host element.
          //
          // We use `Error.captureStackTrace` (V8/Hermes) when available,
          // falling back to a plain `new Error()` stack otherwise.
          const nativeStack = captureProjectFrames();
          // `new Error(msg)` produces a real `.stack` with the *current*
          // call frame (this function). We immediately replace it with a
          // synthetic one whose first frame is the component, then list
          // our own `installErrorHandlers.ts` as the LAST frame so the
          // diagnostics hook stays traceable in the trace.
          const synthetic = new Error(message);
          synthetic.name = 'ReactWarning';
          const originStack = (synthetic.stack ?? '').split('\n');
          // Keep only the first line ("Error: …") and drop our frames.
          const header = originStack[0] ?? `ReactWarning: ${message}`;
          // For dup-key warnings, we ALSO surface the offending key value
          // on its own line so the next export-JSON run can grep for the
          // exact UUID that triggered it (combined with the `Project
          // frames` block, that pinpoints the `.map()`).
          const keyLine =
            dupKeyValue != null ? `Offending key: ${dupKeyValue}` : null;
          synthetic.stack = [
            header,
            keyLine,
            componentStack ?? nativeStack ?? '(no component stack available)',
            `    at captureConsoleError (installErrorHandlers.ts)`,
          ]
            .filter((l) => l != null)
            .join('\n');
          enqueue({
            source: 'console',
            error: synthetic,
            isFatal: false,
          });
        }
      } catch {
        // Never let diagnostics block the real console.error.
      }
    }
    inHandler = true;
    try {
      original(...args);
    } finally {
      inHandler = false;
    }
  };
}

/**
 * Take a fresh JS stack right now and return ONLY the frames that fall
 * under this project's `src/` directory, plus a synthetic tail frame
 * pointing back at the diagnostics hook so the trace stays anchored.
 *
 * The returned string starts with a `Project frames:` header line so it
 * is trivial to grep out of the JSON backup.
 */
function captureProjectFrames(): string | null {
  try {
    const holder: { stack?: string } = {};
    // V8 / Hermes both support Error.captureStackTrace; standard Error()
    // also gives a stack so we don't strictly need it, but captureStackTrace
    // is the documented fast path.
    if (typeof (Error as { captureStackTrace?: unknown }).captureStackTrace === 'function') {
      (Error as unknown as {
        captureStackTrace: (target: object, constructorOpt?: unknown) => void;
      }).captureStackTrace(holder);
    } else {
      holder.stack = new Error().stack ?? '';
    }
    const frames = (holder.stack ?? '').split('\n');
    const projectFrames = frames.filter((f) => /\bat .*src[\\/]/i.test(f));
    if (projectFrames.length === 0) return null;
    return [
      'Project frames (src/ only, raw JS stack):',
      ...projectFrames,
    ].join('\n');
  } catch {
    return null;
  }
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function enqueue(input: ErrorLogInput): void {
  try {
    if (dbHandle) {
      // Fire-and-forget; never block the caller (which may be RN's
      // exception manager itself).
      void errorLogRepo.record(dbHandle, input).catch(() => {
        // ignore — handler invariants forbid throw
      });
      return;
    }
    buffer.push(input);
    if (buffer.length > MAX_BUFFER) {
      // Drop oldest. shift() is O(n) but n ≤ 200 so this is fine.
      buffer.shift();
    }
  } catch {
    // swallow
  }
}

async function flushBuffer(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    while (buffer.length > 0 && dbHandle) {
      const next = buffer.shift();
      if (!next) break;
      try {
        await errorLogRepo.record(dbHandle, next);
      } catch {
        // Per-row failure: drop the event and keep going.
      }
    }
  } finally {
    flushing = false;
  }
}
