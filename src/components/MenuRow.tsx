/**
 * MenuRow — 单行菜单项(Sheet 内 ⋯ 菜单通用)。
 *
 * 用法:在底部 Sheet 里列出若干动作(编辑/删除/替换等),每行一个 MenuRow。
 * 行为/视觉与 G24 系列 ⋯ 菜单保持一致。
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';

export interface MenuRowProps {
  label: string;
  hint?: string;
  onPress: () => void;
  /** 危险色(用于删除等不可逆操作)。 */
  danger?: boolean;
}

export function MenuRow({ label, hint, onPress, danger }: MenuRowProps) {
  const { spacing, colors, typography, radius } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        borderRadius: radius.md,
        backgroundColor: pressed
          ? colors.surfaceMuted
          : colors.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      })}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={[
            typography.body,
            { color: danger ? colors.danger : colors.text },
          ]}
        >
          {label}
        </Text>
        {hint ? (
          <Text
            style={[
              typography.caption,
              { color: colors.textTertiary, marginTop: 2 },
            ]}
          >
            {hint}
          </Text>
        ) : null}
      </View>
      <Text style={{ color: colors.textTertiary, fontSize: 18 }}>›</Text>
    </Pressable>
  );
}
