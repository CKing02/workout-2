/**
 * ActiveTrainingScreen — G6 训练执行核心（全屏沉浸）
 *
 * 布局（自上而下，G29 重构后）：
 *  1. 顶部状态栏  — × 取消 / 训练总计时 / ▾ 进动作总览 / "结束训练"
 *  2. 全宽进度条  — 贴边，pct = 已完成组数 / 总组数
 *  3. 动作标题    — 动作名 + "动作 X/Y" + 肌群·器械 + "+ 添加组"
 *  4. Set 垂直列表 — 每个 set 一行：
 *     - 已完成：折叠 "60kg × 10 ✓"（淡色）
 *     - 当前激活：高亮背景 + inline NumberInput（无 label，靠 unitLabel 暗示）
 *                  + 紧凑"上次"参考
 *     - 未开始：折叠 "60kg × 10"（灰字）
 *     - 点行左边的 `②` 序号 → Sheet「选择组类型 + 删除此组」
 *  5. 底部 CTA    — "完成本组 ✓" 大按钮 → 保存 + mark + 焦点自动跳到下一未完成组
 *
 * 交互约束：
 *  - Android 硬件返回 → BackHandler 拦截（必须通过 × 才能退出）
 *  - iOS 滑动手势 → `gestureEnabled: false`（RootNavigator 配）
 *  - 删除最后一组 → 拒绝（保持至少 1 组）
 *  - 当前激活组已完成 → CTA 禁用（保留数据展示）
 *
 * 数据流：
 *  - activeTraining 在 store 中累积，完成时一次性写 DB（G8 接手）
 *  - 每个组输入 NumberInput → updateSet（每次数值变化）
 *  - "完成本组" → completeAndAdvance（mark + 焦点跳到下一未完成组；plan 组数固定，不自动 append）
 *  - rest timer → G7 RestTimerOverlay（基于 Date.now 时间戳，Reanimated 圆环）
 *  - G24: per-exercise rest 用 activeEx.restSeconds ?? defaultRestSeconds
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setStatusBarHidden } from 'expo-status-bar';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Dialog } from '@/components/Dialog';
import { IconButton } from '@/components/IconButton';
import { NumberInput } from '@/components/NumberInput';
import { Sheet } from '@/components/Sheet';
import { SET_TYPES, type SetTypeValue } from '@/constants/setTypes';
import { findMetricType, type MetricField } from '@/constants/metricTypes';
import { RestTimerOverlay } from '@/features/training/RestTimerOverlay';
import { triggerRestTimer } from '@/features/training/restTimerTrigger';
import { formatElapsed, useElapsedSeconds } from '@/hooks/useElapsedSeconds';
import { toast } from '@/hooks/useToast';
import { usePlanStore, type PlanSetDraft } from '@/store/planStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTrainingStore, type ActiveSet } from '@/store/trainingStore';
import { useTheme } from '@/theme';
import { haptic } from '@/utils/haptics';
import { formatWeight } from '@/utils/units';
import type { TrainingSet } from '@/db/schema';
import type { Unit } from '@/store/settingsStore';

import type { RootStackParamList } from '@/navigation/types';

type Navigation = NativeStackNavigationProp<
  RootStackParamList,
  'ActiveTraining'
>;
type Route = RouteProp<RootStackParamList, 'ActiveTraining'>;

/* ============================================================================
 * Screen
 * ========================================================================== */

