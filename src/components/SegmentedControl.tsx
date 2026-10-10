/**
 * SegmentedControl — mutually-exclusive pill control.
 *
 * Used for short option sets (kg/lb, 30s/60s/90s, 浅色/深色/跟随系统).
 * Implementation notes:
 *
 *  - The "thumb" (highlight) is animated with Reanimated `useAnimatedStyle` so
 *    transitions between options feel smooth, especially when the count of
 *    options changes (light → dark reflow).
 *  - We measure each option once on first layout and cache the widths in a
 *    plain object — that gives us a stable thumb position without forcing
 *    the children to expose refs.
 *  - When `fullWidth` is set we let the row fill its parent; otherwise it
 *    sizes to its content.
 */

import React, { useCallback, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';
import { motion } from '@/theme/motion';

export interface SegmentedOption<T extends string> {
  label: string;
  value: T;
}

export interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (next: T) => void;
  options: ReadonlyArray<SegmentedOption<T>>;
  /** Stretch the control to fill its parent's width. */
  fullWidth?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** Screen-reader label for the whole control. */
  accessibilityLabel?: string;
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  fullWidth = false,
  disabled = false,
  style,
  testID,
  accessibilityLabel,
}: SegmentedControlProps<T>) {
  const { colors, typography, spacing, radius } = useTheme();
  const [widths, setWidths] = useState<number[]>([]);
  const thumbX = useSharedValue(0);

  // Update thumb position whenever the value or measured widths change.
  React.useEffect(() => {
    const idx = options.findIndex((o) => o.value === value);
    if (idx < 0) return;
    const offset = widths.slice(0, idx).reduce((a, b) => a + b, 0);
    if (Number.isFinite(offset)) {
      thumbX.value = withTiming(offset, { duration: motion.duration.fast });
    }
  }, [value, widths, options, thumbX]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: thumbX.value }],
  }));

  const onLayoutItem = useCallback(
    (idx: number) => (e: LayoutChangeEvent) => {
      const w = e.nativeEvent.layout.width;
      setWidths((prev) => {
        if (prev[idx] === w) return prev;
        const next = [...prev];
        next[idx] = w;
        return next;
      });
    },
    [],
  );

  return (
    <View
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="tablist"
      style={[
        styles.wrap,
        {
          backgroundColor: colors.surfaceMuted,
          borderRadius: radius.md,
          padding: 4,
          opacity: disabled ? 0.55 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        style,
      ]}
    >
      {/* Animated thumb — absolute, behind the options */}
      {widths.length === options.length ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.thumb,
            {
              width: widths[options.findIndex((o) => o.value === value)] ?? 0,
              backgroundColor: colors.surfaceElevated,
              borderRadius: radius.sm,
              ...shadowLite(colors.shadow),
            },
            thumbStyle,
          ]}
        />
      ) : null}

      {options.map((opt, idx) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active, disabled }}
            onPress={disabled ? undefined : () => onChange(opt.value)}
            onLayout={onLayoutItem(idx)}
            android_ripple={{ color: colors.primaryMuted, borderless: false }}
            style={[styles.option, { paddingHorizontal: spacing.md, paddingVertical: 6 }]}
          >
            <Text
              style={[
                typography.label,
                {
                  color: active ? colors.text : colors.textSecondary,
                  fontWeight: active ? '700' : '600',
                },
              ]}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function shadowLite(tint: string) {
  return {
    shadowColor: tint,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 1,
  };
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    position: 'relative',
  },
  thumb: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 36,
    zIndex: 1,
  },
});

/* -------------------------------------------------------------------------- */
/* Story                                                                     */
/* -------------------------------------------------------------------------- */
export function SegmentedControlStory() {
  const { spacing } = useTheme();
  const [unit, setUnit] = React.useState<'kg' | 'lb'>('kg');
  const [rest, setRest] = React.useState<'30' | '60' | '90'>('60');
  return (
    <View style={{ gap: spacing.md }}>
      <SegmentedControl
        value={unit}
        onChange={setUnit}
        options={[
          { label: 'kg', value: 'kg' },
          { label: 'lb', value: 'lb' },
        ]}
      />
      <SegmentedControl
        value={rest}
        onChange={setRest}
        options={[
          { label: '30s', value: '30' },
          { label: '60s', value: '60' },
          { label: '90s', value: '90' },
        ]}
        fullWidth
      />
    </View>
  );
}