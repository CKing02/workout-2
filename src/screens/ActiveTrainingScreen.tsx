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
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setStatusBarHidden } from 'expo-status-bar';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';

import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Dialog } from '@/components/Dialog';
import { DurationInputSheetBody } from '@/components/DurationInputSheetBody';
import { ExerciseThumbnail } from '@/components/ExerciseThumbnail';
import { IconButton } from '@/components/IconButton';
import { NumberInput } from '@/components/NumberInput';
import { WeightInput } from '@/components/WeightInput';
import { Sheet } from '@/components/Sheet';
import { SET_TYPES, type SetTypeValue } from '@/constants/setTypes';
import { findMetricType, type MetricField } from '@/constants/metricTypes';
import { resolveExerciseSwipeDirection } from '@/features/training/exerciseSwipe';
import { RestTimerOverlay } from '@/features/training/RestTimerOverlay';
import { RestTimerNotificationBridge } from '@/features/training/RestTimerNotificationBridge';
import { triggerRestTimer } from '@/features/training/restTimerTrigger';
import { useRestTimerStore } from '@/features/training/restTimerStore';
import { dismissRestTimerNotification } from '@/features/training/restTimerNotification';
import { getSetMetricValidationError } from '@/features/training/setMetrics';
import { formatElapsed, useElapsedSeconds } from '@/hooks/useElapsedSeconds';
import { toast } from '@/hooks/useToast';
import { usePlanStore, type PlanSetDraft } from '@/store/planStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTrainingStore, type ActiveSet, type ActiveTraining } from '@/store/trainingStore';
import { useTheme } from '@/theme';
import { motion } from '@/theme/motion';
import { haptic } from '@/utils/haptics';
import { formatSetDuration } from '@/utils/duration';
import { formatWeight } from '@/utils/units';
import type { TrainingSet } from '@/db/schema';
import type { Unit } from '@/store/settingsStore';

import type { RootStackParamList } from '@/navigation/types';

type Navigation = NativeStackNavigationProp<
  RootStackParamList,
  'ActiveTraining'
>;
type Route = RouteProp<RootStackParamList, 'ActiveTraining'>;

