/**
 * SettingsScreen — 设置（G10）。
 *
 * Stack 屏幕。从"我的"Tab 进入。
 *
 * 分组：
 *  - **外观**   主题模式（浅色/深色/跟随系统）+ 重量单位（kg/lb）
 *  - **训练**   默认休息时间 + 震动反馈开关
 *  - **个人**   用户名
 *  - **数据**   导出（P2 占位）+ 清除全部数据（二次确认）
 *
 * 底部追加 `<Card>` 演示单位换算工具生效：
 *  - "示例：100 kg = 220.5 lb"
 *  - "示例：100 lb = 45.4 kg"
 *
 * 无障碍（accessibility）：
 *  - 每个 ListItem 通过 `accessibilityLabel` 说明"X → 当前值 Y"
 *  - Switch 通过 `accessibilityLabel` + `accessibilityHint` 描述行为
 *  - 危险操作（清除数据）通过红色 title + 二次 Dialog 提示
 */

import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/Card';
import { Dialog } from '@/components/Dialog';
import { Input } from '@/components/Input';
import { ListItem } from '@/components/ListItem';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Sheet } from '@/components/Sheet';
import { wipeAllData } from '@/db';
import { toast } from '@/hooks/useToast';
import { useExerciseStore } from '@/store/exerciseStore';
import { usePlanStore } from '@/store/planStore';
import { useSettingsStore, type Unit, type ThemeModeSetting } from '@/store/settingsStore';
import { useTrainingStore } from '@/store/trainingStore';
import { useTheme } from '@/theme';
import { haptic } from '@/utils/haptics';
import { formatWeight, kgToLb, lbToKg } from '@/utils/units';

const THEME_OPTIONS: ReadonlyArray<{ label: string; value: ThemeModeSetting }> = [
  { label: '浅色', value: 'light' },
  { label: '深色', value: 'dark' },
  { label: '跟随系统', value: 'system' },
];

const UNIT_OPTIONS: ReadonlyArray<{ label: string; value: Unit }> = [
  { label: 'kg', value: 'kg' },
  { label: 'lb', value: 'lb' },
];

const REST_PRESETS: ReadonlyArray<{ label: string; value: string }> = [
  { label: '30s', value: '30' },
  { label: '60s', value: '60' },
  { label: '90s', value: '90' },
  { label: '120s', value: '120' },
];

/**
 * 在用户切换主题/单位/默认休息时给出轻量触感反馈。
 * G13 改写：现在统一走 `haptic.selection()` util，util 内部读
 * `settingsStore.hapticsEnabled` —— 切换到「开启」时立即生效（因为
 * `setHapticsEnabled(true)` 是 await 之后才调到这里），关到关闭时
 * 自然静默。
 */
function feedback() {
  haptic.selection();
}

