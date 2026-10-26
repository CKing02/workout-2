import type { Exercise } from '@/db/schema';
import type { SetTypeValue } from '@/constants/setTypes';

export interface TrainingPlanTemplateSet {
  setType: SetTypeValue;
  weight: number;
  reps: number;
  durationSeconds: number;
  distanceKm: number;
}

export interface TrainingPlanTemplateExercise {
  exerciseName: string;
  restSeconds: number;
  sets: TrainingPlanTemplateSet[];
}

export interface TrainingPlanTemplate {
  id: string;
  name: string;
  description: string;
  difficulty: '入门' | '进阶';
  durationMinutes: number;
  focus: string[];
  exercises: TrainingPlanTemplateExercise[];
}

export interface ResolvedTrainingPlanTemplateExercise
  extends TrainingPlanTemplateExercise {
  exerciseId: string;
}

function repSets(count: number, reps: number): TrainingPlanTemplateSet[] {
  return Array.from({ length: count }, () => ({
    setType: 'normal',
    weight: 0,
    reps,
    durationSeconds: 0,
    distanceKm: 0,
  }));
}

function timeSets(count: number, durationSeconds: number): TrainingPlanTemplateSet[] {
  return Array.from({ length: count }, () => ({
    setType: 'normal',
    weight: 0,
    reps: 0,
    durationSeconds,
    distanceKm: 0,
  }));
}

/**
 * Curated, read-only recommendations. Importing one creates an independent
 * private plan, so later edits never mutate this source definition.
 */
export const TRAINING_PLAN_TEMPLATES: readonly TrainingPlanTemplate[] = [
  {
    id: 'beginner-full-body',
    name: '入门全身训练',
    description: '用五个基础动作覆盖推、拉、蹲、髋和核心，适合每周训练 2–3 次。',
    difficulty: '入门',
    durationMinutes: 45,
    focus: ['全身', '基础力量'],
    exercises: [
      { exerciseName: '深蹲', restSeconds: 90, sets: repSets(3, 10) },
      { exerciseName: '杠铃卧推', restSeconds: 90, sets: repSets(3, 10) },
      { exerciseName: '高位下拉', restSeconds: 75, sets: repSets(3, 12) },
      { exerciseName: '哑铃罗马尼亚硬拉', restSeconds: 90, sets: repSets(3, 10) },
      { exerciseName: '平板支撑', restSeconds: 45, sets: timeSets(3, 40) },
    ],
  },
  {
    id: 'smith-upper-body',
    name: '史密斯上肢力量',
    description: '固定轨迹降低稳定负担，集中训练胸、背、肩与三头。',
    difficulty: '入门',
    durationMinutes: 50,
    focus: ['胸', '背', '肩'],
    exercises: [
      { exerciseName: '史密斯卧推', restSeconds: 90, sets: repSets(4, 8) },
      { exerciseName: '史密斯俯身划船', restSeconds: 90, sets: repSets(4, 10) },
      { exerciseName: '史密斯上斜卧推', restSeconds: 75, sets: repSets(3, 10) },
      { exerciseName: '史密斯坐姿肩推', restSeconds: 75, sets: repSets(3, 10) },
      { exerciseName: '跪姿绳索三头伸展', restSeconds: 60, sets: repSets(3, 12) },
    ],
  },
  {
    id: 'smith-lower-body',
    name: '史密斯下肢强化',
    description: '以深蹲和髋伸为主线，兼顾单腿稳定与小腿训练。',
    difficulty: '进阶',
    durationMinutes: 55,
    focus: ['臀', '股四头', '小腿'],
    exercises: [
      { exerciseName: '史密斯深蹲', restSeconds: 120, sets: repSets(4, 8) },
      { exerciseName: '史密斯硬拉', restSeconds: 120, sets: repSets(4, 8) },
      { exerciseName: '史密斯哈克深蹲', restSeconds: 90, sets: repSets(3, 10) },
      { exerciseName: '史密斯分腿蹲', restSeconds: 75, sets: repSets(3, 10) },
      { exerciseName: '史密斯站姿提踵', restSeconds: 60, sets: repSets(4, 15) },
    ],
  },
  {
    id: 'kneeling-upper-core',
    name: '跪姿上肢与核心',
    description: '利用跪姿减少下肢借力，强化背部、肩后束、手臂与核心控制。',
    difficulty: '入门',
    durationMinutes: 40,
    focus: ['背', '腹', '三头'],
    exercises: [
      { exerciseName: '跪姿单臂弹力带下拉', restSeconds: 60, sets: repSets(3, 12) },
      { exerciseName: '跪姿高位划船', restSeconds: 75, sets: repSets(3, 12) },
      { exerciseName: '跪姿绳索后束划船', restSeconds: 60, sets: repSets(3, 12) },
      { exerciseName: '跪姿绳索卷腹', restSeconds: 60, sets: repSets(3, 15) },
      { exerciseName: '跪姿健腹轮', restSeconds: 60, sets: repSets(3, 10) },
      { exerciseName: '跪姿背阔肌拉伸', restSeconds: 30, sets: timeSets(2, 30) },
    ],
  },
];

export function resolveTrainingPlanTemplate(
  template: TrainingPlanTemplate,
  catalog: readonly Exercise[],
): {
  exercises: ResolvedTrainingPlanTemplateExercise[];
  missingExerciseNames: string[];
} {
  const byName = new Map(catalog.map((exercise) => [exercise.name, exercise]));
  const exercises: ResolvedTrainingPlanTemplateExercise[] = [];
  const missingExerciseNames: string[] = [];

  for (const item of template.exercises) {
    const exercise = byName.get(item.exerciseName);
    if (!exercise) {
      missingExerciseNames.push(item.exerciseName);
      continue;
    }
    exercises.push({ ...item, exerciseId: exercise.id });
  }

  return { exercises, missingExerciseNames };
}

export function makeUniquePlanName(
  templateName: string,
  existingNames: readonly string[],
): string {
  const used = new Set(existingNames);
  if (!used.has(templateName)) return templateName;
  let suffix = 2;
  while (used.has(`${templateName}（${suffix}）`)) suffix += 1;
  return `${templateName}（${suffix}）`;
}
