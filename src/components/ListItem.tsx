/**
 * ListItem — generic row for menus / settings / history entries.
 *
 * Anatomy: [leftSlot] title / subtitle [rightSlot], with optional divider
 * underneath. Pressable when `onPress` is provided.
 */

import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/theme';
import { AppIcon } from './AppIcon';

export interface ListItemProps {
  title: string;
  subtitle?: string;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  onPress?: () => void;
  /** Show a 1-px divider below the row. Defaults to false. */
  divider?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** Optional override for the screen-reader label. */
  accessibilityLabel?: string;
  /** Optional hint announced by screen readers when the row is focused/activated. */
  accessibilityHint?: string;
}

export function ListItem({
  title,
  subtitle,
  leftSlot,
  rightSlot,
  onPress,
  divider = false,
  style,
  testID,
  accessibilityLabel,
  accessibilityHint,
}: ListItemProps) {
  const { colors, typography, spacing } = useTheme();

  const containerStyle: ViewStyle = {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.transparent,
    borderBottomWidth: divider ? StyleSheet.hairlineWidth : 0,
    borderBottomColor: divider ? colors.divider : colors.transparent,
  };

  const Body = (
    <>
      {leftSlot ? (
        <View style={[styles.left, { marginRight: spacing.md }]}>{leftSlot}</View>
      ) : null}
      <View style={styles.center}>
        <Text style={[typography.subtitle, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {rightSlot ? (
        <View style={[styles.right, { marginLeft: spacing.md }]}>{rightSlot}</View>
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityHint={accessibilityHint}
        onPress={onPress}
        android_ripple={{ color: colors.surfaceMuted }}
        style={({ pressed }) => [
          styles.row,
          containerStyle,
          { backgroundColor: pressed ? colors.surfaceMuted : colors.transparent },
          style,
        ]}
      >
        {Body}
      </Pressable>
    );
  }

  return (
    <View
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      style={[styles.row, containerStyle, style]}
    >
      {Body}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
  },
  left: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
  },
  right: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/* -------------------------------------------------------------------------- */
/* Story                                                                     */
/* -------------------------------------------------------------------------- */
export function ListItemStory() {
  const { spacing, colors } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <ListItem
        title="杠铃卧推"
        subtitle="胸 · 杠铃 · 上次 60kg × 8"
        leftSlot={<Avatar text="卧" />}
        rightSlot={<AppIcon name="chevron" size={18} color={colors.textTertiary} />}
        divider
        onPress={() => undefined}
      />
      <ListItem
        title="深蹲"
        subtitle="股四头 · 杠铃"
        leftSlot={<Avatar text="蹲" />}
        divider
      />
      <ListItem
        title="设置"
        leftSlot={<AppIcon name="settings" size={20} color={colors.primary} />}
        rightSlot={<AppIcon name="chevron" size={18} color={colors.textTertiary} />}
        onPress={() => undefined}
      />
    </View>
  );
}

function Avatar({ text }: { text: string }) {
  const { colors, radius } = useTheme();
  return (
    <View
      style={{
        width: 36,
        height: 36,
        borderRadius: radius.full,
        backgroundColor: colors.primaryMuted,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: colors.primary, fontWeight: '700' }}>{text}</Text>
    </View>
  );
}
