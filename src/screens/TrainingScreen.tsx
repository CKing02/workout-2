/**
 * TrainingScreen — 锻炼 Tab（G5）
 *
 * 顶部："开始自由训练"（G11）→ 动作库（多选，标题"选择训练动作"）
 *        → onSelect 回调 → startTraining(planId: null) → 直接进训练中页
 * 中部：计划列表（按 updated_at 倒序）
 *   - 卡片样式：计划名 + 动作数 + 上次训练日期（自由训练不显示）
 *   - 点击：进入 PlanEditor 编辑
 *   - 长按：弹出 Dialog 二次确认删除
 *   - 顶部右侧"编辑"按钮：进入/退出编辑模式
 * 右下角悬浮"+"按钮 → 新建计划
 * 空状态：EmptyState + CTA "新建计划"
 *
 * 与动作库的连接：
 *  PlanEditorScreen 把选中的动作 navigate 回 'Tabs' -> Training，
 *  这里同样用 useNavigationState 监控 selectedExerciseIds 的变化
 *  —— 但我们在本 Tab 主要是用 Alert 提示（G4 兼容性 + 调试）。
 */

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useNavigation,
  useNavigationState,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Dialog } from '@/components/Dialog';
import { EmptyState } from '@/components/EmptyState';
import { IconButton } from '@/components/IconButton';
import type { Exercise } from '@/db/schema';
import { FREE_TRAINING_NAME } from '@/features/training/freeTraining';
import { toast } from '@/hooks/useToast';
import { useExerciseStore } from '@/store/exerciseStore';
import { usePlanStore } from '@/store/planStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTrainingStore } from '@/store/trainingStore';
import { useTheme } from '@/theme';

import type { RootStackParamList, TabParamList } from '@/navigation/types';

type Navigation = NativeStackNavigationProp<RootStackParamList>;
type TrainingRoute = RouteProp<TabParamList, 'Training'>;

interface RowProps {
  item: PlanRow;
  editMode: boolean;
  lastTrainedAt: number | null;
  onPress: (item: PlanRow) => void;
  onLongPress: (item: PlanRow) => void;
  onRequestDelete: (item: PlanRow) => void;
  onRequestStart: (item: PlanRow) => void;
}

interface PlanRow {
  id: string;
  name: string;
  updatedAt: number;
  exerciseCount: number;
}

function useTrainingSelectedIds(): string[] | undefined {
  return useNavigationState((state) => {
    const tabs = state.routes.find((r) => r.name === 'Tabs');
    if (!tabs?.state) return undefined;
    const training = tabs.state.routes.find((r) => r.name === 'Training');
    return (training?.params as { selectedExerciseIds?: string[] } | undefined)
      ?.selectedExerciseIds;
  });
}

