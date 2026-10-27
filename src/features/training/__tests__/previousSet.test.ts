import type { TrainingSet } from '@/db/schema';
import { previousSetValues } from '@/features/training/previousSet';

const previous: TrainingSet = {
  id: 'set', trainingId: 'training', exerciseId: 'exercise', exerciseNameSnapshot: '动作',
  metricTypeSnapshot: 'weight_reps', position: 0, setIndex: 1,
  weight: 42.5, reps: 8, durationSeconds: null, distanceKm: null,
  setType: 'warmup', completed: true,
};

it('带入上次数据时只复制当前动作相关字段，保留公斤并不改变组类型', () => {
  expect(previousSetValues(previous, ['weight', 'reps'])).toEqual({ weight: 42.5, reps: 8 });
  expect(previousSetValues(previous, ['reps'])).toEqual({ reps: 8 });
  expect(previousSetValues(previous, ['distance_km'])).toEqual({});
});
