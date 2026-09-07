/**
 * G32 — oneRm.brzycki 单元测试。
 *
 * 覆盖：
 *  - 正常公式：100kg × 5rep → ≈ 112.5kg（AC-32.6）
 *  - reps === 1 → weight（公式精确）
 *  - reps >= 37 cap 为 weight（AC-32.7）
 *  - 非正 / 非有限数 → 0
 */

import { brzycki } from '@/utils/oneRm';

describe('utils/oneRm', () => {
  describe('brzycki — 公式正确性', () => {
    it('AC-32.6: 100kg × 5rep → 1RM ≈ 112.5kg', () => {
      // 100 * (36 / 32) = 100 * 1.125 = 112.5
      expect(brzycki(100, 5)).toBeCloseTo(112.5, 5);
    });

    it('reps === 1 → 1RM === weight（公式 36/36 === 1）', () => {
      expect(brzycki(80, 1)).toBeCloseTo(80, 5);
    });

    it('reps === 10: 60kg → ≈ 80kg', () => {
      // 60 * (36 / 27) = 60 * 1.333... ≈ 80
      expect(brzycki(60, 10)).toBeCloseTo(80, 5);
    });

    it('reps 越大，1RM 越大于 weight（单调递增）', () => {
      const w = 100;
      const prev: number[] = [];
      for (let r = 1; r <= 36; r++) {
        const v = brzycki(w, r);
        if (prev.length > 0) {
          expect(v).toBeGreaterThan(prev[prev.length - 1]!);
        }
        prev.push(v);
      }
    });
  });

  describe('brzycki — 边界处理（AC-32.7）', () => {
    it('reps === 37 → cap 为 weight × 1 = weight', () => {
      expect(brzycki(100, 37)).toBe(100);
    });

    it('reps > 37 也走 cap（避免 37-reps ≤ 0 爆炸）', () => {
      expect(brzycki(100, 50)).toBe(100);
      expect(brzycki(100, 1000)).toBe(100);
    });

    it('reps === 36 → 公式仍然可用（36 / 1 = 36）', () => {
      // 100 * 36 = 3600
      expect(brzycki(100, 36)).toBe(3600);
    });
  });

  describe('brzycki — 非正 / 非有限输入 → 0', () => {
    it('weight = 0 → 0', () => {
      expect(brzycki(0, 5)).toBe(0);
    });

    it('weight < 0 → 0', () => {
      expect(brzycki(-50, 5)).toBe(0);
    });

    it('reps = 0 → 0', () => {
      expect(brzycki(100, 0)).toBe(0);
    });

    it('reps < 0 → 0', () => {
      expect(brzycki(100, -3)).toBe(0);
    });

    it('weight = NaN → 0', () => {
      expect(brzycki(NaN, 5)).toBe(0);
    });

    it('reps = NaN → 0', () => {
      expect(brzycki(100, NaN)).toBe(0);
    });

    it('weight = Infinity → 0', () => {
      expect(brzycki(Infinity, 5)).toBe(0);
    });
  });
});
