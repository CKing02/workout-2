/**
 * G20 — setTypes 类型谓词测试。
 */

import { SET_TYPE_VALUES, isSetType } from '@/constants/setTypes';

describe('constants/setTypes.isSetType', () => {
  it('内置 set type → true', () => {
    for (const v of SET_TYPE_VALUES) {
      expect(isSetType(v)).toBe(true);
    }
  });

  it('未知字符串 → false', () => {
    expect(isSetType('xyz')).toBe(false);
    expect(isSetType('')).toBe(false);
  });
});