/**
 * PlanEditorScreen — G5 新建 / 编辑训练计划
 *
 * 顶部：计划名称输入
 * 中部：动作列表（每个动作包含若干组；支持添加组 / 删除组 / 切换组类型）
 * 底部：添加动作按钮（跳动作库多选；带预勾选回传）
 * 顶部右侧：保存按钮（名称为空时禁用）
 *
 * 数据流：
 *  - 新建：保存时调用 planStore.create({name, exerciseIds})
 *  - 编辑：planStore.loadDetail(planId)；保存时调用 planStore.update(...)
 *  - 组（plan_sets）属于 MVP 暂不落库的范畴：仅在 planStore.detailById 内存保留
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
  useState,
} from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
  Easing,
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
import { Input } from '@/components/Input';
import { NumberInput } from '@/components/NumberInput';
import { Sheet } from '@/components/Sheet';
import { SET_TYPES, type SetTypeValue } from '@/constants/setTypes';
import { toast } from '@/hooks/useToast';
import {
  usePlanStore,
  type PlanExerciseDraft,
  type PlanSetDraft,
} from '@/store/planStore';
import { useExerciseStore } from '@/store/exerciseStore';
import { useTheme } from '@/theme';
import { haptic } from '@/utils/haptics';

import type { RootStackParamList } from '@/navigation/types';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'PlanEditor'>;
type PlanEditorRoute = RouteProp<RootStackParamList, 'PlanEditor'>;

const SWIPE_THRESHOLD = 80;
const STUB_NEW_PLAN_ID = '__new';

export function PlanEditorScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<PlanEditorRoute>();
  const insets = useSafeAreaInsets();

  const planId = route.params?.planId;
  const isEditing = !!planId;

  const { colors, spacing, typography, radius } = useTheme();

  const loadExercises = useExerciseStore((s) => s.load);
  const detailById = usePlanStore((s) => s.detailById);
  const loadDetail = usePlanStore((s) => s.loadDetail);
  const clearDetail = usePlanStore((s) => s.clearDetail);
  const createPlan = usePlanStore((s) => s.create);
  const updatePlan = usePlanStore((s) => s.update);
  const removeExerciseFromPlan = usePlanStore(
    (s) => s.removeExerciseFromPlan,
  );
  const addSet = usePlanStore((s) => s.addSetToPlanExercise);
  const removeSet = usePlanStore((s) => s.removeSetFromPlanExercise);
  const updateSets = usePlanStore((s) => s.updatePlanExerciseSets);

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
  const [pendingRemoveExercise, setPendingRemoveExercise] =
    useState<PlanExerciseDraft | null>(null);

  // ----------------------------------------------------------------
  // Bootstrap: load exercise catalog + edit-mode plan detail.
  //
  // We always re-pull `name` from DB on mount regardless of whether
  // `detail` is already cached. Otherwise a second visit to this screen
  // (after goBack from a save) starts with `name = ''`, the `!detail`
  // guard short-circuits the bootstrap, and the save button stays
  // disabled forever.
  // ----------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    void loadExercises();
    if (isEditing && planId) {
      // Sync name from DB — this state resets on every screen mount, the
      // store cache does not.
      if (!nameTouchedFromDB) {
        void usePlanStore.getState().fetch(planId).then((p) => {
          if (!cancelled && p) {
            setName(p.name);
            setNameTouchedFromDB(true);
          }
        });
      }
      // Exercise list cache (in-memory detail cache) can survive across
      // mounts; only load if we don't already have it.
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
      try {
        setSaving(true);
        await createPlan({ name: trimmed, exerciseIds });
        // G12: 非阻断反馈。navigation.goBack 后 toast 仍能渲染（Toast 在
        // App 根节点层级，独立于 Stack 屏），用户切回列表时能看到。
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
      // picker mode: ExerciseLibrary 完成时调用 onSelect(ids) 并 goBack()，
      // 而不是 navigate('Tabs', { Training.params.selectedExerciseIds })。
      // 数据直接在回调里落 detailById，不再绕锻炼 Tab。
      onSelect: (selectedIds: string[]) => {
        // Read latest state to avoid stale closures — PlanEditor may have
        // re-rendered between navigate() and the picker calling us back.
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

        // Persist to DB if editing (skip for new plans; save() will).
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
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + spacing.xxxxl,
          gap: spacing.lg,
        }}
        keyboardShouldPersistTaps="handled"
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
                onRequestRemove={() => setPendingRemoveExercise(pe)}
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
        visible={!!pendingRemoveExercise}
        variant="danger"
        title="从计划中移除此动作？"
        message={
          pendingRemoveExercise
            ? `动作：${pendingRemoveExercise.exercise.name}`
            : ''
        }
        confirmText="移除"
        cancelText="取消"
        onCancel={() => setPendingRemoveExercise(null)}
        onConfirm={() => {
          const pe = pendingRemoveExercise;
          setPendingRemoveExercise(null);
          if (pe) onDeleteExercise(pe);
        }}
      />

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
/* Sub-components                                                             */
/* -------------------------------------------------------------------------- */

