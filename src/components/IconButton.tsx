/**
 * IconButton — square pressable that renders only an icon.
 *
 * Used in toolbars (close ×, add +, settings ⚙) where horizontal space is
 * tight and a label would add noise. Always pass `accessibilityLabel` so
 * screen readers know what the button does.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import type { ButtonSize, ButtonVariant } from './Button';

export interface IconButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Icon glyph / element rendered in the center. */
  icon: React.ReactNode;
  onPress?: () => void;
  /** Required for accessibility — describes the action, not the icon. */
  accessibilityLabel: string;
  /** Optional secondary announcement for screen readers. */
  accessibilityHint?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const BOX: Record<ButtonSize, number> = {
  sm: 32,
  md: 40,
  lg: 48,
};

export function IconButton({
  variant = 'ghost',
  size = 'md',
  icon,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  disabled = false,
  style,
  testID,
}: IconButtonProps) {
  const { colors, radius } = useTheme();
  const box = BOX[size];

  let background = colors.transparent;
  let pressedBackground = colors.surfaceMuted;
  let foreground = colors.text;

  switch (variant) {
    case 'primary':
      background = colors.primary;
      pressedBackground = colors.primaryPressed;
      foreground = colors.onPrimary;
      break;
    case 'secondary':
      background = colors.surfaceMuted;
      pressedBackground = colors.surface;
      foreground = colors.text;
      break;
    case 'ghost':
      background = colors.transparent;
      pressedBackground = colors.surfaceMuted;
      foreground = colors.primary;
      break;
    case 'danger':
      background = colors.danger;
      pressedBackground = colors.danger;
      foreground = colors.onPrimary;
      break;
  }

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      onPress={disabled ? undefined : onPress}
      android_ripple={{
        color:
          variant === 'ghost' || variant === 'secondary'
            ? colors.primaryMuted
            : 'rgba(255,255,255,0.18)',
        borderless: true,
        radius: box / 2,
      }}
      style={({ pressed }) => [
        styles.base,
        {
          width: box,
          height: box,
          borderRadius: radius.full,
          backgroundColor: pressed ? pressedBackground : background,
          borderWidth: variant === 'ghost' ? StyleSheet.hairlineWidth : 0,
          borderColor: variant === 'ghost' ? colors.border : colors.transparent,
          opacity: disabled ? 0.45 : 1,
        },
        style,
      ]}
    >
      <View style={styles.inner}>
        {typeof icon === 'string' ? (
          // G27: ▶ / ◀ / ▲ / ▼ 的视觉形状 ≠ 字符 typographic box：
          //   1) 不设 lineHeight 时 Text 盒子 = fontSize × 1.2，glyph 在盒子上半，
          //      整体偏上
          //   2) ▶ 字形视觉重心在 typographic box 左侧（base 在左、apex 在右），
          //      居中后视觉三角形偏左
          // 修法：lineHeight 显式 = fontSize 让盒子无 descender padding；
          //       ▶/◀/▲/▼ 时再 marginLeft 右移补偿字形偏左。
          <Text
            style={{
              color: foreground,
              fontSize: box * 0.45,
              fontWeight: '700',
              lineHeight: box * 0.45,
              ...(icon === '▶' || icon === '◀' || icon === '▲' || icon === '▼'
                ? { marginLeft: box * 0.08 }
                : null),
            }}
          >
            {icon}
          </Text>
        ) : (
          icon
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/* -------------------------------------------------------------------------- */
/* Story                                                                     */
/* -------------------------------------------------------------------------- */
export function IconButtonStory() {
  const { spacing } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
      <IconButton accessibilityLabel="close" icon="×" variant="ghost" />
      <IconButton accessibilityLabel="add" icon="+" variant="primary" />
      <IconButton accessibilityLabel="delete" icon="🗑" variant="danger" />
      <IconButton accessibilityLabel="settings" icon="⚙" variant="secondary" size="lg" />
      <IconButton accessibilityLabel="disabled" icon="•" disabled />
    </View>
  );
}