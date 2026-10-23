/**
 * Metric-aware helpers shared by active-training persistence and history UI.
 *
 * A set's metric type is data, not something that should be inferred from
 * whether an unrelated numeric column happens to contain 0 or NULL. New
 * history rows therefore carry `metricTypeSnapshot`; inference remains only
 * as a compatibility fallback for old/imported rows.
 */

import type { Unit } from '@/store/settingsStore';
import { formatWeight } from '@/utils/units';

export interface SetMetricValues {
  weight?: number | null;
  reps?: number | null;
  durationSeconds?: number | null;
  distanceKm?: number | null;
}

export interface NormalizedSetMetricValues {
  weight: number | null;
  reps: number | null;
  durationSeconds: number | null;
  distanceKm: number | null;
}

export interface MetricSnapshotSet extends SetMetricValues {
  metricTypeSnapshot?: string | null;
}

/** Clear columns that do not belong to the exercise's configured metric. */
export function normalizeSetMetricValues(
  metricType: string,
  values: SetMetricValues,
): NormalizedSetMetricValues {
  switch (metricType) {
    case 'time':
      return {
        weight: null,
        reps: null,
        durationSeconds: values.durationSeconds ?? null,
        distanceKm: null,
      };
    case 'km':
      return {
        weight: null,
        reps: null,
        durationSeconds: null,
        distanceKm: values.distanceKm ?? null,
      };
    case 'reps':
      return {
        weight: null,
        reps: values.reps ?? null,
        durationSeconds: null,
        distanceKm: null,
      };
    case 'kg':
      return {
        weight: values.weight ?? null,
        reps: null,
        durationSeconds: null,
        distanceKm: null,
      };
    case 'weight_reps':
    case '+kg':
    case '-kg':
    default:
      return {
        weight: values.weight ?? null,
        reps: values.reps ?? null,
        durationSeconds: null,
        distanceKm: null,
      };
  }
}

/**
 * Return a user-facing validation error for metrics that require an actual
 * measured value before a set can be marked complete.
 */
export function getSetMetricValidationError(
  metricType: string,
  values: SetMetricValues,
): string | null {
  if (
    metricType === 'time' &&
    (values.durationSeconds == null ||
      !Number.isFinite(values.durationSeconds) ||
      values.durationSeconds <= 0)
  ) {
    return '请先记录本组实际时长';
  }
  if (
    metricType === 'km' &&
    (values.distanceKm == null ||
      !Number.isFinite(values.distanceKm) ||
      values.distanceKm <= 0)
  ) {
    return '请先填写本组实际距离';
  }
  return null;
}

/** Resolve new snapshots first; value-shape inference is legacy-only. */
export function resolveTrainingSetMetricType(set: MetricSnapshotSet): string {
  if (set.metricTypeSnapshot) return set.metricTypeSnapshot;
  if (set.durationSeconds != null) return 'time';
  if (
    set.distanceKm != null &&
    Number.isFinite(set.distanceKm) &&
    set.distanceKm > 0
  ) {
    return 'km';
  }
  if (set.weight != null && set.reps != null) return 'weight_reps';
  if (set.weight != null) return 'kg';
  if (set.reps != null) return 'reps';
  return 'weight_reps';
}

export function formatMetricDuration(
  totalSeconds: number | null | undefined,
): string {
  if (totalSeconds == null || !Number.isFinite(totalSeconds)) return '—';
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  if (hours > 0) return `${hours}h ${pad(minutes)}m`;
  if (minutes > 0) return `${minutes}m ${pad(remainder)}s`;
  return `${remainder}s`;
}

/** Format a historical set according to its explicit metric semantics. */
export function formatTrainingSetMetric(
  set: MetricSnapshotSet,
  unit: Unit,
): string {
  const metricType = resolveTrainingSetMetricType(set);
  switch (metricType) {
    case 'time':
      return formatMetricDuration(set.durationSeconds);
    case 'km':
      return set.distanceKm == null || !Number.isFinite(set.distanceKm)
        ? '—'
        : `${set.distanceKm.toFixed(2)} km`;
    case 'reps':
      return set.reps == null ? '—' : `${set.reps} 次`;
    case 'kg':
      return set.weight == null ? '—' : formatWeight(set.weight, unit);
    case 'weight_reps':
    case '+kg':
    case '-kg':
    default:
      if (set.weight != null && set.reps != null) {
        return `${formatWeight(set.weight, unit)} × ${set.reps}`;
      }
      if (set.weight != null) return formatWeight(set.weight, unit);
      if (set.reps != null) return `${set.reps} 次`;
      return '—';
  }
}
