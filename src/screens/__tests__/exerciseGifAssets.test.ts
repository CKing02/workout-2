/**
 * G35 §4 — exerciseGifAssets 单元测
 *
 * 验证:
 * 1. 32 条 mapping 里的 assetFileName 都在 G35_GIF_ASSETS 里
 * 2. resolveGifSource 解析 'assets/exercises/{file}' 路径
 * 3. resolveGifSource 解析 hasaneyldrm 风格 'videos/{file}' 路径(basename 一致就行)
 * 4. null / undefined / 空字符串 → undefined
 * 5. 找不到的文件名 → undefined
 */

import { EXERCISE_G35_MAPPING } from '@/db/seeds/exerciseG35Mapping';
import {
  G35_GIF_ASSETS,
  resolveGifSource,
} from '@/screens/exerciseGifAssets';

describe('G35 §4 exerciseGifAssets', () => {
  it('32 条 mapping 的 assetFileName 都在 G35_GIF_ASSETS 里', () => {
    expect(EXERCISE_G35_MAPPING.length).toBe(32);
    for (const m of EXERCISE_G35_MAPPING) {
      expect(G35_GIF_ASSETS[m.assetFileName]).toBeDefined();
    }
  });

  it('G35_GIF_ASSETS 没有重复 key', () => {
    expect(new Set(Object.keys(G35_GIF_ASSETS)).size).toBe(
      Object.keys(G35_GIF_ASSETS).length,
    );
  });

  it('G35_GIF_ASSETS 里至少有 32 项', () => {
    // §2 测试已经验证 32 张 GIF 都落地,这里只粗校验表大小
    expect(Object.keys(G35_GIF_ASSETS).length).toBeGreaterThanOrEqual(32);
  });

  describe('resolveGifSource', () => {
    it('解析完整路径 "assets/exercises/{file}"', () => {
      const first = EXERCISE_G35_MAPPING[0];
      const result = resolveGifSource(`assets/exercises/${first.assetFileName}`);
      expect(result).toBeDefined();
    });

    it('解析 hasaneyldrm 风格 "videos/{file}"(basename 一致即可)', () => {
      const first = EXERCISE_G35_MAPPING[0];
      const result = resolveGifSource(`videos/${first.assetFileName}`);
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

    it('"foo/bar/baz.gif" 但 baz.gif 不存在 → undefined', () => {
      expect(resolveGifSource('foo/bar/9999-NOTFOUND.gif')).toBeUndefined();
    });

    it('路径无 basename → undefined', () => {
      // 'trailing/' → basename 是空
      expect(resolveGifSource('trailing/')).toBeUndefined();
    });
  });
});