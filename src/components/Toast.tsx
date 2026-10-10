/**
 * Toast — non-modal lightweight feedback.
 *
 * Renders at the top of the screen, just under the status bar, for
 * `durationMs` (default 2500 ms). Driven by the global Zustand store
 * in `@/hooks/useToast`.
 *
 * Why not a third-party lib (`react-native-toast-message`, etc.)? Two
 * reasons for G12:
 *  1. We want full control of variant tokens (light + dark, our exact
 *     green/amber/red/blue).
 *  2. We want zero new dependencies for the MVP ship.
 *
 * Animation: Reanimated fades + slides. The worklet runs entirely on
 * the UI thread so it stays smooth even while React is busy diffing.
 *
 * Mount this component **once** at the root (we do that in App.tsx).
 */

import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useToast, type ToastVariant } from '@/hooks/useToast';
import { useTheme } from '@/theme';
import { motion } from '@/theme/motion';

// 用 motion token (G47):入场给用户读时间,出场快一点让 toast 不挡事
const ENTER_DURATION = motion.duration.base;
const EXIT_DURATION = motion.duration.fast;

interface VariantStyle {
  /** Background fill (full opacity). */
  bg: string;
  /** Foreground text color on top of `bg`. */
  fg: string;
  /** Single-glyph icon rendered at the leading edge. */
  glyph: string;
  /** Hairline border tint (for dark mode). */
  border: string;
}

function resolveVariantStyle(
  variant: ToastVariant,
  colors: ReturnType<typeof useTheme>['colors'],
  scheme: 'light' | 'dark',
): VariantStyle {
  // Light mode uses saturated backgrounds; dark mode uses tinted
  // surface so the toast reads as an "elevated card" rather than a
  // pure-color slab (which is too jarring on near-black).
  if (scheme === 'dark') {
    switch (variant) {
      case 'success':
        return {
          bg: colors.surfaceElevated,
          fg: colors.success,
          glyph: '✓',
          border: colors.success,
        };
      case 'error':
        return {
          bg: colors.surfaceElevated,
          fg: colors.danger,
          glyph: '!',
          border: colors.danger,
        };
      case 'warning':
        return {
          bg: colors.surfaceElevated,
          fg: colors.warning,
          glyph: '⚠',
          border: colors.warning,
        };
      case 'info':
      default:
        return {
          bg: colors.surfaceElevated,
          fg: colors.info,
          glyph: 'i',
          border: colors.info,
        };
    }
  }
  switch (variant) {
    case 'success':
      return {
        bg: colors.success,
        fg: colors.onPrimary,
        glyph: '✓',
        border: colors.success,
      };
    case 'error':
      return {
        bg: colors.danger,
        fg: colors.onPrimary,
        glyph: '!',
        border: colors.danger,
      };
    case 'warning':
      return {
        bg: colors.warning,
        fg: colors.onPrimary,
        glyph: '⚠',
        border: colors.warning,
      };
    case 'info':
    default:
      return {
        bg: colors.info,
        fg: colors.onPrimary,
        glyph: 'i',
        border: colors.info,
      };
  }
}

export function Toast() {
  const { colors, scheme, typography, spacing, radius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const { state, dismiss } = useToast();

  // Drive the enter/exit from `visible` + `id` (id bumps on every new
  // toast so even a same-message replay animates fresh).
  const progress = useSharedValue(0);

  useEffect(() => {
    if (state.visible) {
      progress.value = withTiming(1, {
        duration: ENTER_DURATION,
        easing: motion.easing.standard,
      });
    } else {
      progress.value = withTiming(0, {
        duration: EXIT_DURATION,
        easing: motion.easing.standard,
      });
    }
  }, [state.visible, state.id, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const translateY = (1 - progress.value) * -32;
    const opacity = progress.value;
    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  const variantStyle = resolveVariantStyle(state.variant, colors, scheme);

  // Render the host View regardless of visibility so the exit animation
  // has a place to land. `pointerEvents="none"` when hidden prevents the
  // invisible toast from intercepting taps.
  return (
    <View
      pointerEvents={state.visible ? 'box-none' : 'none'}
      style={[
        StyleSheet.absoluteFill,
        styles.host,
        { top: insets.top + spacing.sm },
      ]}
      // G12 a11y: live region so VoiceOver / TalkBack read the new
      // message when it pops.
      accessibilityLiveRegion="polite"
      accessibilityViewIsModal
    >
      <Animated.View
        style={[
          styles.toast,
          {
            backgroundColor: variantStyle.bg,
            borderColor: variantStyle.border,
            borderRadius: radius.lg,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            marginHorizontal: spacing.lg,
            ...shadows.md,
          },
          animatedStyle,
        ]}
        accessibilityRole="alert"
      >
        <View
          style={[
            styles.glyphWrap,
            {
              backgroundColor:
                scheme === 'dark'
                  ? variantStyle.border + '22' // 13% tint
                  : 'rgba(255,255,255,0.22)',
              borderRadius: radius.full,
              marginRight: spacing.md,
            },
          ]}
        >
          <Text
            style={[
              styles.glyph,
              { color: variantStyle.fg, fontVariant: ['tabular-nums'] },
            ]}
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            {variantStyle.glyph}
          </Text>
        </View>

        <Text
          style={[
            typography.body,
            styles.message,
            { color: variantStyle.fg },
          ]}
          numberOfLines={3}
        >
          {state.message}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="关闭提示"
          onPress={() => dismiss()}
          hitSlop={12}
          style={({ pressed }) => [
            styles.closeBtn,
            { opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Text
            style={[
              styles.closeGlyph,
              { color: variantStyle.fg },
            ]}
          >
            ×
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

/**
 * Convenience wrapper for the manual-dismiss handler so it can be
 * passed straight to Reanimated callbacks without re-binding on every
 * render.
 */
export function useToastDismiss() {
  const { dismiss } = useToast();
  // Always forward the latest dismiss ref so callers don't need to
  // worry about stale closures.
  return dismiss;
}

const styles = StyleSheet.create({
  host: {
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  glyphWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    fontSize: 16,
    fontWeight: '700',
  },
  message: {
    flex: 1,
    fontWeight: '500',
  },
  closeBtn: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  closeGlyph: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 22,
  },
});
