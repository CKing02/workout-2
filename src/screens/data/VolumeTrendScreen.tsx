/**
 * G18 — VolumeTrendScreen
 *
 * 过去 12 周每周训练量柱状图。
 * - 顶部 summary：12 周总训练量 / 平均每周训练量 / 最高单周
 * - 中部：BarChart
 * - 底部：周明细列表（近 12 周）
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
import { BarChart } from '@/features/data/charts/BarChart';
import { useDataAggregates } from '@/features/data/useDataAggregates';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme';
import { formatWeight } from '@/utils/units';

export function VolumeTrendScreen() {
  const { colors, typography, spacing } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const unit = useSettingsStore((s) => s.unit);
  const { data, loading } = useDataAggregates();
  const chartWidth = windowWidth - spacing.lg * 2;

  // 仅展示最近 12 周；如果数据库里更老，自动截断。
  const weekly = useMemo(() => {
    if (!data) return [];
    return data.weekly.slice(-12);
  }, [data]);

  const total = weekly.reduce((s, w) => s + w.volume, 0);
  const avg = weekly.length > 0 ? total / weekly.length : 0;
  const peak = weekly.reduce((m, w) => Math.max(m, w.volume), 0);

  const chartData = useMemo(
    () =>
      weekly.map((w) => ({
        // 把 "YYYY-MM-DD" 截成 "MM/DD"
        label: w.week.slice(5).replace('-', '/'),
        value: w.volume,
      })),
    [weekly],
  );

  const isEmpty = !loading && weekly.length === 0;

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
            illustration="chart"
            title="还没有训练量数据"
            description="完成至少一次训练后，这里会出现过去 12 周的周训练量柱状图。"
          />
        ) : (
          <>
            <Card padding="md" elevated style={{ marginBottom: spacing.lg }}>
              <View
                style={{
                  flexDirection: 'row',
                  gap: spacing.md,
                  marginBottom: spacing.sm,
                }}
              >
                <Stat label="12 周总量" value={formatWeight(total, unit)} colors={colors} typography={typography} />
                <Stat label="周均" value={formatWeight(avg, unit)} colors={colors} typography={typography} />
                <Stat label="最高单周" value={formatWeight(peak, unit)} colors={colors} typography={typography} />
              </View>
              <Text style={[typography.caption, { color: colors.textTertiary }]}>
                每周 = 周一 ~ 周日；单位由设置中的 kg/lb 决定。
              </Text>
            </Card>

            <Card padding="md" style={{ marginBottom: spacing.lg }}>
              <BarChart data={chartData} width={chartWidth} />
            </Card>

            <Card padding="md">
              <Text
                style={[
                  typography.label,
                  { color: colors.textTertiary, letterSpacing: 1, marginBottom: spacing.sm },
                ]}
              >
                周明细
              </Text>
              <View style={{ gap: spacing.xs + 2 }}>
                {weekly
                  .slice()
                  .reverse()
                  .map((w) => (
                    <View
                      key={w.week}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Text style={[typography.body, { color: colors.text }]}>
                        {w.week}（周一）
                      </Text>
                      <Text style={[typography.body, { color: colors.textSecondary }]}>
                        {formatWeight(w.volume, unit)}
                      </Text>
                    </View>
                  ))}
              </View>
            </Card>
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