export function SettingsScreen() {
  const { colors, typography, spacing } = useTheme();
  const {
    unit,
    themeMode,
    defaultRestSeconds,
    hapticsEnabled,
    username,
    setUnit,
    setThemeMode,
    setDefaultRest,
    setHapticsEnabled,
  } = useSettingsStore();

  const [restSheetOpen, setRestSheetOpen] = useState(false);
  const [usernameSheetOpen, setUsernameSheetOpen] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState('');

  const handleOpenUsername = () => {
    setUsernameDraft(username);
    setUsernameSheetOpen(true);
  };

  const handleSaveUsername = async () => {
    await useSettingsStore.getState().setUsername(usernameDraft.trim());
    setUsernameSheetOpen(false);
    // G12: 轻量反馈
    if (usernameDraft.trim()) {
      toast.show('用户名已保存', 'success');
    }
  };

  const handleChangeUnit = async (next: Unit) => {
    feedback();
    await setUnit(next);
  };

  const handleChangeTheme = async (next: ThemeModeSetting) => {
    feedback();
    await setThemeMode(next);
  };

  const handleChangeHaptics = async (next: boolean) => {
    await setHapticsEnabled(next);
    if (next) feedback(); // 开启时立即给一次反馈，让用户感知震动生效
  };

  const handleClearAll = async () => {
    setClearDialogOpen(false);
    // G14: 真正接入 SQLite — 事务内清 7 张表，再 reseed 内置动作。
    try {
      await wipeAllData();
      await Promise.all([
        useExerciseStore.getState().reload(),
        usePlanStore.getState().reload(),
        useTrainingStore.getState().loadHistory(),
        useSettingsStore.getState().load(),
      ]);
      useTrainingStore.getState().cancelTraining();
      toast.show('已清除全部数据', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.show('清除失败：' + msg, 'error');
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: spacing.xxxxl,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ---------------------- 外观 ---------------------- */}
        <SectionHeader title="外观" colors={colors} typography={typography} spacing={spacing} />

        <Card padding="md" style={{ marginTop: spacing.sm }}>
          <View style={{ gap: spacing.lg }}>
            <FieldRow label="主题模式" colors={colors} typography={typography} spacing={spacing}>
              <SegmentedControl
                value={themeMode}
                onChange={handleChangeTheme}
                options={THEME_OPTIONS}
                accessibilityLabel="主题模式"
              />
            </FieldRow>
            <Divider colors={colors} />
            <FieldRow label="重量单位" colors={colors} typography={typography} spacing={spacing}>
              <SegmentedControl
                value={unit}
                onChange={handleChangeUnit}
                options={UNIT_OPTIONS}
                accessibilityLabel="重量单位"
              />
            </FieldRow>
          </View>
        </Card>

        {/* ---------------------- 训练 ---------------------- */}
        <SectionHeader
          title="训练"
          colors={colors}
          typography={typography}
          spacing={spacing}
          topGap
        />

        <Card padding="sm" style={{ marginTop: spacing.sm }}>
          <ListItem
            title="默认休息时间"
            subtitle="完成一组后自动开始倒计时"
            rightSlot={
              <Text style={[typography.subtitle, { color: colors.textSecondary }]}>
                {formatRestSeconds(defaultRestSeconds)}
              </Text>
            }
            onPress={() => setRestSheetOpen(true)}
            divider
            accessibilityLabel={`默认休息时间，当前 ${defaultRestSeconds} 秒`}
            accessibilityHint="点击修改默认休息时间"
          />
          <ListItem
            title="震动反馈"
            subtitle="完成训练 / 计时器到点时震动"
            rightSlot={
              <Switch
                value={hapticsEnabled}
                onValueChange={handleChangeHaptics}
                trackColor={{ true: colors.primaryMuted, false: colors.divider }}
                thumbColor={hapticsEnabled ? colors.primary : colors.surface}
                accessibilityLabel="震动反馈开关"
                accessibilityHint={hapticsEnabled ? '当前已开启，点击关闭' : '当前已关闭，点击开启'}
              />
            }
            onPress={() => handleChangeHaptics(!hapticsEnabled)}
            accessibilityLabel={`震动反馈，当前${hapticsEnabled ? '已开启' : '已关闭'}`}
            accessibilityHint="点击切换震动反馈"
          />
        </Card>

        {/* ---------------------- 个人 ---------------------- */}
        <SectionHeader
          title="个人"
          colors={colors}
          typography={typography}
          spacing={spacing}
          topGap
        />

        <Card padding="sm" style={{ marginTop: spacing.sm }}>
          <ListItem
            title="用户名"
            subtitle="纯本地显示"
            rightSlot={
              <Text style={[typography.subtitle, { color: colors.textSecondary }]}>
                {username || '未设置'} ›
              </Text>
            }
            onPress={handleOpenUsername}
            accessibilityLabel={`用户名，当前 ${username || '未设置'}`}
            accessibilityHint="点击编辑用户名"
          />
        </Card>

        {/* ---------------------- 数据 ---------------------- */}
        <SectionHeader
          title="数据"
          colors={colors}
          typography={typography}
          spacing={spacing}
          topGap
        />

        <Card padding="sm" style={{ marginTop: spacing.sm }}>
          <ListItem
            title="数据导出"
            subtitle="导出 JSON / CSV（P2 占位）"
            rightSlot={
              <Text style={[typography.subtitle, { color: colors.textTertiary }]}>›</Text>
            }
            onPress={() => setExportDialogOpen(true)}
            divider
            accessibilityLabel="数据导出，暂未上线"
            accessibilityHint="点击查看导出占位说明"
          />
          <ListItem
            title="清除全部数据"
            subtitle="删除计划、历史、设置；重新种子动作库"
            onPress={() => setClearDialogOpen(true)}
            accessibilityLabel="清除全部数据，危险操作"
            accessibilityHint="点击将弹出二次确认对话框"
          />
        </Card>

        {/* ---------------------- 单位换算示例 ---------------------- */}
        <SectionHeader
          title="单位换算预览"
          colors={colors}
          typography={typography}
          spacing={spacing}
          topGap
        />
        <Card padding="md" style={{ marginTop: spacing.sm }}>
          <View style={{ gap: spacing.sm }}>
            <PreviewLine
              text={`示例：100 kg = ${kgToLb(100).toFixed(1)} lb`}
              colors={colors}
              typography={typography}
            />
            <PreviewLine
              text={`示例：100 lb = ${lbToKg(100).toFixed(1)} kg`}
              colors={colors}
              typography={typography}
            />
            <PreviewLine
              text={`当前显示格式：${formatWeight(100, unit)}`}
              colors={colors}
              typography={typography}
              muted
            />
          </View>
        </Card>
      </ScrollView>

      {/* ------------------- 休息时间 Sheet ------------------- */}
      <Sheet
        visible={restSheetOpen}
        onClose={() => setRestSheetOpen(false)}
        title="默认休息时间"
        maxHeightRatio={0.6}
      >
        <View style={{ gap: spacing.lg }}>
          <SegmentedControl
            value={String(defaultRestSeconds)}
            onChange={async (v) => {
              feedback();
              await setDefaultRest(Number(v));
              setRestSheetOpen(false);
            }}
            options={REST_PRESETS}
            fullWidth
            accessibilityLabel="预设休息时间"
          />
          <CustomRestField
            current={defaultRestSeconds}
            onCommit={async (s) => {
              feedback();
              await setDefaultRest(s);
              setRestSheetOpen(false);
            }}
          />
        </View>
      </Sheet>

      {/* ------------------- 用户名 Sheet ------------------- */}
      <Sheet
        visible={usernameSheetOpen}
        onClose={() => setUsernameSheetOpen(false)}
        title="编辑用户名"
        maxHeightRatio={0.4}
      >
        <View style={{ gap: spacing.md }}>
          <Input
            value={usernameDraft}
            onChangeText={setUsernameDraft}
            placeholder="请输入用户名"
            maxLength={20}
            autoFocus
            accessibilityLabel="用户名输入"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="保存用户名"
            accessibilityHint="保存并关闭抽屉"
            onPress={handleSaveUsername}
            hitSlop={8}
            style={({ pressed }) => ({
              alignSelf: 'flex-end',
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.sm,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text style={[typography.label, { color: colors.primary }]}>
              保存
            </Text>
          </Pressable>
        </View>
      </Sheet>

      {/* ------------------- 清除数据 Dialog ------------------- */}
      <Dialog
        visible={clearDialogOpen}
        variant="danger"
        title="清除全部数据？"
        message="所有训练计划、历史记录与自定义设置将被删除，内置动作库会重新初始化。此操作不可撤销。"
        confirmText="清除"
        cancelText="取消"
        onCancel={() => setClearDialogOpen(false)}
        onConfirm={handleClearAll}
      />

      {/* ------------------- 导出 Dialog ------------------- */}
      <Dialog
        visible={exportDialogOpen}
        title="数据导出"
        message="敬请期待 — 数据导出将在后续版本提供。"
        confirmText="好的"
        cancelText="关闭"
        onCancel={() => setExportDialogOpen(false)}
        onConfirm={() => setExportDialogOpen(false)}
      />
    </SafeAreaView>
  );
}

/* -------------------------------------------------------------------------- */
/* 子组件                                                                    */
/* -------------------------------------------------------------------------- */

function SectionHeader({
  title,
  colors,
  typography,
  spacing,
  topGap = false,
}: {
  title: string;
  colors: ReturnType<typeof useTheme>['colors'];
  typography: ReturnType<typeof useTheme>['typography'];
  spacing: ReturnType<typeof useTheme>['spacing'];
  topGap?: boolean;
}) {
  return (
    <Text
      accessibilityRole="header"
      style={[
        typography.label,
        {
          color: colors.textTertiary,
          marginTop: topGap ? spacing.xl : 0,
          marginBottom: spacing.sm,
          textTransform: 'uppercase',
        },
      ]}
    >
      {title}
    </Text>
  );
}

function FieldRow({
  label,
  children,
  colors,
  typography,
  spacing,
}: {
  label: string;
  children: React.ReactNode;
  colors: ReturnType<typeof useTheme>['colors'];
  typography: ReturnType<typeof useTheme>['typography'];
  spacing: ReturnType<typeof useTheme>['spacing'];
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text
        accessibilityRole="text"
        style={[typography.label, { color: colors.textSecondary }]}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

function Divider({ colors }: { colors: ReturnType<typeof useTheme>['colors'] }) {
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: colors.divider,
      }}
    />
  );
}

function PreviewLine({
  text,
  colors,
  typography,
  muted = false,
}: {
  text: string;
  colors: ReturnType<typeof useTheme>['colors'];
  typography: ReturnType<typeof useTheme>['typography'];
  muted?: boolean;
}) {
  return (
    <Text
      accessibilityRole="text"
      style={[
        typography.body,
        { color: muted ? colors.textTertiary : colors.text },
      ]}
    >
      {text}
    </Text>
  );
}

function CustomRestField({
  current,
  onCommit,
}: {
  current: number;
  onCommit: (seconds: number) => Promise<void>;
}) {
  const { spacing, typography, colors } = useTheme();
  const [text, setText] = useState('');
  const commit = async () => {
    const n = Math.round(Number(text));
    if (Number.isFinite(n) && n >= 15 && n <= 600) {
      feedback();
      await onCommit(n);
    }
    setText('');
  };
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={[typography.label, { color: colors.textSecondary }]}>
        自定义（当前 {current}s，范围 15–600）
      </Text>
      <Input
        value={text}
        onChangeText={setText}
        placeholder="例如 75"
        keyboardType="number-pad"
        accessibilityLabel="自定义休息时间（秒）"
        rightSlot={
          <Pressable
            onPress={commit}
            accessibilityRole="button"
            accessibilityLabel="设定自定义休息时间"
            hitSlop={8}
            style={({ pressed }) => ({
              paddingVertical: spacing.xs,
              paddingHorizontal: spacing.xs,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text style={[typography.label, { color: colors.primary }]}>
              设定
            </Text>
          </Pressable>
        }
      />
    </View>
  );
}

function formatRestSeconds(s: number): string {
  return `${s}s`;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});