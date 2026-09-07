/**
 * HomeScreen — G9 首页 Tab（锻炼动态）
 *
 * 布局（自上而下，G25）：
 *  1. 顶部：HeatmapCard（过去 12 周训练热力图，点击 → 完整 CalendarHeatmapScreen）
 *     - G25 之前这里是「开始锻炼」CTA；现已替换——开始锻炼的入口在底部 Tab「锻炼」
 *  2. 中部：历史列表（按日期分组）
 *     - 分组标题："今天" / "昨天" / "本周" / "上周" / "更早"
 *     - 每条 Card：开始时间 + 时长 + 动作数 + 训练量
 *     - 点 Card → navigation.navigate('TrainingDetail', { trainingId })
 *  3. 空状态：EmptyState + CTA "去锻炼"
 *
 * 数据：
 *  - 进入页面调 trainingStore.loadHistory()
 *  - 热力图数据来自 useDataAggregates（G18），hook 自己 fetch
 *  - 历史数据本身在 store 里是倒序；dateGroups 进一步按日 / 周分桶
 *  - 单位显示用 useSettingsStore.unit + formatWeight
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useNavigation,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Dialog } from '@/components/Dialog';
import { toast } from '@/hooks/useToast';
import { useSettingsStore } from '@/store/settingsStore';
import { useTrainingStore } from '@/store/trainingStore';
import { useTheme } from '@/theme';
import {
  type HistoryGroup,
  displayExerciseCount,
  displaySetCount,
  formatDurationShort,
  formatStartHHMM,
  groupHistoryByDate,
} from '@/utils/dateGroups';
import { formatWeight } from '@/utils/units';

import type { RootStackParamList } from '@/navigation/types';
import { HeatmapCard } from './home/HeatmapCard';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

type Row =
  | { type: 'group'; group: HistoryGroup }
  | { type: 'training'; trainingId: string };

export function HomeScreen() {
  const navigation = useNavigation<Navigation>();
  const insets = useSafeAreaInsets();
  const { colors, spacing, typography } = useTheme();

  const history = useTrainingStore((s) => s.history);
  const historyLoading = useTrainingStore((s) => s.loading);
  const loadHistory = useTrainingStore((s) => s.loadHistory);
  const deleteHistory = useTrainingStore((s) => s.deleteHistory);

  const unit = useSettingsStore((s) => s.unit);

  // G12: swipe-to-delete + confirm Dialog for history cards. Keeps the
  // existing tap-to-detail path intact.
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ----------------------------------------------------------------
  // Load history on mount
  // ----------------------------------------------------------------
  useEffect(() => {
    void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----------------------------------------------------------------
  // Group by date
  // ----------------------------------------------------------------
  const rows: Row[] = useMemo(() => {
    const groups = groupHistoryByDate(history);
    const out: Row[] = [];
    for (const g of groups) {
      out.push({ type: 'group', group: g });
      for (const t of g.data) {
        out.push({ type: 'training', trainingId: t.id });
      }
    }
    return out;
  }, [history]);

  // ----------------------------------------------------------------
  // Handlers
  // ----------------------------------------------------------------
  const onPressStart = useCallback(() => {
    navigation.navigate('Tabs', { screen: 'Training' });
  }, [navigation]);

  const onOpenHeatmap = useCallback(() => {
    navigation.navigate('CalendarHeatmap');
  }, [navigation]);

  const onPressTraining = useCallback(
    (trainingId: string) => {
      navigation.navigate('TrainingDetail', { trainingId });
    },
    [navigation],
  );

  const onRefresh = useCallback(() => {
    void loadHistory();
  }, [loadHistory]);

  const onConfirmDelete = useCallback(async () => {
    const id = pendingDeleteId;
    if (!id) return;
    setPendingDeleteId(null);
    setDeletingId(id);
    try {
      await deleteHistory(id);
      // G12: 非阻断反馈 + 高意图操作后的提示。
      toast.show('已删除', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.show(`删除失败：${msg}`, 'error');
    } finally {
      setDeletingId(null);
    }
  }, [pendingDeleteId, deleteHistory]);

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------
  const renderItem: ListRenderItem<Row> = useCallback(
    ({ item }) => {
      if (item.type === 'group') {
        return <GroupHeader title={item.group.title} />;
      }
      const t = history.find((x) => x.id === item.trainingId);
      if (!t) return null;
      return (
        <SwipeableTrainingCard
          startedAt={t.startedAt}
          durationSeconds={t.durationSeconds}
          exerciseCount={displayExerciseCount(t, null)}
          setCount={displaySetCount(t, null)}
          totalVolume={t.totalVolume}
          planNameSnapshot={t.planNameSnapshot}
          unit={unit}
          onPress={() => onPressTraining(t.id)}
          onRequestDelete={() => setPendingDeleteId(t.id)}
        />
      );
    },
    [history, unit, onPressTraining],
  );

  const isEmpty = !historyLoading && rows.length === 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <FlatList
        data={rows}
        keyExtractor={(item, idx) =>
          item.type === 'group' ? `g-${item.group.key}-${idx}` : `t-${item.trainingId}`
        }
        renderItem={renderItem}
        ItemSeparatorComponent={Separator}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
        }}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.lg }}>
            <HeatmapCard onOpenFull={onOpenHeatmap} />
          </View>
        }
        ListEmptyComponent={
          isEmpty ? (
            <View style={{ marginTop: spacing.xxl }}>
              <EmptyState
                icon="🏋"
                title="开始你的第一次训练吧"
                description="切换到锻炼 Tab 创建计划"
                actionLabel="去锻炼"
                onAction={onPressStart}
              />
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={historyLoading}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      />

      {/* G12: swipe-to-delete confirmation */}
      <Dialog
        visible={!!pendingDeleteId}
        variant="danger"
        title="删除这条训练记录？"
        message="删除后无法恢复。"
        confirmText={deletingId ? '删除中…' : '删除'}
        cancelText="取消"
        onCancel={() => {
          if (deletingId) return;
          setPendingDeleteId(null);
        }}
        onConfirm={() => {
          if (deletingId) return;
          void onConfirmDelete();
        }}
      />
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Sub-components                                                              */
/* -------------------------------------------------------------------------- */