interface ExerciseEditorCardProps {
  draft: PlanExerciseDraft;
  onAddSet: () => void;
  onOpenSetSheet: (setIndex: number) => void;
  onUpdateSet: (setIndex: number, patch: Partial<PlanSetDraft>) => void;
  onRequestRemove: () => void;
}

function ExerciseEditorCard({
  draft,
  onAddSet,
  onOpenSetSheet,
  onUpdateSet,
  onRequestRemove,
}: ExerciseEditorCardProps) {
  const { colors, spacing, typography, radius } = useTheme();
  const translateX = useSharedValue(0);
  const REVEAL_WIDTH = 80;

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
        translateX.value = withTiming(0, { duration: 180 });
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
    translateX.value = withTiming(0, { duration: 180 }, () => {
      runOnJS(onRequestRemove)();
    });
  }, [onRequestRemove, translateX]);

  return (
    <View style={{ position: 'relative' }}>
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.trashLayer,
          {
            backgroundColor: colors.danger,
            borderRadius: radius.lg,
            right: 0,
          },
          trashStyle,
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="移除动作"
          onPress={handleTrashPress}
          style={({ pressed }) => [
            styles.trashButton,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={{ color: colors.onPrimary, fontWeight: '700' }}>
            移除
          </Text>
        </Pressable>
      </Animated.View>

      <GestureDetector gesture={composed}>
        <Animated.View style={cardStyle}>
          <Card padding="md">
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: spacing.sm,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={[typography.subtitle, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {draft.exercise.name}
                </Text>
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
            </View>

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
                {draft.sets.map((s, idx) => (
                  <SetRow
                    key={s.localId}
                    setRow={s}
                    onPressIndex={() => onOpenSetSheet(idx)}
                    onChangeWeight={(w) => onUpdateSet(idx, { weight: w })}
                    onChangeReps={(r) => onUpdateSet(idx, { reps: r })}
                  />
                ))}
              </View>
            )}
          </Card>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

interface SetRowProps {
  setRow: PlanSetDraft;
  onPressIndex: () => void;
  onChangeWeight: (next: number) => void;
  onChangeReps: (next: number) => void;
}

function SetRow({
  setRow,
  onPressIndex,
  onChangeWeight,
  onChangeReps,
}: SetRowProps) {
  const { colors, spacing, typography, radius } = useTheme();
  const meta = SET_TYPES.find((t) => t.value === setRow.setType) ?? SET_TYPES[0];

  return (
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
        <Text style={[typography.label, { color: colors.primaryPressed }]}>
          {meta.short ? `${meta.short}${setRow.setIndex}` : `${setRow.setIndex}`}
        </Text>
      </Pressable>

      <View style={{ flex: 1 }} accessible accessibilityLabel={`第 ${setRow.setIndex} 组 重量`}>
        <NumberInput
          value={setRow.weight}
          onChangeValue={onChangeWeight}
          min={0}
          max={500}
          step={2.5}
          precision={1}
          unitLabel="kg"
        />
      </View>
      <View style={{ flex: 1 }} accessible accessibilityLabel={`第 ${setRow.setIndex} 组 次数`}>
        <NumberInput
          value={setRow.reps}
          onChangeValue={onChangeReps}
          min={0}
          max={50}
          step={1}
        />
      </View>
    </View>
  );
}

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
});
