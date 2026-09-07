/**
 * G32 — ExerciseHistoryScreen
 *
 * 单动作历史下钻：1RM 趋势线 + 容量柱状 + 时间区间切换 + 长按预览。
 *
 * 布局（自上而下）：
 *  1. Header 信息条：动作名 + 主要肌群 + 器械 + 训练总次数 + 最高 1RM
 *  2. 时间区间 SegmentedControl（4w / 3m / 1y / all）
 *  3. 1RM 趋势线 Card（react-native-svg）
 *  4. 容量柱状 Card（react-native-svg）
 *  5. 空数据 → EmptyState
 *
 * 交互：
 *  - 长按 1RM 折线点 / 容量柱 → 弹 Sheet，显示训练日期 / 时长 / 总训练量
 *    + "查看详情 ›" → navigation.navigate('TrainingDetail', { trainingId })
 *  - 单位用 settingsStore.unit（kg / lb），所有重量展示走 formatWeight()
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
import { useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Sheet } from '@/components/Sheet';
import { Pressable } from 'react-native';
import { ExerciseLineChart } from '@/screens/data/ExerciseLineChart';
import { ExerciseVolumeBars } from '@/screens/data/ExerciseVolumeBars';
import {
  useExerciseHistory,
  type ExerciseHistoryPoint,
  type Range,
} from '@/hooks/useExerciseHistory';
import { getDatabase } from '@/db';
import { getTraining } from '@/db/repositories/trainingRepo';
import type { Training } from '@/db/schema';
import type { RootStackParamList } from '@/navigation/types';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme';
import { formatWeight } from '@/utils/units';

type Navigation = NativeStackNavigationProp<
  RootStackParamList,
  'ExerciseHistory'
>;
type Route = RouteProp<RootStackParamList, 'ExerciseHistory'>;

const RANGE_OPTIONS: ReadonlyArray<{ label: string; value: Range }> = [
  { label: '4 周', value: '4w' },
  { label: '3 月', value: '3m' },
  { label: '1 年', value: '1y' },
  { label: '全部', value: 'all' },
];

export function ExerciseHistoryScreen({
  navigation,
}: {
  navigation: Navigation;
}) {
  const route = useRoute<Route>();
  const exerciseId = route.params?.exerciseId;
  const { colors, typography, spacing } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const unit = useSettingsStore((s) => s.unit);

  const [range, setRange] = useState<Range>('3m');
  const { points, meta, loading, error } = useExerciseHistory(exerciseId, range);

  // Sheet state for preview
  const [previewPoint, setPreviewPoint] = useState<ExerciseHistoryPoint | null>(null);
  const [previewTraining, setPreviewTraining] = useState<Training | null>(null);

  const chartWidth = windowWidth - spacing.lg * 2;
  const lineHeight = 200;
  const barsHeight = 180;

  // Load exercise meta (name / muscle / equipment) once for header
  const [exercise, setExercise] = useState<{
    name: string;
    muscleGroup: string;
    equipment: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!exerciseId) {
      setExercise(null);
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      try {
        const db = await getDatabase();
        const row = await db.getFirstAsync<{
          name: string;
          muscle_group: string;
          equipment: string;
        }>(`SELECT name, muscle_group, equipment FROM exercises WHERE id = ?;`, [exerciseId]);
        if (cancelled) return;
        if (row) {
          setExercise({
            name: row.name,
            muscleGroup: row.muscle_group,
            equipment: row.equipment,
          });
        } else {
          setExercise(null);
        }
      } catch {
        if (!cancelled) setExercise(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [exerciseId]);

  // Header title
  useLayoutEffect(() => {
    navigation.setOptions({ title: exercise?.name ?? '动作历史' });
  }, [navigation, exercise?.name]);

  // Sheet: when a point is long-pressed, load its training summary for preview
  const handleLongPressPoint = useCallback(async (p: ExerciseHistoryPoint) => {
    setPreviewPoint(p);
    setPreviewTraining(null);
    try {
      const db = await getDatabase();
      const t = await getTraining(db, p.trainingId);
      setPreviewTraining(t);
    } catch {
      setPreviewTraining(null);
    }
  }, []);

  const handleCloseSheet = useCallback(() => {
    setPreviewPoint(null);
    setPreviewTraining(null);
  }, []);

  const handleGoToDetail = useCallback(() => {
    if (!previewPoint) return;
    const id = previewPoint.trainingId;
    setPreviewPoint(null);
    setPreviewTraining(null);
    navigation.navigate('TrainingDetail', { trainingId: id });
  }, [navigation, previewPoint]);

  // Error / missing-id edge cases
  if (!exerciseId) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <EmptyState
          icon="❓"
          title="未指定动作"
          description="请从「按动作」Tab 选择一个动作查看历史。"
        />
      </SafeAreaView>
    );
  }

  const isEmpty = !loading && points.length === 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: spacing.xxxxl,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header 信息条 */}
        {exercise ? (
          <Card padding="md" elevated style={{ marginBottom: spacing.lg }}>
            <Text style={[typography.h2, { color: colors.text }]} numberOfLines={1}>
              {exercise.name}
            </Text>
            <Text style={[typography.caption, { color: colors.textTertiary, marginTop: 2 }]}>
              {exercise.muscleGroup} · {exercise.equipment}
            </Text>
            <View style={[styles.headerStats, { marginTop: spacing.md }]}>
              <Stat
                label="训练总次数"
                value={`${meta.totalTrainings} 次`}
                colors={colors}
                typography={typography}
              />
              <Stat
                label="最高 1RM"
                value={
                  meta.maxOneRm > 0
                    ? `${formatWeight(meta.maxOneRm, unit)} (Brzycki)`
                    : '—'
                }
                colors={colors}
                typography={typography}
              />
            </View>
          </Card>
        ) : null}

        {/* 时间区间切换 */}
        <View style={{ marginBottom: spacing.lg }}>
          <SegmentedControl
            value={range}
            onChange={setRange}
            options={RANGE_OPTIONS}
            fullWidth
            accessibilityLabel="时间区间"
          />
        </View>

        {error ? (
          <Card padding="md" style={{ marginBottom: spacing.lg }}>
            <Text style={[typography.body, { color: colors.danger }]}>
              加载失败：{error}
            </Text>
          </Card>
        ) : null}

        {loading && points.length === 0 ? (
          <View style={[styles.center, { paddingVertical: spacing.xxl }]}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : isEmpty ? (
          <EmptyState
            icon="📭"
            title="还没有训练记录"
            description="完成一次包含该动作的训练后，这里会出现 1RM 趋势线和容量柱状。"
          />
        ) : (
          <>
            {/* 1RM 趋势线 */}
            <Card padding="md" style={{ marginBottom: spacing.lg }}>
              <Text
                style={[
                  typography.label,
                  { color: colors.textTertiary, letterSpacing: 1, marginBottom: spacing.sm },
                ]}
              >
                1RM 趋势线
              </Text>
              <Text
                style={[
                  typography.caption,
                  { color: colors.textTertiary, marginBottom: spacing.sm },
                ]}
              >
                长按数据点可预览该次训练。
              </Text>
              <ExerciseLineChart
                points={points}
                width={chartWidth}
                height={lineHeight}
                unitLabel={unit}
                onLongPressPoint={handleLongPressPoint}
              />
            </Card>

            {/* 容量柱状 */}
            <Card padding="md">
              <Text
                style={[
                  typography.label,
                  { color: colors.textTertiary, letterSpacing: 1, marginBottom: spacing.sm },
                ]}
              >
                容量（Σ weight × reps）
              </Text>
              <ExerciseVolumeBars
                points={points}
                width={chartWidth}
                height={barsHeight}
                onLongPressPoint={handleLongPressPoint}
              />
            </Card>
          </>
        )}
      </ScrollView>

      {/* 长按预览 Sheet */}
      <Sheet
        visible={previewPoint !== null}
        onClose={handleCloseSheet}
        title="该次训练预览"
        maxHeightRatio={0.5}
      >
        {previewPoint ? (
          <View style={{ gap: spacing.sm }}>
            <PreviewRow
              label="训练日期"
              value={formatLongDate(previewPoint.date)}
              colors={colors}
              typography={typography}
            />
            <PreviewRow
              label="时长"
              value={formatDuration(previewTraining?.durationSeconds ?? null)}
              colors={colors}
              typography={typography}
            />
            <PreviewRow
              label="总训练量"
              value={
                previewTraining?.totalVolume != null
                  ? formatWeight(previewTraining.totalVolume, unit)
                  : formatWeight(previewPoint.volume, unit)
              }
              colors={colors}
              typography={typography}
            />
            <PreviewRow
              label="1RM"
              value={`${formatWeight(previewPoint.oneRmMax, unit)} · ${formatWeight(previewPoint.topSet.weight, unit)} × ${previewPoint.topSet.reps}`}
              colors={colors}
              typography={typography}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="查看训练详情"
              onPress={handleGoToDetail}
              style={({ pressed }) => ({
                alignSelf: 'flex-end',
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text style={[typography.label, { color: colors.primary }]}>
                查看详情 ›
              </Text>
            </Pressable>
          </View>
        ) : null}
      </Sheet>
    </SafeAreaView>
  );
}

function Stat({
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
      <Text style={[typography.h3, { color: colors.text, marginTop: 2 }]}>
        {value}
      </Text>
    </View>
  );
}

function PreviewRow({
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
    <View style={styles.previewRow}>
      <Text style={[typography.caption, { color: colors.textTertiary }]}>
        {label}
      </Text>
      <Text style={[typography.body, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

function formatLongDate(ms: number): string {
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function formatDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || !Number.isFinite(totalSeconds)) return '—';
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hours > 0) return `${hours}h ${pad(minutes)}m`;
  if (minutes > 0) return `${minutes}m ${pad(seconds)}s`;
  return `${seconds}s`;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  headerStats: { flexDirection: 'row', gap: 16 },
  center: { alignItems: 'center', justifyContent: 'center' },
  previewRow: {
    gap: 2,
  },
});
