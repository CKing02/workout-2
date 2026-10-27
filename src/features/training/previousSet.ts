import type { MetricField } from '@/constants/metricTypes';
import type { TrainingSet } from '@/db/schema';
import type { CreateTrainingSetInput } from '@/db/repositories/trainingSetRepo';

/** Copy only fields relevant to the current exercise, retaining kg storage. */
export function previousSetValues(previous: TrainingSet, fields: readonly MetricField[]): Partial<CreateTrainingSetInput> {
  const patch: Partial<CreateTrainingSetInput> = {};
  if (fields.includes('weight') && previous.weight != null) patch.weight = previous.weight;
  if (fields.includes('reps') && previous.reps != null) patch.reps = previous.reps;
  if (fields.includes('distance_km') && previous.distanceKm != null) patch.distanceKm = previous.distanceKm;
  return patch;
}
