/**
 * G18 — OneRMRecordsScreen
 *
 * 按动作聚合最高 1RM（Epley: weight × (1 + reps/30)）。
 * - 列表：动作名 / 1RM / 当时 weight × reps / 肌群
 */

import React, { useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { useDataAggregates } from '@/features/data/useDataAggregates';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme';
import { formatWeight } from '@/utils/units';

export function OneRMRecordsScreen() {
  const { colors, typography, spacing } = useTheme();
  const unit = useSettingsStore((s) => s.unit);
  const { data, loading } = useDataAggregates();

  const records = useMemo(() => data?.oneRm ?? [], [data]);

  const isEmpty = !loading && records.length === 0;

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
            icon="🏆"
            title="还没有 1RM 数据"
            description="完成一次包含 weight × reps 的训练后，这里会出现按动作聚合的最高 1RM。"
          />
        ) : (
          <>
            <Card padding="sm" style={{ marginBottom: spacing.lg }}>
              <Text
                style={[
                  typography.caption,
                  { color: colors.textTertiary, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
                ]}
              >
                估算公式：1RM ≈ weight × (1 + reps / 30)。同动作同等 1RM 取最近一次。
              </Text>
            </Card>

            <View style={{ gap: spacing.sm }}>
              {records.map((r, idx) => (
                <Card key={r.exerciseId} padding="md">
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.md,
                    }}
                  >
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: colors.primaryMuted,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text
                        style={{ color: colors.primaryPressed, fontWeight: '700' }}
                      >
                        {idx + 1}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.h3, { color: colors.text }]}>
                        {r.exerciseName}
                      </Text>
                      <Text style={[typography.caption, { color: colors.textTertiary, marginTop: 2 }]}>
                        {r.muscleGroup} · {formatWeight(r.weight, unit)} × {r.reps}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[typography.caption, { color: colors.textTertiary }]}>
                        估算 1RM
                      </Text>
                      <Text
                        style={[
                          typography.h2,
                          { color: colors.primary, marginTop: 2 },
                        ]}
                      >
                        {formatWeight(r.oneRm, unit)}
                      </Text>
                    </View>
                  </View>
                </Card>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});