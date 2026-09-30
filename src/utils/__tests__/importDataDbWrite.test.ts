/**
 * G31/导入写库 —— `importFromBackup` 的**字段完整性**回归测。
 *
 * 这个文件存在的唯一理由，是 2026-09-30 真机踩到的一个静默数据破坏：
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
