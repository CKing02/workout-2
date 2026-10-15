/**
 * US-12 — 身体测量主屏。
 *
 * 布局（自上而下）：
 *  1. SegmentedControl：列表 / 趋势
 *  2. 列表 tab：按日期分组（今天 / 昨天 / 本周 / 更早）的滚动列表；
 *     点行进 Edit，长按行弹 Dialog 二次确认删除
 *  3. 趋势 tab：US-12b 占位（"趋势图将在 US-12c 上线"），后续换成 LineChart
 *  4. FAB：右下角浮按钮 "+"，进 Edit 新建
 *
 * 数据流：
 *  - 启动时 `App.tsx` 已 load 一次到 store；本屏直接 selector 订阅
 *  - store.create / update / remove 后 mutate cache，无需 reload
 *  - 切换单位 kg/lb 由 `settingsStore.unit` 实时同步（formatWeight 读取）
 *
 * 交互约束：
 *  - 长按删除：与训练历史"只读"不同，本屏可改可删
 *  - 同日多条：listAll 已按 createdAt DESC，后插入在前
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Card } from '@/components/Card';
import { Dialog } from '@/components/Dialog';
import { EmptyState } from '@/components/EmptyState';
import { LineChart, type LineChartPoint } from '@/components/LineChart';
import { SegmentedControl } from '@/components/SegmentedControl';
import { toast, useToastStore } from '@/hooks/useToast';
import type { RootStackParamList } from '@/navigation/types';
import { useBodyMeasurementStore } from '@/store/bodyMeasurementStore';
import { useSettingsStore, type Unit } from '@/store/settingsStore';
import { useTheme } from '@/theme';
import { haptic } from '@/utils/haptics';
import type { BodyMeasurement } from '@/db/schema';
import { formatWeight } from '@/utils/units';

type Nav = NativeStackNavigationProp<RootStackParamList, 'BodyMeasurement'>;

type Tab = 'list' | 'trend';
type Metric = 'weight' | 'bodyFat';

/* -------------------------------------------------------------------------- */
/* helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** "YYYY-MM-DD" → 本地 Date(零点)。 */
function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map((x) => parseInt(x, 10));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** "今天 18:30" / "昨天 07:15" / "周一 22:00" / "2026-08-12 09:00"。 */
function formatGroupTime(ms: number, isToday: boolean): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (isToday) return `今天 ${hh}:${mm}`;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  ) {
    return `昨天 ${hh}:${mm}`;
  }
  const weekdayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  // 跨年/同年内：
  const today = new Date();
  if (d.getFullYear() === today.getFullYear()) {
    return `${d.getMonth() + 1}月${d.getDate()}日 ${hh}:${mm}`;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${hh}:${mm}`;
}

/** 本地今天的 "YYYY-MM-DD"。 */
function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 按日期分组（今天 / 昨天 / 本周 / 更早），倒序遍历。 */
interface Group {
  title: string;
  data: Array<BodyMeasurement & { _todayLabel: string }>;
}

function groupByDate(items: BodyMeasurement[]): Group[] {
  const todayStr = todayIso();
  const todayMs = parseLocalDate(todayStr).getTime();
  const yesterdayMs = todayMs - 86400000;
  const dayMs = 86400000;
  // 本周一开始
  const weekStart = (() => {
    const d = new Date();
    const dow = d.getDay() === 0 ? 7 : d.getDay();
    d.setDate(d.getDate() - (dow - 1));
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  })();

  const today: BodyMeasurement[] = [];
  const yesterday: BodyMeasurement[] = [];
  const thisWeek: BodyMeasurement[] = [];
  const earlier: BodyMeasurement[] = [];

  for (const m of items) {
    const dayStart = parseLocalDate(m.measuredDate).getTime();
    if (dayStart === todayMs) today.push(m);
    else if (dayStart === yesterdayMs) yesterday.push(m);
    else if (dayStart >= weekStart) thisWeek.push(m);
    else earlier.push(m);
  }

  const toGroup = (arr: BodyMeasurement[], title: string): Group => ({
    title,
    data: arr.map((m) => ({ ...m, _todayLabel: formatGroupTime(m.createdAt, false) })),
  });
  return [
    toGroup(today, '今天'),
    toGroup(yesterday, '昨天'),
    toGroup(thisWeek, '本周'),
    toGroup(earlier, '更早'),
  ].filter((g) => g.data.length > 0);
}

/** 显示体重：存储统一 kg，按 unit 换算。null → —。 */
function displayWeight(kg: number | null, unit: Unit): string {
  if (kg == null) return '—';
  return formatWeight(kg, unit);
}

/** 显示体脂：百分比 1 位小数。null → —。 */
function displayBodyFat(pct: number | null): string {
  if (pct == null) return '—';
  return `${pct.toFixed(1)}%`;
}

/* -------------------------------------------------------------------------- */
/* Screen                                                                     */
/* -------------------------------------------------------------------------- */

export function BodyMeasurementScreen() {
  const { colors, spacing, typography, radius } = useTheme();
  const navigation = useNavigation<Nav>();
  const unit = useSettingsStore((s) => s.unit);
  const measurements = useBodyMeasurementStore((s) => s.measurements);
  const remove = useBodyMeasurementStore((s) => s.remove);

  const [tab, setTab] = useState<Tab>('list');
  const [pendingDelete, setPendingDelete] = useState<BodyMeasurement | null>(null);

  const groups = useMemo(() => groupByDate(measurements), [measurements]);

  const handleAdd = useCallback(() => {
    haptic.selection();
    navigation.navigate('BodyMeasurementEdit', {});
  }, [navigation]);

  const handleRowPress = useCallback(
    (m: BodyMeasurement) => {
      haptic.selection();
      navigation.navigate('BodyMeasurementEdit', { measurementId: m.id });
    },
    [navigation],
  );

  const handleRowLongPress = useCallback((m: BodyMeasurement) => {
    haptic.warning();
    setPendingDelete(m);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    const target = pendingDelete;
    setPendingDelete(null);
    if (!target) return;
    try {
      await remove(target.id);
      toast.show('已删除', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.show(`删除失败：${msg}`, 'error');
    }
  }, [pendingDelete, remove]);

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={['bottom']}
    >
      {/* 顶部 tab 切换 */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <SegmentedControl<Tab>
          value={tab}
          onChange={setTab}
          fullWidth
          options={[
            { label: '列表', value: 'list' },
            { label: '趋势', value: 'trend' },
          ]}
        />
      </View>

      {tab === 'list' ? (
        <ListTab
          groups={groups}
          unit={unit}
          onPress={handleRowPress}
          onLongPress={handleRowLongPress}
          onAdd={handleAdd}
        />
      ) : (
        <TrendTab />
      )}

      {/* FAB —— 列表 tab 才显示（趋势 tab 不需要新增入口） */}
      {tab === 'list' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="新增记录"
          accessibilityHint="打开录入页"
          onPress={handleAdd}
          style={({ pressed }) => [
            styles.fab,
            {
              backgroundColor: colors.primary,
              shadowColor: colors.shadow,
              opacity: pressed ? 0.85 : 1,
              right: spacing.xl,
              bottom: spacing.xl + 16,
            },
          ]}
        >
          <Text style={{ color: colors.onPrimary, fontSize: 28, fontWeight: '300' }}>+</Text>
        </Pressable>
      ) : null}

      {/* 删除确认 Dialog */}
      <Dialog
        visible={pendingDelete !== null}
        variant="danger"
        title="删除这条记录？"
        message={
          pendingDelete
            ? `${pendingDelete.measuredDate} · ${displayWeight(
                pendingDelete.weightKg,
                unit,
              )}${
                pendingDelete.bodyFatPct != null
                  ? ` · ${displayBodyFat(pendingDelete.bodyFatPct)}`
                  : ''
              }`
            : undefined
        }
        confirmText="删除"
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </SafeAreaView>
  );
}

/* -------------------------------------------------------------------------- */
/* List tab                                                                   */
/* -------------------------------------------------------------------------- */

function ListTab({
  groups,
  unit,
  onPress,
  onLongPress,
  onAdd,
}: {
  groups: Group[];
  unit: Unit;
  onPress: (m: BodyMeasurement) => void;
  onLongPress: (m: BodyMeasurement) => void;
  onAdd: () => void;
}) {
  const { colors, spacing, typography } = useTheme();

  if (groups.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <EmptyState
          illustration="measurement"
          title="记录你的第一次测量"
          description="早晚体重可能有差异，支持同一天记录多次。"
          actionLabel="添加记录"
          onAction={onAdd}
        />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{
        padding: spacing.lg,
        paddingBottom: spacing.xxxxl + 64, // 给 FAB 留空间
      }}
      keyboardShouldPersistTaps="handled"
    >
      {groups.map((group) => (
        <View key={group.title} style={{ marginBottom: spacing.lg }}>
          <Text
            style={[
              typography.label,
              {
                color: colors.textTertiary,
                marginBottom: spacing.sm,
                paddingHorizontal: spacing.xs,
              },
            ]}
          >
            {group.title}
          </Text>
          <Card padding="sm">
            {group.data.map((m, idx) => (
              <MeasurementRow
                key={m.id}
                measurement={m}
                unit={unit}
                onPress={onPress}
                onLongPress={onLongPress}
                divider={idx < group.data.length - 1}
              />
            ))}
          </Card>
        </View>
      ))}
    </ScrollView>
  );
}

function MeasurementRow({
  measurement,
  unit,
  onPress,
  onLongPress,
  divider,
}: {
  measurement: BodyMeasurement & { _todayLabel: string };
  unit: Unit;
  onPress: (m: BodyMeasurement) => void;
  onLongPress: (m: BodyMeasurement) => void;
  divider: boolean;
}) {
  const { colors, spacing, typography } = useTheme();

  const hasBoth = measurement.weightKg != null && measurement.bodyFatPct != null;
  const onlyOne = (measurement.weightKg != null) !== (measurement.bodyFatPct != null);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${measurement._todayLabel}，${displayWeight(measurement.weightKg, unit)}${
        measurement.bodyFatPct != null ? `，${displayBodyFat(measurement.bodyFatPct)}` : ''
      }。点按编辑，长按删除。`}
      accessibilityHint="点按进编辑页；长按弹删除确认"
      onPress={() => onPress(measurement)}
      onLongPress={() => onLongPress(measurement)}
      android_ripple={{ color: colors.surfaceMuted }}
      style={({ pressed }) => [
        {
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          opacity: pressed ? 0.85 : 1,
          borderBottomWidth: divider ? StyleSheet.hairlineWidth : 0,
          borderBottomColor: divider ? colors.divider : colors.transparent,
        },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* 主数据：体重 / 体脂 并排 */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.md }}>
            {measurement.weightKg != null ? (
              <Text style={[typography.h2, { color: colors.text }]}>
                {displayWeight(measurement.weightKg, unit)}
              </Text>
            ) : null}
            {measurement.bodyFatPct != null ? (
              <Text
                style={[
                  hasBoth ? typography.h3 : typography.h2,
                  { color: hasBoth ? colors.textSecondary : colors.text },
                ]}
              >
                {displayBodyFat(measurement.bodyFatPct)}
              </Text>
            ) : null}
            {onlyOne &&
            ((measurement.weightKg != null && measurement.bodyFatPct == null) ||
              (measurement.weightKg == null && measurement.bodyFatPct != null)) ? (
              <Text style={[typography.caption, { color: colors.textTertiary }]}>
                {measurement.weightKg != null ? '仅体重' : '仅体脂'}
              </Text>
            ) : null}
          </View>
          <Text
            style={[
              typography.caption,
              { color: colors.textTertiary, marginTop: spacing.xs },
            ]}
          >
            {measurement._todayLabel}
            {measurement.note ? ` · ${measurement.note}` : ''}
          </Text>
        </View>
        {/* 编辑 chevron */}
        <Text style={[typography.subtitle, { color: colors.textTertiary }]}>›</Text>
      </View>
    </Pressable>
  );
}

