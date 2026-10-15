/**
 * G20 — units.ts 单元测试。
 *
 * GOALS.md G10 自检明确要求："单位换算逻辑单元测试或可复现"。
 */

import {
  formatWeight,
  kgToLb,
  lbToKg,
  parseWeightInput,
} from '@/utils/units';

describe('utils/units', () => {
  describe('kgToLb', () => {
    it('0 kg → 0 lb', () => {
      expect(kgToLb(0)).toBe(0);
    });

    it('NaN → 0（防 NaN 传播）', () => {
      expect(kgToLb(NaN)).toBe(0);
    });

    it('Infinity → 0（防 Infinity 传播）', () => {
      expect(kgToLb(Infinity)).toBe(0);
    });

    it('100 kg → 220.46 lb（系数 2.2046）', () => {
      expect(kgToLb(100)).toBeCloseTo(220.46, 5);
    });
  });

  describe('lbToKg', () => {
    it('lbToKg 与 kgToLb 对称', () => {
      // round-trip：100 kg → lb → kg 应回到 100（允许 0.01 误差）
      const roundTrip = lbToKg(kgToLb(100));
      expect(roundTrip).toBeCloseTo(100, 2);
    });

    it('NaN → 0', () => {
      expect(lbToKg(NaN)).toBe(0);
    });
  });

  describe('formatWeight', () => {
    it('kg 模式：保留 1 位小数 + 单位', () => {
      expect(formatWeight(10, 'kg')).toBe('10.0 kg');
    });

    it('lb 模式：保留 1 位小数 + 单位', () => {
      expect(formatWeight(100, 'lb')).toBe('220.5 lb');
    });

    it.each([
      [100, '220.5 lb'],
      [60, '132.3 lb'],
      [40, '88.2 lb'],
    ])('kg → lb 换算：%d kg 显示为 %s', (kg, expected) => {
      expect(formatWeight(kg, 'lb')).toBe(expected);
    });

    it('NaN → 0.0 + 单位（不显示 NaN）', () => {
      expect(formatWeight(NaN, 'kg')).toBe('0.0 kg');
    });
  });

  describe('parseWeightInput', () => {
    it('纯数字 + kg 单位：原样返回', () => {
      expect(parseWeightInput('100', 'kg')).toBe(100);
    });

    it('带空格和 kg 后缀：剥掉后缀', () => {
      expect(parseWeightInput('100 kg', 'kg')).toBe(100);
    });

    it('换算规则：当前 unit 决定存储值（存储统一 kg）', () => {
      // 实现的换算语义：
      //  - 后缀只用于剥，不参与换算
      //  - 当前 unit='kg'：直接返回 n（kg 就是存储单位）
      //  - 当前 unit='lb'：返回 lbToKg(n)（lb → kg）
      // 跨单位输入错误（例如 '100 kg' 但当前是 lb）由调用方 NumberInput 兜底，
      // parseWeightInput 不感知。
      expect(parseWeightInput('100 kg', 'kg')).toBe(100);
      expect(parseWeightInput('100 lb', 'kg')).toBe(100);
      expect(parseWeightInput('100 lb', 'lb')).toBeCloseTo(45.36, 5);
      // 异常组合（用户输错单位）：实现忽略后缀语义，按当前 unit 换算
      expect(parseWeightInput('100 kg', 'lb')).toBeCloseTo(45.36, 5);
    });

    it('空字符串 → NaN（调用方负责兜底）', () => {
      expect(parseWeightInput('', 'kg')).toBeNaN();
    });

    it('非数字 → NaN', () => {
      expect(parseWeightInput('abc', 'kg')).toBeNaN();
    });

    it('大小写不敏感：KG / Lb 后缀都能剥', () => {
      expect(parseWeightInput('100 KG', 'kg')).toBe(100);
      expect(parseWeightInput('100 Lb', 'kg')).toBe(100);
      // '100 LB' 当前单位 lb：剥后缀后 100 → lbToKg → 45.36 kg（存储用 kg）
      expect(parseWeightInput('100 LB', 'lb')).toBeCloseTo(45.36, 5);
    });
  });
});
