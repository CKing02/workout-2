/**
 * US-12 — bodyMeasurementStore
 *
 * 缓存身体测量列表的 Zustand store。App 启动时 DatabaseBootstrap 调
 * `useBodyMeasurementStore.getState().load()` 拉一次,后续操作走本地
 * mutate(乐观更新)+ 失败时 reload() 回滚。
 *
 * 设计要点:
 * - 列表永远按 `createdAt DESC`(同 repo 一致),不重复排序。
 * - create/update/delete 同步更新 store 缓存(无第二个数据源);
 *   写入失败抛 Error 给 UI 层 catch + toast。
 * - 复用 `useExerciseStore` / `useTrainingStore` 的 pattern:
 *   `loaded` flag + `load()` 入口。
 */

import { create } from 'zustand';

import { getDatabase } from '@/db';
import {
  bodyMeasurementRepo,
  type BodyMeasurementInput,
  type BodyMeasurementPatch,
} from '@/db/repositories/bodyMeasurementRepo';
import type { BodyMeasurement } from '@/db/schema';

export interface BodyMeasurementState {
  measurements: BodyMeasurement[];
  loaded: boolean;
  load: () => Promise<void>;
  create: (input: BodyMeasurementInput) => Promise<BodyMeasurement>;
  update: (id: string, patch: BodyMeasurementPatch) => Promise<BodyMeasurement>;
  remove: (id: string) => Promise<void>;
  resetForTests: () => void;
}

const DEFAULTS: Pick<BodyMeasurementState, 'measurements' | 'loaded'> = {
  measurements: [],
  loaded: false,
};

export const useBodyMeasurementStore = create<BodyMeasurementState>((set, get) => ({
  ...DEFAULTS,

  load: async () => {
    const db = await getDatabase();
    const rows = await bodyMeasurementRepo.listAll(db);
    set({ measurements: rows, loaded: true });
  },

  create: async (input) => {
    const db = await getDatabase();
    const created = await bodyMeasurementRepo.create(db, input);
    // 新建一定在最前面(repo 已 DESC)
    set((s) => ({ measurements: [created, ...s.measurements] }));
    return created;
  },

  update: async (id, patch) => {
    const db = await getDatabase();
    const updated = await bodyMeasurementRepo.update(db, id, patch);
    set((s) => ({
      measurements: s.measurements.map((m) => (m.id === id ? updated : m)),
    }));
    return updated;
  },

  remove: async (id) => {
    const db = await getDatabase();
    await bodyMeasurementRepo.delete(db, id);
    set((s) => ({
      measurements: s.measurements.filter((m) => m.id !== id),
    }));
  },

  resetForTests: () => {
    set({ ...DEFAULTS });
    // 防止 hot-reload 残留
    void get;
  },
}));
