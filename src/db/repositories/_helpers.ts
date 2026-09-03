/**
 * Shared helpers for repositories.
 *
 * Repositories are thin wrappers over the raw `SQLiteDatabase`. They:
 * - Accept a `SQLiteDatabase` so callers can use either `getDatabase()` or
 *   `useSQLiteContext()` interchangeably.
 * - Return Promises; errors propagate (no silent swallowing).
 * - Never mutate global state — stores layer is responsible for caching.
 */

import type { SQLiteDatabase } from 'expo-sqlite';

/** Generate a UUID. Falls back if `crypto.randomUUID()` is unavailable. */
export function newId(): string {
  const c = (globalThis as unknown as { crypto?: { randomUUID?: () => string } })
    .crypto;
  if (c?.randomUUID) return c.randomUUID();

  const bytes = new Uint8Array(16);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex: string[] = [];
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i] ?? 0;
    hex.push(b.toString(16).padStart(2, '0'));
  }
  return (
    hex.slice(0, 4).join('') +
    '-' +
    hex.slice(4, 6).join('') +
    '-' +
    hex.slice(6, 8).join('') +
    '-' +
    hex.slice(8, 10).join('') +
    '-' +
    hex.slice(10, 16).join('')
  );
}

/** Shorthand for `new Date().getTime()`. Centralized for mocking later. */
export function nowMs(): number {
  return Date.now();
}

/** Repository base type — every repo takes a db and returns Promises. */
export type RepoFn<Args extends unknown[], R> = (db: SQLiteDatabase, ...args: Args) => Promise<R>;
