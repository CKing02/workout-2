/**
 * G20 — freeTraining 单元测试（G11）。
 */

import {
  FREE_TRAINING_NAME,
  isFreeTraining,
  resolveTrainingTitle,
} from '@/features/training/freeTraining';

describe('features/training/freeTraining', () => {
  describe('resolveTrainingTitle', () => {
    it('null → "自由训练"', () => {
      expect(resolveTrainingTitle(null)).toBe('自由训练');
    });

    it('undefined → "自由训练"', () => {
      expect(resolveTrainingTitle(undefined)).toBe('自由训练');
    });

    it('空白字符串 → "自由训练"', () => {
      expect(resolveTrainingTitle('   ')).toBe('自由训练');
    });

    it('正常计划名 → 原样返回', () => {
      expect(resolveTrainingTitle('胸日')).toBe('胸日');
    });

    it('前后空格被 trim', () => {
      expect(resolveTrainingTitle('  背日  ')).toBe('背日');
    });
  });

  describe('isFreeTraining', () => {
    it('planId 为 null → true', () => {
      expect(isFreeTraining(null)).toBe(true);
    });

    it('planId 为 undefined → true', () => {
      expect(isFreeTraining(undefined)).toBe(true);
    });

    it('planId 有值 → false', () => {
      expect(isFreeTraining('plan-1')).toBe(false);
    });
  });

  it('FREE_TRAINING_NAME 常量值', () => {
    expect(FREE_TRAINING_NAME).toBe('自由训练');
  });
});