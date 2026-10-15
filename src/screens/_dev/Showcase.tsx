/**
 * Design-system Showcase — G20 注册的隐藏开发期自检页。
 *
 * 把所有 G3 组件在单屏渲染，方便开发期肉眼校对浅/深色 + 间距 +
 * 字号。**不**面向终端用户 —— 入口是 Profile 屏幕底部版本号
 * （普通用户不会去点）。
 *
 * 路由：RootNavigator Stack.Screen "Showcase"，headerShown 默认
 * （带返回箭头，开发者可一键回到 Profile）。
 */

import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CheckableRow } from '@/components/CheckableRow';
import { Dialog } from '@/components/Dialog';
import { EmptyState } from '@/components/EmptyState';
import { IconButton } from '@/components/IconButton';
import { Input } from '@/components/Input';
import { ListItem } from '@/components/ListItem';
import { NumberInput } from '@/components/NumberInput';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Sheet } from '@/components/Sheet';
import { TimerRing } from '@/components/TimerRing';

export function Showcase() {
  const { colors, typography, spacing, radius } = useTheme();

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: spacing.xxxxl }]}
        showsVerticalScrollIndicator={false}
      >
        <Header
          title="G3 · 设计系统 Showcase"
          subtitle="所有组件在浅色 / 深色下自动取色。"
        />

        <Section title="Button">
          <ButtonGrid />
        </Section>

        <Section title="IconButton">
          <IconButtonGrid />
        </Section>

        <Section title="Input">
          <InputGrid />
        </Section>

        <Section title="NumberInput">
          <NumberInputGrid />
        </Section>

        <Section title="Card / Badge / ListItem / CheckableRow">
          <SurfaceGrid />
        </Section>

        <Section title="SegmentedControl">
          <SegmentedDemo />
        </Section>

        <Section title="Sheet / Dialog / TimerRing">
          <OverlaysDemo />
        </Section>

        <Section title="EmptyState">
          <EmptyStateDemo />
        </Section>

        <Section title="Theme palette">
          <PaletteDemo />
        </Section>

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------ */
/* Layout helpers                                                      */
/* ------------------------------------------------------------------ */
function Header({ title: t, subtitle }: { title: string; subtitle?: string }) {
  const { colors, typography, spacing } = useTheme();
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={[typography.display, { color: colors.text }]}>{t}</Text>
      {subtitle ? (
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.xs }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

function Section({ title: t, children }: { title: string; children: React.ReactNode }) {
  const { colors, typography, spacing, radius } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: spacing.lg,
          marginBottom: spacing.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.divider,
        },
      ]}
    >
      <Text
        style={[
          typography.label,
          { color: colors.textTertiary, marginBottom: spacing.sm, letterSpacing: 1 },
        ]}
      >
        {t.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */
function ButtonGrid() {
  const { spacing, colors } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        <Button variant="primary" size="sm">
          Small
        </Button>
        <Button variant="primary" size="md">
          Medium
        </Button>
        <Button variant="primary" size="lg">
          Large
        </Button>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        <Button loading variant="primary">
          Loading
        </Button>
        <Button disabled variant="primary">
          Disabled
        </Button>
        <Button
          variant="primary"
          icon={<Text style={{ color: colors.onPrimary, fontWeight: '900' }}>●</Text>}
        >
          With icon
        </Button>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* IconButton                                                          */
/* ------------------------------------------------------------------ */
function IconButtonGrid() {
  const { spacing } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
      <IconButton accessibilityLabel="close" icon="×" variant="ghost" />
      <IconButton accessibilityLabel="add" icon="+" variant="primary" />
      <IconButton accessibilityLabel="delete" icon="🗑" variant="danger" />
      <IconButton accessibilityLabel="settings" icon="⚙" variant="secondary" size="lg" />
      <IconButton accessibilityLabel="disabled" icon="•" disabled />
      <IconButton accessibilityLabel="star" icon="★" variant="secondary" size="sm" />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Input                                                                */
/* ------------------------------------------------------------------ */
function InputGrid() {
  const { spacing } = useTheme();
  const [a, setA] = useState('');
  const [b, setB] = useState('卧推 60kg');
  const [c, setC] = useState('');
  const [d, setD] = useState('');
  return (
    <View style={{ gap: spacing.md }}>
      <Input label="动作名称" value={a} onChangeText={setA} placeholder="例如：杠铃卧推" />
      <Input label="带初始值" value={b} onChangeText={setB} />
      <Input
        label="错误状态"
        value={c}
        onChangeText={setC}
        error="次数必须大于 0"
        keyboardType="numeric"
      />
      <Input
        label="带 helper"
        value={d}
        onChangeText={setD}
        helperText="单位为 kg，支持 1 位小数"
        placeholder="0.0"
        keyboardType="decimal-pad"
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* NumberInput                                                          */
/* ------------------------------------------------------------------ */
function NumberInputGrid() {
  const { spacing, colors, typography } = useTheme();
  const [weight, setWeight] = useState(60);
  const [reps, setReps] = useState(8);
  const [body, setBody] = useState(72.5);
  return (
    <View style={{ gap: spacing.md }}>
      <NumberInput
        label="重量"
        unitLabel="kg"
        value={weight}
        onChangeValue={setWeight}
        min={0}
        max={500}
        precision={1}
      />
      <NumberInput
        label="次数"
        value={reps}
        onChangeValue={setReps}
        min={1}
        max={50}
      />
      <NumberInput
        label="体重"
        unitLabel="kg"
        value={body}
        onChangeValue={setBody}
        min={20}
        max={250}
        precision={1}
      />
      <Text style={[typography.caption, { color: colors.textTertiary }]}>
        提示：试着输入 "abc" —— 会被过滤；空值失焦回退到 min；超长数值会自动缩字号。
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Surface group                                                        */
/* ------------------------------------------------------------------ */
function SurfaceGrid() {
  const { spacing, colors, typography } = useTheme();
  const [items, setItems] = useState([
    { id: 'a', title: '杠铃卧推', subtitle: '胸 · 杠铃 · 60kg × 8', checked: true },
    { id: 'b', title: '深蹲', subtitle: '股四头 · 杠铃', checked: false },
    { id: 'c', title: '划船', subtitle: '背 · 杠铃', checked: false },
  ]);
  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        <Badge label="默认" />
        <Badge label="主要" variant="primary" />
        <Badge label="成功" variant="success" />
        <Badge label="警告" variant="warning" />
        <Badge label="危险" variant="danger" />
        <Badge label="信息" variant="info" />
        <Badge label="小尺寸" variant="primary" size="sm" />
        <Badge label="W 热身" variant="warning" size="sm" />
        <Badge label="F 力竭" variant="danger" size="sm" />
      </View>

      <Card elevated onPress={() => undefined}>
        <Text style={[typography.h3, { color: colors.text }]}>训练卡片</Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: 4 }]}>
          推胸日 · 5 个动作 · 上次训练 2 天前
        </Text>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: spacing.sm }}>
          <Badge label="胸" variant="primary" size="sm" />
          <Badge label="三头" variant="info" size="sm" />
        </View>
      </Card>

      <View style={{ marginHorizontal: -16 }}>
        <ListItem
          title="杠铃卧推"
          subtitle="上次 60kg × 8 · 完成"
          leftSlot={
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                backgroundColor: colors.primaryMuted,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: colors.primaryPressed, fontWeight: '700' }}>卧</Text>
            </View>
          }
          rightSlot={<Text style={{ color: colors.textTertiary, fontSize: 22 }}>›</Text>}
          divider
          onPress={() => undefined}
        />
        <ListItem
          title="设置"
          subtitle="主题 / 单位 / 默认休息时间"
          leftSlot={
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                backgroundColor: colors.surfaceMuted,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 18 }}>⚙</Text>
            </View>
          }
          rightSlot={<Text style={{ color: colors.textTertiary, fontSize: 22 }}>›</Text>}
        />
      </View>

      <View style={{ marginHorizontal: -16 }}>
        {items.map((it) => (
          <CheckableRow
            key={it.id}
            title={it.title}
            subtitle={it.subtitle}
            checked={it.checked}
            onToggle={(next) =>
              setItems((prev) =>
                prev.map((p) => (p.id === it.id ? { ...p, checked: next } : p)),
              )
            }
          />
        ))}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* SegmentedControl                                                     */
