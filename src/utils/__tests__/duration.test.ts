import {
  durationValueToSeconds,
  formatSetDuration,
  inferDurationUnit,
  secondsToDurationValue,
} from '@/utils/duration';

describe('duration helpers', () => {
  test('converts seconds, minutes, and hours to canonical seconds', () => {
    expect(durationValueToSeconds(45, 'seconds')).toBe(45);
    expect(durationValueToSeconds(1.5, 'minutes')).toBe(90);
    expect(durationValueToSeconds(0.5, 'hours')).toBe(1800);
  });

  test('round-trips a duration through the selected display unit', () => {
    expect(secondsToDurationValue(90, 'minutes')).toBe(1.5);
    expect(secondsToDurationValue(5400, 'hours')).toBe(1.5);
  });

  test('infers a human-friendly exact unit without losing seconds', () => {
    expect(inferDurationUnit(7200)).toBe('hours');
    expect(inferDurationUnit(120)).toBe('minutes');
    expect(inferDurationUnit(90)).toBe('seconds');
  });

  test('formats rows as clock values and preserves an empty state', () => {
    expect(formatSetDuration(null)).toBe('—');
    expect(formatSetDuration(0)).toBe('00:00');
    expect(formatSetDuration(90)).toBe('01:30');
    expect(formatSetDuration(3661)).toBe('1:01:01');
  });
});
