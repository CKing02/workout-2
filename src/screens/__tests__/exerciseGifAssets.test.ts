/**
 * G35 §4 / G39 / G40 / G41 — exerciseGifAssets 单元测
 *
 * G35 §4 验证:
 * 1. 52 条 bundled mapping 的 assetFileName 都在 G35_GIF_ASSETS 里
 * 2. resolveGifSource 解析 'assets/exercises/{file}' 老路径(兼容)
 * 3. resolveGifSource 解析 'asset:{file}' 新前缀(G39)
 * 4. null / undefined / 空字符串 → undefined
 * 5. 找不到的文件名 → undefined
 * 6. classifyGifSource 把 'asset:' / 'https://' / 'http://' / 'assets/' / null 正确归类
 *
 * G40: 52/52 全 bundled(22 张原 remote 已并入)。
 * G41: 250 个 remote bundled:false → G35_GIF_ASSETS 不包含(走 CDN,不打包)
 */

import { EXERCISE_G35_MAPPING } from '@/db/seeds/exerciseG35Mapping';
import {
  G35_GIF_ASSETS,
  classifyGifSource,
  resolveGifSource,
} from '@/screens/exerciseGifAssets';

describe('G35 §4 / G40 / G41 exerciseGifAssets', () => {
  const bundledMappings = EXERCISE_G35_MAPPING.filter((m) => m.bundled);

  it('G56: total mapping = 323(bundled 69 + remote 254)', () => {
    expect(EXERCISE_G35_MAPPING.length).toBe(323);
    expect(bundledMappings.length).toBe(69);
  });

  it('52 条 bundled mapping 的 assetFileName 都在 G35_GIF_ASSETS 里', () => {
    for (const m of bundledMappings) {
      expect(G35_GIF_ASSETS[m.assetFileName!]).toBeDefined();
    }
  });

  it('G35_GIF_ASSETS 没有重复 key', () => {
    expect(new Set(Object.keys(G35_GIF_ASSETS)).size).toBe(
      Object.keys(G35_GIF_ASSETS).length,
    );
  });

  it('G35_GIF_ASSETS 恰好 69 项', () => {
    expect(Object.keys(G35_GIF_ASSETS).length).toBe(69);
  });

  describe('resolveGifSource', () => {
    it('解析新前缀 "asset:{file}"(G39)', () => {
      const first = bundledMappings[0];
      const result = resolveGifSource(`asset:${first.assetFileName}`);
      expect(result).toBeDefined();
    });

    it('解析完整路径 "assets/exercises/{file}"(迁移前老路径兼容)', () => {
      const first = bundledMappings[0];
      const result = resolveGifSource(`assets/exercises/${first.assetFileName}`);
      expect(result).toBeDefined();
    });

    it('null → undefined', () => {
      expect(resolveGifSource(null)).toBeUndefined();
    });

    it('undefined → undefined', () => {
      expect(resolveGifSource(undefined)).toBeUndefined();
    });

    it('空字符串 → undefined', () => {
      expect(resolveGifSource('')).toBeUndefined();
    });

    it('"foo/bar/9999-NOTFOUND.gif" → undefined', () => {
      expect(resolveGifSource('foo/bar/9999-NOTFOUND.gif')).toBeUndefined();
    });

    it('"asset:"(空 basename)→ undefined', () => {
      expect(resolveGifSource('asset:')).toBeUndefined();
    });

    it('"https://cdn/foo.gif" → undefined(走 cache 异步路径,同步 resolver 不识别)', () => {
      expect(resolveGifSource('https://cdn.example.com/exercises/0025-EIeI8Vf.gif')).toBeUndefined();
    });
  });

  describe('classifyGifSource', () => {
    it('null / undefined / "" → "none"', () => {
      expect(classifyGifSource(null)).toBe('none');
      expect(classifyGifSource(undefined)).toBe('none');
      expect(classifyGifSource('')).toBe('none');
    });

    it('"asset:{file}" → "asset"', () => {
      expect(classifyGifSource('asset:0025-EIeI8Vf.gif')).toBe('asset');
    });

    it('"assets/exercises/{file}" 老路径 → "asset"(迁移前兼容)', () => {
      expect(classifyGifSource('assets/exercises/0025-EIeI8Vf.gif')).toBe('asset');
    });

    it('"https://..." → "remote"', () => {
      expect(classifyGifSource('https://pub-abc.r2.dev/workout2-gifs/exercises/0025-EIeI8Vf.gif')).toBe('remote');
    });

    it('"http://..." → "remote"', () => {
      expect(classifyGifSource('http://example.com/0025.gif')).toBe('remote');
    });

    it('未知前缀 → "none"', () => {
      expect(classifyGifSource('relative/path.gif')).toBe('none');
      expect(classifyGifSource('videos/0025-EIeI8Vf.gif')).toBe('none'); // 老 hasaneyldrm 源路径,不会写入 DB
    });
  });
});
