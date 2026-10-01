/**
 * G31/导入写库 —— `importFromBackup` 的**字段完整性**回归测。
 *
 * 这个文件存在的唯一理由，是 2026-09-30 真机踩到的一个静默数据破坏
 * （exercises 五字段）和 2026-10-01 修掉的同形第二个（计划处方）：
 *
 * ---
 *
 * 第二个（§13.1，本次）：`plan_exercises.rest_seconds` 被写成**常量 60**，
 * `plan_sets`（weight / reps / setType）压根没写，而流程开头就
 * `DELETE FROM plan_sets` —— 用户配的「60kg × 10」和组间休息在
 * 「导出 → 导入」后静默变回默认值。下面是它的用例。
 *
 * ---
 *
 * 第一个（2026-09-30 真机踩到）：
 *
 *   导出端 dump 的是 `Exercise` 视图，**带** G35 的 5 个字段
 *   （descriptionZh / stepsZh / gifUrl / targetZh / attribution），
 *   而导入端的 `INSERT INTO exercises` 只写了 9 列 —— 导出带了、导入不写。
 *   又因为导入开头就 `DELETE FROM exercises`，所以「导出 → 导入」是**净破坏**：
 *   306 个动作的中文说明、步骤、GIF URL、版权归属全部落成 NULL。
 *
 * 症状极具迷惑性：动作名 / 肌群 / 器械都在，只有详情页说明和动作库 GIF 变空
 *   → 一眼看过去像「网络挂了 / CDN 挂了 / 缓存坏了」，
 *   实际是 DB 里 `gif_url` 整列为 NULL，App 压根没有 URL 可请求。
 *   **判据：`SELECT COUNT(*) FROM exercises WHERE gif_url IS NULL` 拿到全量数字。**
 *   当天是在验收「导入后头像不变」那条 AC 时顺手触发、且当场没发现的 ——
 *   因为验证只盯了头像，没回动作库。
 *
 * 为什么以前没被拦住：`importData.test.ts` 只测纯函数 `validateBackupPayload`，
 * 文件头就写着「DB 写入路径在真机走 AC-31.5/31.6 验证」——
 * **写库路径一直是零单测覆盖**，所以这类漏字段没有任何自动化拦得住。
 *
 * 本文件用假 db 记录 SQL + 绑定参数，不做真 SQLite，
 * 因此能在 node 环境下跑，也不需要 expo-sqlite。
 *
 * ⚠️ 不要整体 mock `expo-modules-core`（原因见 avatarFile.test.ts 顶部）。
 */

/** 按顺序记录每次 executeAsync 的 SQL 与绑定参数。 */
const mockStatements: { sql: string; params: unknown[] }[] = [];
/** 记录 execAsync 的批量 SQL（DELETE 那一段）。 */
const mockExecSql: string[] = [];

const mockDb = {
  execAsync: async (sql: string) => {
    mockExecSql.push(sql);
  },
  withTransactionAsync: async (fn: () => Promise<void>) => {
    await fn();
  },
  prepareAsync: async (sql: string) => ({
    executeAsync: async (params?: unknown[]) => {
      mockStatements.push({ sql, params: params ?? [] });
      return { changes: 1, lastInsertRowId: 1 };
    },
    finalizeAsync: async () => {},
  }),
};

