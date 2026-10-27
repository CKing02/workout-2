/**
 * PlanEditorScreen — G5 新建 / 编辑训练计划
 *
 * 顶部：计划名称输入
 * 中部：动作列表（每个动作包含若干组；支持添加组 / swipe-to-delete 组）
 * 底部：添加动作按钮（跳动作库多选；带预勾选回传）
 * 顶部右侧：保存按钮（名称为空时禁用）
 *
 * 数据流：
 *  - 新建：保存时调用 planStore.create({name, exerciseIds})
 *  - 编辑：planStore.loadDetail(planId)；保存时调用 planStore.update(...)
 *  - 组（plan_sets）属于 MVP 暂不落库的范畴：仅在 planStore.detailById 内存保留
 *
 * 动作卡片交互：
 *  - 右上角 "..." 按钮 → 打开 MoreSheet,内含 3 项:
 *      运动重排序 → 打开 ReorderModal (屏幕居中) 拖拽排序
 *      替换运动   → 打开 ReplaceSheet 选择新动作
 *      删除运动   → Dialog 二次确认 → 移除
 *  - 第一组上方有 "休息定时器" 按钮 (左对齐),点击 → RestSecondsSheet
 *  - 不再支持长按拖拽排序、也不支持从右往左滑动删除动作
 *  - 组 (SetRow) 支持从右往左滑动揭示"删除"按钮
 *
 * 与动作库多选的连接：
 *  PlanEditor 把回调 `onSelect` 通过 `route.params` 传给 ExerciseLibrary。
 *  在 picker mode 下，ExerciseLibrary 完成时直接调用 `onSelect(ids)` 然后
 *  `navigation.goBack()` 回到本屏（而不是绕道 `Tabs -> Training`）。这是
 *  G11 的 picker API；本屏用 G4 时代的 `useNavigationState` 监听 Tabs params
 *  会导致「完成(N)」把用户带到锻炼 Tab 再被 effect 拉回 — 视觉跳错页。
 *
 *  注意：route.params 里的函数是非可序列化的，React Navigation 会打 dev
 *  warning。这里可以接受，因为本 App 从不持久化 navigation state。
 */

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Dialog } from '@/components/Dialog';
import { DurationInputSheetBody } from '@/components/DurationInputSheetBody';
import { ExerciseThumbnail } from '@/components/ExerciseThumbnail';
import { Input } from '@/components/Input';
import { MenuRow } from '@/components/MenuRow';
import { NumberInput } from '@/components/NumberInput';
import { WeightInput } from '@/components/WeightInput';
import { Sheet } from '@/components/Sheet';
import { SET_TYPES, type SetTypeValue } from '@/constants/setTypes';
import { STUB_NEW_PLAN_ID } from '@/constants/plan';
import {
  METRIC_TYPES,
  findMetricType,
  type MetricField,
  type MetricType,
} from '@/constants/metricTypes';
import { toast } from '@/hooks/useToast';
import {
  usePlanStore,
  type PlanExerciseDraft,
  type PlanSetDraft,
} from '@/store/planStore';
import { useExerciseStore } from '@/store/exerciseStore';
import { useTheme } from '@/theme';
import { motion } from '@/theme/motion';
import { haptic } from '@/utils/haptics';
import { formatSetDuration } from '@/utils/duration';
import type { Exercise } from '@/db/schema';

import type { RootStackParamList } from '@/navigation/types';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'PlanEditor'>;
type PlanEditorRoute = RouteProp<RootStackParamList, 'PlanEditor'>;

const SWIPE_THRESHOLD = 80;
const REVEAL_WIDTH = 80;

