/**
 * Settings repository.
 *
 * key-value 表。每个 setting 是一个字符串键值对；序列化由调用方负责
 * （例如 JSON.stringify）。get 不存在的 key 返回 null。
 */

import type { SQLiteDatabase } from 'expo-sqlite';

import type { SettingRow } from '../schema';

export async function getSetting(
  db: SQLiteDatabase,
  key: string,
): Promise<string | null> {
  const row = await db.getFirstAsync<SettingRow>(
    'SELECT * FROM settings WHERE key = ?;',
    [key],
  );
  return row ? row.value : null;
}

/**
 * 写入设置（upsert）。
 */
export async function setSetting(
  db: SQLiteDatabase,
  key: string,
  value: string,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
    [key, value],
  );
}

export async function deleteSetting(
  db: SQLiteDatabase,
  key: string,
): Promise<void> {
  await db.runAsync('DELETE FROM settings WHERE key = ?;', [key]);
}

export async function listSettings(
  db: SQLiteDatabase,
): Promise<Record<string, string>> {
  const rows = await db.getAllAsync<SettingRow>('SELECT * FROM settings;');
  const result: Record<string, string> = {};
  for (const row of rows) result[row.key] = row.value;
  return result;
}

export const settingsRepo = {
  get: getSetting,
  set: setSetting,
  delete: deleteSetting,
  list: listSettings,
};
