/**
 * Seeds: write built-in exercises if `exercises` table is empty.
 *
 * Idempotent: runs once per "fresh install". User-created (`is_custom=1`)
 * rows survive across calls — only seeds when count == 0.
 */

import type { SQLiteDatabase } from 'expo-sqlite';

import { EXERCISE_SEEDS, toExerciseRows } from './exercises';

/**
 * Generate a random UUID. `crypto.randomUUID()` is available in modern React
 * Native (JSC + Hermes), but we keep a tiny fallback for safety on older
 * runtimes (e.g. very old Android Hermes).
 */
function randomUUID(): string {
  // Prefer global crypto if available.
  const c = (globalThis as unknown as { crypto?: { randomUUID?: () => string } })
    .crypto;
  if (c?.randomUUID) {
    return c.randomUUID();
  }
  // RFC4122-ish fallback. Not cryptographic, but unique enough for ID purposes.
  const bytes = new Uint8Array(16);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1
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

export async function seedExercisesIfEmpty(db: SQLiteDatabase): Promise<number> {
  const existing = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM exercises WHERE is_custom = 0;',
  );
  const existingCount = existing?.count ?? 0;
  if (existingCount > 0) {
    return 0;
  }

  const now = Date.now();
  const rows = toExerciseRows(now);
  const ids = rows.map(() => randomUUID());

  await db.withTransactionAsync(async () => {
    const stmt = await db.prepareAsync(
      `INSERT INTO exercises
        (id, name, muscle_group, secondary_muscles, equipment, metric_type, image_uri, is_custom, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    );
    try {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const id = ids[i];
        if (!row || !id) continue;
        await stmt.executeAsync([
          id,
          row.name,
          row.muscle_group,
          row.secondary_muscles,
          row.equipment,
          row.metric_type,
          row.image_uri,
          row.is_custom,
          row.created_at,
        ]);
      }
    } finally {
      await stmt.finalizeAsync();
    }
  });

  return rows.length;
}

/**
 * Expose the seed count for tests / debug.
 */
export const EXPECTED_SEED_COUNT = EXERCISE_SEEDS.length;
