/**
 * G20 — dateGroups.ts 单元测试。
 *
 * 涵盖格式化 / 显示兜底函数；`groupHistoryByDate` 涉及 `Date.now()` 的
 * 时间分组，留给后续 G20.x 批次（需要 fake timer）。
 */

import {
  displayExerciseCount,
  displaySetCount,
  formatDurationShort,
  formatStartHHMM,
} from '@/utils/dateGroups';

describe('utils/dateGroups', () => {
  describe('formatStartHHMM', () => {
    it('本地 14:30 → "14:30"（setup 固定 TZ=UTC）', () => {
      // 2024-06-15T14:30:00Z 在 UTC 下小时=14，分钟=30
      const ms = Date.UTC(2024, 5, 15, 14, 30, 0);
      expect(formatStartHHMM(ms)).toBe('14:30');
    });

    it('0 点补零：00:05', () => {
      const ms = Date.UTC(2024, 0, 1, 0, 5, 0);
      expect(formatStartHHMM(ms)).toBe('00:05');
    });

    it('23:59 → "23:59"', () => {
      const ms = Date.UTC(2024, 0, 1, 23, 59, 0);
      expect(formatStartHHMM(ms)).toBe('23:59');
    });
  });

  describe('formatDurationShort', () => {
    it('null → "—"', () => {
      expect(formatDurationShort(null)).toBe('—');
    });

    it('undefined → "—"', () => {
      expect(formatDurationShort(undefined)).toBe('—');
    });

    it('NaN → "—"', () => {
      expect(formatDurationShort(NaN)).toBe('—');
    });

    it('0 秒 → "0:00"', () => {
      expect(formatDurationShort(0)).toBe('0:00');
    });

    it('125 秒 → "2:05"', () => {
      expect(formatDurationShort(125)).toBe('2:05');
    });

    it('3725 秒（≥1 小时） → "1:02:05"', () => {
      expect(formatDurationShort(3725)).toBe('1:02:05');
    });

    it('负数 → "0:00"（防御 clamp）', () => {
      expect(formatDurationShort(-5)).toBe('0:00');
    });

    it('小数向下取整：125.9 → "2:05"', () => {
      expect(formatDurationShort(125.9)).toBe('2:05');
    });
  });

  describe('displayExerciseCount', () => {
    it('t.exerciseCount 有值时优先返回', () => {
      expect(displayExerciseCount({ exerciseCount: 5 } as never, null)).toBe(5);
    });

    it('t.exerciseCount 为 null 时用 fallback', () => {
      expect(displayExerciseCount({ exerciseCount: null } as never, 3)).toBe(3);
    });

    it('t.exerciseCount 缺失 + fallback 也为 null → 0', () => {
      expect(displayExerciseCount({} as never, null)).toBe(0);
    });
  });

  describe('displaySetCount', () => {
    it('t.setCount 有值时优先返回', () => {
      expect(displaySetCount({ setCount: 12 } as never, null)).toBe(12);
    });

    it('t.setCount 为 null 时用 fallback', () => {
      expect(displaySetCount({ setCount: null } as never, 7)).toBe(7);
    });

    it('t.setCount 缺失 + fallback 也为 null → 0', () => {
      expect(displaySetCount({} as never, null)).toBe(0);
    });
  });
});