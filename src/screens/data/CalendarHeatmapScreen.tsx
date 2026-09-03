/**
 * G18 — CalendarHeatmapScreen
 *
 * 过去 12 周每日训练量热力图。
 * - 顶部 summary：总训练日数 / 总训练量 / 平均每日训练量
 * - 中部：HeatmapCalendar（自适应宽度，初始按屏宽）
 * - 底部：训练日 Top 5 列表
 */

import React, { useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { HeatmapCalendar } from '@/features/data/charts/HeatmapCalendar';
import { useDataAggregates } from '@/features/data/useDataAggregates';
import { useTheme } from '@/theme';
import { useSettingsStore } from '@/store/settingsStore';
import { formatWeight } from '@/utils/units';

export function CalendarHeatmapScreen() {
  const { colors, typography, spacing } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const unit = useSettingsStore((s) => s.unit);
  const { data, loading } = useDataAggregates();
  // 留出 16px padding × 2，HeatmapCalendar 自适应。
  const chartWidth = windowWidth - spacing.lg * 2;

  const topDays = useMemo(() => {
    if (!data) return [];
    return [...data.daily].sort((a, b) => b.volume - a.volume).slice(0, 5);
  }, [data]);

  const totalDays = data?.daily.length ?? 0;
  const totalVolume = data?.daily.reduce((s, d) => s + d.volume, 0) ?? 0;

  const isEmpty = !loading && (data === null || data.daily.length === 0);

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
        {isEmpty ? (
          <EmptyState
            icon="🗓"
            title="还没有训练记录"
            description="完成一次训练后，这里会显示过去 12 周的每日训练量热力图。"
          />
        ) : (
          <>
            {/* Summary */}
            <Card padding="md" elevated style={{ marginBottom: spacing.lg }}>
              <View
                style={{
                  flexDirection: 'row',
                  gap: spacing.lg,
                  marginBottom: spacing.sm,
                }}
              >
                <Stat label="训练日数" value={`${totalDays} 天`} colors={colors} typography={typography} />
                <Stat
                  label="总训练量"
                  value={formatWeight(totalVolume, unit)}
                  colors={colors}
                  typography={typography}
                />
              </View>
              <Text style={[typography.caption, { color: colors.textTertiary }]}>
                颜色越深 → 当日训练量越大（基于近 12 周最大值归一化）。
              </Text>
            </Card>

            {/* Heatmap */}
            <Card padding="md" style={{ marginBottom: spacing.lg }}>
              <HeatmapCalendar
                data={data?.daily ?? []}
                width={chartWidth}
              />
            </Card>

            {/* Top days */}
            {topDays.length > 0 ? (
              <Card padding="md">
                <Text
                  style={[
                    typography.label,
                    { color: colors.textTertiary, letterSpacing: 1, marginBottom: spacing.sm },
                  ]}
                >
                  训练量 TOP 5
                </Text>
                <View style={{ gap: spacing.xs + 2 }}>
                  {topDays.map((d) => (
                    <View
                      key={d.day}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Text style={[typography.body, { color: colors.text }]}>
                        {d.day}
                      </Text>
                      <Text style={[typography.body, { color: colors.textSecondary }]}>
                        {formatWeight(d.volume, unit)}
                      </Text>
                    </View>
                  ))}
                </View>
              </Card>
            ) : null}
          </>
        )}
      </ScrollView>
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
      <Text style={[typography.h2, { color: colors.text, marginTop: 2 }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});