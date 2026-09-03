/**
 * ProfileScreen — 我的 Tab（G10 升级）。
 *
 * 布局：
 *  - 顶部：用户名（来自 settingsStore.username）+ 编辑按钮（弹 Sheet）
 *  - 中部：3 个 ListItem 入口（设置 / 动作库占位 / 数据导出占位）
 *  - 底部：版本号 + 清除全部数据按钮（二次确认 → 占位行为）
 */

import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Dialog } from '@/components/Dialog';
import { Input } from '@/components/Input';
import { ListItem } from '@/components/ListItem';
import { Sheet } from '@/components/Sheet';
import { toast } from '@/hooks/useToast';
import { wipeAllData } from '@/db';
import type { RootStackParamList, TabParamList } from '@/navigation/types';
import { useExerciseStore } from '@/store/exerciseStore';
import { usePlanStore } from '@/store/planStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTrainingStore } from '@/store/trainingStore';
import { useTheme } from '@/theme';

const APP_VERSION = '0.1.0';

type ProfileNav = BottomTabScreenProps<TabParamList, 'Profile'>['navigation'] &
  Pick<RootStackParamList, never>;

interface ProfileScreenProps {
  navigation?: ProfileNav;
}

export function ProfileScreen({ navigation }: ProfileScreenProps) {
  const { colors, typography, spacing } = useTheme();
  const username = useSettingsStore((s) => s.username);

  const [usernameSheetOpen, setUsernameSheetOpen] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exerciseLibDialogOpen, setExerciseLibDialogOpen] = useState(false);
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

  const handleClearAll = async () => {
    setClearDialogOpen(false);
    // G14: 真正接入 SQLite — 事务内清 7 张表，再 reseed 内置动作。
    // settings 表被清后 settingsStore 需 reload，否则内存保留旧值。
    try {
      await wipeAllData();
      await Promise.all([
        useExerciseStore.getState().reload(),
        usePlanStore.getState().reload(),
        useTrainingStore.getState().loadHistory(),
        useSettingsStore.getState().load(),
      ]);
      // 保险：如果用户清数据时内存里恰好有 active training，DB 已经
      // 没了，内存必须跟上；UX 上这种入口（Profile/Settings）触达不到
      // ActiveTrainingScreen，但兜底总比脏数据好。
      useTrainingStore.getState().cancelTraining();
      toast.show('已清除全部数据', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.show('清除失败：' + msg, 'error');
    }
  };

  const handleGoSettings = () => {
    // 从 Tab 跳到 Stack 屏：navigation 实际类型是 CompositeNavigationProp，
    // 这里只需要知道存在 navigate 方法，TS 上做一次宽松断言。
    (navigation as unknown as { navigate: (s: 'Settings') => void } | undefined)?.navigate(
      'Settings',
    );
  };

  const handleGoDiagnostics = () => {
    (navigation as unknown as { navigate: (s: 'Diagnostics') => void } | undefined)?.navigate(
      'Diagnostics',
    );
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
        {/* ---------------------- 用户名卡片 ---------------------- */}
        <Card padding="lg" elevated style={{ marginBottom: spacing.lg }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
            }}
          >
            <Avatar
              text={username ? username.charAt(0).toUpperCase() : '·'}
              colors={colors}
              spacing={spacing}
            />
            <View style={{ flex: 1 }}>
              <Text style={[typography.label, { color: colors.textTertiary }]}>训练者</Text>
              <Text
                style={[
                  typography.h2,
                  { color: username ? colors.text : colors.textTertiary, marginTop: 2 },
                ]}
                numberOfLines={1}
              >
                {username || '未设置'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="编辑用户名"
              accessibilityHint="弹出编辑用户名的底部抽屉"
              onPress={handleOpenUsername}
              hitSlop={8}
              style={({ pressed }) => ({
                paddingVertical: spacing.xs,
                paddingHorizontal: spacing.xs,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text
                style={[typography.label, { color: colors.primary }]}
              >
                编辑
              </Text>
            </Pressable>
          </View>
        </Card>

        {/* ---------------------- 入口列表 ---------------------- */}
        <Card padding="sm">
          <ListItem
            title="设置"
            subtitle="主题 / 单位 / 休息时间 / 数据"
            leftSlot={<Glyph text="⚙" colors={colors} spacing={spacing} />}
            rightSlot={<Chevron colors={colors} typography={typography} />}
            onPress={handleGoSettings}
            divider
            accessibilityLabel="设置"
            accessibilityHint="打开设置页"
          />
          <ListItem
            title="动作库"
            subtitle="按肌群 / 器械浏览"
            leftSlot={<Glyph text="●" colors={colors} spacing={spacing} />}
            rightSlot={<Chevron colors={colors} typography={typography} />}
            onPress={() => setExerciseLibDialogOpen(true)}
            divider
            accessibilityLabel="动作库入口"
            accessibilityHint="点击查看动作库说明"
          />
          <ListItem
            title="诊断"
            subtitle="查看应用错误日志"
            leftSlot={<Glyph text="🩺" colors={colors} spacing={spacing} />}
            rightSlot={<Chevron colors={colors} typography={typography} />}
            onPress={handleGoDiagnostics}
            divider
            accessibilityLabel="诊断"
            accessibilityHint="查看应用错误日志,便于排查问题"
          />
          <ListItem
            title="数据导出"
            subtitle="P2 占位"
            leftSlot={<Glyph text="↗" colors={colors} spacing={spacing} />}
            rightSlot={<Chevron colors={colors} typography={typography} />}
            onPress={() => setExportDialogOpen(true)}
            accessibilityLabel="数据导出，暂未上线"
          />
        </Card>

        {/* ---------------------- 底部操作 ---------------------- */}
        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          <Button
            variant="danger"
            onPress={() => setClearDialogOpen(true)}
            style={{ alignSelf: 'stretch' }}
          >
            清除全部数据
          </Button>
          <Text
            onPress={() => {
              // G20: 长按 → 进入组件 Showcase（开发期自检页）。
              // 隐藏入口：普通用户不会发现，开发者通过版本号进入。
              (navigation as unknown as { navigate: (s: 'Showcase') => void } | undefined)?.navigate(
                'Showcase',
              );
            }}
            accessibilityLabel={`锻炼2点零，版本 ${APP_VERSION}。长按进入组件 Showcase。`}
            accessibilityRole="button"
            style={[
              typography.caption,
              { color: colors.textTertiary, textAlign: 'center' },
            ]}
          >
            锻炼2点零 · v{APP_VERSION}
          </Text>
        </View>
      </ScrollView>

      {/* ---------------------- 用户名 Sheet ---------------------- */}
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
              paddingVertical: spacing.xs,
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

      {/* ---------------------- Dialogs ---------------------- */}
      <Dialog
        visible={clearDialogOpen}
        variant="danger"
        title="清除全部数据？"
        message="所有训练计划、历史记录与自定义设置将被删除，内置动作库会重新初始化。此操作不可撤销。"
        confirmText="清除"
        onCancel={() => setClearDialogOpen(false)}
        onConfirm={handleClearAll}
      />
      <Dialog
        visible={exportDialogOpen}
        title="数据导出"
        message="敬请期待 — 数据导出将在后续版本提供。"
        confirmText="好的"
        cancelText="关闭"
        onCancel={() => setExportDialogOpen(false)}
        onConfirm={() => setExportDialogOpen(false)}
      />
      <Dialog
        visible={exerciseLibDialogOpen}
        title="动作库"
        message={'可通过"锻炼" Tab → "添加动作" 进入动作库。'}
        confirmText="好的"
        cancelText="关闭"
        onCancel={() => setExerciseLibDialogOpen(false)}
        onConfirm={() => setExerciseLibDialogOpen(false)}
      />
    </SafeAreaView>
  );
}

/* -------------------------------------------------------------------------- */
/* 子组件                                                                    */
/* -------------------------------------------------------------------------- */

function Avatar({
  text,
  colors,
  spacing,
}: {
  text: string;
  colors: ReturnType<typeof useTheme>['colors'];
  spacing: ReturnType<typeof useTheme>['spacing'];
}) {
  return (
    <View
      style={{
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.primaryMuted,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.xs,
      }}
    >
      <Text style={{ color: colors.primary, fontSize: 24, fontWeight: '700' }}>
        {text}
      </Text>
    </View>
  );
}

function Glyph({
  text,
  colors,
  spacing,
}: {
  text: string;
  colors: ReturnType<typeof useTheme>['colors'];
  spacing: ReturnType<typeof useTheme>['spacing'];
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
        marginRight: spacing.xs,
      }}
    >
      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
        {text}
      </Text>
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