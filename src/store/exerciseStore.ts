/**
 * Exercise store.
 *
 * Holds the loaded exercise catalog in memory; queries delegate to
 * `exerciseRepo` and update local state.
 *
 * The catalog is loaded once on app boot (see `useBootData`); mutations
 * from other stores (e.g. custom exercise creation in G4+) flow through
 * `reload()` to keep the in-memory copy consistent.
 */

import { create } from 'zustand';

import { getDatabase } from '@/db';
import type { Exercise } from '@/db/schema';
import {
  createExercise,
  deleteExercise,
  getExercise,
  listExercises,
  queryByEquipment,
  queryByMuscleGroup,
  searchByName,
  updateExercise,
  type CreateExerciseInput,
  type UpdateExerciseInput,
} from '@/db/repositories/exerciseRepo';

export interface ExerciseStoreState {
  exercises: Exercise[];
  loading: boolean;
  error: string | null;

  load: () => Promise<void>;
  reload: () => Promise<void>;
  /**
   * G11: resolve a single exercise by id. Reads the in-memory catalog first
   * (the library screen has already loaded it) and only falls back to SQLite
   * when the id is unknown — so picking N exercises costs 0 queries in the
   * common case.
   */
  getById: (id: string) => Promise<Exercise | null>;
  search: (keyword: string) => Promise<Exercise[]>;
  filterByMuscleGroup: (muscleGroup: string) => Promise<Exercise[]>;
  filterByEquipment: (equipment: string) => Promise<Exercise[]>;
  create: (input: CreateExerciseInput) => Promise<Exercise>;
  update: (id: string, patch: UpdateExerciseInput) => Promise<Exercise>;
  remove: (id: string) => Promise<void>;
}

export const useExerciseStore = create<ExerciseStoreState>((set, get) => ({
  exercises: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const db = await getDatabase();
      const exercises = await listExercises(db);
      set({ exercises, loading: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ loading: false, error: msg });
      throw err;
    }
  },

  reload: async () => {
    await get().load();
  },

  getById: async (id) => {
    const cached = get().exercises.find((e) => e.id === id);
    if (cached) return cached;
    const db = await getDatabase();
    return getExercise(db, id);
  },

  search: async (keyword) => {
    const db = await getDatabase();
    return searchByName(db, keyword);
  },

  filterByMuscleGroup: async (muscleGroup) => {
    const db = await getDatabase();
    return queryByMuscleGroup(db, muscleGroup);
  },

  filterByEquipment: async (equipment) => {
    const db = await getDatabase();
    return queryByEquipment(db, equipment);
  },

  create: async (input) => {
    const db = await getDatabase();
    const created = await createExercise(db, input);
    // G15 自检 #3：创建后 reload 让 SQL 排序（is_custom ASC, name ASC）生效，
    // 否则新动作会停留在数组末尾，破坏"自定义排在后面 + 名称次之"。
    const fresh = await listExercises(db);
    set({ exercises: fresh });
    return created;
  },

  update: async (id, patch) => {
    const db = await getDatabase();
    const updated = await updateExercise(db, id, patch);
    set((state) => ({
      exercises: state.exercises.map((e) => (e.id === id ? updated : e)),
    }));
    return updated;
  },

  remove: async (id) => {
    const db = await getDatabase();
    await deleteExercise(db, id);
    set((state) => ({ exercises: state.exercises.filter((e) => e.id !== id) }));
  },
}));
