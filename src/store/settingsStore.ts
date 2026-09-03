/**
 * Settings store.
 *
 * 持久化到 `settings` 表，App 启动时通过 `load()` 拉取。
 *
 * 提供便捷 setter（setUnit / setThemeMode / setDefaultRest / setUsername / setHapticsEnabled），
 * 内部统一调 `setSetting(key, value)`。
 *
 * 字段：
 * - unit: 'kg' | 'lb'
 * - themeMode: 'system' | 'light' | 'dark'
 * - defaultRestSeconds: number (30-300)
 * - username: string
 * - hapticsEnabled: boolean
 */

import { create } from 'zustand';

import { getDatabase } from '@/db';
import { getSetting, setSetting } from '@/db/repositories/settingsRepo';

export type Unit = 'kg' | 'lb';
export type ThemeModeSetting = 'system' | 'light' | 'dark';

export interface SettingsState {
  loaded: boolean;
  unit: Unit;
  themeMode: ThemeModeSetting;
  defaultRestSeconds: number;
  username: string;
  hapticsEnabled: boolean;

  load: () => Promise<void>;
  setUnit: (unit: Unit) => Promise<void>;
  setThemeMode: (mode: ThemeModeSetting) => Promise<void>;
  setDefaultRest: (seconds: number) => Promise<void>;
  setUsername: (name: string) => Promise<void>;
  setHapticsEnabled: (enabled: boolean) => Promise<void>;
}

const KEYS = {
  unit: 'unit',
  themeMode: 'themeMode',
  defaultRestSeconds: 'defaultRestSeconds',
  username: 'username',
  hapticsEnabled: 'hapticsEnabled',
} as const;

const DEFAULTS: Omit<
  SettingsState,
  'load' | 'setUnit' | 'setThemeMode' | 'setDefaultRest' | 'setUsername' | 'setHapticsEnabled'
> = {
  loaded: false,
  unit: 'kg',
  themeMode: 'system',
  defaultRestSeconds: 90,
  username: '',
  hapticsEnabled: true,
};

async function readAll(): Promise<Partial<SettingsState>> {
  const db = await getDatabase();
  const [unit, themeMode, rest, username, haptics] = await Promise.all([
    getSetting(db, KEYS.unit),
    getSetting(db, KEYS.themeMode),
    getSetting(db, KEYS.defaultRestSeconds),
    getSetting(db, KEYS.username),
    getSetting(db, KEYS.hapticsEnabled),
  ]);
  return {
    unit: (unit === 'lb' ? 'lb' : 'kg') as Unit,
    themeMode: ((): ThemeModeSetting => {
      if (themeMode === 'light' || themeMode === 'dark') return themeMode;
      return 'system';
    })(),
    defaultRestSeconds:
      rest && !Number.isNaN(Number(rest)) ? Math.max(15, Math.min(600, Number(rest))) : 90,
    username: username ?? '',
    hapticsEnabled: haptics === null ? true : haptics === 'true',
  };
}

async function writeKey(key: keyof typeof KEYS, value: string): Promise<void> {
  const db = await getDatabase();
  await setSetting(db, KEYS[key], value);
}

export const useSettingsStore = create<SettingsState>((set) => ({
  ...DEFAULTS,

  load: async () => {
    const data = await readAll();
    set({ ...DEFAULTS, ...data, loaded: true });
  },

  setUnit: async (unit) => {
    set({ unit });
    await writeKey('unit', unit);
  },

  setThemeMode: async (mode) => {
    set({ themeMode: mode });
    await writeKey('themeMode', mode);
  },

  setDefaultRest: async (seconds) => {
    const clamped = Math.max(15, Math.min(600, Math.floor(seconds)));
    set({ defaultRestSeconds: clamped });
    await writeKey('defaultRestSeconds', String(clamped));
  },

  setUsername: async (name) => {
    set({ username: name });
    await writeKey('username', name);
  },

  setHapticsEnabled: async (enabled) => {
    set({ hapticsEnabled: enabled });
    await writeKey('hapticsEnabled', enabled ? 'true' : 'false');
  },
}));
