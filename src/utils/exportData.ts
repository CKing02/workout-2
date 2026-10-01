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
 * - `schemaVersion` 2（2026-10-01）：计划处方内嵌进 planExercises —— 详见
 *   `BackupPayload.planExercises` 的说明。
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

/** 当前备份格式版本。v2 = 计划处方（rest_seconds + plan_sets）随 planExercises 内嵌。 */
export const CURRENT_SCHEMA_VERSION = 2;

/** 一条内嵌的组处方 —— 对应 `plan_sets` 表的一行（`id` 不导出，导入端重新生成）。 */
export interface BackupPlanSet {
  setIndex: number;
  setType: string;
  weight: number;
  reps: number;
  durationSeconds: number;
  distanceKm: number;
}

export interface BackupPayload {
  /**
   * Schema version — 后续字段增删可走迁移。
   * v1: 只有 planId / exerciseId / position，没有处方（G19 的限制）。
   * v2: planExercises 每项带上 restSeconds + sets[]（2026-10-01 修 §13.1）。
   */
  schemaVersion: typeof CURRENT_SCHEMA_VERSION;
  appVersion: string;
  exportedAt: string;
  exportedAtMs: number;
  counts: {
    exercises: number;
    plans: number;
    planExercises: number;
    /** 计划处方组数 —— 内嵌在 planExercises[].sets 里，这里只是个总数便于核对。 */
    planSets: number;
    trainings: number;
    trainingSets: number;
    settings: number;
    errorLogs: number;
    bodyMeasurements: number;
  };
  exercises: Exercise[];
  plans: PlanWithCount[];
  /**
   * plan_exercises 行 —— 每条 link 的 planId / exerciseId / position **+ 计划处方**。
   *
   * v2 起把 `rest_seconds` 和该 link 的 `plan_sets` 直接内嵌进来，而不是单独
   * 导一张 `planSets` 表。原因：`plan_sets.plan_exercise_id` 指向
   * `plan_exercises.id`，而**导入时 plan_exercises.id 是新生成的 UUID**，
   * payload 里带不带旧 id 都得重建映射。内嵌之后导入端拿着刚生成的 id
   * 立刻写 sets，顺序天然对齐 —— 零映射、零查找。
   */
  planExercises: Array<{
    planId: string;
    exerciseId: string;
    position: number;
    /** 该动作的组间休息（秒）。用户可在计划编辑里改，不是常量。 */
    restSeconds: number;
    /** 组处方，已按 setIndex 升序。空数组 = 这个动作还没配组。 */
    sets: BackupPlanSet[];
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

  // plan_exercises + 计划处方：一条 LEFT JOIN 拉平，再在 JS 里按 link 归组。
  //
  // ⚠️ 别退回「只 SELECT plan_exercises 四列」的写法 —— 2026-10-01 之前就是那样，
  // 结果是「导出 → 导入」把用户配的 weight/reps/setType 和 rest_seconds 全抹掉
  // （导入端还会主动 DELETE FROM plan_sets，属净破坏）。这里漏一列，
  // importDataDbWrite.test.ts 的 plan_sets 用例就会红。
  //
  // LEFT JOIN 保证没有配过组的 plan_exercise 也出一行（ps.* 为 NULL）。
  const planRows = await db.getAllAsync<{
    plan_id: string;
    exercise_id: string;
    position: number;
    rest_seconds: number;
    set_index: number | null;
    set_type: string | null;
    weight: number | null;
    reps: number | null;
    duration_seconds: number | null;
    distance_km: number | null;
  }>(
    `SELECT pe.plan_id, pe.exercise_id, pe.position, pe.rest_seconds,
            ps.set_index, ps.set_type, ps.weight, ps.reps,
            ps.duration_seconds, ps.distance_km
       FROM plan_exercises pe
       LEFT JOIN plan_sets ps ON ps.plan_exercise_id = pe.id
      ORDER BY pe.plan_id ASC, pe.position ASC, ps.set_index ASC;`,
  );

  // 一个 plan_exercise 由 (plan_id, position) 唯一确定；exercise_id 一起进 key
  // 是为了同计划里同一动作排两次时也能各归各的。Map 保持插入顺序 = 上面的 ORDER BY。
  // key 走 JSON.stringify 而不是字符串拼接：id 来自备份文件（可能被手改过），
  // 拼接法遇到含分隔符的 id 会静默串行。
  const planExercises: BackupPayload['planExercises'] = [];
  const byLink = new Map<string, BackupPayload['planExercises'][number]>();
  for (const r of planRows) {
    const key = JSON.stringify([r.plan_id, r.position, r.exercise_id]);
    let link = byLink.get(key);
    if (!link) {
      link = {
        planId: r.plan_id,
        exerciseId: r.exercise_id,
        position: r.position,
        restSeconds: r.rest_seconds,
        sets: [],
      };
      byLink.set(key, link);
      planExercises.push(link);
    }
    // LEFT JOIN 的空档：这个动作一组都没配。
    if (r.set_index === null) continue;
    link.sets.push({
      setIndex: r.set_index,
      setType: r.set_type ?? 'normal',
      weight: r.weight ?? 0,
      reps: r.reps ?? 0,
      durationSeconds: r.duration_seconds ?? 0,
      distanceKm: r.distance_km ?? 0,
    });
  }

  // 每个 training 拉一次 sets（按 position + setIndex 排序），扁平到一个数组。
  const trainingSets: BackupPayload['trainingSets'] = [];
  for (const t of trainings) {
    const sets = await listSetsByTraining(db, t.id);
    trainingSets.push({ trainingId: t.id, sets });
  }

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    // 从 app.json 读，原先硬编码了一个从不更新的版本号（见 utils/appVersion.ts）。
    // 备份 JSON 的 appVersion 是将来做迁移/兼容判断的依据，不能停在旧值上。
    appVersion: getAppVersion(),
    exportedAt: new Date().toISOString(),
    exportedAtMs: Date.now(),
    counts: {
      exercises: exercises.length,
      plans: plans.length,
      planExercises: planExercises.length,
      planSets: planExercises.reduce((sum, pe) => sum + pe.sets.length, 0),
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