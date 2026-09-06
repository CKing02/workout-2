/**
 * G23 — `dedupByFingerprint` 单元测试。
 *
 * 覆盖 AC-23.1 / AC-23.2 / AC-23.3 + LRU 容量上限 + reset。
 * 不依赖 Date.now() —— 通过 `shouldRecord(fp, now)` 第二参数注入虚拟时钟。
 */

import {
  DEDUPE_WINDOW_MS,
  MAX_TRACKED,
  resetForTests,
  shouldRecord,
  trackedCount,
} from '@/lib/diagnostics/dedupByFingerprint';

describe('lib/diagnostics/dedupByFingerprint', () => {
  beforeEach(() => {
    resetForTests();
  });

  describe('shouldRecord — 基础', () => {
    it('首次见到 fingerprint → true', () => {
      expect(shouldRecord('fp_a', 1_000)).toBe(true);
    });

    it('同一 fingerprint 30 秒内重复 → false', () => {
      expect(shouldRecord('fp_a', 1_000)).toBe(true);
      expect(shouldRecord('fp_a', 1_000 + 5_000)).toBe(false);
      expect(shouldRecord('fp_a', 1_000 + 29_999)).toBe(false);
    });

    it('同一 fingerprint 跨过 30 秒边界 → true（第 2 条）', () => {
      expect(shouldRecord('fp_a', 1_000)).toBe(true);
      expect(shouldRecord('fp_a', 1_000 + DEDUPE_WINDOW_MS)).toBe(true);
      expect(shouldRecord('fp_a', 1_000 + DEDUPE_WINDOW_MS + 1)).toBe(false);
    });

    it('不同 fingerprint 互不影响', () => {
      expect(shouldRecord('fp_a', 1_000)).toBe(true);
      expect(shouldRecord('fp_b', 1_000)).toBe(true);
      expect(shouldRecord('fp_a', 2_000)).toBe(false);
      expect(shouldRecord('fp_b', 2_000)).toBe(false);
      expect(shouldRecord('fp_c', 3_000)).toBe(true);
    });

    it('不传 now 时使用 Date.now()', () => {
      // 我们没法精准断言 Date.now，但能确保不抛 + 第二次仍能 dedupe
      expect(shouldRecord('fp_real')).toBe(true);
      expect(shouldRecord('fp_real')).toBe(false);
    });
  });

  describe('AC-23.3 — 100 次同 fingerprint 5s 内只 1 次', () => {
    it('5 秒内 100 次同 fingerprint → shouldRecord 返回 true 仅 1 次', () => {
      let trueCount = 0;
      for (let i = 0; i < 100; i++) {
        if (shouldRecord('fp_burst', 1_000 + i * 50)) trueCount++;
      }
      expect(trueCount).toBe(1);
      expect(trackedCount()).toBe(1);
    });
  });

  describe('LRU 容量上限', () => {
    it('超过 MAX_TRACKED 个不同 fp → 最早 first-write 被淘汰', () => {
      const base = 1_000_000;

      // 插入 MAX_TRACKED + 5 个 fp
      for (let i = 0; i < MAX_TRACKED + 5; i++) {
        shouldRecord(`fp_${i}`, base + i);
      }

      expect(trackedCount()).toBe(MAX_TRACKED);

      // 最早 5 个 fp 已淘汰，重新出现时应被当作"新事件"
      for (let i = 0; i < 5; i++) {
        expect(shouldRecord(`fp_${i}`, base + MAX_TRACKED + 100 + i)).toBe(
          true,
        );
      }
      // 仍然在容量上限内
      expect(trackedCount()).toBe(MAX_TRACKED);
    });

    it('命中时不增长 Map 容量（不会因 burst 触发 LRU 淘汰）', () => {
      shouldRecord('fp_a', 1_000);
      // 1000 次重复 → 全部 skip，但 Map 不增长
      for (let i = 0; i < 1000; i++) {
        shouldRecord('fp_a', 1_001 + i);
      }
      expect(trackedCount()).toBe(1);
    });
  });

  describe('resetForTests', () => {
    it('清空后所有 fp 重新可记录', () => {
      expect(shouldRecord('fp_x', 1_000)).toBe(true);
      expect(shouldRecord('fp_x', 2_000)).toBe(false);
      resetForTests();
      expect(trackedCount()).toBe(0);
      expect(shouldRecord('fp_x', 3_000)).toBe(true);
    });
  });
});