jest.mock('@/db', () => ({
  __esModule: true,
  getDatabase: async () => mockDb,
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { importFromBackup } = require('@/utils/importData') as typeof import('@/utils/importData');

/* ------------------------------- 小工具 ------------------------------- */

/**
 * 导出端 dump 的 G35 五字段——与 `src/db/schema.ts` 的 `Exercise` 接口对齐。
 *
 * 故意写成**显式清单**而不是「拿 Exercise 类型反射」（TS 接口运行时不存在）：
 * 以后给 `Exercise` 加字段时，这里不会自动跟上 —— 这正是想要的效果，
 * 因为「导入端漏了新字段」恰恰是本次要防的 bug，加字段的人应该被这条测试
 * 提醒去补 importData。`avatarFile` 那套「唯一名 + 扫目录」也是同样的思路：
 * 把容易漏的地方显式钉住。
 */
const G35_COLUMNS = ['description_zh', 'steps_zh', 'gif_url', 'target_zh', 'attribution'] as const;

/** 一份带全部 G35 字段的合法 payload。 */
function makePayload(exerciseOverrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1 as const,
    exercises: [
      {
        id: 'e1',
        name: '卧推',
        muscleGroup: '胸',
        secondaryMuscles: ['三头'],
        equipment: '杠铃',
        metricType: 'reps+kg',
        imageUri: null,
        isCustom: false,
        createdAt: 1_790_762_714_137,
        descriptionZh: '躺平板凳上，握距略宽于肩。',
        stepsZh: ['躺下', '握杠', '推起'],
        gifUrl: 'https://example-cdn.test/exercises/0025-EIeI8Vf.gif',
        targetZh: '胸大肌',
        attribution: '© Gym visual — https://gymvisual.com/',
        ...exerciseOverrides,
      },
    ],
    plans: [],
    planExercises: [],
    trainings: [],
    trainingSets: [],
    settings: {},
    errorLogs: [],
    bodyMeasurements: [],
  };
}

function exercisesInsert() {
  const hit = mockStatements.find((s) => s.sql.includes('INSERT INTO exercises'));
  if (!hit) {
    throw new Error(
      `没有找到 INSERT INTO exercises；实际执行过的语句：\n${mockStatements
        .map((s) => '  ' + s.sql.split('\n')[0])
        .join('\n')}`,
    );
  }
  return hit;
}

beforeEach(() => {
  mockStatements.length = 0;
  mockExecSql.length = 0;
});

/* ------------------------------- 用例 ------------------------------- */

describe('importFromBackup — exercises 写库字段完整性', () => {
  it('INSERT 的列清单必须覆盖导出端 dump 的全部 G35 字段', async () => {
    await importFromBackup(makePayload());

    const sql = exercisesInsert().sql;
    for (const col of G35_COLUMNS) {
      expect(sql).toContain(col);
    }
  });

  it('G35 五个值真的被绑进参数，且 steps_zh 存成 JSON 数组字符串', async () => {
    await importFromBackup(makePayload());
    const { params } = exercisesInsert();

    // 9 个基础列 + 5 个 G35 列
    expect(params).toHaveLength(14);
    // 基础 9 列的位置不能动（前 9 个）
    expect(params[0]).toBe('e1');
    expect(params[1]).toBe('卧推');
    expect(params[8]).toBe(1_790_762_714_137);
    // G35 五列，顺序与列清单一致
    expect(params[9]).toBe('躺平板凳上，握距略宽于肩。');
    expect(params[10]).toBe(JSON.stringify(['躺下', '握杠', '推起']));
    expect(params[11]).toBe('https://example-cdn.test/exercises/0025-EIeI8Vf.gif');
    expect(params[12]).toBe('胸大肌');
    expect(params[13]).toBe('© Gym visual — https://gymvisual.com/');
  });

  it('stepsZh 为 null 时存 null，不能变成字符串 "null"', async () => {
    await importFromBackup(makePayload({ stepsZh: null }));
    const { params } = exercisesInsert();
    expect(params[10]).toBeNull();
  });

  it('旧备份（没有 G35 字段）缺字段时落 null，不抛也不崩', async () => {
    const legacy = makePayload();
    // 模拟 US-12/G35 之前的备份：这些键压根不存在
    const ex = legacy.exercises[0] as Record<string, unknown>;
    for (const k of ['descriptionZh', 'stepsZh', 'gifUrl', 'targetZh', 'attribution']) {
      delete ex[k];
    }

    await expect(importFromBackup(legacy)).resolves.toBeDefined();

    const { params } = exercisesInsert();
    expect(params).toHaveLength(14);
    expect(params.slice(9)).toEqual([null, null, null, null, null]);
  });

  it('动手前先 DELETE 全表 —— 所以漏字段是「净破坏」而不是「没还原」', async () => {
    await importFromBackup(makePayload());
    const deletes = mockExecSql.join('\n');
    expect(deletes).toContain('DELETE FROM exercises');
  });
});

/* -------------------------------------------------------------------------- */
/* §13.1 — 计划处方（plan_exercises.rest_seconds + plan_sets）                 */
/* -------------------------------------------------------------------------- */

/**
 * ⚠️ 这些用例的写法是刻意的：断言**绑定进 SQL 的值**，不是「函数被调过」，
 * 也不是「payload 里有 sets 字段」。后者只测导出端，而本 bug 的另一半
 * 恰在导入端（硬编码 60 + 主动 DELETE）—— 只测 payload 形状的话，
 * 把导入端改回 `VALUES (?, ?, ?, ?, 60)` 这条测试照样绿。
 */
describe('importFromBackup — 计划处方写库', () => {
  /** plan_exercises 的 INSERT（这个文件里通常只有一条）。 */
  function peInserts() {
    return mockStatements.filter((s) => s.sql.includes('INSERT INTO plan_exercises'));
  }
  function setInserts() {
    return mockStatements.filter((s) => s.sql.includes('INSERT INTO plan_sets'));
  }

  /** 用户配的处方：90s 休息 + 热身组 20kg×12 + 正式组 60kg×10。 */
  const LINK_WITH_SETS = {
    planId: 'p1',
    exerciseId: 'e1',
    position: 1,
    restSeconds: 90,
    sets: [
      { setIndex: 1, setType: 'warmup', weight: 20, reps: 12, durationSeconds: 0, distanceKm: 0 },
      { setIndex: 2, setType: 'normal', weight: 60, reps: 10, durationSeconds: 0, distanceKm: 0 },
    ],
  };

  function planPayload(planExercises: unknown[], schemaVersion: 1 | 2 = 2) {
    return {
      ...makePayload(),
      schemaVersion,
      plans: [{ id: 'p1', name: '推日', createdAt: 1, updatedAt: 2 }],
      planExercises,
    };
  }

  it('rest_seconds 绑 payload 的值，不是硬编码 60', async () => {
    await importFromBackup(planPayload([LINK_WITH_SETS]));

    const pe = peInserts();
    expect(pe).toHaveLength(1);
    // 列顺序：(id, plan_id, exercise_id, position, rest_seconds)
    expect(pe[0]!.params).toHaveLength(5);
    expect(pe[0]!.params[4]).toBe(90);
    // 老写法把 60 写死在 VALUES 里 —— 那种 SQL 只有 4 个占位符
    expect(pe[0]!.sql).not.toMatch(/VALUES\s*\(\s*\?\s*,\s*\?\s*,\s*\?\s*,\s*\?\s*,\s*60\s*\)/i);
  });

  it('plan_sets 组处方按 payload 原值写入（setType / weight / reps / setIndex）', async () => {
    await importFromBackup(planPayload([LINK_WITH_SETS]));

    const rows = setInserts();
    expect(rows).toHaveLength(2);
    // 列顺序：(id, plan_exercise_id, set_index, set_type, weight, reps, duration, distance)
    expect(rows[0]!.params.slice(2)).toEqual([1, 'warmup', 20, 12, 0, 0]);
    expect(rows[1]!.params.slice(2)).toEqual([2, 'normal', 60, 10, 0, 0]);
  });

  it('⋯ durationSeconds / distanceKm 也原样还原（time / km 类动作）', async () => {
    await importFromBackup(
      planPayload([
        {
          ...LINK_WITH_SETS,
          sets: [
            { setIndex: 1, setType: 'normal', weight: 0, reps: 0, durationSeconds: 45, distanceKm: 0 },
          ],
        },
      ]),
    );

    const row = setInserts();
    expect(row).toHaveLength(1);
    expect(row[0]!.params.slice(6)).toEqual([45, 0]);
  });

  it('每个 link 的组挂在它自己新生成的 id 上（顺序对齐，不串行）', async () => {
    await importFromBackup(
      planPayload([
        LINK_WITH_SETS,
        {
          planId: 'p1',
          exerciseId: 'e2',
          position: 2,
          restSeconds: 45,
          sets: [
            { setIndex: 1, setType: 'failure', weight: 80, reps: 6, durationSeconds: 0, distanceKm: 0 },
          ],
        },
      ]),
    );

    const peIds = peInserts().map((s) => s.params[0]);
    expect(peIds).toHaveLength(2);
    // 两个 link 各有独立的新 UUID（payload 里本来就没有 id）
    expect(new Set(peIds).size).toBe(2);

    // 前两组 → 第一个 link 的 id，第三组 → 第二个 link 的 id
    expect(setInserts().map((s) => s.params[1])).toEqual([peIds[0], peIds[0], peIds[1]]);
  });

  it('v1 老备份（无 restSeconds / sets）→ 回落 60、不写组，且不抛错', async () => {
    const legacy = planPayload([{ planId: 'p1', exerciseId: 'e1', position: 1 }], 1);

    await expect(importFromBackup(legacy)).resolves.toBeDefined();

    expect(peInserts()[0]!.params[4]).toBe(60);
    expect(setInserts()).toHaveLength(0);
  });

  it('组数为 0 的 link（新建计划还没配组）不影响其它 link', async () => {
    await importFromBackup(
      planPayload([{ planId: 'p1', exerciseId: 'e9', position: 3, restSeconds: 60, sets: [] }]),
    );

    expect(peInserts()).toHaveLength(1);
    expect(setInserts()).toHaveLength(0);
  });

  it('动手前也 DELETE plan_sets —— 所以漏写组是「净破坏」而不是「没还原」', async () => {
    await importFromBackup(planPayload([LINK_WITH_SETS]));
    expect(mockExecSql.join('\n')).toContain('DELETE FROM plan_sets');
  });

  it('ImportCounts 如实报告还原了多少组', async () => {
    const counts = await importFromBackup(planPayload([LINK_WITH_SETS]));
    expect(counts.planExercises).toBe(1);
    expect(counts.planSets).toBe(2);
  });
});
