/**
 * ProfileScreen — “我的”Tab。
 *
 * 视觉层级：个人资料 → 高频训练工具 → 数据管理 → 危险操作。
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

import { AppIcon, Avatar, Card, Dialog, type AppIconName } from '@/components';
import { clearAllData } from '@/features/profile/clearAllData';
import { ProfileEditSheet } from '@/features/profile/ProfileEditSheet';
import { toast } from '@/hooks/useToast';
import type { RootStackParamList, TabParamList } from '@/navigation/types';
import { useAvatarStore } from '@/store/avatarStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme';
import { getAppVersion } from '@/utils/appVersion';
import { exportBackup } from '@/utils/exportData';
import { haptic } from '@/utils/haptics';

type ProfileNav = BottomTabScreenProps<TabParamList, 'Profile'>['navigation'] &
  Pick<RootStackParamList, never>;

interface ProfileScreenProps {
  navigation?: ProfileNav;
}

export function ProfileScreen({ navigation }: ProfileScreenProps) {
  const { colors, typography, spacing, radius } = useTheme();
  const { width } = useWindowDimensions();
  const contentWidth = Math.max(0, Math.min(width - spacing.lg * 2, 640));
  const appVersion = getAppVersion();
  const username = useSettingsStore((state) => state.username);
  const avatarUri = useAvatarStore((state) => state.uri);

  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleClearAll = async () => {
    setClearDialogOpen(false);
    await clearAllData();
  };

  const handleGoSettings = () => {
    (
      navigation as
        | { navigate: (screen: 'Settings') => void }
        | undefined
    )?.navigate('Settings');
  };

  const handleGoDataOverview = () => {
    (
      navigation as
        | { navigate: (screen: 'DataOverview') => void }
        | undefined
    )?.navigate('DataOverview');
  };

  const handleGoExerciseLibrary = () => {
    (
      navigation as
        | {
            navigate: (
              screen: 'ExerciseLibrary',
              params: { title: string; mode: 'browse' },
            ) => void;
          }
        | undefined
    )?.navigate('ExerciseLibrary', { title: '动作库', mode: 'browse' });
  };

  const handleGoBodyMeasurement = () => {
    (
      navigation as
        | { navigate: (screen: 'BodyMeasurement') => void }
        | undefined
    )?.navigate('BodyMeasurement');
  };

  const handleExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    toast.show('正在导出…', 'info');
    try {
      const { fileName } = await exportBackup();
      toast.show(`已导出：${fileName}`, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.show(`导出失败：${message}`, 'error');
    } finally {
      setExporting(false);
    }
  }, [exporting]);

  const openProfileEditor = () => setProfileSheetOpen(true);

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={['bottom']}
    >
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.xxxxl,
          alignItems: 'center',
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ width: contentWidth }}>
          <Card
            padding="lg"
            elevated
            style={{ borderColor: colors.primaryMuted }}
          >
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: radius.full,
                backgroundColor: colors.primary,
                marginBottom: spacing.lg,
              }}
            />
            <View style={styles.profileRow}>
              <View
                style={{
                  padding: 3,
                  borderRadius: radius.full,
                  backgroundColor: colors.primaryMuted,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: colors.primary,
                }}
              >
                <Avatar
                  uri={avatarUri}
                  text={username}
                  size={66}
                  onPress={openProfileEditor}
                  accessibilityLabel="更换头像"
                />
              </View>

              <View
                style={[styles.profileCopy, { marginLeft: spacing.lg }]}
              >
                <Text
                  style={[typography.label, { color: colors.primary }]}
                >
                  训练者档案
                </Text>
                <Text
                  accessibilityRole="header"
                  style={[
                    typography.h2,
                    {
                      color: username ? colors.text : colors.textSecondary,
                      marginTop: spacing.xs,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {username || '设置你的昵称'}
                </Text>
                <Text
                  style={[
                    typography.bodySmall,
                    { color: colors.textSecondary, marginTop: spacing.xs },
                  ]}
                  numberOfLines={2}
                >
                  管理训练数据、身体记录与应用偏好
                </Text>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="编辑个人资料"
              accessibilityHint="编辑头像与用户名"
              onPress={openProfileEditor}
              style={({ pressed }) => ({
                minHeight: 44,
                marginTop: spacing.lg,
                paddingHorizontal: spacing.md,
                borderRadius: radius.md,
                backgroundColor: pressed
                  ? colors.primary
                  : colors.primaryMuted,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: spacing.xs,
              })}
            >
              {({ pressed }) => (
                <>
                  <AppIcon
                    name="edit"
                    size={16}
                    color={pressed ? colors.onPrimary : colors.primaryPressed}
                  />
                  <Text
                    style={[
                      typography.label,
                      {
                        color: pressed
                          ? colors.onPrimary
                          : colors.primaryPressed,
                      },
                    ]}
                  >
                    编辑个人资料
                  </Text>
                </>
              )}
            </Pressable>
          </Card>

          <ProfileSectionHeader title="训练与数据" subtitle="快速进入常用工具" />
          <View style={[styles.quickGrid, { gap: spacing.md }]}>
            <QuickActionTile
              icon="chart"
              title="数据中心"
              subtitle="训练趋势与表现"
              onPress={handleGoDataOverview}
              accessibilityHint="打开训练数据总览"
            />
            <QuickActionTile
              icon="scale"
              title="身体测量"
              subtitle="体重与体脂趋势"
              onPress={handleGoBodyMeasurement}
              accessibilityHint="打开身体测量记录"
            />
            <QuickActionTile
              icon="dumbbell"
              title="动作库"
              subtitle="按肌群与器械浏览"
              onPress={handleGoExerciseLibrary}
              accessibilityHint="打开动作库浏览页"
            />
            <QuickActionTile
              icon="settings"
              title="设置"
              subtitle="主题、单位与休息"
              onPress={handleGoSettings}
              accessibilityHint="打开应用设置"
            />
          </View>

          <ProfileSectionHeader title="数据管理" subtitle="备份和迁移训练记录" />
          <Card padding="sm">
            <ProfileActionRow
              icon="export"
              title="导出训练数据"
              subtitle="生成 JSON 备份并通过系统分享"
              onPress={() => {
                haptic.selection();
                void handleExport();
              }}
              loading={exporting}
              disabled={exporting}
              accessibilityHint="导出全部训练数据并打开系统分享面板"
            />
          </Card>

          <ProfileSectionHeader title="危险操作" subtitle="删除后无法恢复" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="清除全部数据"
            accessibilityHint="打开二次确认对话框"
            onPress={() => setClearDialogOpen(true)}
            android_ripple={{ color: colors.surfaceMuted, borderless: false }}
            style={({ pressed }) => ({
              minHeight: 64,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: radius.lg,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.border,
              backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
            })}
          >
            <IconBadge name="trash" color={colors.danger} muted />
            <View style={{ flex: 1 }}>
              <Text
                style={[typography.title, { color: colors.danger }]}
              >
                清除全部数据
              </Text>
              <Text
                style={[
                  typography.caption,
                  { color: colors.textTertiary, marginTop: spacing.xs },
                ]}
              >
                永久删除训练计划、历史记录与自定义设置
              </Text>
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`锻炼2点零，版本 ${appVersion}。长按进入组件 Showcase。`}
            accessibilityHint="开发者调试入口"
            delayLongPress={600}
            onLongPress={() => {
              (
                navigation as
                  | { navigate: (screen: 'Showcase') => void }
                  | undefined
              )?.navigate('Showcase');
            }}
            style={({ pressed }) => ({
              minHeight: 48,
              marginTop: spacing.xl,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text
              style={[
                typography.caption,
                { color: colors.textTertiary, textAlign: 'center' },
              ]}
            >
              锻炼2点零 · v{appVersion}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <ProfileEditSheet
        visible={profileSheetOpen}
        onClose={() => setProfileSheetOpen(false)}
      />

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

function ProfileSectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  const { colors, typography, spacing } = useTheme();
  return (
    <View
      style={{
        marginTop: spacing.xl,
        marginBottom: spacing.sm,
        paddingHorizontal: spacing.xs,
      }}
    >
      <Text accessibilityRole="header" style={[typography.h3, { color: colors.text }]}>
        {title}
      </Text>
      <Text
        style={[
          typography.bodySmall,
          { color: colors.textSecondary, marginTop: spacing.xs },
        ]}
      >
        {subtitle}
      </Text>
    </View>
  );
}

interface QuickActionTileProps {
  icon: AppIconName;
  title: string;
  subtitle: string;
  onPress: () => void;
  accessibilityHint: string;
}

function QuickActionTile({
  icon,
  title,
  subtitle,
  onPress,
  accessibilityHint,
}: QuickActionTileProps) {
  const { colors, typography, spacing, radius } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      android_ripple={{ color: colors.primaryMuted, borderless: false }}
      style={({ pressed }) => ({
        flexBasis: 148,
        flexGrow: 1,
        minWidth: 0,
        minHeight: 116,
        padding: spacing.md,
        borderRadius: radius.lg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: pressed ? colors.primary : colors.border,
        backgroundColor: pressed ? colors.primaryMuted : colors.surfaceElevated,
      })}
    >
      <View style={styles.tileTopRow}>
        <IconBadge name={icon} />
        <AppIcon name="chevron" size={18} color={colors.textTertiary} />
      </View>
      <Text
        style={[
          typography.title,
          { color: colors.text, marginTop: spacing.md },
        ]}
      >
        {title}
      </Text>
      <Text
        style={[
          typography.caption,
          { color: colors.textSecondary, marginTop: spacing.xs },
        ]}
        numberOfLines={2}
      >
        {subtitle}
      </Text>
    </Pressable>
  );
}

interface ProfileActionRowProps {
  icon: AppIconName;
  title: string;
  subtitle: string;
  onPress: () => void;
  accessibilityHint: string;
  disabled?: boolean;
  loading?: boolean;
}

function ProfileActionRow({
  icon,
  title,
  subtitle,
  onPress,
  accessibilityHint,
  disabled = false,
  loading = false,
}: ProfileActionRowProps) {
  const { colors, typography, spacing, radius } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={loading ? `${title}，正在处理` : title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, busy: loading }}
      disabled={disabled}
      onPress={onPress}
      android_ripple={{ color: colors.primaryMuted, borderless: false }}
      style={({ pressed }) => ({
        minHeight: 68,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        borderRadius: radius.md,
        backgroundColor: pressed ? colors.surfaceMuted : colors.transparent,
        opacity: disabled ? 0.55 : 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
      })}
    >
      <IconBadge name={icon} />
      <View style={{ flex: 1 }}>
        <Text style={[typography.title, { color: colors.text }]}>{title}</Text>
        <Text
          style={[
            typography.caption,
            { color: colors.textSecondary, marginTop: spacing.xs },
          ]}
          numberOfLines={2}
        >
          {subtitle}
        </Text>
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <AppIcon name="chevron" size={18} color={colors.textTertiary} />
      )}
    </Pressable>
  );
}

function IconBadge({
  name,
  color,
  muted = false,
}: {
  name: AppIconName;
  color?: string;
  muted?: boolean;
}) {
  const { colors, radius } = useTheme();
  return (
    <View
      accessible={false}
      style={{
        width: 40,
        height: 40,
        borderRadius: radius.md,
        backgroundColor: muted ? colors.surfaceMuted : colors.primaryMuted,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <AppIcon name={name} size={22} color={color ?? colors.primaryPressed} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileCopy: {
    flex: 1,
    minWidth: 0,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
