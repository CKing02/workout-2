/**
 * Badge — a small chip used for tags ("热身", "力竭"), categories ("胸"),
 * counters ("3 组"), etc. Six variants map onto theme tokens; colors are
 * muted-but-readable so they don't dominate a screen full of chips.
 */

import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

export type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  style?: StyleProp<ViewStyle>;
}

interface VariantTokens {
  bg: string;
  fg: string;
}

export function Badge({ label, variant = 'default', size = 'md', style }: BadgeProps) {
  const { colors, typography, radius } = useTheme();

  const tokens: VariantTokens = (() => {
    switch (variant) {
      case 'primary':
        return { bg: colors.primaryMuted, fg: colors.primaryPressed };
      case 'success':
        return { bg: withAlpha(colors.success, 0.15), fg: colors.success };
      case 'warning':
        return { bg: withAlpha(colors.warning, 0.18), fg: colors.warning };
      case 'danger':
        return { bg: withAlpha(colors.danger, 0.15), fg: colors.danger };
      case 'info':
        return { bg: withAlpha(colors.info, 0.15), fg: colors.info };
      default:
        return { bg: colors.surfaceMuted, fg: colors.textSecondary };
    }
  })();

  const padding = size === 'sm' ? { px: 8, py: 2, font: 11 } : { px: 10, py: 4, font: 13 };

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: tokens.bg,
          borderRadius: radius.full,
          paddingHorizontal: padding.px,
          paddingVertical: padding.py,
        },
        style,
      ]}
    >
      <Text
        style={[
          size === 'sm' ? typography.caption : typography.label,
          { color: tokens.fg, fontSize: padding.font },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

/**
 * Convert `#RRGGBB` to an `rgba(...)` string with the supplied alpha. We
 * avoid depending on any color library by parsing the hex inline.
 */
function withAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return hex;
  const v = parseInt(m[1], 16);
  const r = (v >> 16) & 255;
  const g = (v >> 8) & 255;
  const b = v & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
  },
});

/* -------------------------------------------------------------------------- */
/* Story                                                                     */
/* -------------------------------------------------------------------------- */
export function BadgeStory() {
  const { spacing } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
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
  );
}