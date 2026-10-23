/**
 * G31 — `importData.validateBackupPayload` 单元测试。
 *
 * AC-31.3 (合法 JSON 校验通过；非法 toast 报错不动 DB) 的服务端兜底。
 * 测试范围：顶层结构 + 字段类型校验；不依赖 SQLite，所以可以纯函数测。
 *
 * DB 写入路径（importFromBackup）在真机走 AC-31.5/31.6 验证。
 */

import { validateBackupPayload } from '@/utils/importData';

describe('utils/importData — validateBackupPayload', () => {
  // 基线合法 payload
  const validPayload = {
    schemaVersion: 1,
    appVersion: '0.1.0',
    exportedAt: '2026-09-01T10:00:00.000Z',
    exportedAtMs: 1_700_000_000_000,
    counts: {
      exercises: 0,
      plans: 0,
      planExercises: 0,
      trainings: 0,
      trainingSets: 0,
      settings: 0,
      errorLogs: 0,
    },
    exercises: [],
    plans: [],
    planExercises: [],
    trainings: [],
    trainingSets: [],
    settings: {},
    errorLogs: [],
  };

  describe('合法 payload', () => {
    it('空对象含全部 7 键 + schemaVersion=1 → ok', () => {
      const result = validateBackupPayload(validPayload);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.payload.schemaVersion).toBe(1);
        expect(result.payload.exercises).toEqual([]);
      }
    });

    it('带数据 → ok 且字段保留', () => {
      const payload = {
        ...validPayload,
        exercises: [
          {
            id: 'e1',
            name: '卧推',
            muscleGroup: 'chest',
            secondaryMuscles: [],
            equipment: 'barbell',
            metricType: 'reps+kg',
            imageUri: null,
            isCustom: false,
            createdAt: 1700000000000,
          },
        ],
        plans: [{ id: 'p1', name: '推日', createdAt: 1, updatedAt: 2 }],
        settings: { unit: 'kg', themeMode: 'dark' },
      };
      const result = validateBackupPayload(payload);
      expect(result.ok).toBe(true);
    });

    it('schemaVersion=2 → ok（兼容旧备份）', () => {
      const result = validateBackupPayload({ ...validPayload, schemaVersion: 2 });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.payload.schemaVersion).toBe(2);
      }
    });

    it('schemaVersion=3 → ok（当前导出格式）', () => {
      const result = validateBackupPayload({ ...validPayload, schemaVersion: 3 });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.payload.schemaVersion).toBe(3);
      }
    });

    it('v2 payload（planExercises 带 restSeconds + sets）→ ok', () => {
      const result = validateBackupPayload({
        ...validPayload,
        schemaVersion: 2,
        planExercises: [
          {
            planId: 'p1',
            exerciseId: 'e1',
            position: 1,
            restSeconds: 90,
            sets: [
              {
                setIndex: 1,
                setType: 'normal',
                weight: 60,
                reps: 10,
                durationSeconds: 0,
                distanceKm: 0,
              },
            ],
          },
        ],
      });
      expect(result.ok).toBe(true);
    });
  });

  describe('顶层结构错误', () => {
    it('null → error', () => {
      const result = validateBackupPayload(null);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('顶层不是对象');
      }
    });

    it('字符串 → error', () => {
      const result = validateBackupPayload('hello');
      expect(result.ok).toBe(false);
    });

    it('数组 → error', () => {
      const result = validateBackupPayload([]);
      expect(result.ok).toBe(false);
    });

    it('空对象 → error（缺 schemaVersion 和 7 个键）', () => {
      const result = validateBackupPayload({});
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('schemaVersion');
        // 描述会列出缺失的字段名
      }
    });

    it('schemaVersion=4 → error（只支持 1 / 2 / 3）', () => {
      const result = validateBackupPayload({ ...validPayload, schemaVersion: 4 });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('不支持的备份版本');
        expect(result.error).toContain('4');
      }
    });

    it('schemaVersion 缺 → error', () => {
      const { schemaVersion: _omit, ...without } = validPayload;
      void _omit;
      const result = validateBackupPayload(without);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('不支持的备份版本');
      }
    });

    it('schemaVersion 是字符串 "1" → error（必须严格 === 1）', () => {
      const result = validateBackupPayload({ ...validPayload, schemaVersion: '1' });
      expect(result.ok).toBe(false);
    });
  });

  describe('顶层键缺失', () => {
    it.each([
      ['exercises'],
      ['plans'],
      ['planExercises'],
      ['trainings'],
      ['trainingSets'],
      ['settings'],
      ['errorLogs'],
    ])('缺 %s 键 → error', (key) => {
      const partial = { ...validPayload };
      delete (partial as Record<string, unknown>)[key];
      const result = validateBackupPayload(partial);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain(key);
      }
    });

    it('同时缺多个键 → error 信息包含所有缺失键', () => {
      const partial: Record<string, unknown> = { ...validPayload };
      delete partial.exercises;
      delete partial.plans;
      delete partial.trainings;
      const result = validateBackupPayload(partial);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('exercises');
        expect(result.error).toContain('plans');
        expect(result.error).toContain('trainings');
      }
    });
  });

  describe('字段类型错误', () => {
    it('exercises 不是数组 → error', () => {
      const result = validateBackupPayload({
        ...validPayload,
        exercises: 'not array',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('exercises');
        expect(result.error).toContain('数组');
      }
    });

    it('plans 不是数组 → error', () => {
      const result = validateBackupPayload({ ...validPayload, plans: {} });
      expect(result.ok).toBe(false);
    });

    it('settings 不是对象（是数组）→ error', () => {
      const result = validateBackupPayload({ ...validPayload, settings: [] });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('settings');
        expect(result.error).toContain('对象');
      }
    });

    it('settings 是 null → error', () => {
      const result = validateBackupPayload({ ...validPayload, settings: null });
      expect(result.ok).toBe(false);
    });

    it('settings 是字符串 → error', () => {
      const result = validateBackupPayload({ ...validPayload, settings: 'kg' });
      expect(result.ok).toBe(false);
    });

    it('errorLogs 不是数组 → error', () => {
      const result = validateBackupPayload({
        ...validPayload,
        errorLogs: { count: 0 },
      });
      expect(result.ok).toBe(false);
    });
  });
});
