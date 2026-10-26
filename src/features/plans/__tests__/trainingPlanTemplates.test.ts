import type { Exercise } from '@/db/schema';
import { EXERCISE_SEEDS } from '@/db/seeds/exercises';
import {
  makeUniquePlanName,
  resolveTrainingPlanTemplate,
  TRAINING_PLAN_TEMPLATES,
} from '../trainingPlanTemplates';

const catalog = EXERCISE_SEEDS.map(
  (seed, index) =>
    ({
      id: `exercise-${index}`,
      name: seed.name,
    }) as Exercise,
);

describe('training plan recommendations', () => {
  it('every template resolves completely against the built-in exercise catalog', () => {
    for (const template of TRAINING_PLAN_TEMPLATES) {
      const resolved = resolveTrainingPlanTemplate(template, catalog);
      expect(resolved.missingExerciseNames).toEqual([]);
      expect(resolved.exercises).toHaveLength(template.exercises.length);
      expect(resolved.exercises.every((item) => item.exerciseId)).toBe(true);
    }
  });

  it('ships usable prescriptions instead of empty exercise rows', () => {
    for (const template of TRAINING_PLAN_TEMPLATES) {
      expect(template.exercises.length).toBeGreaterThanOrEqual(5);
      for (const exercise of template.exercises) {
        expect(exercise.restSeconds).toBeGreaterThan(0);
        expect(exercise.sets.length).toBeGreaterThan(0);
        expect(
          exercise.sets.every(
            (set) => set.reps > 0 || set.durationSeconds > 0 || set.distanceKm > 0,
          ),
        ).toBe(true);
      }
    }
  });

  it('reports missing actions without silently dropping the whole template', () => {
    const template = TRAINING_PLAN_TEMPLATES[0];
    const partialCatalog = catalog.filter(
      (exercise) => exercise.name !== template.exercises[0].exerciseName,
    );
    const resolved = resolveTrainingPlanTemplate(template, partialCatalog);
    expect(resolved.missingExerciseNames).toEqual([
      template.exercises[0].exerciseName,
    ]);
    expect(resolved.exercises).toHaveLength(template.exercises.length - 1);
  });

  it('creates a non-colliding editable private-plan name', () => {
    expect(makeUniquePlanName('史密斯下肢强化', [])).toBe('史密斯下肢强化');
    expect(
      makeUniquePlanName('史密斯下肢强化', [
        '史密斯下肢强化',
        '史密斯下肢强化（2）',
      ]),
    ).toBe('史密斯下肢强化（3）');
  });
});
