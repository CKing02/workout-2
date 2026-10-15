/**
 * G18 — MuscleGroupDistributionScreen
 *
 * 肌群分布饼图（按总训练量）。
 * - 左/上：DonutChart 居中
 * - 右/下：占比列表（百分比 + 训练量）
 */

import React from 'react';
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
import { DonutChart } from '@/features/data/charts/DonutChart';
import { useDataAggregates } from '@/features/data/useDataAggregates';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme';
import { formatWeight } from '@/utils/units';

export function MuscleGroupDistributionScreen() {
  const { colors, typography, spacing } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const unit = useSettingsStore((s) => s.unit);
  const { data, loading } = useDataAggregates();

  const total = data?.muscleGroups.reduce((s, m) => s + m.volume, 0) ?? 0;

  // Empty = "no data to render" — covers both the never-loaded state
  // (data === null) and the loaded-but-empty state. Previously gated by
  // `!loading &&`, which routed the loading tick through the non-empty
  // branch while `data` was still null → `data!.muscleGroups.map(...)`
  // threw `Cannot read property 'muscleGroups' of null`. The check now
  // depends only on `data`, which is the only thing the branches below
  // actually read.
  const isEmpty = data === null || data.muscleGroups.length === 0;

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
            title="还没有肌群数据"
            description="至少完成一次训练后，这里会出现按主要肌群聚合的训练量占比饼图。"
          />
        ) : (
          <>
            <Card padding="md" elevated style={{ marginBottom: spacing.lg }}>
              <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
                <DonutChart
                  data={data!.muscleGroups.map((m) => ({
                    label: m.muscleGroup,
                    value: m.volume,
                  }))}
                  size={Math.min(220, windowWidth - spacing.lg * 4)}
                  centerLabel={formatWeight(total, unit)}
                  centerSubLabel="总训练量"
                />
              </View>
            </Card>

            <Card padding="md">
              <Text
                style={[
                  typography.label,
                  { color: colors.textTertiary, letterSpacing: 1, marginBottom: spacing.sm },
                ]}
              >
                占比明细
              </Text>
              <View style={{ gap: spacing.xs + 2 }}>
                {data!.muscleGroups.map((m) => {
                  const pct =
                    total > 0 ? Math.round((m.volume / total) * 100) : 0;
                  return (
                    <View
                      key={m.muscleGroup}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Text style={[typography.body, { color: colors.text }]}>
                        {m.muscleGroup}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: spacing.md }}>
                        <Text style={[typography.caption, { color: colors.textTertiary }]}>
                          {pct}%
                        </Text>
                        <Text style={[typography.body, { color: colors.textSecondary }]}>
                          {formatWeight(m.volume, unit)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