/* ------------------------------------------------------------------ */
function SegmentedDemo() {
  const { spacing } = useTheme();
  const [unit, setUnit] = useState<'kg' | 'lb'>('kg');
  const [rest, setRest] = useState<'30' | '60' | '90' | '120'>('60');
  return (
    <View style={{ gap: spacing.md }}>
      <SegmentedControl
        value={unit}
        onChange={setUnit}
        options={[
          { label: 'kg', value: 'kg' },
          { label: 'lb', value: 'lb' },
        ]}
      />
      <SegmentedControl
        value={rest}
        onChange={setRest}
        options={[
          { label: '30s', value: '30' },
          { label: '60s', value: '60' },
          { label: '90s', value: '90' },
          { label: '120s', value: '120' },
        ]}
        fullWidth
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Sheet / Dialog / TimerRing                                           */
/* ------------------------------------------------------------------ */
function OverlaysDemo() {
  const { spacing, colors, typography, radius } = useTheme();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dangerOpen, setDangerOpen] = useState(false);
  const [duration, setDuration] = useState(10);
  const [key, setKey] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [doneCount, setDoneCount] = useState(0);

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        <Button onPress={() => setSheetOpen(true)} variant="secondary">
          打开 Sheet
        </Button>
        <Button onPress={() => setDialogOpen(true)} variant="secondary">
          打开 Dialog
        </Button>
        <Button onPress={() => setDangerOpen(true)} variant="danger">
          删除 Dialog
        </Button>
      </View>

      <Sheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="选择组类型"
        maxHeightRatio={0.5}
      >
        <View style={{ gap: spacing.xs }}>
          {(
            [
              ['正式组', 'normal'],
              ['热身组 W', 'warmup'],
              ['递减组 D', 'dropout'],
              ['力竭组 F', 'failure'],
            ] as const
          ).map(([label, value]) => (
            <SheetRow
              key={value}
              label={label}
              onPress={() => setSheetOpen(false)}
            />
          ))}
          <SheetRow
            label="删除组"
            tone="danger"
            onPress={() => setSheetOpen(false)}
          />
        </View>
      </Sheet>

      <Dialog
        visible={dialogOpen}
        title="保存本次训练？"
        message="保存后会出现在历史列表。"
        onCancel={() => setDialogOpen(false)}
        onConfirm={() => setDialogOpen(false)}
      />

      <Dialog
        visible={dangerOpen}
        variant="danger"
        title="删除这条计划？"
        message="删除后无法恢复。"
        confirmText="删除"
        onCancel={() => setDangerOpen(false)}
        onConfirm={() => setDangerOpen(false)}
      />

      <View style={{ alignItems: 'center', gap: spacing.sm }}>
        <TimerRing
          key={`${duration}-${elapsed}-${key}`}
          duration={duration}
          elapsed={elapsed}
          size={180}
          strokeWidth={10}
          labelSlot={
            <View style={{ alignItems: 'center' }}>
              <Text style={[typography.numeric, { color: colors.text }]}>
                {Math.max(0, duration - elapsed)}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                秒
              </Text>
            </View>
          }
          onComplete={() => setDoneCount((c) => c + 1)}
        />
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          完成回调次数: {doneCount}（按 10s 测试一次）
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', justifyContent: 'center' }}>
          <SmallButton
            label="10s"
            onPress={() => {
              setDuration(10);
              setElapsed(0);
              setKey((k) => k + 1);
            }}
          />
          <SmallButton
            label="30s"
            onPress={() => {
              setDuration(30);
              setElapsed(0);
              setKey((k) => k + 1);
            }}
          />
          <SmallButton
            label="30s · 跳过 20s"
            onPress={() => {
              setDuration(30);
              setElapsed(20);
              setKey((k) => k + 1);
            }}
          />
          <SmallButton
            label="重启"
            onPress={() => {
              setElapsed(0);
              setKey((k) => k + 1);
            }}
          />
        </View>
      </View>
      {/* Use `radius` so the lint rule is satisfied even if we drop SmallButton */}
      <View style={{ height: 0, borderRadius: radius.xs }} />
    </View>
  );
}

