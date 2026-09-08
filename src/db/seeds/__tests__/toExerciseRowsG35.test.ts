/**
 * G35 §3 — toExerciseRows 把 5 字段填满(单元测,不连 DB)
 *
 * 集成验证交给真机(Jest 里跑 expo-sqlite in-memory 配置成本太高,
 * 这里只测 toExerciseRows 输出);seedRunner 那侧手写 INSERT 列数已在
 * review 时校对。
 */

import { EXERCISE_SEEDS, toExerciseRows } from '../exercises';
import { EXERCISE_G35_BY_NAME, EXERCISE_G35_MAPPING } from '../exerciseG35Mapping';
import { EXERCISE_ZH_BY_HASANEYLDRM_ID } from '../exerciseZhData';

describe('G35 §3 toExerciseRows 5 字段填充', () => {
  const rows = toExerciseRows(1700000000000);

  it('52 条 seed 全部有 14 列(含 5 个 G35 新字段)', () => {
    expect(rows.length).toBe(52);
    const expectedKeys = [
      'name', 'muscle_group', 'secondary_muscles', 'equipment', 'metric_type',
      'image_uri', 'is_custom', 'created_at',
      'description_zh', 'steps_zh', 'gif_url', 'target_zh', 'attribution',
    ].sort();
    for (const r of rows) {
      const actualKeys = Object.keys(r).sort();
      expect(actualKeys).toEqual(expectedKeys);
    }
  });

  it('52 条 seed 全有 gif_url(指向 assets/exercises/{file})', () => {
    for (const r of rows) {
      expect(r.gif_url).toMatch(/^assets\/exercises\/[0-9]{4}-[A-Za-z0-9]+\.gif$/);
    }
  });

  it('52 条 seed 全有 description_zh + 非空 steps_zh(JSON 数组字符串)', () => {
    for (const r of rows) {
      expect(typeof r.description_zh).toBe('string');
      expect(r.description_zh!.length).toBeGreaterThan(20);
      expect(r.steps_zh).toBeTruthy();
      const parsed = JSON.parse(r.steps_zh!);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThan(0);
    }
  });

  it('52 条 seed 全有 target_zh(从 mapping targetEn 翻译)', () => {
    for (const r of rows) {
      expect(typeof r.target_zh).toBe('string');
      expect(r.target_zh!.length).toBeGreaterThan(0);
      // 不能是英文原样(翻译表覆盖到的 en 值都已转 zh)
      expect(r.target_zh!).not.toBe('pectorals');
      expect(r.target_zh!).not.toBe('delts');
      expect(r.target_zh!).not.toBe('lats');
    }
  });

  it('52 条 seed 全有 attribution(Gym Visual 版权声明)', () => {
    for (const r of rows) {
      expect(r.attribution).toBe('© Gym visual — https://gymvisual.com/');
    }
  });

  it('gif_url 字段和 mapping 的 assetFileName 严格一致', () => {
    for (const r of rows) {
      const mapping = EXERCISE_G35_BY_NAME.get(r.name);
      expect(mapping).toBeTruthy();
      expect(r.gif_url).toBe(`assets/exercises/${mapping!.assetFileName}`);
    }
  });

  it('description_zh / steps_zh 来自 EXERCISE_ZH_BY_HASANEYLDRM_ID', () => {
    for (const r of rows) {
      const mapping = EXERCISE_G35_BY_NAME.get(r.name)!;
      const zh = EXERCISE_ZH_BY_HASANEYLDRM_ID[mapping.hasaneyldrmId];
      expect(r.description_zh).toBe(zh.description);
      expect(JSON.parse(r.steps_zh!)).toEqual(zh.steps);
    }
  });

  it('mapping 里所有 52 条都出现在 rows 里(没漏)', () => {
    const rowNames = new Set(rows.map((r) => r.name));
    for (const m of EXERCISE_G35_MAPPING) {
      expect(rowNames.has(m.seedName)).toBe(true);
    }
  });

  it('is_custom = 0 + image_uri = null(seed 标志)', () => {
    for (const r of rows) {
      expect(r.is_custom).toBe(0);
      expect(r.image_uri).toBeNull();
    }
  });

  it('created_at 全部等于调用方传入的 now(单事务一致性)', () => {
    for (const r of rows) {
      expect(r.created_at).toBe(1700000000000);
    }
  });

  it('EXERCISE_SEEDS 数量(防回归:加新 seed 必须补 mapping + zh)', () => {
    expect(EXERCISE_SEEDS.length).toBe(52);
  });
});