function GroupHeader({ title }: { title: string }) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View
      style={{
        paddingTop: spacing.md,
        paddingBottom: spacing.sm,
        paddingHorizontal: spacing.xs,
      }}
    >
      <Text
        style={[
          typography.label,
          { color: colors.textSecondary, letterSpacing: 0.4 },
        ]}
      >
        {title.toUpperCase()}
      </Text>
    </View>
  );
}

function Separator() {
  const { spacing } = useTheme();
  return <View style={{ height: spacing.sm }} />;
}

interface TrainingCardProps {
  startedAt: number;
  durationSeconds: number | null;
  exerciseCount: number;
  setCount: number;
  totalVolume: number | null;
  planNameSnapshot: string | null;
  unit: 'kg' | 'lb';
  onPress: () => void;
}

function TrainingCard({
  startedAt,
  durationSeconds,
  exerciseCount,
  setCount,
  totalVolume,
  planNameSnapshot,
  unit,
  onPress,
}: TrainingCardProps) {
  const { colors, spacing, typography } = useTheme();
  const subtitleParts: string[] = [];
  subtitleParts.push(formatStartHHMM(startedAt));
  subtitleParts.push(formatDurationShort(durationSeconds));
  subtitleParts.push(`${exerciseCount} 个动作`);
  if (setCount > 0) subtitleParts.push(`${setCount} 组`);
  const subtitle = subtitleParts.join(' · ');

  return (
    <Card elevated padding="md" onPress={onPress} testID={`history-card-${startedAt}`}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        }}
      >
        <View style={{ flex: 1 }}>
          {planNameSnapshot ? (
            <Text
              style={[typography.h3, { color: colors.text }]}
              numberOfLines={1}
            >
              {planNameSnapshot}
            </Text>
          ) : (
            <Text style={[typography.h3, { color: colors.text }]}>自由训练</Text>
          )}
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

        <View style={{ alignItems: 'flex-end' }}>
          <Text
            style={[typography.numeric, { fontSize: 18, lineHeight: 22, color: colors.primary }]}
          >
            {totalVolume != null ? formatWeight(totalVolume, unit) : '—'}
          </Text>
          <Text
            style={[
              typography.caption,
              { color: colors.textTertiary, marginTop: 2 },
            ]}
          >
            训练量
          </Text>
        </View>

        <Text style={[typography.h3, { color: colors.textTertiary }]}>›</Text>
      </View>
    </Card>
  );
}

/* G12 — SwipeableTrainingCard dimensions (kept above `styles` so we can
   reference them from the StyleSheet block). */
const SWIPE_REVEAL = 88;
const SWIPE_THRESHOLD = 40;

const styles = StyleSheet.create({
  root: { flex: 1 },
  trashLayer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: SWIPE_REVEAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

interface SwipeableTrainingCardProps {
  startedAt: number;
  durationSeconds: number | null;
  exerciseCount: number;
  setCount: number;
  totalVolume: number | null;
  planNameSnapshot: string | null;
  unit: 'kg' | 'lb';
  onPress: () => void;
  onRequestDelete: () => void;
}

function SwipeableTrainingCard(props: SwipeableTrainingCardProps) {
  const { colors, radius } = useTheme();
  const translateX = useSharedValue(0);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-10, 10])
        .failOffsetY([-12, 12])
        .onUpdate((e) => {
          'worklet';
          // Only allow left-swipe (negative translation).
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
      runOnJS(props.onRequestDelete)();
    });
  }, [props, translateX]);

  return (
    <View style={{ position: 'relative' }}>
      {/* Trash layer behind the card */}
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
          accessibilityLabel="删除这条训练记录"
          accessibilityHint="弹出确认对话框，确认后删除"
          onPress={handleTrashPress}
          hitSlop={8}
          style={({ pressed }) => ({
            flex: 1,
            width: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text
            style={{
              color: colors.onPrimary,
              fontWeight: '700',
              fontSize: 15,
            }}
          >
            删除
          </Text>
        </Pressable>
      </Animated.View>

      <GestureDetector gesture={composed}>
        <Animated.View style={cardStyle}>
          <TrainingCard
            startedAt={props.startedAt}
            durationSeconds={props.durationSeconds}
            exerciseCount={props.exerciseCount}
            setCount={props.setCount}
            totalVolume={props.totalVolume}
            planNameSnapshot={props.planNameSnapshot}
            unit={props.unit}
            onPress={props.onPress}
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
