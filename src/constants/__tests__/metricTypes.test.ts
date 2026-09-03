/**
 * G20 — metricTypes 类型谓词测试。
 */

import { METRIC_TYPE_VALUES, isMetricType } from '@/constants/metricTypes';

describe('constants/metricTypes.isMetricType', () => {
  it('内置 metric type → true', () => {
    for (const v of METRIC_TYPE_VALUES) {
      expect(isMetricType(v)).toBe(true);
    }
  });

  it('未知字符串 → false', () => {
    expect(isMetricType('xyz')).toBe(false);
    expect(isMetricType('')).toBe(false);
  });
});