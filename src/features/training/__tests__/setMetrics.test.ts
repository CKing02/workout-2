import {
  formatTrainingSetMetric,
  getSetMetricValidationError,
  normalizeSetMetricValues,
  resolveTrainingSetMetricType,
} from '@/features/training/setMetrics';

const contaminated = {
  weight: 0,
  reps: 0,
  durationSeconds: 25,
  distanceKm: 0,
};

describe('setMetrics', () => {
  it('按显式 time 快照显示时长，不受 weight=0 / reps=0 干扰', () => {
    const set = { ...contaminated, metricTypeSnapshot: 'time' };
    expect(resolveTrainingSetMetricType(set)).toBe('time');
    expect(formatTrainingSetMetric(set, 'kg')).toBe('25s');
  });

  it('旧记录没有快照时优先从 durationSeconds 推断 time', () => {
    expect(resolveTrainingSetMetricType(contaminated)).toBe('time');
  });

  it.each([
    ['reps', { reps: 12 }, '12 次'],
    ['kg', { weight: 20 }, '20.0 kg'],
    ['weight_reps', { weight: 20, reps: 12 }, '20.0 kg × 12'],
    ['+kg', { weight: 20, reps: 12 }, '20.0 kg × 12'],
    ['-kg', { weight: 20, reps: 12 }, '20.0 kg × 12'],
    ['time', { durationSeconds: 90 }, '1m 30s'],
    ['km', { distanceKm: 3.2 }, '3.20 km'],
  ])('%s 使用自己的字段格式化', (metricType, values, expected) => {
    expect(
      formatTrainingSetMetric(
        {
          weight: null,
          reps: null,
          durationSeconds: null,
          distanceKm: null,
          metricTypeSnapshot: metricType,
          ...values,
        },
        'kg',
      ),
    ).toBe(expected);
  });

  it('规范化 time 时清除计划带入的无关零值', () => {
    expect(normalizeSetMetricValues('time', contaminated)).toEqual({
      weight: null,
      reps: null,
      durationSeconds: 25,
      distanceKm: null,
    });
  });

  it('time / km 缺实际值时给出完成校验错误', () => {
    expect(getSetMetricValidationError('time', { durationSeconds: null })).toContain('实际时长');
    expect(getSetMetricValidationError('km', { distanceKm: 0 })).toContain('实际距离');
    expect(getSetMetricValidationError('time', { durationSeconds: 1 })).toBeNull();
    expect(getSetMetricValidationError('km', { distanceKm: 0.1 })).toBeNull();
  });
});
