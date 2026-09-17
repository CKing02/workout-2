/**
 * ProfileScreen — 我的 Tab（G10 升级）。
 *
 * 布局：
 *  - 顶部：用户名（来自 settingsStore.username）+ 编辑按钮（弹 Sheet）
 *  - 中部：3 个 ListItem 入口（设置 / 动作库占位 / 数据导出占位）
 *  - 底部：版本号 + 清除全部数据按钮（二次确认 → 占位行为）
 */

import React, { useCallback, useState } from 'react';
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
import { exportBackup } from '@/utils/exportData';
import { haptic } from '@/utils/haptics';

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
  const [exporting, setExporting] = useState(false);
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

  const handleGoDataOverview = () => {
    (navigation as unknown as { navigate: (s: 'DataOverview') => void } | undefined)?.navigate(
      'DataOverview',
    );
  };

  const handleGoExerciseLibrary = () => {
    // G26: 进入动作库浏览模式（不进入选择态、不显示 ☑/完成 切换）。
    (navigation as unknown as {
      navigate: (s: 'ExerciseLibrary', p: { title: string; mode: 'browse' }) => void;
    } | undefined)?.navigate('ExerciseLibrary', { title: '动作库', mode: 'browse' });
  };

  // US-12 — 身体测量（体重 + 体脂）。
  const handleGoBodyMeasurement = () => {
    (navigation as unknown as { navigate: (s: 'BodyMeasurement') => void } | undefined)?.navigate(
      'BodyMeasurement',
    );
  };

  // G19: 真实导出 —— 全表读 → 写文件 → 弹分享面板。
  // 数据导出不像清除那么不可逆，无二次确认；失败时 toast 错误并保留页面。
  const handleExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    toast.show('正在导出…', 'info');
    try {
      const { fileName } = await exportBackup();
      toast.show(`已导出：${fileName}`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.show(`导出失败：${msg}`, 'error');
    } finally {
      setExporting(false);
    }
  }, [exporting]);

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
            onPress={handleGoExerciseLibrary}
            divider
            accessibilityLabel="动作库入口"
            accessibilityHint="打开动作库浏览页"
          />
          <ListItem
            title="数据"
            subtitle="热力图 / 训练量 / 肌群分布 / 1RM"
            leftSlot={<Glyph text="📊" colors={colors} spacing={spacing} />}
            rightSlot={<Chevron colors={colors} typography={typography} />}
            onPress={handleGoDataOverview}
            divider
            accessibilityLabel="数据可视化"
            accessibilityHint="打开数据可视化总览页"
          />
          <ListItem
            title="数据导出"
            subtitle="导出全部训练数据为 JSON"
            leftSlot={<Glyph text="↗" colors={colors} spacing={spacing} />}
            rightSlot={<Chevron colors={colors} typography={typography} />}
            onPress={() => {
              haptic.selection();
              void handleExport();
            }}
            divider
            accessibilityLabel="数据导出"
            accessibilityHint="把所有训练数据导出为 JSON 文件，弹出系统分享面板"
          />
          {/* US-12 — 身体测量（体重 + 体脂）。 */}
          <ListItem
            title="身体测量"
            subtitle="体重 / 体脂记录与趋势"
            leftSlot={<Glyph text="⚖" colors={colors} spacing={spacing} />}
            rightSlot={<Chevron colors={colors} typography={typography} />}
            onPress={handleGoBodyMeasurement}
            accessibilityLabel="身体测量"
            accessibilityHint="打开身体测量记录与趋势页"
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