export function PlanEditorScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<PlanEditorRoute>();
  const insets = useSafeAreaInsets();

  const planId = route.params?.planId;
  const isEditing = !!planId;

  const { colors, spacing, typography } = useTheme();

  const loadExercises = useExerciseStore((s) => s.load);
  const detailById = usePlanStore((s) => s.detailById);
  const loadDetail = usePlanStore((s) => s.loadDetail);
  const createPlan = usePlanStore((s) => s.create);
  const updatePlan = usePlanStore((s) => s.update);
  const removeExerciseFromPlan = usePlanStore(
    (s) => s.removeExerciseFromPlan,
  );
  const addSet = usePlanStore((s) => s.addSetToPlanExercise);
  const removeSet = usePlanStore((s) => s.removeSetFromPlanExercise);
  const updateSets = usePlanStore((s) => s.updatePlanExerciseSets);
  const replaceExerciseInPlan = usePlanStore((s) => s.replaceExerciseInPlan);
  const setExerciseRestSeconds = usePlanStore((s) => s.setExerciseRestSeconds);

  // The plan id under which we stage this edit. For new plans we use a stub
  // sentinel until save, so the editor's local state has somewhere to live.
  const editKey = isEditing ? planId! : STUB_NEW_PLAN_ID;

  // ----------------------------------------------------------------
  // Local editing state — `name` is draft until the user hits "保存".
  // ----------------------------------------------------------------
  const detail = detailById[editKey] ?? null;
  const detailLoading = isEditing && !detail;
  const [name, setName] = useState<string>('');
  const [nameTouchedFromDB, setNameTouchedFromDB] = useState(false);
  const [saving, setSaving] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const setRowRefs = useRef(new Map<string, View>());
  const pendingInputRowRef = useRef<string | null>(null);

  const scrollSetRowIntoView = useCallback((localId: string) => {
    const target = setRowRefs.current.get(localId);
    const scrollView = scrollViewRef.current;
    if (!target || !scrollView) return;
    // Fabric's measureLayout requires the native view ref, not its numeric
    // tag (nor the composite ScrollView instance).
    const content = (scrollView as unknown as { getInnerViewRef: () => View | null }).getInnerViewRef();
    if (!content) return;
    target.measureLayout(
      content as unknown as number,
      (_x, y) => {
        scrollViewRef.current?.scrollTo({
          y: Math.max(0, y - 112),
          animated: true,
        });
      },
      () => undefined,
    );
  }, []);

  const handleSetInputFocus = useCallback(
    (localId: string) => {
      pendingInputRowRef.current = localId;
      requestAnimationFrame(() => scrollSetRowIntoView(localId));
    },
    [scrollSetRowIntoView],
  );

  useEffect(() => {
    const eventName = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const subscription = Keyboard.addListener(eventName, (event) => {
      if (Platform.OS === 'android') setKeyboardHeight(event.endCoordinates.height);
      const localId = pendingInputRowRef.current;
      if (localId) requestAnimationFrame(() => scrollSetRowIntoView(localId));
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      pendingInputRowRef.current = null;
      setKeyboardHeight(0);
    });
    return () => {
      subscription.remove();
      hideSubscription.remove();
    };
  }, [scrollSetRowIntoView]);

  // ----------------------------------------------------------------
  // Bootstrap: load exercise catalog + edit-mode plan detail.
  // ----------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    void loadExercises();
    if (isEditing && planId) {
      if (!nameTouchedFromDB) {
        void usePlanStore.getState().fetch(planId).then((p) => {
          if (!cancelled && p) {
            setName(p.name);
            setNameTouchedFromDB(true);
          }
        });
      }
      if (!detail) {
        void loadDetail(planId);
      }
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, isEditing]);

  // ----------------------------------------------------------------
  // Header right: save button.
  // ----------------------------------------------------------------
  const handleSave = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.show('请输入计划名称', 'warning');
      return;
    }
    if (!isEditing) {
      const exerciseIds = detail?.exerciseIds ?? [];
      if (exerciseIds.length === 0) {
        toast.show('请至少添加一个动作', 'warning');
        return;
      }
      // BL-fix-rest: 防御性显式透传 restSecondsByExerciseId,不再依赖 store 内部
      // auto-collect。如果 store 内部某行过滤掉了草稿(React 闭包延迟/重排竞态),
      // 这里从最新的 detail.exercises 现场构造,保证写入 DB 的是用户最终设置的值。
      const restSecondsByExerciseId: Record<string, number> = {};
      for (const pe of detail?.exercises ?? []) {
        restSecondsByExerciseId[pe.exerciseId] = pe.restSeconds;
      }
      try {
        setSaving(true);
        await createPlan({ name: trimmed, exerciseIds, restSecondsByExerciseId });
        toast.show('计划已保存', 'success');
        navigation.goBack();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.show(`保存失败：${msg}`, 'error');
      } finally {
        setSaving(false);
      }
      return;
    }
    if (!planId) return;
    try {
      setSaving(true);
      const exerciseIds = detail?.exerciseIds ?? [];
      await updatePlan(planId, { name: trimmed, exerciseIds });
      toast.show('计划已保存', 'success');
      navigation.goBack();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.show(`保存失败：${msg}`, 'error');
    } finally {
      setSaving(false);
    }
  }, [name, detail, isEditing, planId, createPlan, updatePlan, navigation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Button
          size="sm"
          variant="primary"
          loading={saving}
          disabled={!name.trim()}
          onPress={handleSave}
        >
          保存
        </Button>
      ),
    });
  }, [navigation, saving, name, handleSave]);

  // ----------------------------------------------------------------
  // Cleanup on unmount: drop the stub detail for a new plan (we lose the
  // draft anyway because the user navigated away).
  // ----------------------------------------------------------------
  useEffect(() => {
    return () => {
      if (!isEditing) {
        usePlanStore.setState((state) => {
          const { [STUB_NEW_PLAN_ID]: _removed, ...rest } = state.detailById;
          return {
            detailById: rest,
            activePlanId:
              state.activePlanId === STUB_NEW_PLAN_ID
                ? null
                : state.activePlanId,
          };
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----------------------------------------------------------------
  // ExerciseLibrary round-trip — picker mode (G11 API).
  // ----------------------------------------------------------------
  const handlePickExercises = useCallback(() => {
    const initial = detail?.exerciseIds ?? [];
    navigation.navigate('ExerciseLibrary', {
      mode: 'multiple',
      initialSelectedIds: initial,
      onSelect: (selectedIds: string[]) => {
        const current =
          usePlanStore.getState().detailById[editKey]?.exerciseIds ?? [];
        const fresh = selectedIds.filter((id) => !current.includes(id));
        if (fresh.length === 0) return;

        usePlanStore.setState((state) => {
          const existing = state.detailById[editKey];
          const all = useExerciseStore.getState().exercises;
          const carry = existing?.exercises ?? [];
          const idsBefore = existing?.exerciseIds ?? [];
          const nextIds = [...idsBefore, ...fresh];
          const newRows: PlanExerciseDraft[] = [];
          let pos = carry.length;
          for (const id of fresh) {
            const ex = all.find((e) => e.id === id);
            if (!ex) continue;
            newRows.push({
              id: `tmp_${id}_${Date.now().toString(36)}`,
              planId: editKey,
              exerciseId: id,
              position: pos++,
              restSeconds: 60,
              exercise: ex,
              sets: [],
            });
          }
          return {
            detailById: {
              ...state.detailById,
              [editKey]: {
                exercises: [...carry, ...newRows],
                exerciseIds: nextIds,
              },
            },
            activePlanId: editKey,
          };
        });

        if (isEditing && planId) {
          void Promise.all(
            fresh.map((id) =>
              usePlanStore.getState().addExerciseToPlan(planId, id),
            ),
          );
        }
      },
    });
  }, [detail, editKey, isEditing, planId, navigation]);

  // ----------------------------------------------------------------
  // Set management helpers.
  // ----------------------------------------------------------------
  const onAddSet = useCallback(
    (peId: string) => {
      addSet(editKey, peId, true);
      haptic.selection();
    },
    [addSet, editKey],
  );

  const onRemoveSet = useCallback(
    (peId: string, setIndex: number) => {
      removeSet(editKey, peId, setIndex);
    },
    [removeSet, editKey],
  );

  const onUpdateSet = useCallback(
    (peId: string, setIndex: number, patch: Partial<PlanSetDraft>) => {
      const d = usePlanStore.getState().detailById[editKey];
      if (!d) return;
      const ex = d.exercises.find((e) => e.id === peId);
      if (!ex) return;
      const next = ex.sets.map((s, i) =>
        i === setIndex ? { ...s, ...patch } : s,
      );
      updateSets(editKey, peId, next);
    },
    [updateSets, editKey],
  );

  const onDeleteExercise = useCallback(
    (pe: PlanExerciseDraft) => {
      if (!isEditing) {
        usePlanStore.setState((state) => {
          const d = state.detailById[editKey];
          if (!d) return state;
          return {
            detailById: {
              ...state.detailById,
              [editKey]: {
                exercises: d.exercises.filter((e) => e.id !== pe.id),
                exerciseIds: d.exerciseIds.filter(
                  (id) => id !== pe.exerciseId,
                ),
              },
            },
          };
        });
        return;
      }
      void removeExerciseFromPlan(planId!, pe.id);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isEditing, planId, editKey, removeExerciseFromPlan],
  );

  // ----------------------------------------------------------------
  // Sheet for set type / delete-set.
  // ----------------------------------------------------------------
  const [setSheet, setSetSheet] = useState<{
    peId: string;
    setIndex: number;
  } | null>(null);

  const openSetSheet = useCallback((peId: string, setIndex: number) => {
    setSetSheet({ peId, setIndex });
    haptic.selection();
  }, []);

  const closeSetSheet = useCallback(() => setSetSheet(null), []);

  const onPickSetType = useCallback(
    (type: SetTypeValue) => {
      if (!setSheet) return;
      onUpdateSet(setSheet.peId, setSheet.setIndex, { setType: type });
      closeSetSheet();
    },
    [setSheet, onUpdateSet, closeSetSheet],
  );

  const onDeleteSetFromSheet = useCallback(() => {
    if (!setSheet) return;
    onRemoveSet(setSheet.peId, setSheet.setIndex);
    closeSetSheet();
  }, [setSheet, onRemoveSet, closeSetSheet]);

  const [durationSheet, setDurationSheet] = useState<{
    peId: string;
    setIndex: number;
    seconds: number;
  } | null>(null);

  const openDurationSheet = useCallback(
    (peId: string, setIndex: number, seconds: number) => {
      setDurationSheet({ peId, setIndex, seconds });
      haptic.selection();
    },
    [],
  );

  const commitDuration = useCallback(
    (seconds: number) => {
      if (!durationSheet) return;
      onUpdateSet(durationSheet.peId, durationSheet.setIndex, {
        durationSeconds: seconds,
      });
      setDurationSheet(null);
      haptic.success();
    },
    [durationSheet, onUpdateSet],
  );

  // ----------------------------------------------------------------
  // Per-card menus — MoreSheet / ReorderModal / ReplaceSheet / RestSheet.
  // `targetPeId` 同时驱动 MoreSheet 和它打开的下游界面。
  // ----------------------------------------------------------------
  const [moreSheetPeId, setMoreSheetPeId] = useState<string | null>(null);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [replaceSheetPeId, setReplaceSheetPeId] = useState<string | null>(null);
  const [restSheetPeId, setRestSheetPeId] = useState<string | null>(null);

  // Delete-confirm dialog state lives here so we can re-use the same Dialog
  // for any card, regardless of which menu opened it.
  const [pendingDeletePe, setPendingDeletePe] =
    useState<PlanExerciseDraft | null>(null);

  const openMoreSheet = useCallback((peId: string) => {
    setMoreSheetPeId(peId);
    haptic.selection();
  }, []);

  const closeMoreSheet = useCallback(() => setMoreSheetPeId(null), []);

  const handleMorePickReorder = useCallback(() => {
    setMoreSheetPeId(null);
    setReorderOpen(true);
  }, []);

  const handleMorePickReplace = useCallback(() => {
    const id = moreSheetPeId;
    setMoreSheetPeId(null);
    if (id) setReplaceSheetPeId(id);
  }, [moreSheetPeId]);

  const handleMorePickDelete = useCallback(() => {
    const id = moreSheetPeId;
    setMoreSheetPeId(null);
    if (!id || !detail) {
      setPendingDeletePe(null);
      return;
    }
    const pe = detail.exercises.find((e) => e.id === id) ?? null;
    setPendingDeletePe(pe);
  }, [moreSheetPeId, detail]);

  const closeReorderModal = useCallback(() => setReorderOpen(false), []);
  const closeReplaceSheet = useCallback(() => setReplaceSheetPeId(null), []);
  const closeRestSheet = useCallback(() => setRestSheetPeId(null), []);

  const handleReplacePick = useCallback(
    async (newExerciseId: string) => {
      const id = replaceSheetPeId;
      setReplaceSheetPeId(null);
      if (!id || !isEditing || !planId) return;
      try {
        await replaceExerciseInPlan(planId, id, newExerciseId);
        toast.show('已替换动作', 'success');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.show(`替换失败：${msg}`, 'error');
      }
    },
    [replaceSheetPeId, isEditing, planId, replaceExerciseInPlan],
  );

  const handleRestSecondsCommit = useCallback(
    async (seconds: number) => {
      const id = restSheetPeId;
      setRestSheetPeId(null);
      if (!id) return;
      if (isEditing && planId) {
        try {
          await setExerciseRestSeconds(planId, id, seconds);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          toast.show(`更新休息时长失败：${msg}`, 'error');
        }
      } else {
        // 新建计划 → 直接写本地 detailById,save 时 update() 路径会保留。
        usePlanStore.setState((state) => {
          const d = state.detailById[editKey];
          if (!d) return state;
          return {
            detailById: {
              ...state.detailById,
              [editKey]: {
                ...d,
                exercises: d.exercises.map((e) =>
                  e.id === id ? { ...e, restSeconds: seconds } : e,
                ),
              },
            },
          };
        });
      }
    },
    [restSheetPeId, isEditing, planId, setExerciseRestSeconds, editKey],
  );

  // ----------------------------------------------------------------
  // Render.
  // ----------------------------------------------------------------
  if (detailLoading) {
    return (
      <View
        style={[styles.center, { backgroundColor: colors.background }]}
        accessibilityLiveRegion="polite"
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const exercisesToShow = detail?.exercises ?? [];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + spacing.xxxxl + keyboardHeight,
          gap: spacing.lg,
        }}
        keyboardShouldPersistTaps="handled"
        onLayout={() => {
          const localId = pendingInputRowRef.current;
          if (localId) requestAnimationFrame(() => scrollSetRowIntoView(localId));
        }}
        onContentSizeChange={() => {
          const localId = pendingInputRowRef.current;
          if (keyboardHeight > 0 && localId) {
            requestAnimationFrame(() => scrollSetRowIntoView(localId));
          }
        }}
      >
        <Input
          label="计划名称"
          placeholder="如：推胸日"
          value={name}
          onChangeText={(v) => {
            setName(v);
            setNameTouchedFromDB(true);
          }}
          accessibilityLabel="计划名称输入"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={40}
        />

        <View style={{ gap: spacing.md }}>
          {exercisesToShow.length === 0 ? (
            <Card padding="lg">
              <Text
                style={[
                  typography.subtitle,
                  { color: colors.textSecondary, textAlign: 'center' },
                ]}
              >
                还没有动作。点击下方"添加动作"开始构建计划。
              </Text>
            </Card>
          ) : (
            exercisesToShow.map((pe) => (
              <ExerciseEditorCard
                key={pe.id}
                draft={pe}
                onAddSet={() => onAddSet(pe.id)}
                onOpenSetSheet={(idx) => openSetSheet(pe.id, idx)}
                onUpdateSet={(idx, patch) => onUpdateSet(pe.id, idx, patch)}
                onRemoveSet={(idx) => onRemoveSet(pe.id, idx)}
                onOpenMore={() => openMoreSheet(pe.id)}
                onOpenRest={() => setRestSheetPeId(pe.id)}
                onEditDuration={(idx, seconds) =>
                  openDurationSheet(pe.id, idx, seconds)
                }
                onSetInputFocus={handleSetInputFocus}
                setRowRef={(localId, view) => {
                  if (view) setRowRefs.current.set(localId, view);
                  else setRowRefs.current.delete(localId);
                }}
                onPressName={() =>
                  (navigation as unknown as {
                    navigate: (s: 'ExerciseDetail', p: { exerciseId: string }) => void;
                  }).navigate('ExerciseDetail', { exerciseId: pe.exercise.id })
                }
              />
            ))
          )}
        </View>

        <Button
          variant="primary"
          style={{ alignSelf: 'stretch' }}
          onPress={handlePickExercises}
          accessibilityLabel="添加动作"
        >
          + 添加动作
        </Button>
      </ScrollView>

      <Dialog
        visible={!!pendingDeletePe}
        variant="danger"
        title="从计划中移除此动作？"
        message={
          pendingDeletePe
            ? `动作：${pendingDeletePe.exercise.name}`
            : ''
        }
        confirmText="移除"
        cancelText="取消"
        onCancel={() => setPendingDeletePe(null)}
        onConfirm={() => {
          const pe = pendingDeletePe;
          setPendingDeletePe(null);
          if (pe) onDeleteExercise(pe);
        }}
      />

      <Sheet
        visible={!!moreSheetPeId}
        onClose={closeMoreSheet}
        title={
          moreSheetPeId
            ? detail?.exercises.find((e) => e.id === moreSheetPeId)?.exercise
                .name ?? '动作'
            : undefined
        }
        maxHeightRatio={0.45}
      >
        <MoreSheetBody
          onReorder={handleMorePickReorder}
          onReplace={handleMorePickReplace}
          onDelete={handleMorePickDelete}
        />
      </Sheet>

      <ReorderModal
        visible={reorderOpen}
        exercises={exercisesToShow}
        onClose={closeReorderModal}
        onCommit={async (newExerciseIds) => {
          setReorderOpen(false);
          if (!isEditing || !planId) {
            // 新建计划 → 仅本地重排
            usePlanStore.setState((state) => {
              const d = state.detailById[editKey];
              if (!d) return state;
              // newExerciseIds 是 exercises 表的 id 序列;d.exercises 是
              // PlanExerciseDraft 数组,通过 exerciseId 字段匹配。
              const reordered = newExerciseIds
                .map((exId) => d.exercises.find((e) => e.exerciseId === exId))
                .filter((v): v is PlanExerciseDraft => v !== null);
              return {
                detailById: {
                  ...state.detailById,
                  [editKey]: {
                    exercises: reordered,
                    exerciseIds: reordered.map((e) => e.exerciseId),
                  },
                },
              };
            });
            return;
          }
          // 编辑模式:用完整的 newExerciseIds 直接调 update(),让 store
          // 走 DELETE 旧 plan_exercises + 按新顺序 INSERT 全行。**不**算
          // 单步 swap —— 用户在 modal 里可能拖了多次,所有相对位置变化
          // 都要反映到最终顺序上。
          const current =
            usePlanStore.getState().detailById[planId]?.exerciseIds ?? [];
          if (
            current.length === newExerciseIds.length &&
            current.every((id, i) => id === newExerciseIds[i])
          ) {
            return; // 顺序未变,no-op
          }
          await usePlanStore.getState().update(planId, {
            exerciseIds: newExerciseIds,
          });
          haptic.success();
        }}
      />

      <Sheet
        visible={!!replaceSheetPeId}
        onClose={closeReplaceSheet}
        title="替换运动"
        maxHeightRatio={0.85}
      >
        <ReplaceSheetBody
          currentExerciseId={
            replaceSheetPeId
              ? detail?.exercises.find((e) => e.id === replaceSheetPeId)
                  ?.exerciseId
              : undefined
          }
          onPick={handleReplacePick}
        />
      </Sheet>

      <Sheet
        visible={!!restSheetPeId}
        onClose={closeRestSheet}
        title="休息定时器"
        maxHeightRatio={0.55}
      >
        <RestSecondsSheetBody
          currentSeconds={
            restSheetPeId
              ? detail?.exercises.find((e) => e.id === restSheetPeId)
                  ?.restSeconds ?? 60
              : 60
          }
          onCommit={handleRestSecondsCommit}
        />
      </Sheet>

      <Sheet
        visible={!!durationSheet}
        onClose={() => setDurationSheet(null)}
        title={
          durationSheet ? `设置第 ${durationSheet.setIndex + 1} 组时间` : '设置时间'
        }
        maxHeightRatio={0.55}
      >
        {durationSheet ? (
          <DurationInputSheetBody
            currentSeconds={durationSheet.seconds}
            onCommit={commitDuration}
          />
        ) : null}
      </Sheet>

      <Sheet
        visible={!!setSheet}
        onClose={closeSetSheet}
        title="编辑组"
        maxHeightRatio={0.55}
      >
        {setSheet ? (
          <SetSheetBody
            peId={setSheet.peId}
            setIndex={setSheet.setIndex}
            editKey={editKey}
            onPickType={onPickSetType}
            onDelete={onDeleteSetFromSheet}
          />
        ) : null}
      </Sheet>
    </KeyboardAvoidingView>
  );
}

/* -------------------------------------------------------------------------- */
/* ExerciseEditorCard                                                         */
/* -------------------------------------------------------------------------- */

interface ExerciseEditorCardProps {
  draft: PlanExerciseDraft;
  onAddSet: () => void;
  onOpenSetSheet: (setIndex: number) => void;
  onUpdateSet: (setIndex: number, patch: Partial<PlanSetDraft>) => void;
  onRemoveSet: (setIndex: number) => void;
  onOpenMore: () => void;
  onOpenRest: () => void;
  onEditDuration: (setIndex: number, seconds: number) => void;
  onSetInputFocus: (localId: string) => void;
  setRowRef: (localId: string, view: View | null) => void;
  /** G36: 点击动作名 → 跳详情屏。 */
  onPressName: () => void;
}

function ExerciseEditorCard({
  draft,
  onAddSet,
  onOpenSetSheet,
  onUpdateSet,
  onRemoveSet,
  onOpenMore,
  onOpenRest,
  onEditDuration,
  onSetInputFocus,
  setRowRef,
  onPressName,
}: ExerciseEditorCardProps) {
  const { colors, spacing, typography, radius } = useTheme();

  // ⋯ SetRow 按动作的 metricType 渲染字段。fallback 走第一个(reps)以防老数据
  // 残留未知值。
  // 注:PlanExerciseDraft.exercise 的"快照陈旧"由 src/store/syncExerciseToStores
  // 在架构层处理,本组件读 draft.exercise 即可拿到 live 值。
  const metricType =
    findMetricType(draft.exercise.metricType) ?? METRIC_TYPES[0];

  return (
    <Card padding="md">
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing.sm,
          gap: spacing.sm,
        }}
      >
        {/* G36: 左侧 GIF 头像 + 名称(可点击跳详情)。占用头部左侧 ~48px。 */}
        <ExerciseThumbnail
          name={draft.exercise.name}
          gifUrl={draft.exercise.gifUrl}
          size={48}
          rounded="square"
        />
        <View style={{ flex: 1 }}>
          <Pressable
            onPress={onPressName}
            hitSlop={6}
            accessibilityRole="link"
            accessibilityLabel={`${draft.exercise.name} 详情`}
            accessibilityHint="打开动作详情页"
          >
            <Text
              style={[typography.subtitle, { color: colors.text }]}
              numberOfLines={1}
            >
              {draft.exercise.name}
            </Text>
          </Pressable>
          <View
            style={{
              flexDirection: 'row',
              gap: spacing.xs,
              marginTop: spacing.xxs,
              flexWrap: 'wrap',
            }}
          >
            <Badge
              label={draft.exercise.muscleGroup}
              variant="primary"
              size="sm"
            />
            <Badge
              label={draft.exercise.equipment}
              variant="default"
              size="sm"
            />
          </View>
        </View>
        <Button
          size="sm"
          variant="ghost"
          onPress={onAddSet}
          accessibilityLabel={`为 ${draft.exercise.name} 添加组`}
        >
          添加组
        </Button>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${draft.exercise.name} 更多操作`}
          accessibilityHint="打开运动重排序、替换、删除菜单"
          hitSlop={8}
          onPress={onOpenMore}
          style={({ pressed }) => ({
            width: 32,
            height: 32,
            borderRadius: radius.sm,
            backgroundColor: pressed ? colors.surfaceMuted : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          <Text
            style={{
              color: colors.textTertiary,
              fontSize: 20,
              fontWeight: '700',
              lineHeight: 22,
            }}
          >
            ⋯
          </Text>
        </Pressable>
      </View>

      {/* 休息定时器按钮 (左对齐) — 仅在有组时显示;空组下"添加组"已存在,
          再放按钮反而拥挤。 */}
      {draft.sets.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="设置休息时长"
          accessibilityHint={`当前 ${draft.restSeconds} 秒`}
          onPress={onOpenRest}
          style={({ pressed }) => ({
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            paddingVertical: spacing.xs,
            paddingHorizontal: spacing.sm,
            marginBottom: spacing.xs,
            borderRadius: radius.sm,
            backgroundColor: pressed
              ? colors.surfaceMuted
              : colors.surface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
          })}
        >
          <Text style={{ fontSize: 14 }}>⏱</Text>
          <Text
            style={[typography.label, { color: colors.textSecondary }]}
          >
            休息 {draft.restSeconds}s
          </Text>
        </Pressable>
      ) : null}

      {draft.sets.length === 0 ? (
        <Text
          style={[
            typography.bodySmall,
            {
              color: colors.textTertiary,
              textAlign: 'center',
              paddingVertical: spacing.sm,
            },
          ]}
        >
          还没有组。点击右上角"添加组"开始。
        </Text>
      ) : (
        <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
          {metricType.value === 'time' ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                paddingHorizontal: spacing.xs,
                paddingBottom: spacing.xxs,
              }}
            >
              <Text
                style={[
                  typography.caption,
                  { width: 40, textAlign: 'center', color: colors.textTertiary },
                ]}
              >
                设置
              </Text>
              <Text
                style={[typography.caption, { flex: 1, color: colors.textTertiary }]}
              >
                时间
              </Text>
            </View>
          ) : null}
          {draft.sets.map((s, idx) => (
            <SetRow
              key={s.localId}
              setRow={s}
              metricType={metricType}
              onPressIndex={() => onOpenSetSheet(idx)}
              onChangeWeight={(w) => onUpdateSet(idx, { weight: w })}
              onChangeReps={(r) => onUpdateSet(idx, { reps: r })}
              onEditDuration={() => onEditDuration(idx, s.durationSeconds)}
              onChangeDistance={(km) => onUpdateSet(idx, { distanceKm: km })}
              onRemove={() => onRemoveSet(idx)}
              onInputFocus={() => onSetInputFocus(s.localId)}
              rowRef={(view) => setRowRef(s.localId, view)}
            />
          ))}
        </View>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* SetRow — supports swipe-to-delete                                          */
/*                                                                            */
/* 字段渲染按 metricType.fields 动态出 NumberInput:                             */
/* - ['reps']              → 1 个「次」输入                                    */
/* - ['weight']            → 1 个「kg」输入                                    */
/* - ['weight','reps']     → 「kg」+「次」两个输入（现有负重类）              */
/* - ['duration_seconds']  → 1 个时钟值；点击后选择 s/min/h 编辑              */
/* - ['distance_km']       → 1 个「km」输入                                   */
/*                                                                            */
/* duration 通过独立 Sheet 提交；distance 仍直接写 PlanSetDraft。             */
/* -------------------------------------------------------------------------- */

interface SetRowProps {
  setRow: PlanSetDraft;
  metricType: MetricType;
  onPressIndex: () => void;
  onChangeWeight: (next: number) => void;
  onChangeReps: (next: number) => void;
  onEditDuration?: () => void;
  onChangeDistance?: (km: number) => void;
  onRemove: () => void;
  onInputFocus?: () => void;
  rowRef?: (view: View | null) => void;
}

function SetRow({
  setRow,
  metricType,
  onPressIndex,
  onChangeWeight,
  onChangeReps,
  onEditDuration,
  onChangeDistance,
  onRemove,
  onInputFocus,
  rowRef,
}: SetRowProps) {
  const { colors, spacing, typography, radius } = useTheme();
  const meta = SET_TYPES.find((t) => t.value === setRow.setType) ?? SET_TYPES[0];

  const translateX = useSharedValue(0);

  const handleTrashPress = useCallback(() => {
    translateX.value = withTiming(0, { duration: motion.duration.fast }, (finished) => {
      if (finished) runOnJS(onRemove)();
    });
  }, [onRemove, translateX]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-12, 12])
        .failOffsetY([-12, 12])
        .onUpdate((e) => {
          const next = Math.min(
            0,
            Math.max(-REVEAL_WIDTH - 16, e.translationX),
          );
          translateX.value = next;
        })
        .onEnd(() => {
          if (translateX.value < -SWIPE_THRESHOLD) {
            translateX.value = withTiming(-REVEAL_WIDTH, {
              duration: motion.duration.fast,
              easing: motion.easing.standard,
            });
          } else {
            translateX.value = withTiming(0, {
              duration: motion.duration.fast,
              easing: motion.easing.standard,
            });
          }
        }),
    [translateX],
  );

  const tap = useMemo(
    () =>
      Gesture.Tap().onEnd(() => {
        translateX.value = withTiming(0, { duration: motion.duration.fast });
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

  return (
    <View ref={rowRef} collapsable={false} style={{ position: 'relative' }}>
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.trashLayer,
          {
            backgroundColor: colors.danger,
            borderRadius: radius.md,
            right: 0,
          },
          trashStyle,
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`删除第 ${setRow.setIndex} 组`}
          onPress={handleTrashPress}
          style={({ pressed }) => [
            styles.trashButton,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={{ color: colors.onPrimary, fontWeight: '700' }}>
            删除
          </Text>
        </Pressable>
      </Animated.View>

      <GestureDetector gesture={composed}>
        <Animated.View style={cardStyle}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`第 ${setRow.setIndex} 组 ${meta.label}`}
              accessibilityHint="点击修改组类型或删除组"
              onPress={onPressIndex}
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                borderRadius: radius.full,
                backgroundColor: colors.primaryMuted,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text
                style={[typography.label, { color: colors.primaryPressed }]}
              >
                {meta.short
                  ? `${meta.short}${setRow.setIndex}`
                  : `${setRow.setIndex}`}
              </Text>
            </Pressable>

            {/* 字段区:按 metricType.fields 动态渲染 1 / 2 个 NumberInput。 */}
            {metricType.fields.map((field) => (
              <SetRowField
                key={field}
                field={field}
                setIndex={setRow.setIndex}
                setRow={setRow}
                onChangeWeight={onChangeWeight}
                onChangeReps={onChangeReps}
                onEditDuration={onEditDuration}
                onChangeDistance={onChangeDistance}
                onInputFocus={onInputFocus}
              />
            ))}
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* SetRowField — 单字段输入框,根据 MetricField 类型分发                       */
/* -------------------------------------------------------------------------- */

interface SetRowFieldProps {
  field: MetricField;
  setIndex: number;
  setRow: PlanSetDraft;
  onChangeWeight: (next: number) => void;
  onChangeReps: (next: number) => void;
  onEditDuration?: () => void;
  onChangeDistance?: (km: number) => void;
  onInputFocus?: () => void;
}

function SetRowField({
  field,
  setIndex,
  setRow,
  onChangeWeight,
  onChangeReps,
  onEditDuration,
  onChangeDistance,
  onInputFocus,
}: SetRowFieldProps) {
  const { colors, typography, radius } = useTheme();
  switch (field) {
    case 'weight':
      return (
        <View
          style={{ flex: 1 }}
          accessible
          accessibilityLabel={`第 ${setIndex} 组 重量`}
        >
          <WeightInput
            value={setRow.weight}
            onChangeValue={onChangeWeight}
            min={0}
            max={500}
            onFocus={onInputFocus}
          />
        </View>
      );
    case 'reps':
      return (
        <View
          style={{ flex: 1 }}
          accessible
          accessibilityLabel={`第 ${setIndex} 组 次数`}
        >
          <NumberInput
            value={setRow.reps}
            onChangeValue={onChangeReps}
            min={0}
            max={50}
            onFocus={onInputFocus}
          />
        </View>
      );
    case 'duration_seconds':
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`第 ${setIndex} 组时间 ${formatSetDuration(setRow.durationSeconds, '00:00')}`}
          accessibilityHint="打开时间和单位编辑"
          onPress={onEditDuration}
          style={({ pressed }) => ({
            flex: 1,
            minHeight: 48,
            justifyContent: 'center',
            paddingHorizontal: 12,
            borderRadius: radius.md,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text
            style={[
              typography.numeric,
              {
                color: colors.text,
                fontSize: 17,
                fontWeight: '600',
                fontVariant: ['tabular-nums'],
              },
            ]}
          >
            {formatSetDuration(setRow.durationSeconds, '00:00')}
          </Text>
        </Pressable>
      );
    case 'distance_km':
      return (
        <View
          style={{ flex: 1 }}
          accessible
          accessibilityLabel={`第 ${setIndex} 组 距离`}
        >
          <NumberInput
            value={setRow.distanceKm}
            onChangeValue={onChangeDistance ?? (() => {})}
            min={0}
            max={500}
            precision={2}
            unitLabel="km"
            onFocus={onInputFocus}
          />
        </View>
      );
  }
}

/* -------------------------------------------------------------------------- */
/* MoreSheetBody — 动作卡片 "..." 菜单                                         */
/* -------------------------------------------------------------------------- */

interface MoreSheetBodyProps {
  onReorder: () => void;
  onReplace: () => void;
  onDelete: () => void;
}

function MoreSheetBody({
  onReorder,
  onReplace,
  onDelete,
}: MoreSheetBodyProps) {
  const { spacing, colors, typography, radius } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <MenuRow
        label="运动重排序"
        hint="拖动调整动作顺序"
        onPress={onReorder}
      />
      <MenuRow label="替换运动" hint="更换为动作库中的其他动作" onPress={onReplace} />
      <MenuRow
        label="删除运动"
        hint="从此计划中移除该动作"
        onPress={onDelete}
        danger
      />
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* ReorderModal — 屏幕居中,内含可拖拽的动作列表                                */
/* -------------------------------------------------------------------------- */

interface ReorderModalProps {
  visible: boolean;
  exercises: PlanExerciseDraft[];
  onClose: () => void;
  onCommit: (newOrder: string[]) => void;
}

const REORDER_ROW_HEIGHT = 56;
const REORDER_ROW_GAP = 6;

function ReorderModal({
  visible,
  exercises,
  onClose,
  onCommit,
}: ReorderModalProps) {
  const { colors, spacing, typography, radius } = useTheme();
  const insets = useSafeAreaInsets();

  // 本地顺序:用户拖拽 swap 时改这里,松手 commit 时推到父级。
  // 用父级 exercises 的 id 序列签名作为 useState 的"隐式同步触发":
  // exercises 一旦内容变化,orderKey 变,useEffect 立即 setOrder 跟上。
  const orderKey = exercises.map((e) => e.id).join('|');
  const [order, setOrder] = useState<string[]>(() =>
    exercises.map((e) => e.id),
  );

  useEffect(() => {
    setOrder(exercises.map((e) => e.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderKey, visible]);

  // 按 visualOrder 索引查找 planExercise。
  const byId = useMemo(
    () => new Map(exercises.map((e) => [e.id, e])),
    [exercises],
  );

  /**
   * ReorderRow 在 pan end 时调用:把 id 从 fromIndex 一次 swap 到 toIndex。
   * 不在拖拽过程中 step-by-step 改 order — 那样会让 key 变化触发组件
   * unmount/mount,把 GestureDetector 也带走,导致拖拽中断。
   * 视觉上的"跨行"由卡片自身的 translateY 共享值实时跟随手指完成,
   * 松手时一次性把数据层同步到正确位置。
   */
  const handleDrop = useCallback(
    (id: string, translationY: number) => {
      haptic.selection();
      const fromIdx = order.indexOf(id);
      if (fromIdx === -1) return;
      const stepOffset = Math.round(
        translationY / (REORDER_ROW_HEIGHT + REORDER_ROW_GAP),
      );
      const toIdx = Math.max(
        0,
        Math.min(order.length - 1, fromIdx + stepOffset),
      );
      if (toIdx === fromIdx) return;
      setOrder((prev) => {
        const next = [...prev];
        const [moved] = next.splice(fromIdx, 1);
        next.splice(toIdx, 0, moved);
        return next;
      });
    },
    [order],
  );

  const handleConfirm = useCallback(() => {
    // 把 plan_exercises.id 序列翻译成 exerciseId 序列再交给父级 ——
    // 父级 detailById[planId].exerciseIds 与父级 reorder/update 逻辑都用
    // exerciseId 作为顺序真源。如果直接传 plan_exercises.id,父级
    // update(exerciseIds) 路径会用 id 跟 exerciseId 比对,所有元素都不等,
    // 整张表就被错位重写。
    const newExerciseIds = order
      .map((id) => byId.get(id)?.exerciseId)
      .filter((v): v is string => !!v);
    onCommit(newExerciseIds);
  }, [order, byId, onCommit]);

  if (!visible) return null;

  // 不用 RN Modal —— Modal 走原生 UIViewController/Dialog,事件路径不经过
  // gesture-handler 的 native view 树,内部的 GestureDetector 收不到 touch。
  // 改成 absoluteFill 全屏覆盖 View 嵌在 PlanEditorScreen 根级 child,
  // 这样 row 在正常的 RN view tree 里,长按拖拽才能 attach。
  //
  // 高度策略:modalCard 是 flex column,标题/提示/按钮各占自然高度,
  // 中间 row 列表用 flex: 1 + overflow:'hidden' 吃掉所有剩余空间 —
  // 任何动作数下按钮都贴在 modalCard 底部,row 超出部分被裁切(常见做法,
  // 配合 6 行 maxHeight 用户已够用)。
  return (
    <View style={styles.modalBackdrop} pointerEvents="box-none">
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="关闭"
      />
      <View style={styles.modalCardWrap} pointerEvents="box-none">
        <View
          style={[
            styles.modalCard,
            {
              backgroundColor: colors.surfaceElevated,
              borderRadius: radius.xl,
              padding: spacing.lg,
              paddingBottom: spacing.lg + insets.bottom,
              flex: 1,
            },
          ]}
        >
          <Text
            style={[
              typography.h3,
              { color: colors.text, marginBottom: spacing.xs },
            ]}
          >
            调整动作顺序
          </Text>
          <Text
            style={[
              typography.caption,
              { color: colors.textTertiary, marginBottom: spacing.md },
            ]}
          >
            长按任意位置拖动到目标行
          </Text>

          <View
            style={{
              gap: REORDER_ROW_GAP,
              flex: 1,
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            {order.length === 0 ? (
              <Text
                style={[
                  typography.bodySmall,
                  {
                    color: colors.textTertiary,
                    textAlign: 'center',
                    paddingVertical: spacing.lg,
                  },
                ]}
              >
                暂无可排序的动作
              </Text>
            ) : (
              order.map((id, idx) => {
                const pe = byId.get(id);
                if (!pe) return null;
                return (
                  <ReorderRow
                    key={id}
                    pe={pe}
                    index={idx}
                    onDrop={handleDrop}
                  />
                );
              })
            )}
          </View>

          <View
            style={{
              flexDirection: 'row',
              gap: spacing.sm,
              marginTop: spacing.lg,
              justifyContent: 'flex-end',
            }}
          >
            <Button variant="ghost" onPress={onClose}>
              取消
            </Button>
            <Button variant="primary" onPress={handleConfirm}>
              完成
            </Button>
          </View>
        </View>
      </View>
    </View>
  );
}

interface ReorderRowProps {
  pe: PlanExerciseDraft;
  index: number;
  /** Pan end: parent swaps this id from current index to `translationY` 推断的目标位置。 */
  onDrop: (id: string, translationY: number) => void;
}

/**
 * 整张 ROW 都是 GestureDetector — 长按 220ms 启动后,卡片视觉位置
 * 由共享值 `translateY` 直接跟随手指 (无 setState 中间过程,绝无抖动),
 * 松手时把 translationY 交回父级算 toIndex 一次性 setOrder。
 * 视觉上的"跨过 N 行"由其他行 gap 自然撑开 — 数据没动就只是这一行浮起。
 */
function ReorderRow({ pe, index, onDrop }: ReorderRowProps) {
  const { colors, spacing, typography, radius } = useTheme();

  const translateY = useSharedValue(0);
  const isActive = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    zIndex: isActive.value === 1 ? 10 : 0,
    opacity: isActive.value === 1 ? 0.92 : 1,
    elevation: isActive.value === 1 ? 6 : 0,
  }));

  const dragGesture = useMemo(
    () =>
      Gesture.Pan()
        .activateAfterLongPress(220)
        .failOffsetX([-12, 12])
        .onStart(() => {
          isActive.value = 1;
        })
        .onUpdate((e) => {
          translateY.value = e.translationY;
        })
        .onEnd((e) => {
          isActive.value = 0;
          runOnJS(onDrop)(pe.id, e.translationY);
          translateY.value = withTiming(0, { duration: motion.duration.fast });
        })
        .onFinalize(() => {
          // 兜底:手势被中途取消(Modal 关闭 / 焦点丢失等)也要归位。
          isActive.value = 0;
          translateY.value = withTiming(0, { duration: motion.duration.fast });
        }),
    [pe.id, translateY, isActive, onDrop],
  );

  return (
    <GestureDetector gesture={dragGesture}>
      <Animated.View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            borderRadius: radius.md,
            backgroundColor: colors.surface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            minHeight: REORDER_ROW_HEIGHT,
          },
          animatedStyle,
        ]}
      >
        <Text
          style={[
            typography.label,
            { color: colors.textTertiary, width: 24, textAlign: 'center' },
          ]}
        >
          {index + 1}
        </Text>
        <View style={{ flex: 1 }}>
          <Text
            style={[typography.body, { color: colors.text }]}
            numberOfLines={1}
          >
            {pe.exercise.name}
          </Text>
          <Text
            style={[
              typography.caption,
              { color: colors.textTertiary, marginTop: 2 },
            ]}
          >
            {pe.exercise.muscleGroup} · {pe.exercise.equipment}
          </Text>
        </View>
        <View
          accessibilityLabel="长按整行拖动排序"
          style={{
            width: 36,
            height: 36,
            borderRadius: radius.sm,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              color: colors.textTertiary,
              fontSize: 18,
              fontWeight: '700',
              letterSpacing: 2,
            }}
          >
            ⋮⋮
          </Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

/* -------------------------------------------------------------------------- */
/* ReplaceSheetBody — 选择替换动作                                             */
/* -------------------------------------------------------------------------- */

interface ReplaceSheetBodyProps {
  currentExerciseId?: string;
  onPick: (newExerciseId: string) => void;
}

function ReplaceSheetBody({
  currentExerciseId,
  onPick,
}: ReplaceSheetBodyProps) {
  const { colors, spacing, typography, radius } = useTheme();
  const exercises = useExerciseStore((s) => s.exercises);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return exercises.filter((e) => e.id !== currentExerciseId);
    return exercises.filter((e) => {
      if (e.id === currentExerciseId) return false;
      return (
        e.name.toLowerCase().includes(q) ||
        e.muscleGroup.toLowerCase().includes(q) ||
        e.equipment.toLowerCase().includes(q)
      );
    });
  }, [exercises, query, currentExerciseId]);

  return (
    <View style={{ gap: spacing.sm }}>
      <TextInput
        placeholder="搜索动作"
        placeholderTextColor={colors.textTertiary}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
        style={{
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: radius.md,
          backgroundColor: colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          color: colors.text,
          fontSize: 14,
        }}
      />

      {filtered.length === 0 ? (
        <Text
          style={[
            typography.bodySmall,
            {
              color: colors.textTertiary,
              textAlign: 'center',
              paddingVertical: spacing.lg,
            },
          ]}
        >
          没有匹配的动作
        </Text>
      ) : (
        <ScrollView
          style={{ maxHeight: 360 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ gap: spacing.xs }}>
            {filtered.map((ex) => (
              <ReplaceRow key={ex.id} ex={ex} onPick={onPick} />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function ReplaceRow({
  ex,
  onPick,
}: {
  ex: Exercise;
  onPick: (id: string) => void;
}) {
  const { colors, spacing, typography, radius } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`替换为 ${ex.name}`}
      onPress={() => onPick(ex.id)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radius.md,
        backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
      })}
    >
      {/* G36: GIF 静态首帧代替之前的字符占位 */}
      <ExerciseThumbnail name={ex.name} gifUrl={ex.gifUrl} size={32} rounded="circle" />
      <View style={{ flex: 1 }}>
        <Text style={[typography.body, { color: colors.text }]}>{ex.name}</Text>
        <Text
          style={[typography.caption, { color: colors.textTertiary, marginTop: 2 }]}
        >
          {ex.muscleGroup} · {ex.equipment}
        </Text>
      </View>
    </Pressable>
  );
}

/* -------------------------------------------------------------------------- */
/* RestSecondsSheetBody — 配置休息时长                                         */
/* -------------------------------------------------------------------------- */

interface RestSecondsSheetBodyProps {
  currentSeconds: number;
  onCommit: (seconds: number) => void;
}

const REST_PRESETS = [30, 45, 60, 90, 120, 180, 240];

function RestSecondsSheetBody({
  currentSeconds,
  onCommit,
}: RestSecondsSheetBodyProps) {
  const { spacing, colors, typography, radius } = useTheme();
  const [value, setValue] = useState<number>(currentSeconds);

  useEffect(() => {
    setValue(currentSeconds);
  }, [currentSeconds]);

  const clamped = Math.max(0, Math.min(600, Math.round(value)));

  return (
    <View style={{ gap: spacing.md }}>
      <Text
        style={[
          typography.label,
          { color: colors.textSecondary, textTransform: 'uppercase' },
        ]}
      >
        常用时长
      </Text>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.xs,
        }}
      >
        {REST_PRESETS.map((preset) => {
          const active = clamped === preset;
          return (
            <Pressable
              key={preset}
              accessibilityRole="radio"
              accessibilityLabel={`${preset} 秒`}
              accessibilityState={{ selected: active }}
              onPress={() => setValue(preset)}
              style={({ pressed }) => ({
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
                borderRadius: radius.full,
                backgroundColor: active
                  ? colors.primary
                  : pressed
                  ? colors.surfaceMuted
                  : colors.surface,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: active ? colors.primary : colors.border,
              })}
            >
              <Text
                style={[
                  typography.label,
                  { color: active ? colors.onPrimary : colors.text },
                ]}
              >
                {preset}s
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View>
        <Text
          style={[
            typography.label,
            {
              color: colors.textSecondary,
              textTransform: 'uppercase',
              marginBottom: spacing.xs,
            },
          ]}
        >
          自定义 (秒)
        </Text>
        <NumberInput
          value={value}
          onChangeValue={setValue}
          min={0}
          max={600}
          unitLabel="s"
        />
      </View>

      <View
        style={{
          flexDirection: 'row',
          gap: spacing.sm,
          justifyContent: 'flex-end',
          marginTop: spacing.xs,
        }}
      >
        <Button
          variant="primary"
          onPress={() => onCommit(clamped)}
          disabled={clamped === currentSeconds}
        >
          保存
        </Button>
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* SetSheetBody                                                               */
/* -------------------------------------------------------------------------- */

interface SetSheetBodyProps {
  peId: string;
  setIndex: number;
  editKey: string;
  onPickType: (type: SetTypeValue) => void;
  onDelete: () => void;
}

function SetSheetBody({
  setIndex,
  editKey,
  onPickType,
  onDelete,
}: SetSheetBodyProps) {
  const { spacing, colors, typography, radius } = useTheme();
  const [currentType, setCurrentType] = useState<SetTypeValue>('normal');

  useEffect(() => {
    const detail = usePlanStore.getState().detailById[editKey];
    const ex = detail?.exercises.find((e) =>
      e.sets.some((_, i) => i === setIndex),
    );
    if (!ex) return;
    const setRow = ex.sets[setIndex];
    if (setRow) setCurrentType(setRow.setType);
  }, [setIndex, editKey]);

  return (
    <View style={{ gap: spacing.md }}>
      <Text
        style={[
          typography.label,
          { color: colors.textSecondary, textTransform: 'uppercase' },
        ]}
      >
        组类型
      </Text>
      <View style={{ gap: spacing.xs }}>
        {SET_TYPES.map((t) => {
          const active = currentType === t.value;
          return (
            <Pressable
              key={t.value}
              accessibilityRole="radio"
              accessibilityLabel={t.label}
              accessibilityState={{ selected: active }}
              onPress={() => {
                setCurrentType(t.value);
                onPickType(t.value);
              }}
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
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="删除此组"
        onPress={onDelete}
        style={({ pressed }) => ({
          paddingVertical: spacing.md,
          borderRadius: radius.md,
          backgroundColor: pressed ? colors.danger : colors.surface,
          alignItems: 'center',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.danger,
        })}
      >
        <Text style={[typography.label, { color: colors.danger }]}>
          删除此组
        </Text>
      </Pressable>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Styles                                                                     */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trashLayer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trashButton: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalCardWrap: {
    width: '100%',
    maxHeight: '90%',
    height: '90%',
    alignItems: 'center',
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
  },
});
