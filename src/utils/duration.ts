export type DurationUnit = 'seconds' | 'minutes' | 'hours';

export const MAX_DURATION_SECONDS = 24 * 60 * 60;

export const DURATION_UNITS: ReadonlyArray<{
  value: DurationUnit;
  label: string;
  suffix: string;
  precision: number;
}> = [
  { value: 'seconds', label: '秒', suffix: 's', precision: 0 },
  { value: 'minutes', label: '分钟', suffix: 'min', precision: 2 },
  { value: 'hours', label: '小时', suffix: 'h', precision: 3 },
];

const UNIT_SECONDS: Record<DurationUnit, number> = {
  seconds: 1,
  minutes: 60,
  hours: 3600,
};

export function durationValueToSeconds(
  value: number,
  unit: DurationUnit,
): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(
    MAX_DURATION_SECONDS,
    Math.max(0, Math.round(value * UNIT_SECONDS[unit])),
  );
}

export function secondsToDurationValue(
  seconds: number | null | undefined,
  unit: DurationUnit,
): number {
  if (!Number.isFinite(seconds)) return 0;
  return Math.max(0, Number(seconds)) / UNIT_SECONDS[unit];
}

export function inferDurationUnit(
  seconds: number | null | undefined,
): DurationUnit {
  const safe = Math.max(0, Number(seconds) || 0);
  if (safe >= 3600 && safe % 3600 === 0) return 'hours';
  if (safe >= 60 && safe % 60 === 0) return 'minutes';
  return 'seconds';
}

/** Stable compact representation used in set rows. */
export function formatSetDuration(
  seconds: number | null | undefined,
  empty = '—',
): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
    return empty;
  }
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainder = safe % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(remainder)}`;
  return `${pad(minutes)}:${pad(remainder)}`;
}