export function TrainingScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<TrainingRoute>();
  const insets = useSafeAreaInsets();

  const { colors, spacing, typography, radius } = useTheme();

  // Store hooks
  const plans = usePlanStore((s) => s.plans);
  const plansLoading = usePlanStore((s) => s.loading);
  const loadPlans = usePlanStore((s) => s.load);
  const removePlan = usePlanStore((s) => s.remove);
  const history = useTrainingStore((s) => s.history);
  const loadHistory = useTrainingStore((s) => s.loadHistory);
  const startTraining = useTrainingStore((s) => s.startTraining);
  const getExerciseById = useExerciseStore((s) => s.getById);
  const defaultRestSeconds = useSettingsStore((s) => s.defaultRestSeconds);

  // Local state
  const [editMode, setEditMode] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PlanRow | null>(null);
  /** G11: true while we resolve exercises + create the training row. */
  const [startingFree, setStartingFree] = useState(false);
  const startingFreeRef = React.useRef(false);
  const lastAlertSigRef = React.useRef<string | undefined>(undefined);

  // ----------------------------------------------------------------
  // Bootstrap
  // ----------------------------------------------------------------
  useEffect(() => {
    if (plans.length === 0 && !plansLoading) {
      void loadPlans();
    }
    if (history.length === 0) {
      void loadHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----------------------------------------------------------------
  // Build rows: enrich plan with exerciseCount + lastTrainedAt snapshot.
  // ----------------------------------------------------------------
  const lastByPlanId = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of history) {
      if (!t.planId) continue;
      const prev = map.get(t.planId) ?? 0;
      if (t.startedAt > prev) map.set(t.planId, t.startedAt);
    }
    return map;
  }, [history]);

  const rows = useMemo<PlanRow[]>(
    () =>
      plans.map((p) => ({
        id: p.id,
        name: p.name,
        updatedAt: p.updatedAt,
        // p.exerciseCount is denormalized at load time via SQL LEFT JOIN
        // (see planRepo.listPlansWithCount). Don't fall back to history —
        // a plan with no training history would otherwise read 0 and
        // disable its start button.
        exerciseCount: p.exerciseCount,
      })),
    [plans],
  );

  // ----------------------------------------------------------------
  // Header right: 编辑 button
  // ----------------------------------------------------------------
  useLayoutEffect(() => {
    if (rows.length === 0) {
      navigation.setOptions({ headerRight: undefined });
      return;
    }
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={editMode ? '完成编辑' : '编辑'}
          onPress={() => setEditMode((v) => !v)}
          hitSlop={12}
          style={({ pressed }) => ({
            paddingHorizontal: 4,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text
            style={[
              typography.subtitle,
              { color: editMode ? colors.primary : colors.text },
            ]}
          >
            {editMode ? '完成' : '编辑'}
          </Text>
        </Pressable>
      ),
    });
  }, [navigation, rows.length, editMode, colors.primary, colors.text, typography.subtitle]);

  // ----------------------------------------------------------------
  // Compatible surface for incoming selectedExerciseIds (G4).
  // ----------------------------------------------------------------
  const selectedIds = useTrainingSelectedIds();
  useEffect(() => {
    if (!selectedIds) return;
    const sig = selectedIds.join(',');
    if (sig === lastAlertSigRef.current) return;
    lastAlertSigRef.current = sig;
    // G12: toast 替代 Alert —— G4 兼容性保留（用户从动作库勾选返回时
    // 收到的提示），但用非阻断轻提示，避免阻断用户后续操作。
    toast.show(`已选 ${selectedIds.length} 个动作`, 'info');
    navigation.setParams({ selectedExerciseIds: undefined });
  }, [selectedIds, navigation]);

  // ----------------------------------------------------------------
  // Handlers
  // ----------------------------------------------------------------
  const onItemPress = useCallback(
    (item: PlanRow) => {
      if (editMode) {
        setPendingDelete(item);
        return;
      }
      navigation.navigate('PlanEditor', { planId: item.id });
    },
    [editMode, navigation],
  );

  const onItemLongPress = useCallback((item: PlanRow) => {
    setPendingDelete(item);
  }, []);

  const onRequestDelete = useCallback((item: PlanRow) => {
    setPendingDelete(item);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    try {
      await removePlan(target.id);
      // G12: 非阻断反馈 —— 用户长按→二次确认→删除，是一段高意图操作，
      // toast 让用户确认动作成功，而不必打断浏览。
      toast.show('计划已删除', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.show(`删除失败：${msg}`, 'error');
    }
  }, [pendingDelete, removePlan]);

  // ----------------------------------------------------------------
  // G11 — 自由训练：动作库（多选）→ 直接进训练中页
  //
  // 关键设计：**在导航之前**就 `startTraining()`。ActiveTrainingScreen 的
  // bootstrap 只在 `activeTraining === null` 时才去查计划，所以先建好内存
  // 状态就能完全跳过它的 planId 分支 —— 不需要改 G6/G8 的任何逻辑。
  // ----------------------------------------------------------------
  const handleFreeTrain = useCallback(
    async (selectedIds: string[]) => {
      // 防抖：完成按钮连点 / 回调重入
      if (startingFreeRef.current) return;

      if (selectedIds.length === 0) {
        // 动作库里"完成"在 0 选中时已禁用，这里是兜底（AC-11.1）
        toast.show('请至少选择 1 个动作', 'warning');
        return;
      }

      startingFreeRef.current = true;
      setStartingFree(true);
      try {
        const resolved = await Promise.all(
          selectedIds.map((id) => getExerciseById(id)),
        );
        // 过滤掉已被删除的自定义动作，保持选择顺序
        const exercises = resolved.filter((e): e is Exercise => e !== null);
        if (exercises.length === 0) {
          toast.show('所选动作已不存在，请重新选择', 'warning');
          return;
        }

        await startTraining({
          planId: null, // 自由训练 → trainings.plan_id = NULL
          planNameSnapshot: FREE_TRAINING_NAME,
          exercises: exercises.map((exercise) => ({
            exercise,
            // 自由训练没有 plan 覆盖,沿用设置里的全局默认。
            restSeconds: defaultRestSeconds,
          })),
        });

        navigation.navigate('ActiveTraining', { mode: 'free' });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.show(`开始自由训练失败：${msg}`, 'error');
      } finally {
        startingFreeRef.current = false;
        setStartingFree(false);
      }
    },
    [getExerciseById, startTraining, navigation, defaultRestSeconds],
  );

  const handleOpenFreeTraining = useCallback(() => {
    navigation.navigate('ExerciseLibrary', {
      mode: 'multiple',
      title: '选择训练动作',
      onSelect: handleFreeTrain,
    });
  }, [navigation, handleFreeTrain]);

  const handleNewPlan = useCallback(() => {
    navigation.navigate('PlanEditor', {});
  }, [navigation]);

  // ----------------------------------------------------------------
  // Empty + list rendering
  // ----------------------------------------------------------------
  const handleStartTraining = useCallback(
    (item: PlanRow) => {
      navigation.navigate('ActiveTraining', { planId: item.id });
    },
    [navigation],
  );

  const renderItem: ListRenderItem<PlanRow> = useCallback(
    ({ item }) => (
      <PlanListItem
        item={item}
        editMode={editMode}
        lastTrainedAt={lastByPlanId.get(item.id) ?? null}
        onPress={onItemPress}
        onLongPress={onItemLongPress}
        onRequestDelete={onRequestDelete}
        onRequestStart={handleStartTraining}
      />
    ),
    [
      editMode,
      lastByPlanId,
      onItemPress,
      onItemLongPress,
      onRequestDelete,
      handleStartTraining,
    ],
  );

  const isEmpty = !plansLoading && rows.length === 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={Separator}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: insets.bottom + 96,
        }}
        ListHeaderComponent={
          <View style={{ gap: spacing.md, marginBottom: spacing.lg }}>
            <Button
              variant="primary"
              size="lg"
              style={{ alignSelf: 'stretch' }}
              onPress={handleOpenFreeTraining}
              // Design-system loading state: swaps the label for a spinner
              // and blocks presses while we create the training row.
              loading={startingFree}
              accessibilityLabel="开始自由训练"
              accessibilityHint="选择动作后直接开始，不绑定训练计划"
            >
              开始自由训练
            </Button>
            {editMode ? (
              <View
                style={{
                  backgroundColor: colors.primaryMuted,
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.md,
                }}
              >
                <Text
                  style={[
                    typography.bodySmall,
                    { color: colors.primaryPressed },
                  ]}
                >
                  编辑模式：轻点卡片即可删除
                </Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          isEmpty ? (
            <View style={{ marginTop: spacing.xxxl }}>
              <EmptyState
                icon="📋"
                title="还没有训练计划"
                description="创建你的第一个训练计划"
                actionLabel="新建计划"
                onAction={handleNewPlan}
              />
            </View>
          ) : null
        }
        extraData={editMode}
      />

      {/* FAB — 新建 */}
      {!isEmpty ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.fabWrap,
            { bottom: insets.bottom + spacing.lg, right: spacing.lg },
          ]}
        >
          <IconButton
            icon="+"
            size="lg"
            variant="primary"
            accessibilityLabel="新建训练计划"
            onPress={handleNewPlan}
          />
        </View>
      ) : null}

      {/* Delete confirmation */}
      <Dialog
        visible={!!pendingDelete}
        variant="danger"
        title="删除这个计划？"
        message={pendingDelete ? `计划：${pendingDelete.name}` : ''}
        confirmText="删除"
        cancelText="取消"
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </View>
  );
}

