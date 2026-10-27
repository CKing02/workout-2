/** Compact profile and application tools. */
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

import { AppIcon, Avatar, Card, type AppIconName } from '@/components';
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

export function ProfileScreen({ navigation }: { navigation?: ProfileNav }) {
  const { colors, typography, spacing, radius } = useTheme();
  const { width } = useWindowDimensions();
  const username = useSettingsStore((state) => state.username);
  const avatarUri = useAvatarStore((state) => state.uri);
  const appVersion = getAppVersion();
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    toast.show('正在导出…', 'info');
    try {
      const { fileName } = await exportBackup();
      toast.show(`已导出：${fileName}`, 'success');
    } catch (error) {
      toast.show(`导出失败：${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally {
      setExporting(false);
    }
  }, [exporting]);

  const go = (screen: 'Settings' | 'DataOverview' | 'BodyMeasurement' | 'Showcase') => {
    (navigation as unknown as { navigate: (name: string) => void } | undefined)?.navigate(screen);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxxxl, alignItems: 'center' }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ width: Math.max(0, Math.min(width - spacing.lg * 2, 640)) }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="编辑个人资料"
            accessibilityHint="编辑头像与用户名"
            onPress={() => setProfileSheetOpen(true)}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', padding: spacing.lg,
              borderRadius: radius.lg, backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
            })}
          >
            <Avatar uri={avatarUri} text={username} size={56} />
            <View style={{ flex: 1, minWidth: 0, marginLeft: spacing.md }}>
              <Text accessibilityRole="header" numberOfLines={1} style={[typography.h3, { color: colors.text }]}>
                {username || '设置昵称'}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xs }]}>
                编辑个人资料
              </Text>
            </View>
            <AppIcon name="chevron" size={18} color={colors.textTertiary} />
          </Pressable>

          <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
            <Card padding="sm">
              <ProfileRow icon="chart" title="数据中心" onPress={() => go('DataOverview')} divider />
              <ProfileRow icon="scale" title="身体测量" onPress={() => go('BodyMeasurement')} divider />
              <ProfileRow icon="dumbbell" title="动作库" onPress={() => {
                (navigation as unknown as { navigate: (name: string, params: { title: string; mode: 'browse' }) => void } | undefined)
                  ?.navigate('ExerciseLibrary', { title: '动作库', mode: 'browse' });
              }} divider />
              <ProfileRow icon="settings" title="设置" onPress={() => go('Settings')} />
            </Card>
            <Card padding="sm">
              <ProfileRow icon="export" title="导出训练数据" loading={exporting} onPress={() => {
                haptic.selection();
                void handleExport();
              }} />
            </Card>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`锻炼2点零，版本 ${appVersion}。长按进入组件 Showcase。`}
            accessibilityHint="开发者调试入口"
            delayLongPress={600}
            onLongPress={() => go('Showcase')}
            style={({ pressed }) => ({ minHeight: 48, marginTop: spacing.lg, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
          >
            <Text style={[typography.caption, { color: colors.textTertiary }]}>锻炼2点零 · v{appVersion}</Text>
          </Pressable>
        </View>
      </ScrollView>

      <ProfileEditSheet visible={profileSheetOpen} onClose={() => setProfileSheetOpen(false)} />
    </SafeAreaView>
  );
}

function ProfileRow({ icon, title, onPress, divider = false, danger = false, loading = false }: {
  icon: AppIconName; title: string; onPress: () => void; divider?: boolean; danger?: boolean; loading?: boolean;
}) {
  const { colors, typography, spacing, radius } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={loading ? `${title}，正在处理` : title}
      accessibilityHint={danger ? '打开二次确认对话框' : undefined}
      accessibilityState={{ disabled: loading, busy: loading }}
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 52, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center',
        gap: spacing.md, borderRadius: radius.sm,
        borderBottomWidth: divider ? StyleSheet.hairlineWidth : 0,
        borderBottomColor: colors.divider,
        backgroundColor: pressed ? colors.surfaceMuted : colors.transparent,
        opacity: loading ? 0.55 : 1,
      })}
    >
      <AppIcon name={icon} size={21} color={danger ? colors.danger : colors.primaryPressed} />
      <Text style={[typography.body, { flex: 1, color: danger ? colors.danger : colors.text }]}>{title}</Text>
      {loading ? <ActivityIndicator size="small" color={colors.primary} /> : <AppIcon name="chevron" size={18} color={colors.textTertiary} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({ safe: { flex: 1 } });
