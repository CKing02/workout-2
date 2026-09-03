/**
 * G20 — equipment 类型谓词测试。
 */

import { EQUIPMENT, isEquipment } from '@/constants/equipment';

describe('constants/equipment.isEquipment', () => {
  it('内置器械 → true', () => {
    for (const e of EQUIPMENT) {
      expect(isEquipment(e)).toBe(true);
    }
  });

  it('未知字符串 → false', () => {
    expect(isEquipment('木棍')).toBe(false);
    expect(isEquipment('')).toBe(false);
  });
});