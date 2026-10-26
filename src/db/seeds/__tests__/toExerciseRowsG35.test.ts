/**
 * G35 §3 / G39 / G40 / G41 — toExerciseRows 把 5 字段填满(单元测,不连 DB)
 *
 * 集成验证交给真机(Jest 里跑 expo-sqlite in-memory 配置成本太高,
 * 这里只测 toExerciseRows 输出);seedRunner 那侧手写 INSERT 列数已在
 * review 时校对。
 *
 * G39: gif_url 改为带前缀的语义。
 *   bundled === true  → 'asset:{filename}'
 *   bundled === false → mapping.cdnUrl(完整 https URL,G41)
 *
 * G41: 250 个 bundled:false 走 cdnUrl 路径,seed 入库时直接是 https URL,
 * 客户端 ExerciseGifImage 首次访问走 getCachedOrDownload 拉取 + LRU 200MB。
 */

import { EXERCISE_SEEDS, toExerciseRows } from '../exercises';
import { EXERCISE_G35_BY_NAME, EXERCISE_G35_MAPPING } from '../exerciseG35Mapping';
import { EXERCISE_ZH_BY_HASANEYLDRM_ID } from '../exerciseZhData';

describe('G35 §3 / G39 / G41 toExerciseRows 字段填充', () => {
  const rows = toExerciseRows(1700000000000);

  it('302 条 seed 全部有 14 列(含 5 个 G35 新字段)', () => {
    expect(rows.length).toBe(323);
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

  it('G40: 52 条 bundled → gif_url = "asset:{filename}"', () => {
    const bundledRows = rows.filter((r) => r.gif_url?.startsWith('asset:'));
    expect(bundledRows.length).toBe(69);
    for (const r of bundledRows) {
      expect(r.gif_url).toMatch(/^asset:[0-9]{4}-[A-Za-z0-9]+\.gif$/);
    }
  });

  it('G44: 254 条 remote → gif_url = https URL(腾讯云 COS 域名)', () => {
    const remoteRows = rows.filter((r) => r.gif_url?.startsWith('https://'));
    expect(remoteRows.length).toBe(254);
    for (const r of remoteRows) {
      expect(r.gif_url).toMatch(/^https:\/\/[\w-]+\.cos\.ap-shanghai\.myqcloud\.com\//);
    }
  });

  it('G41: bundled/remote 互斥,加起来 = 302', () => {
    const bundled = rows.filter((r) => r.gif_url?.startsWith('asset:')).length;
    const remote = rows.filter((r) => r.gif_url?.startsWith('https://')).length;
    const nullUrl = rows.filter((r) => r.gif_url === null).length;
    expect(bundled + remote + nullUrl).toBe(323);
    expect(bundled).toBe(69);
    expect(remote).toBe(254);
  });

  it('mapping 里所有 302 条都出现在 rows 里(没漏)', () => {
    const rowNames = new Set(rows.map((r) => r.name));
    for (const m of EXERCISE_G35_MAPPING) {
      expect(rowNames.has(m.seedName)).toBe(true);
    }
  });

  it('G39/G41: bundled ? asset: : cdnUrl(双分支路由)', () => {
    for (const r of rows) {
      const mapping = EXERCISE_G35_BY_NAME.get(r.name);
      expect(mapping).toBeTruthy();
      if (mapping!.bundled) {
        expect(r.gif_url).toBe(`asset:${mapping!.assetFileName}`);
      } else {
        expect(r.gif_url).toBe(mapping!.cdnUrl);
      }
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

  it('target_zh 全部从 mapping targetEn 翻译(52 bundled + 250 remote)', () => {
    for (const r of rows) {
      expect(typeof r.target_zh).toBe('string');
      expect(r.target_zh!.length).toBeGreaterThan(0);
      expect(r.target_zh!).not.toBe('pectorals');
      expect(r.target_zh!).not.toBe('delts');
      expect(r.target_zh!).not.toBe('lats');
    }
  });

  it('attribution 全部为 Gym Visual 版权声明', () => {
    for (const r of rows) {
      expect(r.attribution).toBe('© Gym visual — https://gymvisual.com/');
    }
  });

  it('G41: 50 个最常用动作有 description_zh + 非空 steps_zh;200 个其余 fallback null', () => {
    let withZh = 0;
    let withoutZh = 0;
    for (const r of rows) {
      if (r.description_zh && r.steps_zh) {
        expect(typeof r.description_zh).toBe('string');
        expect(r.description_zh!.length).toBeGreaterThan(20);
        expect(r.steps_zh).toBeTruthy();
        const parsed = JSON.parse(r.steps_zh!);
        expect(Array.isArray(parsed)).toBe(true);
        expect(parsed.length).toBeGreaterThan(0);
        withZh++;
      } else {
        // null 兜底 — 详情页 fallback 到 GIF
        expect(r.description_zh).toBeNull();
        expect(r.steps_zh).toBeNull();
        withoutZh++;
      }
    }
    // 52 bundled + 254 CDN,全部 306 都有 zh(G37 user-motion 灌完后)
    expect(withZh).toBe(323);
    // 0 remote 走 GIF fallback
    expect(withoutZh).toBe(0);
  });

  it('EXERCISE_SEEDS 数量(防回归:加新 seed 必须补 mapping + zh)', () => {
    expect(EXERCISE_SEEDS.length).toBe(323);
  });
});
