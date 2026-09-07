/**
 * G18 — DataOverview
 * G32 — 加「按动作」Tab
 *
 * 数据可视化总览：4 个子页的入口 + 一句话总览（基于当前数据给出
 * "过去 7/30 天的训练次数 / 累计训练量"）。
 *
 * G32 升级：顶部加 SegmentedControl「总览 / 按动作」。
 *  - 「总览」Tab = 原有内容（summary + 4 个 ListItem 入口）
 *  - 「按动作」Tab = 有训练记录的动作列表（按 max Brzycki 1RM 降序）
 *    点行 → ExerciseHistoryScreen
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ListItem } from '@/components/ListItem';
import { SegmentedControl } from '@/components/SegmentedControl';
import { getDatabase } from '@/db';
import { useDataAggregates } from '@/features/data/useDataAggregates';
import {
  listExercisesWithHistory,
  type ExerciseListRow,
} from '@/db/repositories/exerciseListRepo';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme';
import { formatWeight } from '@/utils/units';

import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'DataOverview'>;
type TabValue = 'overview' | 'byExercise';

const TAB_OPTIONS: ReadonlyArray<{ label: string; value: TabValue }> = [
  { label: '总览', value: 'overview' },
  { label: '按动作', value: 'byExercise' },
];

export function DataOverviewScreen({ navigation }: Props) {
  const { colors, typography, spacing } = useTheme();
  const { data, loading: aggLoading } = useDataAggregates();
  const unit = useSettingsStore((s) => s.unit);

  const [tab, setTab] = useState<TabValue>('overview');

  const summary = useMemo(() => {
    if (!data) return null;
    const now = Date.now();
    const oneDay = 86_400_000;
    let count7 = 0;
    let count30 = 0;
    let volume30 = 0;
    // 直接用 training 维度更简单——但我们只 join 了 set，所以从 daily 反推
    for (const d of data.daily) {
      const t = new Date(d.day).getTime();
      const age = now - t;
      if (age <= 7 * oneDay) count7 += 1;
      if (age <= 30 * oneDay) count30 += 1;
      if (age <= 30 * oneDay) volume30 += d.volume;
    }
    return { count7, count30, volume30, exerciseCount: data.oneRm.length };
  }, [data]);

  // 设置 header 默认
  useLayoutEffect(() => {
    navigation.setOptions({ title: '数据' });
  }, [navigation]);

  // 按动作 Tab 数据：自己 fetch 一次（不用 useDataAggregates，因为那个是全量聚合）
  const [exerciseList, setExerciseList] = useState<ExerciseListRow[] | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const reloadExerciseList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const db = await getDatabase();
      const rows = await listExercisesWithHistory(db);
      setExerciseList(rows);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setListError(msg);
      setExerciseList([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'byExercise' && exerciseList === null) {
      void reloadExerciseList();
    }
  }, [tab, exerciseList, reloadExerciseList]);

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={['bottom']}
    >
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: spacing.xxxxl,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Tab 切换 */}
        <View style={{ marginBottom: spacing.lg }}>
          <SegmentedControl
            value={tab}
            onChange={setTab}
            options={TAB_OPTIONS}
            fullWidth
            accessibilityLabel="数据视图切换"
          />
        </View>

        {tab === 'overview' ? (
          <OverviewTab
            summary={summary}
            loading={aggLoading}
            navigation={navigation}
          />
        ) : (
          <ByExerciseTab
            list={exerciseList}
            loading={listLoading}
            error={listError}
            onRetry={reloadExerciseList}
            unit={unit}
            onPickExercise={(exerciseId) =>
              navigation.navigate('ExerciseHistory', { exerciseId })
            }
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* -------------------------------------------------------------------------- */
/* 总览 Tab                                                                   */
/* -------------------------------------------------------------------------- */

function OverviewTab({
  summary,
  loading,
  navigation,
}: {
  summary: ReturnType<typeof useMemo<{ count7: number; count30: number; volume30: number; exerciseCount: number } | null>>;
  loading: boolean;
  navigation: Props['navigation'];
}) {
  const { colors, typography, spacing } = useTheme();

  return (
    <>
      {/* 顶部 summary */}
      {summary && (summary.count7 > 0 || summary.count30 > 0) ? (
        <Card padding="lg" elevated style={{ marginBottom: spacing.lg }}>
          <Text
            style={[typography.label, { color: colors.textTertiary, letterSpacing: 1 }]}
          >
            概览
          </Text>
          <View
            style={{
              flexDirection: 'row',
              gap: spacing.lg,
              marginTop: spacing.sm,
            }}
          >
            <SummaryStat label="过去 7 天" value={`${summary.count7} 次`} colors={colors} typography={typography} />
            <SummaryStat label="过去 30 天" value={`${summary.count30} 次`} colors={colors} typography={typography} />
            <SummaryStat label="覆盖动作" value={`${summary.exerciseCount} 个`} colors={colors} typography={typography} />
          </View>
        </Card>
      ) : null}

      {/* 4 个子入口 */}
      <Card padding="sm">
        <ListItem
          title="日历热力图"
          subtitle="过去 12 周每日训练量"
          leftSlot={<Glyph emoji="🗓" />}
          rightSlot={<Chevron colors={colors} typography={typography} />}
          onPress={() => navigation.navigate('CalendarHeatmap')}
          divider
          accessibilityLabel="打开日历热力图"
        />
        <ListItem
          title="训练量趋势"
          subtitle="过去 12 周每周训练量"
          leftSlot={<Glyph emoji="📈" />}
          rightSlot={<Chevron colors={colors} typography={typography} />}
          onPress={() => navigation.navigate('VolumeTrend')}
          divider
          accessibilityLabel="打开训练量趋势"
        />
        <ListItem
          title="肌群分布"
          subtitle="按主要肌群聚合训练量"
          leftSlot={<Glyph emoji="🥩" />}
          rightSlot={<Chevron colors={colors} typography={typography} />}
          onPress={() => navigation.navigate('MuscleGroupDistribution')}
          divider
          accessibilityLabel="打开肌群分布"
        />
        <ListItem
          title="1RM 记录"
          subtitle="按 Epley 公式估算每个动作最高 1RM"
          leftSlot={<Glyph emoji="🏆" />}
          rightSlot={<Chevron colors={colors} typography={typography} />}
          onPress={() => navigation.navigate('OneRMRecords')}
          accessibilityLabel="打开 1RM 记录"
        />
      </Card>

      {loading && !summary ? (
        <Text
          style={[
            typography.caption,
            { color: colors.textTertiary, marginTop: spacing.md, textAlign: 'center' },
          ]}
        >
          加载中…
        </Text>
      ) : null}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* 按动作 Tab                                                                 */
/* -------------------------------------------------------------------------- */

function ByExerciseTab({
  list,
  loading,
  error,
  onRetry,
  unit,
  onPickExercise,
}: {
  list: ExerciseListRow[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  unit: 'kg' | 'lb';
  onPickExercise: (exerciseId: string) => void;
}) {
  const { colors, typography, spacing } = useTheme();

  if (error) {
    return (
      <Card padding="md">
        <Text style={[typography.body, { color: colors.danger, marginBottom: spacing.sm }]}>
          加载失败：{error}
        </Text>
        <Text
          accessibilityRole="button"
          onPress={onRetry}
          style={[typography.label, { color: colors.primary }]}
        >
          重试
        </Text>
      </Card>
    );
  }

  if (loading && list === null) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!loading && (list === null || list.length === 0)) {
    return (
      <EmptyState
        icon="🏋"
        title="还没有训练过的动作"
        description="完成一次训练后，这里会列出你做过的所有动作（按最高 1RM 排序）。"
      />
    );
  }

  const rows = list ?? [];

  return (
    <>
      <Text
        style={[
          typography.caption,
          { color: colors.textTertiary, marginBottom: spacing.sm, letterSpacing: 0.5 },
        ]}
      >
        共 {rows.length} 个动作 · 按最高 1RM 降序
      </Text>
      <Card padding="sm">
        {rows.map((row, idx) => (
          <ListItem
            key={row.exercise.id}
            title={row.exercise.name}
            subtitle={`${row.exercise.muscleGroup} · ${row.exercise.equipment} · ${row.totalTrainings} 次`}
            rightSlot={
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[typography.caption, { color: colors.textTertiary }]}>
                  最高 1RM
                </Text>
                <Text style={[typography.title, { color: colors.primary, marginTop: 2 }]}>
                  {row.maxOneRm > 0 ? formatWeight(row.maxOneRm, unit) : '—'}
                </Text>
              </View>
            }
            onPress={() => onPickExercise(row.exercise.id)}
            divider={idx < rows.length - 1}
            accessibilityLabel={`${row.exercise.name}，最高 1RM ${row.maxOneRm > 0 ? formatWeight(row.maxOneRm, unit) : '未知'}`}
            accessibilityHint="打开该动作的历史趋势"
          />
        ))}
      </Card>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* 子组件                                                                    */
/* -------------------------------------------------------------------------- */

function SummaryStat({
  label,
  value,
  colors,
  typography,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useTheme>['colors'];
  typography: ReturnType<typeof useTheme>['typography'];
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[typography.caption, { color: colors.textTertiary }]}>
        {label}
      </Text>
      <Text style={[typography.h2, { color: colors.text, marginTop: 2 }]}>
        {value}
      </Text>
    </View>
  );
}

function Glyph({ emoji }: { emoji: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.surfaceMuted,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 4,
      }}
    >
      <Text style={{ fontSize: 16 }}>{emoji}</Text>
    </View>
  );
}

function Chevron({
  colors,
  typography,
}: {
  colors: ReturnType<typeof useTheme>['colors'];
  typography: ReturnType<typeof useTheme>['typography'];
}) {
  return (
    <Text style={[typography.subtitle, { color: colors.textTertiary }]}>›</Text>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