function SheetRow({
  label,
  onPress,
  tone = 'normal',
}: {
  label: string;
  onPress: () => void;
  tone?: 'normal' | 'danger';
}) {
  const { colors, typography, spacing } = useTheme();
  return (
    <View>
      <Text
        onPress={onPress}
        style={[
          typography.body,
          {
            color: tone === 'danger' ? colors.danger : colors.text,
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.sm,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function SmallButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors, typography, spacing, radius } = useTheme();
  return (
    <Text
      onPress={onPress}
      style={[
        typography.label,
        {
          color: colors.text,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          backgroundColor: colors.surfaceMuted,
          borderRadius: radius.md,
          overflow: 'hidden',
        },
      ]}
    >
      {label}
    </Text>
  );
}

/* ------------------------------------------------------------------ */
/* EmptyState                                                           */
/* ------------------------------------------------------------------ */
function EmptyStateDemo() {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.lg }}>
      <EmptyState
        illustration="plan"
        title="创建你的第一个训练计划"
        description="把今天想练的动作组合起来，下次训练一点就能开始。"
        actionLabel="新建计划"
        onAction={() => undefined}
      />
      <EmptyState illustration="training" title="开始你的第一次训练吧" />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Palette preview                                                      */
/* ------------------------------------------------------------------ */
function PaletteDemo() {
  const { colors, radius, spacing, typography } = useTheme();
  const swatches = [
    ['primary', colors.primary],
    ['primaryPressed', colors.primaryPressed],
    ['primaryMuted', colors.primaryMuted],
    ['background', colors.background],
    ['surface', colors.surface],
    ['surfaceElevated', colors.surfaceElevated],
    ['text', colors.text],
    ['textSecondary', colors.textSecondary],
    ['textTertiary', colors.textTertiary],
    ['border', colors.border],
    ['success', colors.success],
    ['warning', colors.warning],
    ['danger', colors.danger],
    ['info', colors.info],
  ] as const;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {swatches.map(([name, value]) => (
        <View
          key={name}
          style={{
            width: 96,
            padding: spacing.sm,
            borderRadius: radius.md,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            backgroundColor: colors.background,
          }}
        >
          <View
            style={{
              height: 36,
              borderRadius: radius.sm,
              backgroundColor: value,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.border,
              marginBottom: spacing.xs,
            }}
          />
          <Text style={[typography.caption, { color: colors.text }]}>{name}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: {
    padding: 16,
  },
});

export default Showcase;
