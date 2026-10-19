/**
 * Exercise repository.
 *
 * CRUD on the `exercises` table. Built-in seeds + user-created (`is_custom=1`)
 * coexist; queries default to all rows unless filter is provided.
 */

import type { SQLiteDatabase } from 'expo-sqlite';

import {
  rowToExercise,
  type Exercise,
  type ExerciseRow,
} from '../schema';

import { newId, nowMs } from './_helpers';

export interface CreateExerciseInput {
  name: string;
  muscleGroup: string;
  secondaryMuscles?: string[];
  equipment: string;
  metricType: string;
  imageUri?: string | null;
  /** Defaults to true (P1 用户自定义动作). */
  isCustom?: boolean;
}

export interface UpdateExerciseInput {
  name?: string;
  muscleGroup?: string;
  secondaryMuscles?: string[];
  equipment?: string;
  metricType?: string;
  imageUri?: string | null;
}

export async function listExercises(db: SQLiteDatabase): Promise<Exercise[]> {
  // BL-003: 自定义动作置顶 + 名称次之（COLLATE NOCASE 让中英文都大小写不敏感）。
  const rows = await db.getAllAsync<ExerciseRow>(
    'SELECT * FROM exercises ORDER BY is_custom DESC, name COLLATE NOCASE ASC;',
  );
  return rows.map(rowToExercise);
}

export async function getExercise(
  db: SQLiteDatabase,
  id: string,
): Promise<Exercise | null> {
  const row = await db.getFirstAsync<ExerciseRow>(
    'SELECT * FROM exercises WHERE id = ?;',
    [id],
  );
  return row ? rowToExercise(row) : null;
}

export async function createExercise(
  db: SQLiteDatabase,
  input: CreateExerciseInput,
): Promise<Exercise> {
  const id = newId();
  const now = nowMs();
  await db.runAsync(
    `INSERT INTO exercises
       (id, name, muscle_group, secondary_muscles, equipment, metric_type, image_uri, is_custom, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      id,
      input.name,
      input.muscleGroup,
      JSON.stringify(input.secondaryMuscles ?? []),
      input.equipment,
      input.metricType,
      input.imageUri ?? null,
      input.isCustom === false ? 0 : 1,
      now,
    ],
  );
  return {
    id,
    name: input.name,
    muscleGroup: input.muscleGroup,
    secondaryMuscles: input.secondaryMuscles ?? [],
    equipment: input.equipment,
    metricType: input.metricType,
    imageUri: input.imageUri ?? null,
    isCustom: input.isCustom === false ? false : true,
    createdAt: now,
    // G35 §3 — user-created 走不到 mapping,这 5 字段都是 null
    descriptionZh: null,
    stepsZh: null,
    gifUrl: null,
    targetZh: null,
    attribution: null,
  };
}

export async function updateExercise(
  db: SQLiteDatabase,
  id: string,
  patch: UpdateExerciseInput,
): Promise<Exercise> {
  const existing = await getExercise(db, id);
  if (!existing) {
    throw new Error(`Exercise not found: ${id}`);
  }
  const next = {
    name: patch.name ?? existing.name,
    muscleGroup: patch.muscleGroup ?? existing.muscleGroup,
    secondaryMuscles: patch.secondaryMuscles ?? existing.secondaryMuscles,
    equipment: patch.equipment ?? existing.equipment,
    metricType: patch.metricType ?? existing.metricType,
    imageUri: patch.imageUri !== undefined ? patch.imageUri : existing.imageUri,
  };
  await db.runAsync(
    `UPDATE exercises
       SET name = ?, muscle_group = ?, secondary_muscles = ?, equipment = ?, metric_type = ?, image_uri = ?
       WHERE id = ?;`,
    [
      next.name,
      next.muscleGroup,
      JSON.stringify(next.secondaryMuscles),
      next.equipment,
      next.metricType,
      next.imageUri,
      id,
    ],
  );
  return { ...existing, ...next };
}

export async function deleteExercise(
  db: SQLiteDatabase,
  id: string,
): Promise<void> {
  await db.runAsync('DELETE FROM exercises WHERE id = ?;', [id]);
}

/**
 * 主要肌群筛选（单选）。
 */
export async function queryByMuscleGroup(
  db: SQLiteDatabase,
  muscleGroup: string,
): Promise<Exercise[]> {
  const rows = await db.getAllAsync<ExerciseRow>(
    'SELECT * FROM exercises WHERE muscle_group = ? ORDER BY is_custom DESC, name COLLATE NOCASE ASC;',
    [muscleGroup],
  );
  return rows.map(rowToExercise);
}

/**
 * 器械筛选（单选）。
 */
export async function queryByEquipment(
  db: SQLiteDatabase,
  equipment: string,
): Promise<Exercise[]> {
  const rows = await db.getAllAsync<ExerciseRow>(
    'SELECT * FROM exercises WHERE equipment = ? ORDER BY is_custom DESC, name COLLATE NOCASE ASC;',
    [equipment],
  );
  return rows.map(rowToExercise);
}

/**
 * 名称模糊搜索（中文 LIKE）。
 */
export async function searchByName(
  db: SQLiteDatabase,
  keyword: string,
): Promise<Exercise[]> {
  const trimmed = keyword.trim();
  if (!trimmed) return listExercises(db);
  const rows = await db.getAllAsync<ExerciseRow>(
    'SELECT * FROM exercises WHERE name LIKE ? ORDER BY is_custom DESC, name COLLATE NOCASE ASC;',
    [`%${trimmed}%`],
  );
  return rows.map(rowToExercise);
}

export const exerciseRepo = {
  list: listExercises,
  get: getExercise,
  create: createExercise,
  update: updateExercise,
  delete: deleteExercise,
  queryByMuscleGroup,
  queryByEquipment,
  searchByName,
};
