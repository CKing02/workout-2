/**
 * G18 — DataOverview
 *
 * 数据可视化总览：4 个子页的入口 + 一句话总览（基于当前数据给出
 * "过去 7/30 天的训练次数 / 累计训练量"）。
 *
 * 渲染：顶部 Card 展示 summary（如果有数据）；下面 Card 是 4 个
 * ListItem 入口：日历热力图 / 训练量趋势 / 肌群分布 / 1RM 记录。
 */

import React, { useLayoutEffect, useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Card } from '@/components/Card';
import { ListItem } from '@/components/ListItem';
import { useDataAggregates } from '@/features/data/useDataAggregates';
import { useTheme } from '@/theme';

import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'DataOverview'>;

export function DataOverviewScreen({ navigation }: Props) {
  const { colors, typography, spacing } = useTheme();
  const { data, loading } = useDataAggregates();

  const summary = useMemo(() => {
    if (!data) return null;
    const now = Date.now();
    const oneDay = 86_400_000;
    let count7 = 0;
    let count30 = 0;
    let volume30 = 0;
    for (const t of data.joined) {
      if (now - t.trainingStartedAt > 30 * oneDay) continue;
      // 每个训练只算一次：用最后一个 set 的 startedAt 代表
    }
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

  // 设置 header 默认（虽然 RootStack.Navigator screenOptions 已配）
  useLayoutEffect(() => {
    navigation.setOptions({ title: '数据' });
  }, [navigation]);

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
              <SummaryStat
                label="过去 7 天"
                value={`${summary.count7} 次`}
                colors={colors}
                typography={typography}
              />
              <SummaryStat
                label="过去 30 天"
                value={`${summary.count30} 次`}
                colors={colors}
                typography={typography}
              />
              <SummaryStat
                label="覆盖动作"
                value={`${summary.exerciseCount} 个`}
                colors={colors}
                typography={typography}
              />
            </View>
          </Card>
        ) : null}

        {/* 4 个子入口 */}
        <Card padding="sm">
          <ListItem
            title="日历热力图"
            subtitle="过去 12 周每日训练量"
            leftSlot={<Glyph emoji="🗓" colors={colors} />}
            rightSlot={<Chevron colors={colors} typography={typography} />}
            onPress={() => navigation.navigate('CalendarHeatmap')}
            divider
            accessibilityLabel="打开日历热力图"
          />
          <ListItem
            title="训练量趋势"
            subtitle="过去 12 周每周训练量"
            leftSlot={<Glyph emoji="📈" colors={colors} />}
            rightSlot={<Chevron colors={colors} typography={typography} />}
            onPress={() => navigation.navigate('VolumeTrend')}
            divider
            accessibilityLabel="打开训练量趋势"
          />
          <ListItem
            title="肌群分布"
            subtitle="按主要肌群聚合训练量"
            leftSlot={<Glyph emoji="🥩" colors={colors} />}
            rightSlot={<Chevron colors={colors} typography={typography} />}
            onPress={() => navigation.navigate('MuscleGroupDistribution')}
            divider
            accessibilityLabel="打开肌群分布"
          />
          <ListItem
            title="1RM 记录"
            subtitle="按 Epley 公式估算每个动作最高 1RM"
            leftSlot={<Glyph emoji="🏆" colors={colors} />}
            rightSlot={<Chevron colors={colors} typography={typography} />}
            onPress={() => navigation.navigate('OneRMRecords')}
            accessibilityLabel="打开 1RM 记录"
          />
        </Card>

        {loading && !data ? (
          <Text
            style={[
              typography.caption,
              { color: colors.textTertiary, marginTop: spacing.md, textAlign: 'center' },
            ]}
          >
            加载中…
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

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
      <Text
        style={[
          typography.h2,
          { color: colors.text, marginTop: 2 },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function Glyph({
  emoji,
  colors,
}: {
  emoji: string;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
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