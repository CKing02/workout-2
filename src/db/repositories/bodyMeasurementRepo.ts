/**
 * US-12 — body_measurements 仓库层。
 *
 * 操作 5 类：
 * - listAll()              全表读,按 created_at DESC(列表/趋势共用)
 * - getById(id)            单条查询(编辑页加载时用)
 * - create(input)          新增一条,返回创建后的对象(含 server-side id + 时间戳)
 * - update(id, patch)      部分字段更新,自动维护 updated_at
 * - remove(id)             物理删除
 *
 * 所有方法接受 db 作为第一参数(沿用现有 repo 风格),错误向上抛,
 * 事务由调用方组织(repo 层不主动开启事务,因为 create/update 各自 1 个
 * SQL 就够,不需要原子化多步)。
 */

import type { SQLiteDatabase } from 'expo-sqlite';

import {
  rowToBodyMeasurement,
  type BodyMeasurement,
  type BodyMeasurementRow,
} from '../schema';
import { newId, nowMs } from './_helpers';

export interface BodyMeasurementInput {
  /** 本地 'YYYY-MM-DD' */
  measuredDate: string;
  weightKg: number | null;
  bodyFatPct: number | null;
  note: string | null;
}

export type BodyMeasurementPatch = Partial<BodyMeasurementInput>;

/**
 * 全表读取,按 created_at DESC 排序。
 * 列表/趋势都按这个顺序展示(同日多条自然后插入的在前)。
 */
export async function listBodyMeasurements(
  db: SQLiteDatabase,
): Promise<BodyMeasurement[]> {
  const rows = await db.getAllAsync<BodyMeasurementRow>(
    `SELECT * FROM body_measurements ORDER BY created_at DESC;`,
  );
  return rows.map(rowToBodyMeasurement);
}

export async function getBodyMeasurementById(
  db: SQLiteDatabase,
  id: string,
): Promise<BodyMeasurement | null> {
  const row = await db.getFirstAsync<BodyMeasurementRow>(
    `SELECT * FROM body_measurements WHERE id = ?;`,
    [id],
  );
  return row ? rowToBodyMeasurement(row) : null;
}

/**
 * 新增一条测量记录。
 *
 * 输入校验(轻量,UI 层是主防线):
 * - measuredDate 非空
 * - weightKg / bodyFatPct 任一非 null(至少记一项) — 调用方负责
 */
export async function createBodyMeasurement(
  db: SQLiteDatabase,
  input: BodyMeasurementInput,
): Promise<BodyMeasurement> {
  if (!input.measuredDate) {
    throw new Error('measuredDate 不能为空');
  }
  const id = newId();
  const ts = nowMs();
  await db.runAsync(
    `INSERT INTO body_measurements
       (id, measured_date, weight_kg, body_fat_pct, note,
        created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [
      id,
      input.measuredDate,
      input.weightKg,
      input.bodyFatPct,
      input.note,
      ts,
      ts,
    ],
  );
  return {
    id,
    measuredDate: input.measuredDate,
    weightKg: input.weightKg,
    bodyFatPct: input.bodyFatPct,
    note: input.note,
    createdAt: ts,
    updatedAt: ts,
  };
}

/**
 * 部分字段更新。updated_at 自动维护。
 * 返回更新后的对象;id 不存在时 throw(由 SQL changes=0 检测)。
 */
export async function updateBodyMeasurement(
  db: SQLiteDatabase,
  id: string,
  patch: BodyMeasurementPatch,
): Promise<BodyMeasurement> {
  const sets: string[] = [];
  const args: (string | number | null)[] = [];

  if (patch.measuredDate !== undefined) {
    sets.push('measured_date = ?');
    args.push(patch.measuredDate);
  }
  if (patch.weightKg !== undefined) {
    sets.push('weight_kg = ?');
    args.push(patch.weightKg);
  }
  if (patch.bodyFatPct !== undefined) {
    sets.push('body_fat_pct = ?');
    args.push(patch.bodyFatPct);
  }
  if (patch.note !== undefined) {
    sets.push('note = ?');
    args.push(patch.note);
  }

  if (sets.length === 0) {
    // 没字段要改,直接返回当前行
    const existing = await getBodyMeasurementById(db, id);
    if (!existing) throw new Error(`bodyMeasurement not found: ${id}`);
    return existing;
  }

  sets.push('updated_at = ?');
  args.push(nowMs());
  args.push(id);

  const result = await db.runAsync(
    `UPDATE body_measurements SET ${sets.join(', ')} WHERE id = ?;`,
    args,
  );
  if (result.changes === 0) {
    throw new Error(`bodyMeasurement not found: ${id}`);
  }

  const updated = await getBodyMeasurementById(db, id);
  if (!updated) {
    // 竞态:刚 update 完就读不到,理论不应该发生。
    throw new Error(`bodyMeasurement disappeared after update: ${id}`);
  }
  return updated;
}

export async function deleteBodyMeasurement(
  db: SQLiteDatabase,
  id: string,
): Promise<void> {
  const result = await db.runAsync(
    `DELETE FROM body_measurements WHERE id = ?;`,
    [id],
  );
  if (result.changes === 0) {
    // 与 update 策略不同:删除幂等,不存在不报错(用户可能 double-tap)。
    return;
  }
}

export const bodyMeasurementRepo = {
  listAll: listBodyMeasurements,
  getById: getBodyMeasurementById,
  create: createBodyMeasurement,
  update: updateBodyMeasurement,
  delete: deleteBodyMeasurement,
};
