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

import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { getDatabase } from '@/db';
import { listBodyMeasurements } from '@/db/repositories/bodyMeasurementRepo';
import { listExercises } from '@/db/repositories/exerciseRepo';
import { listErrors } from '@/db/repositories/errorLogRepo';
import { listPlansWithCount, type PlanWithCount } from '@/db/repositories/planRepo';
import { listTrainings, type Training } from '@/db/repositories/trainingRepo';
import { listSetsByTraining } from '@/db/repositories/trainingSetRepo';
import { listSettings } from '@/db/repositories/settingsRepo';
import type { BodyMeasurement, Exercise, ErrorLog, TrainingSet } from '@/db/schema';
import { getAppVersion } from '@/utils/appVersion';

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
    bodyMeasurements: number;
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
  /** US-12 — 身体测量（体重 + 体脂）。 */
  bodyMeasurements: BodyMeasurement[];
}

/**
 * 构造一份完整的 JSON 备份对象（不做任何 IO）。
 */
export async function buildBackupPayload(): Promise<BackupPayload> {
  const db = await getDatabase();
  const [exercises, plans, trainings, settings, errorLogs, bodyMeasurements] =
    await Promise.all([
      listExercises(db),
      listPlansWithCount(db),
      listTrainings(db),
      listSettings(db),
      listErrors(db, 10000), // 上限 1w 条；本地错误日志不会到这个量级
      listBodyMeasurements(db),
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
    // 从 app.json 读，原先硬编码了一个从不更新的版本号（见 utils/appVersion.ts）。
    // 备份 JSON 的 appVersion 是将来做迁移/兼容判断的依据，不能停在旧值上。
    appVersion: getAppVersion(),
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
      bodyMeasurements: bodyMeasurements.length,
    },
    exercises,
    plans,
    planExercises,
    trainings,
    trainingSets,
    settings,
    errorLogs,
    bodyMeasurements,
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
 * 全流程导出：构造 JSON → 写到 documentDirectory → expo-sharing 弹面板。
 * 失败抛 Error（UI 层 catch 后 toast）。
 *
 * G31 fix: 同步迁移到 v57 新 `expo-file-system` API — 写路径走
 * `new File(Paths.document, name).write()`(同步迁移到非 legacy 入口,避免
 * 后续 SDK 升级再次踩 deprecated 警告)。
 */
export async function exportBackup(): Promise<{ fileName: string }> {
  const payload = await buildBackupPayload();
  const fileName = `workout2-backup-${backupTimestamp(payload.exportedAtMs)}.json`;
  const json = JSON.stringify(payload, null, 2);

  // G31 fix: 用新 API `File` + `Paths.document` 写文件。`Paths.document.uri`
  // 在原生平台始终非空；这里保留显式兜底(返回空字符串时 = web / 异常环境)。
  const file = new File(Paths.document, fileName);
  if (!file.uri || !file.uri.startsWith('file://')) {
    throw new Error('无法获取应用文档目录');
  }
  // G31 fix: 新 API `file.write()` 默认覆盖写、自动创建文件;UTF8 是默认值。
  file.write(json);

  // 模拟器上 Sharing.isAvailableAsync() 返回 false —— 仍然写到文件，
  // 但跳过分享面板（用户可以手动从 Files / 文件管理 找到）。
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(file.uri, {
      dialogTitle: '导出训练数据',
      mimeType: 'application/json',
      UTI: 'public.json',
    });
  }
  return { fileName };
}