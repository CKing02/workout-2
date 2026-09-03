/**
 * G19 — 数据导出 JSON
 *
 * 把数据库全表（exercises / plans / plan_exercises / trainings /
 * training_sets / settings / error_logs）按 camelCase 字段序列化到
 * 一个临时 JSON 文件，再通过 `expo-sharing` 弹出原生分享面板
 * （保存到文件 / 分享给他人）。
 *
 * 关键设计：
 * - 字段命名 camelCase：和 store / rowToXxx 的内存模型一致，导入端
 *   （未来的恢复功能）可以直接吃这份 JSON。
 * - 空数据也能导出：每张表保证是 `[]` / `{}`，结构完整。
 * - `exportedAt` ISO 字符串：让恢复端知道这份备份是哪天的。
 * - 不预读 settings store —— 直接从 DB 取最新值，避免内存缓存过期。
 *
 * 用法：
 *   await exportBackup()    // 全流程：读 → 写 → 分享
 *   await buildBackupPayload()  // 只构造 JSON 对象（便于测试 / 复用）
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { getDatabase } from '@/db';
import { listExercises } from '@/db/repositories/exerciseRepo';
import { listErrors } from '@/db/repositories/errorLogRepo';
import { listPlansWithCount, type PlanWithCount } from '@/db/repositories/planRepo';
import { listTrainings, type Training } from '@/db/repositories/trainingRepo';
import { listSetsByTraining } from '@/db/repositories/trainingSetRepo';
import { listSettings } from '@/db/repositories/settingsRepo';
import type { Exercise, ErrorLog, TrainingSet } from '@/db/schema';

export interface BackupPayload {
  /** Schema version — 后续字段增删可走迁移。 */
  schemaVersion: 1;
  appVersion: string;
  exportedAt: string;
  exportedAtMs: number;
  counts: {
    exercises: number;
    plans: number;
    planExercises: number;
    trainings: number;
    trainingSets: number;
    settings: number;
    errorLogs: number;
  };
  exercises: Exercise[];
  plans: PlanWithCount[];
  /** plan_exercises 行（每条 link 的 planId / exerciseId / position）。 */
  planExercises: Array<{
    planId: string;
    exerciseId: string;
    position: number;
  }>;
  trainings: Training[];
  /** 嵌套：每个 training 下的 set 数组（已经按 position + setIndex 排序）。 */
  trainingSets: Array<{
    trainingId: string;
    sets: TrainingSet[];
  }>;
  settings: Record<string, string>;
  errorLogs: ErrorLog[];
}

/**
 * 构造一份完整的 JSON 备份对象（不做任何 IO）。
 */
export async function buildBackupPayload(): Promise<BackupPayload> {
  const db = await getDatabase();
  const [exercises, plans, trainings, settings, errorLogs] = await Promise.all([
    listExercises(db),
    listPlansWithCount(db),
    listTrainings(db),
    listSettings(db),
    listErrors(db, 10000), // 上限 1w 条；本地错误日志不会到这个量级
  ]);

  // plan_exercises: 直接全表读 + planId/exerciseId/position 三列。
  const planExerciseRows = await db.getAllAsync<{
    plan_id: string;
    exercise_id: string;
    position: number;
  }>(
    `SELECT plan_id, exercise_id, position
       FROM plan_exercises
       ORDER BY plan_id ASC, position ASC;`,
  );
  const planExercises = planExerciseRows.map((r) => ({
    planId: r.plan_id,
    exerciseId: r.exercise_id,
    position: r.position,
  }));

  // 每个 training 拉一次 sets（按 position + setIndex 排序），扁平到一个数组。
  const trainingSets: BackupPayload['trainingSets'] = [];
  for (const t of trainings) {
    const sets = await listSetsByTraining(db, t.id);
    trainingSets.push({ trainingId: t.id, sets });
  }

  return {
    schemaVersion: 1,
    appVersion: '0.1.0',
    exportedAt: new Date().toISOString(),
    exportedAtMs: Date.now(),
    counts: {
      exercises: exercises.length,
      plans: plans.length,
      planExercises: planExercises.length,
      trainings: trainings.length,
      trainingSets: trainingSets.reduce((sum, t) => sum + t.sets.length, 0),
      settings: Object.keys(settings).length,
      errorLogs: errorLogs.length,
    },
    exercises,
    plans,
    planExercises,
    trainings,
    trainingSets,
    settings,
    errorLogs,
  };
}

/**
 * 把 ISO 时间戳转成 `YYYYMMDD-HHmm` 文件名片段。
 * 例：2026-09-03T14:35:08.123Z → "20260903-2235"（用本地时间）。
 */
function backupTimestamp(ms: number): string {
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${mi}`;
}

/**
 * 全流程导出：构造 JSON → 写到 cacheDirectory → expo-sharing 弹面板。
 * 失败抛 Error（UI 层 catch 后 toast）。
 */
export async function exportBackup(): Promise<{ fileName: string }> {
  const payload = await buildBackupPayload();
  const fileName = `workout2-backup-${backupTimestamp(payload.exportedAtMs)}.json`;
  const json = JSON.stringify(payload, null, 2);

  // 兼容 legacy：documentDirectory 在 SDK 57 仍然存在（FileSystem.documentDirectory）。
  const baseDir = FileSystem.documentDirectory;
  if (!baseDir) {
    throw new Error('无法获取应用文档目录');
  }
  const fileUri = `${baseDir}${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  // 模拟器上 Sharing.isAvailableAsync() 返回 false —— 仍然写到文件，
  // 但跳过分享面板（用户可以手动从 Files / 文件管理 找到）。
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(fileUri, {
      dialogTitle: '导出训练数据',
      mimeType: 'application/json',
      UTI: 'public.json',
    });
  }
  return { fileName };
}