const Separator = () => {
  const { spacing } = useTheme();
  return <View style={{ height: spacing.sm }} />;
};

function PlanListItem({
  item,
  editMode,
  lastTrainedAt,
  onPress,
  onLongPress,
  onRequestDelete,
  onRequestStart,
}: RowProps) {
  const { colors, spacing, typography, radius } = useTheme();

  const subtitleParts: string[] = [];
  subtitleParts.push(
    item.exerciseCount === 0 ? '尚无动作' : `${item.exerciseCount} 个动作`,
  );
  if (lastTrainedAt) {
    subtitleParts.push(`上次训练 ${formatDate(lastTrainedAt)}`);
  } else {
    subtitleParts.push('尚未训练');
  }
  const subtitle = subtitleParts.join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.name}，${subtitle}`}
      accessibilityHint={editMode ? '点击删除' : '点击进入编辑'}
      onPress={() => onPress(item)}
      onLongPress={() => onLongPress(item)}
      delayLongPress={450}
      android_ripple={{ color: colors.primaryMuted }}
      style={({ pressed }) => ({
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <Card elevated padding="md">
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={[typography.h3, { color: colors.text }]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            <Text
              style={[
                typography.bodySmall,
                { color: colors.textSecondary, marginTop: spacing.xxs },
              ]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          </View>

          {editMode ? (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`删除计划 ${item.name}`}
                hitSlop={12}
                onPress={() => onRequestDelete(item)}
                style={({ pressed }) => ({
                  width: 36,
                  height: 36,
                  borderRadius: radius.full,
                  backgroundColor: pressed ? colors.danger : colors.surfaceMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                })}
              >
                <Text
                  style={{
                    color: colors.danger,
                    fontWeight: '700',
                    fontSize: 18,
                  }}
                >
                  −
                </Text>
              </Pressable>
              <Badge
                label="点击删除"
                variant="danger"
                size="sm"
              />
            </>
          ) : (
            <>
              <IconButton
                icon="▶"
                variant="primary"
                size="md"
                accessibilityLabel={`开始训练 ${item.name}`}
                accessibilityHint="进入全屏训练中页"
                onPress={() => onRequestStart(item)}
                disabled={item.exerciseCount === 0}
              />
              <Text style={[typography.body, { color: colors.textTertiary }]}>
                ›
              </Text>
            </>
          )}
        </View>
      </Card>
    </Pressable>
  );
}

function formatDate(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  if (sameYear) return `${mm}-${dd}`;
  return `${yyyy}-${mm}-${dd}`;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fabWrap: {
    position: 'absolute',
  },
});