interface DurationTimerState {
  clientId: string;
  exerciseIndex: number;
  startedAt: number;
  baseSeconds: number;
}

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
  // G38.1: rest timer 进行中时隐藏 Bottom CTA(展开 Sheet 自带遮罩,折叠
  // 窄条只盖住中段,左右 margin 仍漏 — 整体隐藏最稳)。startedAt 翻 null
  // 时 CTA 自动复现,绑定的就是新激活 set 的"完成本组"。
  const restTimerActive = useRestTimerStore((s) => s.startedAt !== null);
  useEffect(() => {
    if (!activeTraining) return;
    const ids = activeTraining.exercises.map((e) => e.exercise.id);
    void loadLastSetsForExercises(ids, 3);
    // 故意不依赖 lastSetsByExerciseId：避免每次 store 重写都触发重查。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTraining?.id]);

  /**
   * G21 回归哨兵：训练中「上次数据」是否又出现重复 s.id。
   *
   * 红屏的真根因（`SELECT *` + JOIN 让 `trainings.id` 覆盖 `training_sets.id`）
   * 已在 `f4bef66` 修掉，并有 8 个针对旧 SQL 会失败的回归测试 —— 所以这条**不是**
   * 在排查某个已知问题，而是留一个便宜的现场哨兵：真机数据千奇百怪，
   * 万一以后又冒出来，logcat 里能第一时间看到，不用再从头二分。
   *
   * ⚠️ 必须 `__DEV__` 守卫 —— 2026-09-30 之前它没有守卫，**生产包每次进训练
   * 都会扫一遍并可能打日志**。更要命的是它的输出格式和真问题长得一样，
   * 导致测试清单 §13.2 把「logcat 里出现过 `[DIAG:dup-key]`」当成了 bug 证据，
   * 而当时同屏另一条诊断是**无条件打印**的 —— 拿诊断输出当症状是纯粹的误读。
   */
  useEffect(() => {
    if (!__DEV__) return;
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
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -----------------------------------------------------------------
  // G29: Set-type sheet state — targets an explicit (exIdx, setIdx)
  // so any row's `②` number can open it (not only the current).
  // -----------------------------------------------------------------
  const [typeSheetTarget, setTypeSheetTarget] = useState<
    { exerciseIndex: number; setIndex: number } | null
  >(null);

  const [durationSheetTarget, setDurationSheetTarget] = useState<{
    exerciseIndex: number;
    setIndex: number;
    seconds: number | null;
  } | null>(null);
  const [durationTimer, setDurationTimer] =
    useState<DurationTimerState | null>(null);
  const durationTimerElapsed = useElapsedSeconds(durationTimer?.startedAt ?? null);

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
  // G38.1: Rest timer 自然到 0 → 1.1s 后 scroll 到当前 set + 短暂高亮
  //
  // 流程:
  //   1. restTimerStore.completedAt 从 null → number
  //   2. 1.1s 后(让 overlay 完全消失):scroll 到 currentSetIndex 对应行
  //   3. setPulsedSetId(当前 set.clientId)→ SetRow 看到 justActivated=true
  //      → 加 2dp primary 顶边光带 + 背景提亮
  //   4. 0.6s 后清 pulsedSetId,光带消失
  //
  // 注:仅在"自然完成"路径触发 — 用户手动 skip 不会让 completedAt 翻转,
  // 保留用户"我跳过我自己处理"的控制感。
  // -----------------------------------------------------------------
  const scrollViewRef = useRef<ScrollView | null>(null);
  // 用 Map 而不是数组,因为 set 列表会随用户"+ 添加组"动态增删,index 不稳。
  const setRowRefs = useRef<Map<string, View | null>>(new Map());
  const [pulsedSetId, setPulsedSetId] = useState<string | null>(null);
  const prevCompletedAtRef = useRef<number | null>(null);
  // 1.1s 滚动延迟 setTimeout 的 id,unmount 时清掉防止在卸载组件上 setState
  const scrollDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 0.6s 高亮撤销 setTimeout 的 id
  const pulseClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 组件 mounted 标志,setTimeout 回调里检查
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    const unsub = useRestTimerStore.subscribe((state) => {
      const prev = prevCompletedAtRef.current;
      const cur = state.completedAt;
      prevCompletedAtRef.current = cur;
      // 仅 null → number 翻转触发一次
      if (prev === null && cur !== null) {
        // 清掉可能残留的旧 timer(理论上 runId 翻转会清 completedAt → 不会
        // 走到这里,但保险起见)
        if (scrollDelayTimerRef.current) {
          clearTimeout(scrollDelayTimerRef.current);
          scrollDelayTimerRef.current = null;
        }
        if (pulseClearTimerRef.current) {
          clearTimeout(pulseClearTimerRef.current);
          pulseClearTimerRef.current = null;
        }
        // 1.1s 后:overlay 完全消失,再做滚动 + 高亮
        scrollDelayTimerRef.current = setTimeout(() => {
          scrollDelayTimerRef.current = null;
          if (!isMountedRef.current) return;
          // 当前 set.clientId(completeAndAdvance 早已把 currentSetIndex 移过去)
          const ex = useTrainingStore.getState().activeTraining?.exercises[
            useTrainingStore.getState().currentExerciseIndex
          ];
          const setIdx = useTrainingStore.getState().currentSetIndex;
          const targetSet = ex?.sets[setIdx];
          if (!targetSet) return;
          const targetView = setRowRefs.current.get(targetSet.clientId);
          if (targetView && scrollViewRef.current) {
            // measureLayout 给的是相对父 ScrollView 的坐标
            targetView.measureLayout(
              scrollViewRef.current as unknown as number,
              (_x, y, _w, h) => {
                if (!isMountedRef.current) return;
                // 把目标行的中心滚到 ScrollView 视口中央偏上(留 80dp 顶部空间)
                const offset = Math.max(0, y - 80);
                scrollViewRef.current?.scrollTo({
                  y: offset,
                  animated: true,
                });
                // 滚动结束再高亮更自然 — 跟 scrollTo 的动画 250ms 同步
                setPulsedSetId(targetSet.clientId);
                if (pulseClearTimerRef.current) {
                  clearTimeout(pulseClearTimerRef.current);
                }
                pulseClearTimerRef.current = setTimeout(() => {
                  pulseClearTimerRef.current = null;
                  if (!isMountedRef.current) return;
                  setPulsedSetId((curId) =>
                    curId === targetSet.clientId ? null : curId,
                  );
                }, 600);
              },
              () => {
                // measureLayout 失败(罕见)兜底:仅高亮不滚动
                if (!isMountedRef.current) return;
                setPulsedSetId(targetSet.clientId);
                if (pulseClearTimerRef.current) {
                  clearTimeout(pulseClearTimerRef.current);
                }
                pulseClearTimerRef.current = setTimeout(() => {
                  pulseClearTimerRef.current = null;
                  if (!isMountedRef.current) return;
                  setPulsedSetId((curId) =>
                    curId === targetSet.clientId ? null : curId,
                  );
                }, 600);
              },
            );
          } else {
            // 找不到 view(可能当前 set 已被换走)— 仍走高亮
            if (!isMountedRef.current) return;
            setPulsedSetId(targetSet.clientId);
            if (pulseClearTimerRef.current) {
              clearTimeout(pulseClearTimerRef.current);
            }
            pulseClearTimerRef.current = setTimeout(() => {
              pulseClearTimerRef.current = null;
              if (!isMountedRef.current) return;
              setPulsedSetId((curId) =>
                curId === targetSet.clientId ? null : curId,
              );
            }, 600);
          }
        }, 1100);
      }
    });
    return () => {
      isMountedRef.current = false;
      unsub();
      if (scrollDelayTimerRef.current) {
        clearTimeout(scrollDelayTimerRef.current);
        scrollDelayTimerRef.current = null;
      }
      if (pulseClearTimerRef.current) {
        clearTimeout(pulseClearTimerRef.current);
        pulseClearTimerRef.current = null;
      }
    };
  }, []);

  // 屏幕 unmount 时清掉 setRowRefs(防止持有已卸载的 View 引用)
  useEffect(() => {
    return () => {
      setRowRefs.current.clear();
    };
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
              durationSeconds: s.durationSeconds,
              distanceKm: s.distanceKm,
              setType: s.setType,
            })),
          })),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        Alert.alert('开始训练失败', msg, [
          { text: '好的', onPress: () => navigation.goBack() },
        ]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopDurationTimer = useCallback((): number | null => {
    if (!durationTimer) return null;
    const elapsedSeconds = Math.max(
      0,
      Math.floor((Date.now() - durationTimer.startedAt) / 1000),
    );
    const actualSeconds = durationTimer.baseSeconds + elapsedSeconds;
    useTrainingStore.getState().updateSet(
      durationTimer.exerciseIndex,
      durationTimer.clientId,
      { durationSeconds: actualSeconds },
    );
    setDurationTimer(null);
    return actualSeconds;
  }, [durationTimer]);

  const handleToggleDurationTimer = useCallback(
    (exerciseIndex: number, target: ActiveSet) => {
      if (durationTimer?.clientId === target.clientId) {
        stopDurationTimer();
        haptic.success();
        return;
      }
      stopDurationTimer();
      setDurationTimer({
        clientId: target.clientId,
        exerciseIndex,
        startedAt: Date.now(),
        baseSeconds: target.durationSeconds ?? 0,
      });
      haptic.selection();
    },
    [durationTimer, stopDurationTimer],
  );

  const handleOpenDurationEditor = useCallback(
    (exerciseIndex: number, setIndex: number, target: ActiveSet) => {
      const committed = stopDurationTimer();
      setDurationSheetTarget({
        exerciseIndex,
        setIndex,
        seconds:
          durationTimer?.clientId === target.clientId
            ? committed ?? null
            : target.durationSeconds ?? null,
      });
      haptic.selection();
    },
    [durationTimer, stopDurationTimer],
  );

  const handleCommitActualDuration = useCallback(
    (seconds: number) => {
      if (!durationSheetTarget) return;
      const state = useTrainingStore.getState().activeTraining;
      const target =
        state?.exercises[durationSheetTarget.exerciseIndex]?.sets[
          durationSheetTarget.setIndex
        ];
      if (target) {
        useTrainingStore.getState().updateSet(
          durationSheetTarget.exerciseIndex,
          target.clientId,
          { durationSeconds: seconds },
        );
      }
      setDurationSheetTarget(null);
      haptic.success();
    },
    [durationSheetTarget],
  );

  // -----------------------------------------------------------------
  // Cancel handlers
  // -----------------------------------------------------------------
  const handleRequestCancel = useCallback(() => setPendingCancel(true), []);
  const handleConfirmCancel = useCallback(() => {
    setPendingCancel(false);
    // 强制收尾通知栏 + rest timer —— 用户中途点 × 放弃时,overlay 可能还
    // 显示折叠条或通知栏刚被点亮。这步必须在 cancelTraining() 之前同步
    // 执行,否则 bridge 跟着 ActiveTrainingScreen unmount,通知会卡住。
    // dismissRestTimerNotification 直调一道兜底 —— bridge 的 useEffect 在
    // unmount 时只跑 cleanup 不重跑 body,跳 idle 后再 unmount 会漏 dismiss。
    useRestTimerStore.getState().skip();
    void dismissRestTimerNotification();
    cancelTraining();
    // G12: 取消训练轻量提示，告知用户已放弃的数据。
    toast.show('已放弃本次训练', 'info');
    // G8 spec: popToTop() so we leave the active-training stack intact and
    // bounce to the Tabs root.
    navigation.popToTop();
  }, [cancelTraining, navigation]);

  // -----------------------------------------------------------------
  // G8: Finish handlers — navigate (replace) to TrainingComplete summary.
  // DB write is deferred to that screen (user explicitly taps "保存训练记录").
  // -----------------------------------------------------------------
  const handleRequestFinish = useCallback(
    () => setPendingFinish(true),
    [],
  );

  /**
   * Compute stats in-memory and navigate to the summary screen.
   * DB write is intentionally NOT done here — `completeTraining()` lives
   * on the TrainingCompleteScreen so the user has the final say.
   *
   * Safe to call multiple times via the `finishing` mutex.
   *
   * 必须先 `useRestTimerStore.getState().skip()` 收尾通知栏再 navigation:
   * 否则 bridge 随 ActiveTrainingScreen unmount,通知卡在最后帧。
   */
  const completeAndNavigate = useCallback(async () => {
    if (finishing) return;
    setFinishing(true);
    try {
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = null;
      }
      // 1) 强制收尾通知栏 + rest timer(必须在 navigation 之前同步执行)
      // dismissRestTimerNotification 直调一道兜底 —— bridge 的 useEffect 在
      // unmount 时只跑 cleanup 不重跑 body,跳 idle 后再 unmount 会漏 dismiss。
      useRestTimerStore.getState().skip();
      void dismissRestTimerNotification();

      // 2) 定格 store 的内存统计，保存时复用；不计总结页停留时间。
      const at = useTrainingStore.getState().activeTraining;
      if (!at) {
        setFinishing(false);
        return;
      }
      const stats = useTrainingStore.getState().prepareTrainingSummary();
      if (!stats) return;

      // 3) 跳转。activeTraining 仍驻留内存,等用户在 TrainingComplete
      //    显式 tap「保存训练记录」(→ completeTraining) 或「不保存」
      //    (→ cancelTraining) 才落库 / 丢弃。
      navigation.replace('TrainingComplete', {
        trainingId: at.id,
        durationSeconds: stats.durationSeconds,
        totalVolume: stats.totalVolume,
        exerciseCount: stats.exerciseCount,
        setCount: stats.setCount,
        planNameSnapshot: at.planNameSnapshot,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert('进入总结页失败', msg, [
        {
          text: '好的',
          onPress: () => {
            setFinishing(false);
          },
        },
      ]);
    }
  }, [finishing, navigation]);

  const handleConfirmFinish = useCallback(() => {
    setPendingFinish(false);
    stopDurationTimer();
    void completeAndNavigate();
  }, [completeAndNavigate, stopDurationTimer]);

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

  const handleSelectExercise = useCallback(
    (exIndex: number) => {
      if (
        !activeTraining ||
        exIndex < 0 ||
        exIndex >= activeTraining.exercises.length ||
        exIndex === currentExerciseIndex
      ) {
        return;
      }

      stopDurationTimer();
      Keyboard.dismiss();
      setCurrentExerciseIndex(exIndex);
      // Each exercise is its own task context. Returning to the top prevents
      // a long previous set list from leaving the new exercise half offscreen.
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      });
      haptic.tick();
    },
    [
      activeTraining,
      currentExerciseIndex,
      setCurrentExerciseIndex,
      stopDurationTimer,
    ],
  );

  const handleJumpToExercise = useCallback(
    (exIndex: number) => {
      handleSelectExercise(exIndex);
      setOverviewSheetOpen(false);
    },
    [handleSelectExercise],
  );

  const handleConfirmDelete = useCallback(() => {
    if (!pendingDelete) return;
    if (durationTimer?.clientId === pendingDelete.clientId) {
      setDurationTimer(null);
    }
    removeSet(pendingDelete.exerciseIndex, pendingDelete.clientId);
    haptic.warning();
    setPendingDelete(null);
  }, [durationTimer, pendingDelete, removeSet]);

  // -----------------------------------------------------------------
  // Field change handler — write into store on every change
  // BL-004: input focus -> scroll this set row into view above the keyboard.
  // Uses measureLayout + scrollTo (same pattern as rest-timer auto-scroll at
  // line ~285); the offset below places the row near the top of the visible
  // viewport, just below the status bar.
  const handleSetInputFocus = useCallback(
    (clientId: string) => {
      const targetView = setRowRefs.current.get(clientId);
      if (!targetView || !scrollViewRef.current) return;
      // Wrap measureLayout in requestAnimationFrame so the ScrollView has
      // a chance to react to the keyboard coming up (KeyboardAvoidingView
      // padding pushes content) before we measure coordinates.
      requestAnimationFrame(() => {
        if (!scrollViewRef.current) return;
        targetView.measureLayout(
          scrollViewRef.current as unknown as number,
          (_x, y, _w, _h) => {
            if (!scrollViewRef.current) return;
            // Row center near top of viewport. 100dp offset clears
            // the status bar + progress bar + a little breathing room.
            const offset = Math.max(0, y - 100);
            scrollViewRef.current.scrollTo({
              y: offset,
              animated: true,
            });
          },
          () => {
            // measureLayout 罕见失败 — 不滚,也不打断用户输入。
          },
        );
      });
    },
    [],
  );

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
  const checkScale = useSharedValue(1);
  const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: checkScale.value }] }));
  const [completingSet, setCompletingSet] = useState(false);
  const completingSetRef = useRef(false);
  useEffect(() => () => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    cancelAnimation(checkScale);
  }, [checkScale]);

  const handleCompleteSet = useCallback(() => {
    if (!activeTraining || completingSetRef.current) {
      return;
    }
    const ex = activeTraining.exercises[currentExerciseIndex];
    let target = ex?.sets[currentSetIndex];
    if (!target) {
      return;
    }
    if (target.completed) {
      return; // already done — CTA disabled but defensive
    }

    // 时间组若正在计时，主 CTA 同时承担“停止并写入实际时间”的职责。
    // updateSet 是同步 Zustand mutation，随后 completeAndAdvance 会在最新
    // state 上标记完成，因此不会丢掉这一拍的计时结果。
    if (durationTimer?.clientId === target.clientId) {
      stopDurationTimer();
    }

    // stopDurationTimer() synchronously writes the measured value to Zustand.
    // Re-read the row before validation so the last timer tick is included.
    const latestEx =
      useTrainingStore.getState().activeTraining?.exercises[currentExerciseIndex] ?? ex;
    target = latestEx.sets.find((s) => s.clientId === target.clientId) ?? target;
    const validationError = getSetMetricValidationError(
      latestEx.exercise.metricType,
      target,
    );
    if (validationError) {
      toast.show(validationError, 'warning');
      return;
    }

    // G29: 检测"这是当前动作的最后一组未完成"。
    // - 真：要么跳下一个还有未完成组的动作，要么（没有就）整体收尾。
    // - 假：什么都不做，依赖 completeAndAdvance 在动作内自动跳到下一未完成组。
    //
    // 必须 *在 mutate 之前* 用 closure 捕获的 exBefore 来算：
    // store 改写后再读就读到的是 mutate 之后的状态，会得到 0 个未完成，
    // 误判为"最后一组"。
    const exBefore = latestEx;
    const wasLastUncompletedInExercise =
      exBefore.sets.filter((s) => !s.completed).length === 1;

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

    completingSetRef.current = true;
    setCompletingSet(true);
    // duration-based spring 保留 gentle 的阻尼含义，并限制为临界阻尼。
    // Reanimated 的实际 settling duration 是配置的 1.5 倍：两段共 200ms。
    const spring = {
      duration: motion.duration.instant / 1.5,
      dampingRatio: Math.max(1, motion.springs.gentle.damping /
        (2 * Math.sqrt(motion.springs.gentle.stiffness))),
      overshootClamping: true,
    };
    checkScale.value = 1;
    checkScale.value = withSequence(withSpring(1.08, spring), withSpring(1, spring));

    haptic.success();

    // G12: 完成一组 → 轻量 toast 反馈（不阻断）。
    // Rest timer Sheet 即将弹出，toast 与 Sheet 不会冲突：toast 在顶部，
    // Sheet 在底部。
    const setLabel = `第 ${currentSetIndex + 1} 组`;
    toast.show(`${setLabel}已完成`, 'success');

    // G7 + G24: 触发休息计时器（restTimerStore.start → RestTimerOverlay 自动渲染）。
    // 优先用当前动作的 per-exercise 覆盖（plan_exercises.rest_seconds），
    // 自由训练 / 无覆盖时回落到设置里的全局默认。
    // 设计优化 #1: 同步把"刚做完的动作名"塞进 store,通知栏 title 展示出来,
    // 让用户在系统抽屉就能识别"休息的是哪个动作"。
    const activeEx = activeTraining?.exercises[currentExerciseIndex];
    const restSeconds = activeEx?.restSeconds ?? defaultRestSeconds;
    // 保留已完成的 CTA 一拍，避免休息遮罩或下一页吞掉落版反馈。
    feedbackTimerRef.current = setTimeout(() => {
      feedbackTimerRef.current = null;
      checkScale.value = 1;
      completingSetRef.current = false;
      setCompletingSet(false);
      triggerRestTimer(restSeconds, activeEx?.exercise.name ?? null);

      // G29: 跨动作跳转 / 整体收尾。当前动作做完后：
      //   1. 找下一个还有未完成组的动作 → 跳过去（store 自动把 currentSetIndex 重置为 0）
      //   2. 找不到 → 整体收尾（→ TrainingComplete 总结页）
      // 注意：wasLastUncompletedInExercise=true 在单动作训练 + 最后一组 时也会触发，
      // 自然走到分支 2，无需单独的 wouldAllBeDone 判断。
      if (wasLastUncompletedInExercise) {
        let jumpedTo = -1;
        for (let i = currentExerciseIndex + 1; i < activeTraining.exercises.length; i++) {
          const nextEx = activeTraining.exercises[i];
          if (nextEx.sets.some((s) => !s.completed)) {
            setCurrentExerciseIndex(i);
            jumpedTo = i;
            break;
          }
        }
        if (jumpedTo < 0) {
          // 没找到下一个 → 整体收尾。直接跳，不再二次确认（用户主动点的 CTA）。
          void completeAndNavigate();
        }
      }
    }, motion.duration.instant * 2);
  }, [
    activeTraining,
    currentExerciseIndex,
    currentSetIndex,
    completeAndAdvance,
    checkScale,
    defaultRestSeconds,
    completeAndNavigate,
    setCurrentExerciseIndex,
    durationTimer,
    stopDurationTimer,
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
        ref={scrollViewRef}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xxl,
          gap: spacing.lg,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {totalExercises > 1 ? (
          <ExerciseSwipeNavigator
            currentIndex={currentExerciseIndex}
            exerciseNames={activeTraining.exercises.map(
              (item) => item.exercise.name,
            )}
            onSelect={handleSelectExercise}
          />
        ) : null}

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
            {/* G36: 头像 + 名称都可点击 → 跳详情屏。 */}
            <Pressable
              onPress={() =>
                (navigation as unknown as {
                  navigate: (s: 'ExerciseDetail', p: { exerciseId: string }) => void;
                }).navigate('ExerciseDetail', { exerciseId: ex.exercise.id })
              }
              hitSlop={4}
              accessibilityRole="link"
              accessibilityLabel={`${ex.exercise.name} 详情`}
              accessibilityHint="打开动作详情页"
            >
              <ExerciseThumbnail
                name={ex.exercise.name}
                gifUrl={ex.exercise.gifUrl}
                size={48}
                rounded="square"
              />
            </Pressable>
            <Pressable
              onPress={() =>
                (navigation as unknown as {
                  navigate: (s: 'ExerciseDetail', p: { exerciseId: string }) => void;
                }).navigate('ExerciseDetail', { exerciseId: ex.exercise.id })
              }
              hitSlop={4}
              accessibilityRole="link"
              accessibilityLabel={`${ex.exercise.name} 详情`}
              accessibilityHint="打开动作详情页"
              style={{ flex: 1, gap: spacing.xs }}
            >
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
            </Pressable>
            {/* G29: "+ 添加组" 紧贴标题右侧，不再藏在 chip 卡里。 */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`为 ${ex.exercise.name} 添加组`}
              onPress={() => {
                appendEmptySet(currentExerciseIndex);
                // G29 细化：*不*把焦点跳到新组 —— 用户可能正在做当前的
                // 一组输入，只是先多开几组备用。焦点留在原 set 上，新组
                // 出现在列表底部，想用时自己点过去即可。
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
          {ex.exercise.metricType === 'time' ? <DurationSetHeader /> : null}
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
                  ex.exercise.metricType === 'time' || isActive
                    ? lastSetsByExerciseId[ex.exercise.id]
                    : undefined
                }
                onPressNumber={() =>
                  handleOpenTypeSheet(currentExerciseIndex, idx)
                }
                onTapRow={() => {
                  if (!isActive) {
                    stopDurationTimer();
                    setCurrentSetIndex(idx);
                    haptic.selection();
                  }
                }}
                onChangeField={onFieldChange}
                liveDurationSeconds={
                  durationTimer?.clientId === s.clientId
                    ? durationTimer.baseSeconds + durationTimerElapsed
                    : undefined
                }
                durationTimerRunning={durationTimer?.clientId === s.clientId}
                onToggleDurationTimer={() =>
                  handleToggleDurationTimer(currentExerciseIndex, s)
                }
                onEditDuration={() =>
                  handleOpenDurationEditor(currentExerciseIndex, idx, s)
                }
                justActivated={pulsedSetId === s.clientId}
                onInputFocus={isActive ? () => handleSetInputFocus(s.clientId) : undefined}
                rowRef={(view) => {
                  if (view) {
                    setRowRefs.current.set(s.clientId, view);
                  } else {
                    setRowRefs.current.delete(s.clientId);
                  }
                }}
              />
            );
          })}
        </View>
      </ScrollView>

      {/* ====== Bottom CTA ====== */}
      {/* G38.1: rest timer 进行中(展开态 / 折叠态)隐藏 Bottom CTA ——
          展开态 Sheet 已全屏遮罩(原本就不可见),折叠态底部窄条会盖住
          CTA 中段,但窄条左右两侧的 margin 仍可能透出 CTA 被误点。直接
          整体隐藏更稳。rest 结束后 skip() 触发,startedAt 翻 null,CTA
          自动复现,绑定的就是新激活 set 的"完成本组"。 */}
      {!restTimerActive ? (
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
          <Animated.View style={checkStyle} testID="complete-set-feedback">
            <Button
              variant={set.completed ? 'secondary' : 'primary'}
              size="lg"
              disabled={set.completed || completingSet}
              onPress={handleCompleteSet}
              accessibilityLabel={set.completed || completingSet ? '本组已完成' : '完成本组'}
              accessibilityHint={
                set.completed ? undefined : '保存数据并开始休息计时'
              }
              style={{ alignSelf: 'stretch' }}
            >
              {set.completed || completingSet ? '已完成 ✓' : '完成本组 ✓'}
            </Button>
          </Animated.View>
        </View>
      ) : null}

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

      <Sheet
        visible={durationSheetTarget !== null}
        onClose={() => setDurationSheetTarget(null)}
        title={
          durationSheetTarget
            ? `记录第 ${durationSheetTarget.setIndex + 1} 组时间`
            : '记录时间'
        }
        maxHeightRatio={0.55}
      >
        {durationSheetTarget ? (
          <DurationInputSheetBody
            currentSeconds={durationSheetTarget.seconds}
            onCommit={handleCommitActualDuration}
            submitLabel="填入本次"
          />
        ) : null}
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

      {/* ====== Rest-timer 通知栏同步 Bridge (G38) — 无 UI,纯副作用 ====== */}
      <RestTimerNotificationBridge />
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
    return `${prefix}${formatSetDuration(set.durationSeconds)}`;
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
          // G21 真正根因已于 2026-09-27 定位并修掉（见 trainingSetRepo.ts
          // `getLastSetsForExercises`）：不是 DB 里有重复行，是该查询用了
          // `SELECT *` + JOIN，`trainings.id` 覆盖了 `training_sets.id`，
          // 同一场训练的每组拿到同一个 id。**之前的注释把根因归给"DB 里存在
          // 重复 training_sets.id 行"，是错的**，别再照着它查。
          //
          // `#{i}` 后缀保留：现在 `s.id` 已恢复唯一，但同一 id 若因别的原因
          // 再次进入列表（或未来这个查询又回归），这个后缀能保证兄弟节点唯一，
          // 不会再把 warning 升级成红屏 overlay。代价仅为 key 稳定性略降。
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
  /**
   * BL-004: forwarded to NumberInput/WeightInput so the parent can scroll
   * the row above the keyboard when this field gains focus.
   */
  onInputFocus?: () => void;
}