/* -------------------------------------------------------------------------- */
/* Trend tab — US-12c: 实际 LineChart 接入                                    */
/* -------------------------------------------------------------------------- */

function TrendTab() {
  const { colors, spacing, typography } = useTheme();
  const measurements = useBodyMeasurementStore((s) => s.measurements);
  const unit = useSettingsStore((s) => s.unit);
  const { width: screenWidth } = useWindowDimensions();
  // 内边距与 G18/G32 一致;Card 默认 padding 'md' = 16,左右各 16 + 外层 lg = 16
  // = 屏幕 - 64。卡片再 pad 16 → 实际图宽 = 屏宽 - 64 - 32 = 屏宽 - 96
  const chartWidth = Math.max(280, screenWidth - spacing.lg * 2 - spacing.md * 2 - spacing.lg * 2);
  const [metric, setMetric] = useState<Metric>('weight');

  // 数据按 createdAt ASC(从左到右时间递增);LineChart x=timestamp,y=数值
  const weightPoints = useMemo<LineChartPoint[]>(() => {
    return measurements
      .filter((m) => m.weightKg != null)
      .slice() // copy,因为 sort 原地
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((m) => {
        const weightKg = m.weightKg as number;
        return {
          x: m.createdAt,
          y: weightKg,
          label: formatWeight(weightKg, unit),
          payload: m,
        };
      });
  }, [measurements, unit]);

  const fatPoints = useMemo<LineChartPoint[]>(() => {
    return measurements
      .filter((m) => m.bodyFatPct != null)
      .slice()
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((m) => ({
        x: m.createdAt,
        y: m.bodyFatPct as number,
        label: `${(m.bodyFatPct as number).toFixed(1)}%`,
        payload: m,
      }));
  }, [measurements]);

  const activePoints = metric === 'weight' ? weightPoints : fatPoints;
  const activeYFormat =
    metric === 'weight' ? (y: number) => formatWeight(y, unit) : (y: number) => `${y.toFixed(1)}%`;
  const activeEmpty = metric === 'weight' ? '还没有体重记录' : '还没有体脂记录';

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
      <View style={{ marginBottom: spacing.md }}>
        <SegmentedControl<Metric>
          value={metric}
          onChange={setMetric}
          fullWidth
          options={[
            { label: '体重', value: 'weight' },
            { label: '体脂', value: 'bodyFat' },
          ]}
        />
      </View>
      <Card padding="md">
        {activePoints.length === 0 ? (
          <View style={{ paddingVertical: spacing.xxl }}>
            <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center' }]}>
              {activeEmpty}
            </Text>
          </View>
        ) : (
          <LineChart
            points={activePoints}
            width={chartWidth}
            height={220}
            yLabelFormat={activeYFormat}
            accessibilityLabel={`${metric === 'weight' ? '体重' : '体脂'}趋势线`}
            onLongPressPoint={(pt) => {
              const m = pt.payload as BodyMeasurement | undefined;
              if (!m) return;
              haptic.selection();
              // 直接走 store 接受 durationMs;toast 包装只有 2 参数。
              useToastStore.getState().show(
                `${new Date(m.createdAt).toLocaleString()} · ${
                  metric === 'weight'
                    ? formatWeight(m.weightKg as number, unit)
                    : `${(m.bodyFatPct as number).toFixed(1)}%`
                }`,
                { variant: 'info', durationMs: 3500 },
              );
            }}
          />
        )}
        <Text
          style={[
            typography.caption,
            { color: colors.textTertiary, marginTop: spacing.sm },
          ]}
        >
          共 {activePoints.length} 条记录 · 长按数据点查看详情
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  fab: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
});