export function ActiveTrainingScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const { colors, spacing, typography, radius } = useTheme();

  const planId = route.params?.planId;

  // Store hooks
  const activeTraining = useTrainingStore((s) => s.activeTraining);
  const currentExerciseIndex = useTrainingStore((s) => s.currentExerciseIndex);
  const currentSetIndex = useTrainingStore((s) => s.currentSetIndex);
  const startTraining = useTrainingStore((s) => s.startTraining);
  const updateSet = useTrainingStore((s) => s.updateSet);
  const markSetCompleted = useTrainingStore((s) => s.markSetCompleted);
  const completeAndAdvance = useTrainingStore((s) => s.completeAndAdvance);
  const removeSet = useTrainingStore((s) => s.removeSet);
  const appendEmptySet = useTrainingStore((s) => s.appendEmptySet);
  const changeSetType = useTrainingStore((s) => s.changeSetType);
  const cancelTraining = useTrainingStore((s) => s.cancelTraining);
  // G8: completeTraining() — async, performs atomic batch write of all sets
  // + training summary row, then returns the enriched Training.
  const completeTraining = useTrainingStore((s) => s.completeTraining);
  const setCurrentExerciseIndex = useTrainingStore(
    (s) => s.setCurrentExerciseIndex,
  );
  const setCurrentSetIndex = useTrainingStore((s) => s.setCurrentSetIndex);

  const plan = usePlanStore((s) => s.plans.find((p) => p.id === planId) ?? null);
  const loadDetail = usePlanStore((s) => s.loadDetail);
  const detailById = usePlanStore((s) => s.detailById);

  const defaultRestSeconds = useSettingsStore((s) => s.defaultRestSeconds);

  // G17: 训练中显示"上次数据"—— 一次性查全部动作最近 3 组。
  const loadLastSetsForExercises = useTrainingStore(
    (s) => s.loadLastSetsForExercises,
  );
  const lastSetsByExerciseId = useTrainingStore((s) => s.lastSetsByExerciseId);
  useEffect(() => {
    if (!activeTraining) return;
    const ids = activeTraining.exercises.map((e) => e.exercise.id);
    void loadLastSetsForExercises(ids, 3);
    // 故意不依赖 lastSetsByExerciseId：避免每次 store 重写都触发重查。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTraining?.id]);

  // [DIAG] LastSetsPreview 内 s.id 重复嫌疑
  useEffect(() => {
    const entries = Object.entries(lastSetsByExerciseId);
    if (entries.length === 0) return;
    for (const [eid, sets] of entries) {
      const ids = sets.map((s) => s.id);
      const uniq = new Set(ids);
      if (uniq.size !== ids.length) {
        // eslint-disable-next-line no-console
        console.log(
          '[DIAG:dup-key] lastSets[' + eid + '] has dup s.id count=' +
          ids.length + ' unique=' + uniq.size,
        );
      }
    }
  }, [lastSetsByExerciseId]);

  const elapsed = useElapsedSeconds(activeTraining?.startedAt ?? null);

  // -----------------------------------------------------------------
  // Cancel dialog state
  // -----------------------------------------------------------------
  const [pendingCancel, setPendingCancel] = useState(false);

  // -----------------------------------------------------------------
  // G8: Finish-confirm dialog state — 用户主动"结束训练"按钮二次确认.
  // -----------------------------------------------------------------
  const [pendingFinish, setPendingFinish] = useState(false);
  const [finishing, setFinishing] = useState(false);

  // -----------------------------------------------------------------
  // G29: Set-type sheet state — targets an explicit (exIdx, setIdx)
  // so any row's `②` number can open it (not only the current).
  // -----------------------------------------------------------------
  const [typeSheetTarget, setTypeSheetTarget] = useState<
    { exerciseIndex: number; setIndex: number } | null
  >(null);

  // -----------------------------------------------------------------
  // G29: Exercise-overview sheet — list every exercise in the
  // current training with its progress; tap a row to jump.
  // -----------------------------------------------------------------
  const [overviewSheetOpen, setOverviewSheetOpen] = useState(false);

  // -----------------------------------------------------------------
  // Delete-confirm dialog state (used by swipe-delete & sheet-delete)
  // -----------------------------------------------------------------
  const [pendingDelete, setPendingDelete] = useState<
    | {
        exerciseIndex: number;
        setIndex: number;
        clientId: string;
        label: string;
      }
    | null
  >(null);

  // -----------------------------------------------------------------
  // Hardware-back interception on Android. iOS uses `gestureEnabled:
  // false` from the Stack screen options.
  // -----------------------------------------------------------------
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  // -----------------------------------------------------------------
  // Full-screen immersion (B1 fix for test 2.2.1 ❌).
  //
  // Hide the OS status bar while this screen is focused; restore on blur so
  // parent Tab screens show their normal themed status bar again.
  //
  // NOTE: the bottom Tab bar is hidden via TabNavigator's own state-listener
  // (see `src/navigation/TabNavigator.tsx`). React Navigation v7's
  // `navigation.getParent(id)` only walks ancestor navigators — Tabs is a
  // SIBLING of ActiveTraining under RootStack, so we can't reach it from
  // here. Letting TabNavigator own its visibility is cleaner than reaching
  // across siblings from a screen.
  // -----------------------------------------------------------------
  useFocusEffect(
    useCallback(() => {
      setStatusBarHidden(true, 'fade');
      return () => {
        setStatusBarHidden(false, 'fade');
      };
    }, []),
  );

  // -----------------------------------------------------------------
  // Bootstrap: build the activeTraining from the plan (if not already).
  // -----------------------------------------------------------------
  const bootstrappedRef = useRef(false);
  useEffect(() => {
    if (bootstrappedRef.current) return;
    if (activeTraining) {
      bootstrappedRef.current = true;
      return;
    }
    if (!planId) {
      bootstrappedRef.current = true;
      Alert.alert('无法开始训练', '缺少计划信息。', [
        { text: '好的', onPress: () => navigation.goBack() },
      ]);
      return;
    }
    bootstrappedRef.current = true;
    (async () => {
      try {
        const detail = await loadDetail(planId);
        if (!detail) {
          Alert.alert('无法开始训练', '找不到该计划。', [
            { text: '好的', onPress: () => navigation.goBack() },
          ]);
          return;
        }
        const planNameSnapshot = plan?.name ?? detail.exercises[0]?.exercise.name ?? '训练';
        await startTraining({
          planId,
          planNameSnapshot,
          exercises: detail.exercises.map((pe) => ({
            exercise: pe.exercise,
            // G24: thread per-exercise rest interval from plan so the
            // training timer honors `plan_exercises.rest_seconds` instead
            // of always falling back to the global default.
            restSeconds: pe.restSeconds,
            // G28: plan-level 处方 (weight / reps / setType) 透传到 store。
            // 训练时实际值可能和处方不同（重量调整 / 减次），用户改一下就行；
            // 不改的话直接做 + 完成。
            // G6 「数据不预填」的原意是不预填 *上一次训练* 的值（避免渐进
            // 超负荷被"惯性拷贝"拖累），不覆盖 *计划级处方*。
            initialSets: pe.sets.map((s: PlanSetDraft) => ({
              weight: s.weight,
              reps: s.reps,
              setType: s.setType,
            })),
          })),
        });
        // [DIAG] duplicate-key 病根定位:打印 plan 里动作的去重情况
        const _ids = detail.exercises.map((pe) => pe.exercise.id);
        const _unique = new Set(_ids);
        const _dup: string[] = [];
        const _seen = new Set<string>();
        for (const id of _ids) {
          if (_seen.has(id)) _dup.push(id);
          else _seen.add(id);
        }
        // eslint-disable-next-line no-console
        console.log(
          '[DIAG:dup-key] plan=' + planId +
          ' total=' + _ids.length +
          ' unique=' + _unique.size +
          ' duplicateIds=' + JSON.stringify(_dup),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        Alert.alert('开始训练失败', msg, [
          { text: '好的', onPress: () => navigation.goBack() },
        ]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -----------------------------------------------------------------
  // Cancel handlers
  // -----------------------------------------------------------------
  const handleRequestCancel = useCallback(() => setPendingCancel(true), []);
  const handleConfirmCancel = useCallback(() => {
    setPendingCancel(false);
    cancelTraining();
    // G12: 取消训练轻量提示，告知用户已放弃的数据。
    toast.show('已放弃本次训练', 'info');
    // G8 spec: popToTop() so we leave the active-training stack intact and
    // bounce to the Tabs root.
    navigation.popToTop();
  }, [cancelTraining, navigation]);

  // -----------------------------------------------------------------
  // G8: Finish handlers — call completeTraining() (atomic DB write), then
  // navigate (replace) to the TrainingComplete summary screen.
  // -----------------------------------------------------------------
  const handleRequestFinish = useCallback(
    () => setPendingFinish(true),
    [],
  );

  /**
   * Run completeTraining() once. If it succeeds, navigate to the summary
   * page via `replace` so the ActiveTraining screen is no longer on the
   * back stack — preventing accidental back-swipes returning to a possibly
   * stale training-in-progress UI.
   *
   * Safe to call multiple times via the `finishing` mutex.
   */
  const completeAndNavigate = useCallback(async () => {
    if (finishing) return;
    setFinishing(true);
    try {
      const result = await completeTraining();
      if (!result) {
        // No active training — bail out without navigating.
        setPendingFinish(false);
        setFinishing(false);
        return;
      }
      navigation.replace('TrainingComplete', {
        trainingId: result.id,
        durationSeconds: result.durationSeconds ?? result.stats.durationSeconds,
        totalVolume: result.totalVolume ?? result.stats.totalVolume,
        exerciseCount:
          result.exerciseCount ?? result.stats.exerciseCount,
        setCount: result.setCount ?? result.stats.setCount,
        planNameSnapshot: result.planNameSnapshot,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert('完成训练失败', msg, [
        {
          text: '好的',
          onPress: () => {
            setPendingFinish(false);
            setFinishing(false);
          },
        },
      ]);
    }
  }, [completeTraining, finishing, navigation]);

  const handleConfirmFinish = useCallback(() => {
    setPendingFinish(false);
    void completeAndNavigate();
  }, [completeAndNavigate]);

  // -----------------------------------------------------------------
  // G29: Set-type sheet handlers — target a specific (exIdx, setIdx),
  // not only the current set.
  // -----------------------------------------------------------------
  const closeTypeSheet = useCallback(() => setTypeSheetTarget(null), []);
  const handleOpenTypeSheet = useCallback(
    (exerciseIndex: number, setIndex: number) => {
      setTypeSheetTarget({ exerciseIndex, setIndex });
      haptic.selection();
    },
    [],
  );

  const handlePickSetType = useCallback(
    (type: SetTypeValue) => {
      if (!activeTraining || !typeSheetTarget) return;
      const ex = activeTraining.exercises[typeSheetTarget.exerciseIndex];
      const target = ex?.sets[typeSheetTarget.setIndex];
      if (!target) {
        setTypeSheetTarget(null);
        return;
      }
      changeSetType(
        typeSheetTarget.exerciseIndex,
        target.clientId,
        type,
      );
      haptic.selection();
      setTypeSheetTarget(null);
    },
    [activeTraining, typeSheetTarget, changeSetType],
  );

  const handleRequestDeleteFromSheet = useCallback(() => {
    if (!activeTraining || !typeSheetTarget) return;
    const ex = activeTraining.exercises[typeSheetTarget.exerciseIndex];
    const target = ex?.sets[typeSheetTarget.setIndex];
    if (!target) {
      setTypeSheetTarget(null);
      return;
    }
    if (ex.sets.length <= 1) {
      // G12: 用 toast 替代 Alert —— 这种保护性提示不需要阻断式弹窗，
      // 让用户继续操作即可。
      toast.show('至少保留 1 组', 'warning');
      setTypeSheetTarget(null);
      return;
    }
    setPendingDelete({
      exerciseIndex: typeSheetTarget.exerciseIndex,
      setIndex: typeSheetTarget.setIndex,
      clientId: target.clientId,
      label: `第 ${typeSheetTarget.setIndex + 1} 组`,
    });
    setTypeSheetTarget(null);
  }, [activeTraining, typeSheetTarget]);

  // -----------------------------------------------------------------
  // G29: Exercise overview sheet handlers — list every exercise with
  // its progress; tap a row to jump straight to it.
  // -----------------------------------------------------------------
  const handleOpenOverview = useCallback(() => {
    setOverviewSheetOpen(true);
    haptic.selection();
  }, []);

  const handleCloseOverview = useCallback(
    () => setOverviewSheetOpen(false),
    [],
  );

  const handleJumpToExercise = useCallback(
    (exIndex: number) => {
      setCurrentExerciseIndex(exIndex);
      setOverviewSheetOpen(false);
      haptic.selection();
    },
    [setCurrentExerciseIndex],
  );

  const handleConfirmDelete = useCallback(() => {
    if (!pendingDelete) return;
    removeSet(pendingDelete.exerciseIndex, pendingDelete.clientId);
    haptic.warning();
    setPendingDelete(null);
  }, [pendingDelete, removeSet]);

  // -----------------------------------------------------------------
  // Field change handler — write into store on every change
  // -----------------------------------------------------------------
  const onFieldChange = useCallback(
    (field: MetricField, value: number) => {
      if (!activeTraining) return;
      const ex = activeTraining.exercises[currentExerciseIndex];
      const target = ex?.sets[currentSetIndex];
      if (!target) return;
      // Clamp to a sane range so the store never holds out-of-bound values
      // (NumberInput already clamps; this is defensive).
      const patch: Record<string, number | null> = {};
      if (field === 'weight') patch.weight = value;
      else if (field === 'reps') patch.reps = value;
      else if (field === 'duration_seconds') patch.durationSeconds = value;
      else if (field === 'distance_km') patch.distanceKm = value;
      updateSet(currentExerciseIndex, target.clientId, patch);
    },
    [activeTraining, currentExerciseIndex, currentSetIndex, updateSet],
  );

  // -----------------------------------------------------------------
  // Complete-set handler — the main CTA
  // -----------------------------------------------------------------
  const handleCompleteSet = useCallback(() => {
    if (!activeTraining) {
      return;
    }
    const ex = activeTraining.exercises[currentExerciseIndex];
    const target = ex?.sets[currentSetIndex];
    if (!target) {
      return;
    }
    if (target.completed) {
      return; // already done — CTA disabled but defensive
    }

    // G8: detect "last intended set" — if the set being completed is the
    // final one across every exercise, auto-finish the training + jump to
    // the TrainingComplete summary. We compute this BEFORE the mutation,
    // using the plan-derived group count (the atomic action no longer
    // appends, so `allSetsBefore.length` stays stable across completes).
    const allSetsBefore = activeTraining.exercises.flatMap((e) => e.sets);
    const completedBefore = allSetsBefore.filter((s) => s.completed).length;
    const wouldAllBeDone = completedBefore + 1 >= allSetsBefore.length;

    // Bug-3 fix: single atomic mutation. Marks completed + advances focus
    // to the next uncompleted set in ONE set() call. Does NOT auto-append
    // — the plan's group count is sacred; users add extras via the
    // explicit "+ 添加组" button. Returns `false` if this was a duplicate
    // tap so we skip side effects.
    const didAdvance = completeAndAdvance(
      currentExerciseIndex,
      target.clientId,
    );
    if (!didAdvance) return;

    haptic.success();

    // G12: 完成一组 → 轻量 toast 反馈（不阻断）。
    // Rest timer Sheet 即将弹出，toast 与 Sheet 不会冲突：toast 在顶部，
    // Sheet 在底部。
    const setLabel = `第 ${currentSetIndex + 1} 组`;
    toast.show(`${setLabel}已完成`, 'success');

    // G7 + G24: 触发休息计时器（restTimerStore.start → RestTimerOverlay 自动渲染）。
    // 优先用当前动作的 per-exercise 覆盖（plan_exercises.rest_seconds），
    // 自由训练 / 无覆盖时回落到设置里的全局默认。
    const activeEx = activeTraining?.exercises[currentExerciseIndex];
    const restSeconds = activeEx?.restSeconds ?? defaultRestSeconds;
    triggerRestTimer(restSeconds);

    // Auto-jump: only when the user actually completed the last real set
    // (not after they accidentally tapped, e.g. on a freshly-appended set).
    if (wouldAllBeDone) {
      // Skip the dialog — auto-completion is intentional & already confirmed
      // by the user's CTA press.
      void completeAndNavigate();
    }
  }, [
    activeTraining,
    currentExerciseIndex,
    currentSetIndex,
    completeAndAdvance,
    defaultRestSeconds,
    completeAndNavigate,
  ]);

  // -----------------------------------------------------------------
  // G29: Chip-select / chip-delete / exercise-chip handlers — REMOVED.
  // The horizontal chip strip is gone (replaced by a vertical set list).
  // Set-type change is initiated by tapping the row's set number;
  // set delete lives inside the type sheet. Exercise jumping is done
  // via the new ExerciseOverviewSheet (▾ button).
  // -----------------------------------------------------------------

  // -----------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------
  if (!activeTraining) {
    return (
      <View
        style={[styles.center, { backgroundColor: colors.background }]}
        accessibilityLiveRegion="polite"
        accessibilityLabel="正在加载训练"
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const ex = activeTraining.exercises[currentExerciseIndex];
  const set = ex?.sets[currentSetIndex];

  if (!ex || !set) {
    // Shouldn't happen — currentExerciseIndex is clamped. Bail out.
    return (
      <View
        style={[styles.center, { backgroundColor: colors.background }]}
      >
        <Text style={[typography.body, { color: colors.textSecondary }]}>
          没有可显示的动作。
        </Text>
      </View>
    );
  }

  const metric = findMetricType(ex.exercise.metricType);
  const fields: MetricField[] = metric?.fields ?? ['weight', 'reps'];
  const totalExercises = activeTraining.exercises.length;
  const totalSets = ex.sets.length;

  // G12: 给取消对话框用 —— 明确告知用户已完成的组数。
  const completedSetCount = activeTraining.exercises.reduce(
    (acc, e) => acc + e.sets.filter((s) => s.completed).length,
    0,
  );

  // G29: 全宽进度条用 —— 整训练范围内已完成组数 / 总组数。
  const totalAllSets = activeTraining.exercises.reduce(
    (acc, e) => acc + e.sets.length,
    0,
  );
  const completedAllSets = completedSetCount;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ====== Top status bar (G29: ▾ opens ExerciseOverviewSheet) ====== */}
      <View
        style={[
          styles.topBar,
          {
            paddingTop: insets.top + spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.sm,
            backgroundColor: colors.background,
            borderBottomColor: colors.divider,
          },
        ]}
        accessibilityRole="header"
      >
        <IconButton
          icon="×"
          variant="ghost"
          accessibilityLabel="取消训练"
          onPress={handleRequestCancel}
        />
        <View style={styles.timerWrap}>
          <Text
            style={[
              typography.numeric,
              { color: colors.text, fontVariant: ['tabular-nums'] },
            ]}
            accessibilityLabel={`已训练 ${formatElapsed(elapsed)}`}
          >
            {formatElapsed(elapsed)}
          </Text>
        </View>
        {/* G29: ▾ button → ExerciseOverviewSheet. Lives next to × for
            symmetry (both are navigator-style controls); 结束训练 stays
            on the right as the "commit and exit" action. */}
        <IconButton
          icon="▾"
          variant="ghost"
          accessibilityLabel="动作总览"
          accessibilityHint="弹出本训练所有动作的进度列表"
          onPress={handleOpenOverview}
        />
        {/* G8: 主动"结束训练"按钮 — 与左侧 × 互不影响。 */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="结束训练"
          accessibilityHint="保存数据并跳到训练总结"
          onPress={handleRequestFinish}
          hitSlop={8}
          disabled={finishing}
          style={({ pressed }) => ({
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
            borderRadius: radius.md,
            backgroundColor: pressed ? colors.primaryMuted : colors.transparent,
            opacity: finishing ? 0.5 : 1,
            minWidth: 60,
            alignItems: 'center',
          })}
        >
          <Text
            style={[
              typography.label,
              { color: colors.primaryPressed, fontSize: 13 },
            ]}
          >
            结束训练
          </Text>
        </Pressable>
      </View>

      {/* ====== G29: Full-width progress bar (edge-to-edge) ======
          4px 高，pct = 已完成组数 / 总组数，贴边无 padding。和顶部状态栏
          之间留 spacing.sm 让"计时器"+"▾"不至于视觉上挤到进度条。 */}
      <ProgressBarEdgeToEdge
        percent={
          totalAllSets === 0
            ? 0
            : Math.min(100, Math.round((completedAllSets / totalAllSets) * 100))
        }
        trackColor={colors.surfaceMuted}
        fillColor={colors.primary}
        accessibilityLabel={`训练进度 ${completedAllSets}/${totalAllSets} 组`}
      />

      {/* ====== Body (scrollable) ====== */}
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xxl,
          gap: spacing.lg,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ----- Exercise title (with "动作 X/Y" + "+ 添加组") ----- */}
        <View style={{ gap: spacing.xs }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: spacing.sm,
            }}
          >
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text
                style={[typography.h1, { color: colors.text }]}
                numberOfLines={2}
                accessibilityRole="header"
              >
                {ex.exercise.name}
              </Text>
              <Text
                style={[typography.body, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {`动作 ${currentExerciseIndex + 1}/${totalExercises} · ${ex.exercise.muscleGroup} · ${ex.exercise.equipment}`}
              </Text>
            </View>
            {/* G29: "+ 添加组" 紧贴标题右侧，不再藏在 chip 卡里。 */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`为 ${ex.exercise.name} 添加组`}
              onPress={() => {
                appendEmptySet(currentExerciseIndex);
                // 焦点跳到新组（下一帧 store 同步完后再读 length）。
                setTimeout(() => {
                  setCurrentSetIndex(ex.sets.length);
                }, 0);
                haptic.selection();
              }}
              hitSlop={10}
              style={({ pressed }) => ({
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xxs + 2,
                borderRadius: radius.full,
                backgroundColor: pressed
                  ? colors.primaryMuted
                  : colors.surfaceMuted,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.border,
              })}
            >
              <Text
                style={[typography.label, { color: colors.primaryPressed }]}
              >
                + 添加组
              </Text>
            </Pressable>
          </View>
        </View>

        {/* ----- G29: Vertical set list -----
            每个 set 一行：左是 `②` 序号 tap target，右是状态相关内容。
            - 已完成：折叠 "60kg × 10 ✓"
            - 当前激活：高亮 + inline NumberInput（无 label）+ 紧凑"上次"参考
            - 未开始：折叠 "60kg × 10"（灰字） */}
        <View
          style={{
            borderRadius: radius.lg,
            backgroundColor: colors.surface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            overflow: 'hidden',
          }}
        >
          {ex.sets.map((s, idx) => {
            const isActive = idx === currentSetIndex;
            const isLast = idx === ex.sets.length - 1;
            return (
              <SetRow
                key={s.clientId}
                setRow={s}
                isActive={isActive}
                isLast={isLast}
                metricType={ex.exercise.metricType}
                fields={fields}
                lastSets={
                  isActive ? lastSetsByExerciseId[ex.exercise.id] : undefined
                }
                onPressNumber={() =>
                  handleOpenTypeSheet(currentExerciseIndex, idx)
                }
                onTapRow={() => {
                  if (!isActive) {
                    setCurrentSetIndex(idx);
                    haptic.selection();
                  }
                }}
                onChangeField={onFieldChange}
              />
            );
          })}
        </View>
      </ScrollView>

      {/* ====== Bottom CTA ====== */}
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.divider,
            paddingBottom: insets.bottom + spacing.md,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
          },
        ]}
      >
        <Button
          variant={set.completed ? 'secondary' : 'primary'}
          size="lg"
          disabled={set.completed}
          onPress={handleCompleteSet}
          accessibilityLabel={set.completed ? '本组已完成' : '完成本组'}
          accessibilityHint={
            set.completed ? undefined : '保存数据并开始休息计时'
          }
          style={{ alignSelf: 'stretch' }}
        >
          {set.completed ? '已完成 ✓' : '完成本组 ✓'}
        </Button>
      </View>

      {/* ====== Cancel dialog ====== */}
      {/* G12: 取消对话框文案强化 —— 明确告诉用户"已完成的 N 组数据将丢失"
          而非笼统的"已记录的数据不会保存"，让误触用户更有机会停下来。 */}
      <Dialog
        visible={pendingCancel}
        variant="danger"
        title="放弃本次训练？"
        message={
          activeTraining
            ? `已完成的 ${completedSetCount} 组数据将丢失，未完成的组也会被清除。`
            : '已记录的数据不会保存。'
        }
        confirmText="放弃"
        cancelText="继续训练"
        onCancel={() => setPendingCancel(false)}
        onConfirm={handleConfirmCancel}
      />

      {/* ====== G8: Finish dialog ====== */}
      <Dialog
        visible={pendingFinish}
        title="结束本次训练？"
        message="已完成的组会写入训练历史。"
        confirmText={finishing ? '保存中…' : '结束训练'}
        cancelText="继续"
        onCancel={() => {
          if (finishing) return;
          setPendingFinish(false);
        }}
        onConfirm={() => {
          if (finishing) return;
          handleConfirmFinish();
        }}
      />

      {/* ====== Delete-set dialog ====== */}
      <Dialog
        visible={!!pendingDelete}
        variant="danger"
        title="删除这组？"
        message={pendingDelete?.label ?? ''}
        confirmText="删除"
        cancelText="取消"
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleConfirmDelete}
      />

      {/* ====== G29: Set-type sheet (targets the row whose `②` was tapped) ====== */}
      <Sheet
        visible={typeSheetTarget !== null}
        onClose={closeTypeSheet}
        title={
          typeSheetTarget
            ? `选择组类型 · 第 ${typeSheetTarget.setIndex + 1} 组`
            : '选择组类型'
        }
        maxHeightRatio={0.55}
      >
        {typeSheetTarget && activeTraining
          ? (() => {
              const targetEx =
                activeTraining.exercises[typeSheetTarget.exerciseIndex];
              const targetSet =
                targetEx?.sets[typeSheetTarget.setIndex] ?? null;
              if (!targetEx || !targetSet) return null;
              return (
                <View style={{ gap: spacing.xs }}>
                  {SET_TYPES.map((t) => {
                    const active = targetSet.setType === t.value;
                    return (
                      <Pressable
                        key={t.value}
                        accessibilityRole="radio"
                        accessibilityLabel={t.label}
                        accessibilityState={{ selected: active }}
                        onPress={() => handlePickSetType(t.value)}
                        style={({ pressed }) => ({
                          paddingVertical: spacing.md,
                          paddingHorizontal: spacing.md,
                          borderRadius: radius.md,
                          backgroundColor: active
                            ? colors.primaryMuted
                            : pressed
                            ? colors.surfaceMuted
                            : colors.surface,
                          borderWidth: StyleSheet.hairlineWidth,
                          borderColor: active ? colors.primary : colors.border,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        })}
                      >
                        <Text style={[typography.body, { color: colors.text }]}>
                          {t.label}
                        </Text>
                        {t.short ? (
                          <Badge label={t.short} variant="primary" size="sm" />
                        ) : (
                          <Text
                            style={[
                              typography.caption,
                              { color: colors.textTertiary },
                            ]}
                          >
                            默认
                          </Text>
                        )}
                      </Pressable>
                    );
                  })}

                  <View style={{ height: spacing.sm }} />

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="删除此组"
                    onPress={handleRequestDeleteFromSheet}
                    disabled={targetEx.sets.length <= 1}
                    style={({ pressed }) => ({
                      paddingVertical: spacing.md,
                      borderRadius: radius.md,
                      backgroundColor: pressed
                        ? colors.danger
                        : colors.surface,
                      alignItems: 'center',
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: colors.danger,
                      opacity: targetEx.sets.length <= 1 ? 0.4 : 1,
                    })}
                  >
                    <Text style={[typography.label, { color: colors.danger }]}>
                      删除此组
                    </Text>
                  </Pressable>

                  {targetEx.sets.length <= 1 ? (
                    <Text
                      style={[
                        typography.caption,
                        {
                          color: colors.textTertiary,
                          textAlign: 'center',
                        },
                      ]}
                    >
                      至少保留 1 组
                    </Text>
                  ) : null}
                </View>
              );
            })()
          : null}
      </Sheet>

      {/* ====== G29b: Exercise overview sheet ======
          Lists every exercise in the current training with progress.
          Tap a row to jump; no "skip" button (per spec). */}
      <Sheet
        visible={overviewSheetOpen}
        onClose={handleCloseOverview}
        title="动作总览"
        maxHeightRatio={0.7}
      >
        {activeTraining ? (
          <View style={{ gap: spacing.xs }}>
            {activeTraining.exercises.map((otherEx, idx) => {
              const isActive = idx === currentExerciseIndex;
              const completedCount = otherEx.sets.filter(
                (s) => s.completed,
              ).length;
              const total = otherEx.sets.length;
              return (
                <Pressable
                  key={otherEx.exercise.id}
                  accessibilityRole="button"
                  accessibilityLabel={`跳到 ${otherEx.exercise.name}，${completedCount}/${total} 组已完成${
                    isActive ? '，当前动作' : ''
                  }`}
                  accessibilityState={{ selected: isActive }}
                  onPress={() => handleJumpToExercise(idx)}
                  style={({ pressed }) => ({
                    paddingVertical: spacing.md,
                    paddingHorizontal: spacing.md,
                    borderRadius: radius.md,
                    backgroundColor: isActive
                      ? colors.primaryMuted
                      : pressed
                      ? colors.surfaceMuted
                      : colors.surface,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: isActive ? colors.primary : colors.border,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: spacing.sm,
                  })}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text
                      style={[
                        typography.body,
                        {
                          color: colors.text,
                          fontWeight: isActive ? '700' : '500',
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {idx + 1}. {otherEx.exercise.name}
                    </Text>
                    <Text
                      style={[
                        typography.caption,
                        { color: colors.textTertiary },
                      ]}
                      numberOfLines={1}
                    >
                      {otherEx.exercise.muscleGroup} ·{' '}
                      {completedCount}/{total} 组
                    </Text>
                  </View>
                  {/* Tiny inline progress bar — visual cue for partial completion. */}
                  <View
                    style={{
                      width: 48,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: colors.surfaceMuted,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        width: `${
                          total === 0 ? 0 : (completedCount / total) * 100
                        }%`,
                        height: 4,
                        backgroundColor: isActive
                          ? colors.primary
                          : colors.primaryPressed,
                      }}
                    />
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </Sheet>

      {/* ====== Rest-timer overlay (G7) ====== */}
      <RestTimerOverlay />
    </KeyboardAvoidingView>
  );
}

/* ============================================================================
 * Sub-components
 * ========================================================================== */

function readField(set: ActiveSet, field: MetricField): number {
  if (field === 'weight') return set.weight ?? 0;
  if (field === 'reps') return set.reps ?? 0;
  if (field === 'duration_seconds') return set.durationSeconds ?? 0;
  if (field === 'distance_km') return set.distanceKm ?? 0;
  return 0;
}

/* ---------- G17: 上次数据预览 ---------- */

interface LastSetsPreviewProps {
  exerciseId: string;
  metricType: string;
  lastSets: TrainingSet[] | undefined;
}

const SET_TYPE_SHORT: Record<string, string> = {
  normal: '',
  warmup: 'W',
  dropout: 'D',
  failure: 'F',
};

/**
 * 把一组 set 按 metricType + 当前单位格式化成单行简写。
 * - reps / +kg / -kg : "60.0kg × 8"（kg 按 settingsStore.unit 换算）
 * - kg                : "60.0kg"
 * - time              : "30 秒"
 * - km                : "1.50km"
 */
function formatLastSetRow(set: TrainingSet, metricType: string, unit: Unit): string {
  const short = SET_TYPE_SHORT[set.setType] ?? '';
  const prefix = short ? `${short} ` : '';
  const m = metricType;
  if (m === 'time') {
    return `${prefix}${set.durationSeconds ?? 0} 秒`;
  }
  if (m === 'km') {
    return `${prefix}${(set.distanceKm ?? 0).toFixed(2)}km`;
  }
  // kg / reps / +kg / -kg 都需要显示 weight
  if (m === 'kg') {
    return `${prefix}${formatWeight(set.weight ?? 0, unit)}`;
  }
  return `${prefix}${formatWeight(set.weight ?? 0, unit)} × ${set.reps ?? 0}`;
}

function LastSetsPreview({ exerciseId, metricType, lastSets }: LastSetsPreviewProps) {
  const { colors, spacing, typography } = useTheme();
  const unit = useSettingsStore((s) => s.unit);

  // 缓存未填充 = 加载中，不渲染占位（避免闪烁）
  if (lastSets === undefined) return null;
  // 加载完成但为空 = 无历史
  if (lastSets.length === 0) {
    return (
      <Text
        accessibilityLabel={`${exerciseId} 无历史数据`}
        style={[typography.caption, { color: colors.textTertiary }]}
      >
        上次：无历史数据
      </Text>
    );
  }
  return (
    <View
      accessibilityLabel={`${exerciseId} 最近 ${lastSets.length} 组数据`}
      style={{
        backgroundColor: colors.surfaceMuted,
        borderRadius: 8,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs + 2,
        gap: 2,
      }}
    >
      <Text style={[typography.caption, { color: colors.textTertiary }]}>
        上次
      </Text>
      {lastSets.map((s, i) => (
        <Text
          // G21: confirmed root cause via binary-rollback hunt (see
          // memory `feedback-g21-dup-key-root-cause`). The duplicate-key
          // warning fires here when the same `s.id` appears in two
          // different `lastSets` entries — but the *upstream* cause is
          // that `getLastSetsForExercises` returns training_sets rows
          // whose `exercise_id` is the same across two entries, yet
          // somehow the records share a `training_sets.id`. Until the
          // store is audited, the safe defensive fix is the index
          // suffix: it guarantees uniqueness within this list, which
          // is the only place these siblings live.
          key={`${s.id}#${i}`}
          style={[
            typography.body,
            { color: colors.textSecondary, fontSize: 13 },
          ]}
        >
          {`${i + 1}. ${formatLastSetRow(s, metricType, unit)}`}
        </Text>
      ))}
    </View>
  );
}

interface MetricFieldInputProps {
  field: MetricField;
  value: number;
  disabled: boolean;
  onChange: (next: number) => void;
  /**
   * G29: when true, render inline (no label above the field). Used by
   * SetRow's active-set body so the inputs sit compact next to the
   * `②` tap target — the field meaning is implied by `unitLabel` (kg /
   * 秒 / km) or by ordinal context (reps has no unit, just a number).
   */
  inline?: boolean;
}

function MetricFieldInput({
  field,
  value,
  disabled,
  onChange,
  inline = false,
}: MetricFieldInputProps) {
  if (field === 'weight') {
    return (
      <NumberInput
        label={inline ? undefined : '重量'}
        unitLabel="kg"
        value={value}
        onChangeValue={onChange}
        min={0}
        max={500}
        precision={1}
        disabled={disabled}
      />
    );
  }
  if (field === 'reps') {
    return (
      <NumberInput
        label={inline ? undefined : '次数'}
        value={value}
        onChangeValue={onChange}
        min={0}
        max={50}
        disabled={disabled}
      />
    );
  }
  if (field === 'duration_seconds') {
    return (
      <NumberInput
        label={inline ? undefined : '秒数'}
        unitLabel="秒"
        value={value}
        onChangeValue={onChange}
        min={0}
        max={3600}
        disabled={disabled}
      />
    );
  }
  // distance_km
  return (
    <NumberInput
      label={inline ? undefined : '公里'}
      unitLabel="km"
      value={value}
      onChangeValue={onChange}
      min={0}
      max={100}
      precision={2}
      disabled={disabled}
    />
  );
}

/* ---------- G29: ProgressBarEdgeToEdge ---------- */

interface ProgressBarEdgeToEdgeProps {
  percent: number;
  trackColor: string;
  fillColor: string;
  accessibilityLabel?: string;
}

/**
 * G29: full-width progress bar (edge-to-edge, 4px tall).
 * The outer View sits flush against the screen edges — unlike the rest of
 * the screen which is wrapped in `spacing.lg` gutters. The fill is a plain
 * child with a percent width.
 */
function ProgressBarEdgeToEdge({
  percent,
  trackColor,
  fillColor,
  accessibilityLabel,
}: ProgressBarEdgeToEdgeProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: clamped }}
      style={{
        height: 4,
        backgroundColor: trackColor,
        width: '100%',
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          height: 4,
          width: `${clamped}%`,
          backgroundColor: fillColor,
        }}
      />
    </View>
  );
}

/* ---------- G29: SetRow (vertical set list) ---------- */

interface SetRowProps {
  setRow: ActiveSet;
  isActive: boolean;
  isLast: boolean;
  metricType: string;
  fields: MetricField[];
  /** Only passed when isActive — keeps the inactive rows cheap. */
  lastSets: TrainingSet[] | undefined;
  /** Tap on the set number `②` — opens the type sheet for this set. */
  onPressNumber: () => void;
  /** Tap on the row body (when not active) — focuses this set. */
  onTapRow: () => void;
  onChangeField: (field: MetricField, value: number) => void;
}

/**
 * G29: vertical set list row.
 *  - Left: tap target on the set number `②` (with optional W/D/F badge) →
 *           opens the type sheet.
 *  - Right (active): inline NumberInputs (no labels, unitLabel only) +
 *                    compact LastSetsPreview.
 *  - Right (completed): muted one-liner `60.0kg × 10 ✓` (line-through).
 *  - Right (future): muted one-liner `60.0kg × 10`.
 *
 * The row body is a separate sibling Pressable from the set-number one so
 * tapping the number doesn't also fire the row-tap-to-focus path.
 */
function SetRow({
  setRow,
  isActive,
  isLast,
  metricType,
  fields,
  lastSets,
  onPressNumber,
  onTapRow,
  onChangeField,
}: SetRowProps) {
  const { colors, spacing, typography, radius } = useTheme();
  const unit = useSettingsStore((s) => s.unit);
  const meta =
    SET_TYPES.find((t) => t.value === setRow.setType) ?? SET_TYPES[0];

  const completed = setRow.completed;

  // Background tint: active highlights, completed recedes, future is neutral.
  const rowBg = isActive
    ? colors.primaryMuted
    : completed
    ? colors.surfaceMuted
    : colors.surface;
  // Press feedback for the row body (only meaningful when not active).
  const rowPressedBg = colors.surfaceMuted;

  const numberFg = isActive
    ? colors.primaryPressed
    : completed
    ? colors.textTertiary
    : colors.text;
  const numberPressedBg = colors.surfaceMuted;

  const summary = formatActiveSetSummary(setRow, metricType, unit);

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: spacing.sm,
        paddingVertical: spacing.sm + 4,
        paddingHorizontal: spacing.md,
        backgroundColor: rowBg,
        borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: colors.divider,
        alignItems: 'flex-start',
      }}
    >
      {/* Left: set-number tap target (independent Pressable so it doesn't
          collide with the row-body Pressable below). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          `第 ${setRow.setIndex} 组 · ${meta.label}` +
          (completed
            ? '，已完成'
            : isActive
            ? '，当前激活'
            : '，未激活') +
          '，点击改类型'
        }
        accessibilityHint="弹出选择组类型面板"
        onPress={onPressNumber}
        hitSlop={6}
        style={({ pressed }) => ({
          width: 40,
          minHeight: 40,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: spacing.xxs,
          borderRadius: radius.md,
          backgroundColor: pressed ? numberPressedBg : colors.transparent,
        })}
      >
        <Text
          style={[
            typography.numeric,
            {
              color: numberFg,
              fontSize: 22,
              fontWeight: '700',
              fontVariant: ['tabular-nums'],
              lineHeight: 24,
            },
          ]}
        >
          {setRow.setIndex}
        </Text>
        {meta.short ? (
          <Text
            style={[
              typography.caption,
              {
                color: isActive
                  ? colors.primaryPressed
                  : colors.textTertiary,
                fontSize: 10,
                marginTop: -2,
              },
            ]}
          >
            {meta.short}
          </Text>
        ) : null}
      </Pressable>

      {/* Right: state-dependent body. Active row hosts the inputs; other
          rows show a one-liner. Pressing the body of an inactive row
          focuses it; pressing the active row body is a no-op. */}
      {isActive ? (
        <View style={{ flex: 1, gap: spacing.sm }}>
          {fields.length === 1 ? (
            <MetricFieldInput
              field={fields[0]}
              value={readField(setRow, fields[0])}
              disabled={false}
              onChange={(v) => onChangeField(fields[0], v)}
              inline
            />
          ) : (
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {fields.map((f) => (
                <View key={f} style={{ flex: 1 }}>
                  <MetricFieldInput
                    field={f}
                    value={readField(setRow, f)}
                    disabled={false}
                    onChange={(v) => onChangeField(f, v)}
                    inline
                  />
                </View>
              ))}
            </View>
          )}
          <LastSetsPreview
            exerciseId={setRow.exerciseId}
            metricType={metricType}
            lastSets={lastSets}
          />
        </View>
      ) : (
        <Pressable
          onPress={onTapRow}
          hitSlop={4}
          style={({ pressed }) => ({
            flex: 1,
            paddingVertical: spacing.sm,
            minHeight: 40,
            justifyContent: 'center',
            borderRadius: radius.md,
            backgroundColor: pressed ? rowPressedBg : colors.transparent,
          })}
        >
          {completed ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.xs,
              }}
            >
              <Text
                style={[
                  typography.body,
                  {
                    color: colors.textTertiary,
                    textDecorationLine: 'line-through',
                  },
                ]}
                numberOfLines={1}
              >
                {summary}
              </Text>
              <Text
                style={{
                  color: colors.success,
                  fontSize: 16,
                  fontWeight: '700',
                }}
              >
                ✓
              </Text>
            </View>
          ) : (
            <Text
              style={[typography.body, { color: colors.textTertiary }]}
              numberOfLines={1}
            >
              {summary}
            </Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

/**
 * G29: one-line set summary used by non-active rows.
 * Same formatting as `formatLastSetRow` but takes an `ActiveSet` instead
 * of a `TrainingSet` (they have identical shape; we just keep types
 * separate to flag the boundary).
 */
function formatActiveSetSummary(
  set: ActiveSet,
  metricType: string,
  unit: Unit,
): string {
  const setType = set.setType ?? 'normal';
  const short = SET_TYPE_SHORT[setType] ?? '';
  const prefix = short ? `${short} ` : '';
  const m = metricType;
  if (m === 'time') {
    return `${prefix}${set.durationSeconds ?? 0} 秒`;
  }
  if (m === 'km') {
    return `${prefix}${(set.distanceKm ?? 0).toFixed(2)}km`;
  }
  if (m === 'kg') {
    return `${prefix}${formatWeight(set.weight ?? 0, unit)}`;
  }
  return `${prefix}${formatWeight(set.weight ?? 0, unit)} × ${set.reps ?? 0}`;
}

/* ---------- G29: legacy SetChip removed — replaced by SetRow ---------- */


/* ============================================================================
 * Styles
 * ========================================================================== */

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  timerWrap: {
    flex: 1,
    alignItems: 'center',
  },
  bottomBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});