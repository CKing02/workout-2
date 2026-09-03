/**
 * Button — primary interactive primitive.
 *
 * Variants:
 *  - `primary`  : filled brand color (default CTA)
 *  - `secondary`: subtle surface fill, neutral
 *  - `ghost`    : borderless, transparent until pressed
 *  - `danger`   : filled danger color (destructive)
 *
 * Sizes map directly onto the spacing scale (sm/md/lg).
 *
 * Design constraints:
 *  - No hard-coded colors — every color reads from `useTheme()`.
 *  - Disabled state dims the surface (lower opacity, no color swap) to keep
 *    hierarchy recognizable.
 *  - Loading state replaces the label with a small spinner; the button is
 *    still `accessibilityRole="button"` so screen readers announce it.
 */

import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** When true, shows a spinner and blocks presses. */
  loading?: boolean;
  disabled?: boolean;
  /** Optional glyph rendered before the label. */
  icon?: React.ReactNode;
  onPress?: () => void;
  children: React.ReactNode;
  /** Override or extend the outer wrapper style (e.g. `flex: 1` to fill row). */
  style?: StyleProp<ViewStyle>;
  /** Used when this button represents a destructive action; purely semantic. */
  accessibilityLabel?: string;
  /** Optional secondary announcement for screen readers (e.g. "双击删除"). */
  accessibilityHint?: string;
  testID?: string;
}

interface SizeTokens {
  paddingVertical: number;
  paddingHorizontal: number;
  fontSize: number;
  lineHeight: number;
  height: number;
}

const SIZE_TOKENS: Record<ButtonSize, SizeTokens> = {
  sm: { paddingVertical: 6, paddingHorizontal: 12, fontSize: 13, lineHeight: 18, height: 32 },
  md: { paddingVertical: 10, paddingHorizontal: 16, fontSize: 15, lineHeight: 22, height: 44 },
  lg: { paddingVertical: 14, paddingHorizontal: 20, fontSize: 16, lineHeight: 22, height: 52 },
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  onPress,
  children,
  style,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const { colors, typography, radius } = useTheme();
  const tokens = SIZE_TOKENS[size];
  const isInert = disabled || loading;

  // Resolve background / foreground colors for the variant.
  let background: string = colors.transparent;
  let pressedBackground: string = colors.transparent;
  let foreground: string = colors.text;

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
      accessibilityState={{ disabled: isInert, busy: loading }}
      accessibilityLabel={accessibilityLabel ?? (typeof children === 'string' ? children : undefined)}
      accessibilityHint={accessibilityHint}
      onPress={isInert ? undefined : onPress}
      android_ripple={
        variant === 'ghost' || variant === 'secondary'
          ? { color: colors.primaryMuted, borderless: false }
          : { color: 'rgba(255,255,255,0.18)', borderless: false }
      }
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: pressed ? pressedBackground : background,
          borderRadius: radius.md,
          paddingVertical: tokens.paddingVertical,
          paddingHorizontal: tokens.paddingHorizontal,
          minHeight: tokens.height,
          borderWidth: variant === 'ghost' ? StyleSheet.hairlineWidth : 0,
          borderColor: variant === 'ghost' ? colors.border : colors.transparent,
          opacity: disabled ? 0.45 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={foreground} />
      ) : (
        <View style={styles.content}>
          {icon ? (
            <View style={styles.icon}>
              {typeof icon === 'string' || typeof icon === 'number' ? (
                <Text
                  style={[
                    typography.label,
                    {
                      color: foreground,
                      fontSize: tokens.fontSize,
                      lineHeight: tokens.lineHeight,
                    },
                  ]}
                >
                  {icon}
                </Text>
              ) : (
                icon
              )}
            </View>
          ) : null}
          {typeof children === 'string' || typeof children === 'number' ? (
            <Text
              style={[
                typography.label,
              { color: foreground, fontSize: tokens.fontSize, lineHeight: tokens.lineHeight },
              ]}
              numberOfLines={1}
            >
              {children}
            </Text>
          ) : (
            children
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 6,
  },
});

/* -------------------------------------------------------------------------- */
/* Story — exercises every variant × size and loading/disabled states.       */
/* -------------------------------------------------------------------------- */
export function ButtonStory() {
  const { spacing, colors } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        <Button variant="primary" size="sm">Small</Button>
        <Button variant="primary" size="md">Medium</Button>
        <Button variant="primary" size="lg">Large</Button>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button loading variant="primary">Loading</Button>
        <Button disabled variant="primary">Disabled</Button>
        <Button variant="primary" icon={<Text style={{ color: colors.onPrimary }}>●</Text>}>
          With icon
        </Button>
      </View>
    </View>
  );
}