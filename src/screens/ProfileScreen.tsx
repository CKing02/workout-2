/**
 * ProfileScreen — 我的 Tab（G10 升级）。
 *
 * 布局：
 *  - 顶部：头像（可点，弹资料编辑抽屉）+ 用户名 + 编辑按钮
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

import { Avatar, Button, Card, Dialog, ListItem } from '@/components';
import { toast } from '@/hooks/useToast';
import { clearAllData } from '@/features/profile/clearAllData';
import { ProfileEditSheet } from '@/features/profile/ProfileEditSheet';
import type { RootStackParamList, TabParamList } from '@/navigation/types';
import { useAvatarStore } from '@/store/avatarStore';
import { useSettingsStore } from '@/store/settingsStore';
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
  const avatarUri = useAvatarStore((s) => s.uri);

  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // G14: 清库 + 头像文件 + GIF 缓存 + 4 个 store 的同步，全在
  // clearAllData 里（两个入口共用，避免这份收尾清单又被抄成两份）。
  const handleClearAll = async () => {
    setClearDialogOpen(false);
    await clearAllData();
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
        {/* ---------------------- 头像 + 用户名卡片 ---------------------- */}
        <Card padding="lg" elevated style={{ marginBottom: spacing.lg }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
            }}
          >
            {/* 头像本身可点 —— 比多一个隐形入口更好发现。用户名编辑仍走右边的「编辑」。 */}
            <Avatar
              uri={avatarUri}
              text={username}
              size={56}
              onPress={() => setProfileSheetOpen(true)}
              accessibilityLabel="更换头像"
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
              accessibilityLabel="编辑资料"
              accessibilityHint="弹出编辑头像与用户名的底部抽屉"
              onPress={() => setProfileSheetOpen(true)}
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
      {/* ---------------------- 资料编辑抽屉 ---------------------- */}
      <ProfileEditSheet
        visible={profileSheetOpen}
        onClose={() => setProfileSheetOpen(false)}
      />

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