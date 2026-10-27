/**
 * G25 — 首页热力图卡片。
 *
 * 复用 G18 的 `HeatmapCalendar` + `useDataAggregates` hook。
 * - 标题 + 12 周 × 7 天热力图 + 摘要行（训练天数 + 总训练量）
 * - 整张 Card 可点 → 完整 `CalendarHeatmapScreen`
 * - 空数据：热力图照常渲染（全部 surfaceMuted），摘要行换"暂无训练记录"提示
 *
 * 数据来自 useDataAggregates：与 CalendarHeatmapScreen / DataOverviewScreen
 * 各自独立 fetch（hook 内部未做共享缓存）；SQLite 单屏聚合 < 50ms，
 * 重复查询在 Home + Profile 切换场景下可接受。
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { Card } from '@/components/Card';
import { AppIcon } from '@/components/AppIcon';
import { HeatmapCalendar } from '@/features/data/charts/HeatmapCalendar';
import { useDataAggregates } from '@/features/data/useDataAggregates';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme';
import { formatWeight } from '@/utils/units';

interface HeatmapCardProps {
  /** 跳转到完整 CalendarHeatmapScreen */
  onOpenFull: () => void;
}

/** 与 Card padding="md" 一致，避免图表再被内层 padding 二次扣减时手抖。 */
const CARD_PADDING = 16;

export function HeatmapCard({ onOpenFull }: HeatmapCardProps) {
  const { colors, spacing, typography } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const unit = useSettingsStore((s) => s.unit);
  const { data, loading } = useDataAggregates();

  // HomeScreen ListHeader 外层 paddingHorizontal = spacing.lg，Card 内部 padding="md"。
  // 留 4px 视觉余量（cell 间距 + 屏幕贴边缓冲）。
  const chartWidth = windowWidth - spacing.lg * 2 - CARD_PADDING * 2;

  const totalDays = data?.daily.length ?? 0;
  const totalVolume = useMemo(
    () => data?.daily.reduce((s, d) => s + d.volume, 0) ?? 0,
    [data],
  );
  const isEmpty = !loading && totalDays === 0;

  return (
    <Card
      padding="md"
      elevated
      onPress={onOpenFull}
      accessibilityLabel="查看完整训练热力图"
      testID="home-heatmap-card"
    >
      <View style={styles.content}>
        <Text style={[typography.h3, { color: colors.text }]}>
          过去 12 周训练
        </Text>

        <HeatmapCalendar data={data?.daily ?? []} width={chartWidth} />

        <View style={styles.footer}>
          <Text
            style={[typography.caption, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {isEmpty
              ? '暂无训练记录，去锻炼 Tab 完成第一次'
              : `${totalDays} 天训练 · ${formatWeight(totalVolume, unit)}`}
          </Text>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            <AppIcon name="chevron" size={18} color={colors.textTertiary} />
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 10,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
