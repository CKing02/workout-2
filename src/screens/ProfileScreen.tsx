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
import type { RootStackParamList, TabParamList } from '@/navigation/types';
import { useSettingsStore } from '@/store/settingsStore';
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

  const handleClearAll = () => {
    setClearDialogOpen(false);
    // G10 范围：清空逻辑留待后续接入 SQLite DROP 之后实现，此处占位反馈。
    // G12: 改成非阻断 toast。
    toast.show('已清除（演示）', 'success');
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