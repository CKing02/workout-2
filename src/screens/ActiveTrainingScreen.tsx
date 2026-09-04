/**
 * ActiveTrainingScreen — G6 训练执行核心（全屏沉浸）
 *
 * 布局（自上而下）：
 *  1. 顶部状态栏  — × 取消 / 训练总计时 / 动作进度
 *  2. 动作标题    — 动作名 + 肌群·器械
 *  3. 组状态横条  — 全部组的横向 chip；当前激活用主色；左滑出现删除
 *  4. 数据录入    — 根据动作的 metricType 显示 NumberInput
 *  5. 组类型行    — 当前组类型 chip → Sheet（4 类型 + 红色删除组）
 *  6. 底部 CTA    — "完成本组 ✓" 大按钮 → 保存 + mark + triggerRestTimer
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
 *  - "完成本组" → completeAndAdvance（mark + 焦点跳到下一组；plan 组数固定，不自动 append）
 *  - rest timer → G7 RestTimerOverlay（基于 Date.now 时间戳，Reanimated 圆环）
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
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
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
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

const SWIPE_REVEAL = 72; // px
const SWIPE_THRESHOLD = 40; // px past origin to commit reveal

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
  // Set-type sheet state (current exerciseIndex + setIndex)
  // -----------------------------------------------------------------
  const [sheetOpen, setSheetOpen] = useState(false);

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
            // G5 stores `PlanSetDraft` in memory only. We pass setType hints
            // through; numeric fields are intentionally dropped — the user
            // enters fresh data per the G6 spec ("数据不预填").
            initialSets: pe.sets.map((s: PlanSetDraft) => ({
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
  // Set-type sheet handlers
  // -----------------------------------------------------------------
  const openSheet = useCallback(() => setSheetOpen(true), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const handlePickSetType = useCallback(
    (type: SetTypeValue) => {
      if (!activeTraining) return;
      const ex = activeTraining.exercises[currentExerciseIndex];
      const target = ex?.sets[currentSetIndex];
      if (!target) return;
      changeSetType(currentExerciseIndex, target.clientId, type);
      haptic.selection();
      closeSheet();
    },
    [
      activeTraining,
      currentExerciseIndex,
      currentSetIndex,
      changeSetType,
      closeSheet,
    ],
  );

  const handleRequestDeleteFromSheet = useCallback(() => {
    if (!activeTraining) return;
    const ex = activeTraining.exercises[currentExerciseIndex];
    const target = ex?.sets[currentSetIndex];
    if (!target) return;
    if (ex.sets.length <= 1) {
      // G12: 用 toast 替代 Alert —— 这种保护性提示不需要阻断式弹窗，
      // 让用户继续操作即可。
      toast.show('至少保留 1 组', 'warning');
      closeSheet();
      return;
    }
    setPendingDelete({
      exerciseIndex: currentExerciseIndex,
      setIndex: currentSetIndex,
      clientId: target.clientId,
      label: `第 ${currentSetIndex + 1} 组`,
    });
    closeSheet();
  }, [activeTraining, currentExerciseIndex, currentSetIndex, closeSheet]);

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

    // G7: 触发休息计时器（restTimerStore.start → RestTimerOverlay 自动渲染）。
    triggerRestTimer(defaultRestSeconds);

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
  // Chip-select handler
  // -----------------------------------------------------------------
  const handleSelectSet = useCallback(
    (setIndex: number) => {
      setCurrentSetIndex(setIndex);
      haptic.selection();
    },
    [setCurrentSetIndex],
  );

  const handleSelectExercise = useCallback(
    (exIndex: number) => {
      setCurrentExerciseIndex(exIndex);
      haptic.selection();
    },
    [setCurrentExerciseIndex],
  );

  // -----------------------------------------------------------------
  // Swipe-delete from chip — same target as the sheet delete, routed
  // through the same confirm dialog.
  // -----------------------------------------------------------------
  const handleRequestDeleteFromChip = useCallback(
    (exerciseIndex: number, setIndex: number) => {
      if (!activeTraining) return;
      const ex = activeTraining.exercises[exerciseIndex];
      const target = ex?.sets[setIndex];
      if (!target) return;
      if (ex.sets.length <= 1) {
        toast.show('至少保留 1 组', 'warning');
        return;
      }
      setPendingDelete({
        exerciseIndex,
        setIndex,
        clientId: target.clientId,
        label: `${ex.exercise.name} · 第 ${setIndex + 1} 组`,
      });
    },
    [activeTraining],
  );

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

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ====== Top status bar ====== */}
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
        <View style={styles.progressWrap}>
          <Text
            style={[typography.subtitle, { color: colors.textSecondary }]}
            accessibilityLabel={`第 ${currentExerciseIndex + 1} 个动作，共 ${totalExercises} 个`}
          >
            {currentExerciseIndex + 1}/{totalExercises}
          </Text>
        </View>
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
        {/* ----- Exercise title ----- */}
        <View style={{ gap: spacing.xs }}>
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
            {ex.exercise.muscleGroup} · {ex.exercise.equipment}
          </Text>
        </View>

        {/* ----- Set chips row ----- */}
        <Card padding="md">
          <View style={{ gap: spacing.sm }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text
                style={[
                  typography.label,
                  { color: colors.textSecondary },
                ]}
              >
                组状态 · {totalSets} 组
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`为 ${ex.exercise.name} 添加组`}
                onPress={() => {
                  appendEmptySet(currentExerciseIndex);
                  // Move focus to the newly-added set.
                  setTimeout(() => {
                    setCurrentSetIndex(ex.sets.length);
                  }, 0);
                  haptic.selection();
                }}
                hitSlop={10}
                style={({ pressed }) => ({
                  paddingHorizontal: spacing.sm,
                  paddingVertical: spacing.xxs,
                  borderRadius: radius.full,
                  backgroundColor: pressed
                    ? colors.primaryMuted
                    : colors.transparent,
                })}
              >
                <Text
                  style={[typography.label, { color: colors.primaryPressed }]}
                >
                  + 添加组
                </Text>
              </Pressable>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.sm }}
            >
              {ex.sets.map((s, idx) => (
                <SetChip
                  key={s.clientId}
                  setRow={s}
                  active={idx === currentSetIndex}
                  canDelete={ex.sets.length > 1}
                  onPress={() => handleSelectSet(idx)}
                  onRequestDelete={() =>
                    handleRequestDeleteFromChip(currentExerciseIndex, idx)
                  }
                />
              ))}
            </ScrollView>
          </View>
        </Card>

        {/* ----- Input fields ----- */}
        <Card padding="md">
          <View style={{ gap: spacing.md }}>
            <Text
              style={[typography.label, { color: colors.textSecondary }]}
            >
              本组数据
            </Text>
            {/* G17: 上次训练数据预览——按动作 id 取最近 3 组。 */}
            <LastSetsPreview
              exerciseId={ex.exercise.id}
              metricType={ex.exercise.metricType}
              lastSets={lastSetsByExerciseId[ex.exercise.id]}
            />
            {fields.map((f) => (
              <MetricFieldInput
                key={f}
                field={f}
                value={readField(set, f)}
                disabled={!!set.completed}
                onChange={(v) => onFieldChange(f, v)}
              />
            ))}
            {set.completed ? (
              <Text
                style={[
                  typography.caption,
                  { color: colors.textTertiary },
                ]}
              >
                该组已完成，数据已保存
              </Text>
            ) : null}
          </View>
        </Card>

        {/* ----- Set type row ----- */}
        <Card padding="md">
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: spacing.md,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  typography.label,
                  { color: colors.textSecondary, marginBottom: spacing.xs },
                ]}
              >
                组类型
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="切换组类型"
                accessibilityHint="弹出选择面板"
                onPress={openSheet}
                hitSlop={6}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                })}
              >
                <SetTypeBadge type={(set.setType ?? 'normal') as SetTypeValue} />
                <Text
                  style={[typography.caption, { color: colors.textTertiary }]}
                >
                  点击切换 ›
                </Text>
              </Pressable>
            </View>
          </View>
        </Card>

        {/* ----- Exercise navigator (when more than one exercise) ----- */}
        {totalExercises > 1 ? (
          <Card padding="md">
            <View style={{ gap: spacing.sm }}>
              <Text
                style={[
                  typography.label,
                  { color: colors.textSecondary },
                ]}
              >
                动作导航
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: spacing.sm }}
              >
                {activeTraining.exercises.map((otherEx, idx) => {
                  const isActive = idx === currentExerciseIndex;
                  const completedCount = otherEx.sets.filter(
                    (s) => s.completed,
                  ).length;
                  return (
                    <Pressable
                      key={otherEx.exercise.id}
                      accessibilityRole="tab"
                      accessibilityLabel={`${otherEx.exercise.name}，${completedCount}/${otherEx.sets.length} 组已完成`}
                      accessibilityState={{ selected: isActive }}
                      onPress={() => handleSelectExercise(idx)}
                      style={({ pressed }) => ({
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.sm,
                        borderRadius: radius.md,
                        backgroundColor: isActive
                          ? colors.primary
                          : pressed
                          ? colors.surfaceMuted
                          : colors.surface,
                        borderWidth: StyleSheet.hairlineWidth,
                        borderColor: isActive
                          ? colors.primary
                          : colors.border,
                      })}
                    >
                      <Text
                        style={[
                          typography.label,
                          {
                            color: isActive
                              ? colors.onPrimary
                              : colors.text,
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {idx + 1}. {otherEx.exercise.name}
                      </Text>
                      <Text
                        style={[
                          typography.caption,
                          {
                            color: isActive
                              ? colors.onPrimary
                              : colors.textTertiary,
                            opacity: 0.8,
                          },
                        ]}
                      >
                        {completedCount}/{otherEx.sets.length} 组
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </Card>
        ) : null}
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

      {/* ====== Set-type sheet ====== */}
      <Sheet
        visible={sheetOpen}
        onClose={closeSheet}
        title="选择组类型"
        maxHeightRatio={0.55}
      >
        <View style={{ gap: spacing.xs }}>
          {SET_TYPES.map((t) => {
            const active = set.setType === t.value;
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
            disabled={ex.sets.length <= 1}
            style={({ pressed }) => ({
              paddingVertical: spacing.md,
              borderRadius: radius.md,
              backgroundColor: pressed ? colors.danger : colors.surface,
              alignItems: 'center',
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.danger,
              opacity: ex.sets.length <= 1 ? 0.4 : 1,
            })}
          >
            <Text style={[typography.label, { color: colors.danger }]}>
              删除此组
            </Text>
          </Pressable>

          {ex.sets.length <= 1 ? (
            <Text
              style={[
                typography.caption,
                { color: colors.textTertiary, textAlign: 'center' },
              ]}
            >
              至少保留 1 组
            </Text>
          ) : null}
        </View>
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
}

function MetricFieldInput({
  field,
  value,
  disabled,
  onChange,
}: MetricFieldInputProps) {
  if (field === 'weight') {
    return (
      <NumberInput
        label="重量"
        unitLabel="kg"
        value={value}
        onChangeValue={onChange}
        min={0}
        max={500}
        step={2.5}
        precision={1}
        disabled={disabled}
      />
    );
  }
  if (field === 'reps') {
    return (
      <NumberInput
        label="次数"
        value={value}
        onChangeValue={onChange}
        min={0}
        max={50}
        step={1}
        disabled={disabled}
      />
    );
  }
  if (field === 'duration_seconds') {
    return (
      <NumberInput
        label="秒数"
        unitLabel="秒"
        value={value}
        onChangeValue={onChange}
        min={0}
        max={3600}
        step={5}
        disabled={disabled}
      />
    );
  }
  // distance_km
  return (
    <NumberInput
      label="公里"
      unitLabel="km"
      value={value}
      onChangeValue={onChange}
      min={0}
      max={100}
      step={0.1}
      precision={2}
      disabled={disabled}
    />
  );
}

/* ---------- SetChip (with swipe-to-delete) ---------- */

interface SetChipProps {
  setRow: ActiveSet;
  active: boolean;
  canDelete: boolean;
  onPress: () => void;
  onRequestDelete: () => void;
}

function SetChip({
  setRow,
  active,
  canDelete,
  onPress,
  onRequestDelete,
}: SetChipProps) {
  const { colors, spacing, typography, radius } = useTheme();
  const translateX = useSharedValue(0);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-10, 10])
        .failOffsetY([-12, 12])
        .onUpdate((e) => {
          'worklet';
          const next = Math.min(
            0,
            Math.max(-SWIPE_REVEAL - 12, e.translationX),
          );
          translateX.value = next;
        })
        .onEnd(() => {
          'worklet';
          if (translateX.value < -SWIPE_THRESHOLD) {
            translateX.value = withTiming(-SWIPE_REVEAL, {
              duration: 180,
              easing: Easing.out(Easing.cubic),
            });
          } else {
            translateX.value = withTiming(0, {
              duration: 180,
              easing: Easing.out(Easing.cubic),
            });
          }
        }),
    [translateX],
  );

  const tap = useMemo(
    () =>
      Gesture.Tap().onEnd(() => {
        'worklet';
        translateX.value = withTiming(0, { duration: 160 });
      }),
    [translateX],
  );

  const composed = useMemo(() => Gesture.Race(pan, tap), [pan, tap]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const trashStyle = useAnimatedStyle(() => ({
    opacity: translateX.value === 0 ? 0 : 1,
  }));

  const handleTrashPress = useCallback(() => {
    translateX.value = withTiming(0, { duration: 160 }, () => {
      runOnJS(onRequestDelete)();
    });
  }, [onRequestDelete, translateX]);

  const meta = SET_TYPES.find((t) => t.value === setRow.setType) ?? SET_TYPES[0];

  // Visual: completed vs active vs normal
  const chipBg = setRow.completed
    ? colors.success
    : active
    ? colors.primary
    : colors.surfaceMuted;
  const chipFg = setRow.completed || active ? colors.onPrimary : colors.text;
  const chipBorder = setRow.completed
    ? colors.success
    : active
    ? colors.primary
    : colors.border;

  const labelText = meta.short
    ? `${meta.short}${setRow.setIndex}`
    : `${setRow.setIndex}`;

  return (
    <View style={{ position: 'relative' }}>
      {/* Trash layer behind the chip */}
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.trashLayer,
          {
            backgroundColor: colors.danger,
            borderRadius: radius.full,
            right: 0,
          },
          trashStyle,
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`删除第 ${setRow.setIndex} 组`}
          onPress={canDelete ? handleTrashPress : undefined}
          disabled={!canDelete}
          hitSlop={8}
          style={({ pressed }) => [
            styles.trashButton,
            {
              borderRadius: radius.full,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text
            style={{
              color: colors.onPrimary,
              fontWeight: '700',
              fontSize: 16,
            }}
          >
            ×
          </Text>
        </Pressable>
      </Animated.View>

      <GestureDetector gesture={composed}>
        <Animated.View style={cardStyle}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`第 ${setRow.setIndex} 组 ${meta.label}${
              setRow.completed ? '，已完成' : ''
            }`}
            accessibilityHint="左滑出现删除按钮，点击切换到该组"
            onPress={onPress}
            android_ripple={{ color: colors.primaryMuted, borderless: false }}
            style={({ pressed }) => ({
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: radius.full,
              backgroundColor: pressed && !setRow.completed && !active
                ? colors.primaryMuted
                : chipBg,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: chipBorder,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xxs,
              minWidth: 48,
            })}
          >
            <Text
              style={[
                typography.label,
                { color: chipFg, fontVariant: ['tabular-nums'] },
              ]}
            >
              {labelText}
            </Text>
            {setRow.completed ? (
              <Text style={{ color: chipFg, fontWeight: '700', fontSize: 14 }}>
                ✓
              </Text>
            ) : null}
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

function SetTypeBadge({ type }: { type: SetTypeValue }) {
  const { colors, typography, radius, spacing } = useTheme();
  const meta = SET_TYPES.find((t) => t.value === type) ?? SET_TYPES[0];
  const variant: 'default' | 'primary' | 'warning' | 'danger' =
    type === 'normal'
      ? 'default'
      : type === 'warmup'
      ? 'warning'
      : type === 'dropout'
      ? 'primary'
      : 'danger';
  const label = meta.short ? `${meta.short} ${meta.label}` : meta.label;
  return <Badge label={label} variant={variant} size="md" />;
}

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
  progressWrap: {
    minWidth: 60,
    alignItems: 'flex-end',
  },
  bottomBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  trashLayer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: SWIPE_REVEAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trashButton: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});