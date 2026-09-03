/**
 * G20 — muscleGroups 类型谓词测试。
 */

import { MUSCLE_GROUPS, isMuscleGroup } from '@/constants/muscleGroups';

describe('constants/muscleGroups.isMuscleGroup', () => {
  it('内置主肌群 → true', () => {
    for (const g of MUSCLE_GROUPS) {
      expect(isMuscleGroup(g)).toBe(true);
    }
  });

  it('未知字符串 → false', () => {
    expect(isMuscleGroup('乱写')).toBe(false);
    expect(isMuscleGroup('')).toBe(false);
  });
});