function MetricFieldInput({
  field,
  value,
  disabled,
  onChange,
  inline = false,
  onInputFocus,
}: MetricFieldInputProps) {
  if (field === 'weight') {
    return (
      <WeightInput
        label={inline ? undefined : '重量'}
        value={value}
        onChangeValue={onChange}
        min={0}
        max={500}
        disabled={disabled}
        onFocus={onInputFocus}
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
        onFocus={onInputFocus}
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
        onFocus={onInputFocus}
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
      onFocus={onInputFocus}
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

/* ---------- Adjacent exercise navigation ---------- */

interface ExerciseSwipeNavigatorProps {
  currentIndex: number;
  exerciseNames: string[];
  onSelect: (index: number) => void;
}

/**
 * A dedicated gesture lane keeps horizontal exercise switching away from the
 * vertical set list and every editable control. The two arrow buttons make the
 * same action visible and keyboard/screen-reader reachable; swipe is an
 * acceleration, never the only way to navigate.
 */
function ExerciseSwipeNavigator({
  currentIndex,
  exerciseNames,
  onSelect,
}: ExerciseSwipeNavigatorProps) {
  const { colors, radius, spacing, typography } = useTheme();
  const total = exerciseNames.length;
  const canPrevious = currentIndex > 0;
  const canNext = currentIndex < total - 1;
  const currentName = exerciseNames[currentIndex] ?? '';

  const selectPrevious = useCallback(() => {
    if (canPrevious) onSelect(currentIndex - 1);
  }, [canPrevious, currentIndex, onSelect]);

  const selectNext = useCallback(() => {
    if (canNext) onSelect(currentIndex + 1);
  }, [canNext, currentIndex, onSelect]);

  const swipeGesture = useMemo(
    () =>
      Gesture.Pan()
        // The center lane begins well inside the screen edge, and a vertical
        // move wins before horizontal activation so ScrollView keeps its feel.
        .activeOffsetX([-18, 18])
        .failOffsetY([-10, 10])
        .runOnJS(true)
        .onEnd((event) => {
          const direction = resolveExerciseSwipeDirection({
            translationX: event.translationX,
            velocityX: event.velocityX,
            canPrevious,
            canNext,
          });
          if (direction !== 0) onSelect(currentIndex + direction);
        }),
    [canNext, canPrevious, currentIndex, onSelect],
  );

  const arrowStyle = (enabled: boolean, pressed: boolean) => ({
    width: 48,
    minHeight: 48,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: radius.md,
    backgroundColor:
      enabled && pressed ? colors.primaryMuted : colors.transparent,
    opacity: enabled ? 1 : 0.3,
  });

  return (
    <View
      style={{
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.xs,
        borderRadius: radius.lg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          canPrevious
            ? `上一个动作，${exerciseNames[currentIndex - 1]}`
            : '已经是第一个动作'
        }
        accessibilityState={{ disabled: !canPrevious }}
        disabled={!canPrevious}
        hitSlop={4}
        onPress={selectPrevious}
        style={({ pressed }) => arrowStyle(canPrevious, pressed)}
      >
        <Text
          style={{
            color: colors.primaryPressed,
            fontSize: 28,
            lineHeight: 30,
          }}
        >
          ‹
        </Text>
      </Pressable>

      <GestureDetector gesture={swipeGesture}>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={`当前动作 ${currentIndex + 1}/${total}，${currentName}`}
          accessibilityHint="左右滑动，或使用两侧按钮切换动作"
          accessibilityValue={{
            min: 1,
            max: total,
            now: currentIndex + 1,
            text: currentName,
          }}
          accessibilityActions={[
            { name: 'decrement', label: '上一个动作' },
            { name: 'increment', label: '下一个动作' },
          ]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'decrement') selectPrevious();
            if (event.nativeEvent.actionName === 'increment') selectNext();
          }}
          style={{
            flex: 1,
            minHeight: 54,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
          }}
        >
          <Text
            style={[
              typography.label,
              { color: colors.text, fontVariant: ['tabular-nums'] },
            ]}
          >
            动作 {currentIndex + 1}/{total}
          </Text>
          <Text
            style={[typography.caption, { color: colors.textTertiary }]}
          >
            左右滑动切换
          </Text>
        </View>
      </GestureDetector>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          canNext
            ? `下一个动作，${exerciseNames[currentIndex + 1]}`
            : '已经是最后一个动作'
        }
        accessibilityState={{ disabled: !canNext }}
        disabled={!canNext}
        hitSlop={4}
        onPress={selectNext}
        style={({ pressed }) => arrowStyle(canNext, pressed)}
      >
        <Text
          style={{
            color: colors.primaryPressed,
            fontSize: 28,
            lineHeight: 30,
          }}
        >
          ›
        </Text>
      </Pressable>
    </View>
  );
}

/* ---------- G29: SetRow (vertical set list) ---------- */

function DurationSetHeader() {
  const { colors, spacing, typography } = useTheme();
  return (
    <View
      accessibilityRole="header"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        minHeight: 36,
        paddingHorizontal: spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.divider,
      }}
    >
      <Text
        style={[
          typography.caption,
          { width: 40, textAlign: 'center', color: colors.textTertiary },
        ]}
      >
        组
      </Text>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
        {['上次', '目标', '本次'].map((label) => (
          <Text
            key={label}
            style={[
              typography.caption,
              { flex: 1, textAlign: 'center', color: colors.textTertiary },
            ]}
          >
            {label}
          </Text>
        ))}
        <View style={{ width: 48 }} />
      </View>
    </View>
  );
}

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
  liveDurationSeconds?: number;
  durationTimerRunning?: boolean;
  onToggleDurationTimer: () => void;
  onEditDuration: () => void;
  /**
   * G38.1: rest timer 倒计时自然到 0 之后 1.1s,屏幕侧会让该 prop 翻 true
   * 维持 0.6s,SetRow 据此给当前激活行加一个 border 闪光 + 背景短暂提亮
   * 提示用户"焦点已切到这一组"。手动 skip 路径不走该 prop。
   */
  justActivated?: boolean;
  /**
   * G38.1: 父级需要拿到每一行最外层 View 引用,以便 measureLayout 滚动
   * 到当前 set。callback ref 模式,卸载时回 null。
   */
  rowRef?: (view: View | null) => void;
  /**
   * BL-004: 当行内任意 TextInput 获得焦点时触发,父级据此 measureLayout
   * + scrollTo 把这一行带到键盘上方。仅 active set 会被聚焦,所以
   * onInputFocus 只在 active=true 时有意义。
   */
  onInputFocus?: () => void;
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
  liveDurationSeconds,
  durationTimerRunning = false,
  onToggleDurationTimer,
  onEditDuration,
  justActivated,
  rowRef,
  onInputFocus,
}: SetRowProps) {
  const { colors, spacing, typography, radius } = useTheme();
  const unit = useSettingsStore((s) => s.unit);
  const meta =
    SET_TYPES.find((t) => t.value === setRow.setType) ?? SET_TYPES[0];

  const completed = setRow.completed === true;

  // Background tint: active highlights, completed recedes, future is neutral.
  // G38.1: justActivated 时背景再亮一档(border + 背景短暂提亮),提示用户
  // "焦点切到了这一组"。0.6s 后自动复原(由父级 prop 翻 false 控制)。
  const rowBg = justActivated
    ? colors.primaryMuted
    : isActive
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
      ref={rowRef}
      style={{
        flexDirection: 'row',
        gap: spacing.sm,
        paddingVertical:
          metricType === 'time' ? spacing.xxs : spacing.sm + 4,
        paddingHorizontal: spacing.md,
        backgroundColor: rowBg,
        borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: colors.divider,
        // G38.1: justActivated 时顶部加一条 2dp primary 色"光带",视觉上
        // 提示这一行刚被激活;0.6s 后随 prop 翻 false 一起消失
        borderTopWidth: justActivated ? 2 : 0,
        borderTopColor: justActivated ? colors.primary : 'transparent',
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

      {/* Right: state-dependent body. Render priority is *completed >
          isActive > future* — once a set is done it shows the ✓ UI no
          matter whether focus happens to be on it (covers the "just
          completed the LAST set of an exercise" path where
          completeAndAdvance keeps currentSetIndex on the just-completed
          set). Pressing the body of an incomplete inactive row focuses
          it; completed rows aren't pressable (no edit semantics). */}
      {metricType === 'time' ? (
        <DurationSetRowBody
          setRow={setRow}
          isActive={isActive}
          completed={completed}
          lastSets={lastSets}
          liveSeconds={liveDurationSeconds}
          timerRunning={durationTimerRunning}
          onTapRow={onTapRow}
          onEditDuration={onEditDuration}
          onToggleTimer={onToggleDurationTimer}
        />
      ) : completed ? (
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            paddingVertical: spacing.sm,
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
      ) : isActive ? (
        <View style={{ flex: 1, gap: spacing.sm }}>
          {fields.length === 1 ? (
            <MetricFieldInput
              field={fields[0]}
              value={readField(setRow, fields[0])}
              disabled={false}
              onChange={(v) => onChangeField(fields[0], v)}
              inline
              onInputFocus={onInputFocus}
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
                    onInputFocus={onInputFocus}
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
          <Text
            style={[typography.body, { color: colors.textTertiary }]}
            numberOfLines={1}
          >
            {summary}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

interface DurationSetRowBodyProps {
  setRow: ActiveSet;
  isActive: boolean;
  completed: boolean;
  lastSets: TrainingSet[] | undefined;
  liveSeconds?: number;
  timerRunning: boolean;
  onTapRow: () => void;
  onEditDuration: () => void;
  onToggleTimer: () => void;
}

function DurationSetRowBody({
  setRow,
  isActive,
  completed,
  lastSets,
  liveSeconds,
  timerRunning,
  onTapRow,
  onEditDuration,
  onToggleTimer,
}: DurationSetRowBodyProps) {
  const { colors, typography, radius } = useTheme();
  const previous = lastSets?.find((item) => item.setIndex === setRow.setIndex);
  const actualSeconds = liveSeconds ?? setRow.durationSeconds;
  const textColor = completed ? colors.textTertiary : colors.text;

  const cells = (
    <>
      <Text
        style={[
          typography.bodySmall,
          {
            flex: 1,
            textAlign: 'center',
            color: colors.textSecondary,
            fontVariant: ['tabular-nums'],
          },
        ]}
        numberOfLines={1}
      >
        {formatSetDuration(previous?.durationSeconds)}
      </Text>
      <Text
        style={[
          typography.bodySmall,
          {
            flex: 1,
            textAlign: 'center',
            color: colors.textSecondary,
            fontVariant: ['tabular-nums'],
          },
        ]}
        numberOfLines={1}
      >
        {formatSetDuration(setRow.targetDurationSeconds)}
      </Text>
      {isActive && !completed ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`本次时间 ${formatSetDuration(actualSeconds)}`}
          accessibilityHint="手动填写本组时间"
          onPress={onEditDuration}
          style={({ pressed }) => ({
            flex: 1,
            minHeight: 48,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radius.sm,
            backgroundColor: pressed ? colors.surfaceMuted : colors.transparent,
          })}
        >
          <Text
            style={[
              typography.numeric,
              {
                color: colors.primaryPressed,
                fontSize: 15,
                fontWeight: '700',
                fontVariant: ['tabular-nums'],
              },
            ]}
          >
            {formatSetDuration(actualSeconds)}
          </Text>
        </Pressable>
      ) : (
        <Text
          style={[
            typography.bodySmall,
            {
              flex: 1,
              textAlign: 'center',
              color: textColor,
              fontVariant: ['tabular-nums'],
              textDecorationLine: completed ? 'line-through' : 'none',
            },
          ]}
          numberOfLines={1}
        >
          {formatSetDuration(actualSeconds)}
        </Text>
      )}
      {isActive && !completed ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={timerRunning ? '停止本组计时' : '开始本组计时'}
          accessibilityState={{ selected: timerRunning }}
          onPress={onToggleTimer}
          style={({ pressed }) => ({
            width: 48,
            height: 48,
            borderRadius: radius.full,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: timerRunning
              ? colors.primary
              : pressed
                ? colors.primaryMuted
                : colors.surfaceMuted,
          })}
        >
          <Text
            style={{
              color: timerRunning ? colors.onPrimary : colors.primaryPressed,
              fontSize: 18,
              fontWeight: '800',
            }}
          >
            {timerRunning ? '■' : '▶'}
          </Text>
        </Pressable>
      ) : (
        <View style={{ width: 48, alignItems: 'center' }}>
          {completed ? (
            <Text
              accessibilityLabel="已完成"
              style={{ color: colors.success, fontSize: 16, fontWeight: '700' }}
            >
              ✓
            </Text>
          ) : null}
        </View>
      )}
    </>
  );

  if (!isActive && !completed) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`选择第 ${setRow.setIndex} 组`}
        onPress={onTapRow}
        style={({ pressed }) => ({
          flex: 1,
          minHeight: 48,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: pressed ? colors.surfaceMuted : colors.transparent,
        })}
      >
        {cells}
      </Pressable>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      {cells}
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
    return `${prefix}${formatSetDuration(set.durationSeconds)}`;
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
