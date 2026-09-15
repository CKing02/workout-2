/**
 * G38.3 latent fix — 跨 store 订阅,保持 planStore / trainingStore 里的
 * `Exercise` 快照与 useExerciseStore.exercises 同步。
 *
 * 背景:
 * - `PlanExerciseDraft.exercise: Exercise` 在 loadDetail/toDraftState 时快照。
 * - `ActiveExercise.exercise: Exercise` 在 startTraining 时快照。
 * - 用户从 ExerciseDetailScreen 的 ⋯ 菜单编辑动作 (改 metricType / name /
 *   muscleGroup / equipment),`useExerciseStore.update` 改了 exercises[],
 *   但上面两个 store 里的快照不刷新,导致 SetRow 字段陈旧 (G38.3 报告的 bug)。
 * - 旧做法是每个消费者自己订阅 useExerciseStore,但这样要改 N 处;这里改成
 *   单一订阅源,所有 `*.exercise` 引用始终反映最新值。
 *
 * 行为:
 * - 订阅 useExerciseStore,任一字段变化就检查 `exercises` 数组引用是否变;
 *   没变直接 return,避免 planStore/trainingStore 收到 set() 通知。
 * - 变了就 walk planStore.detailById[].exercises[] 和
 *   trainingStore.exercises[],逐项 `byId.get(draft.exerciseId)` 拿 live,
 *   引用变了才替换 (`{...row, exercise: live}`),不引用不替换 — 保证
 *   没有真实变化的快照行不产生新对象引用,React 重渲染精确。
 * - 删除同步 **不**做:如果一个 exercise 被删,plan / active 里仍留
 *   最后已知快照(让现有 UI 不崩)。ReplaceSheet / DeleteDialog 是从
 *   当时拉取的列表里取数据,不受影响。
 *
 * Setup 是幂等的:多次调 initExerciseSync() 只生效一次,返回同一个 teardown。
 */

import { useExerciseStore } from './exerciseStore';
import { usePlanStore, type PlanExerciseDraft } from './planStore';
import { useTrainingStore, type ActiveExercise } from './trainingStore';

let initialized = false;
let teardown: (() => void) | null = null;

function refreshPlanRow(
  row: PlanExerciseDraft,
  byId: Map<string, PlanExerciseDraft['exercise']>,
): PlanExerciseDraft {
  const live = byId.get(row.exerciseId);
  if (live && live !== row.exercise) {
    return { ...row, exercise: live };
  }
  return row;
}

function refreshActiveRow(
  row: ActiveExercise,
  byId: Map<string, ActiveExercise['exercise']>,
): ActiveExercise {
  // ActiveExercise 没有 exerciseId 字段;靠 row.exercise.id 查 live。
  const live = byId.get(row.exercise.id);
  if (live && live !== row.exercise) {
    return { ...row, exercise: live };
  }
  return row;
}

export function initExerciseSync(): () => void {
  if (initialized) {
    return teardown ?? (() => {});
  }
  initialized = true;

  // Cache the last seen `exercises` array reference so we early-exit when
  // exerciseStore fires for unrelated fields (e.g. `loading` toggle).
  let lastExercisesRef: ReadonlyArray<unknown> | null = null;

  const handleStateChange = (state: { exercises: ReadonlyArray<unknown> }) => {
    if (state.exercises === lastExercisesRef) return;
    lastExercisesRef = state.exercises;
    // 快照是只读的 byId Map,只在本次 handler 内用,closure 结束就丢。
    const byId = new Map<string, PlanExerciseDraft['exercise']>();
    for (const e of state.exercises as ReadonlyArray<PlanExerciseDraft['exercise']>) {
      byId.set(e.id, e);
    }

    usePlanStore.setState((s) => {
      const entries = Object.entries(s.detailById);
      if (entries.length === 0) return s;
      let dirty = false;
      const nextDetailById: Record<string, (typeof entries)[number][1]> = {};
      for (const [planId, detail] of entries) {
        let rowDirty = false;
        const newExercises = detail.exercises.map((d) => {
          const refreshed = refreshPlanRow(d, byId);
          if (refreshed !== d) rowDirty = true;
          return refreshed;
        });
        if (rowDirty) {
          dirty = true;
          nextDetailById[planId] = { ...detail, exercises: newExercises };
        } else {
          nextDetailById[planId] = detail;
        }
      }
      if (!dirty) return s;
      return { ...s, detailById: nextDetailById };
    });

    useTrainingStore.setState((s) => {
      // activeTraining 是 null 时(没在训练),exercises 也是空,no-op。
      const active = s.activeTraining;
      if (!active || active.exercises.length === 0) return s;
      let dirty = false;
      const newExercises = active.exercises.map((row) => {
        const refreshed = refreshActiveRow(row, byId);
        if (refreshed !== row) dirty = true;
        return refreshed;
      });
      if (!dirty) return s;
      return { ...s, activeTraining: { ...active, exercises: newExercises } };
    });
  };

  // 立刻同步一次:启动时 useExerciseStore.exercises 可能已经有数据
  // (e.g. test 场景,或者 boot 期间 reload 完成),不再等下一次 state 变化。
  handleStateChange(useExerciseStore.getState() as { exercises: ReadonlyArray<unknown> });

  const unsubscribe = useExerciseStore.subscribe(handleStateChange);

  teardown = () => {
    unsubscribe();
    initialized = false;
    teardown = null;
    lastExercisesRef = null;
  };
  return teardown;
}
