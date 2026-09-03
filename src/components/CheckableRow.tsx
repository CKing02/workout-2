/**
 * CheckableRow — a row with a leading checkbox + a label/subtitle, used to
 * mark sets done in G6 and to drive multi-select pickers in G4.
 *
 * Tap anywhere on the row to toggle. The checkbox itself is a decorative
 * rounded square — the *real* hit area is the whole row, so it's easy to
 * hit during a workout.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

export interface CheckableRowProps {
  checked: boolean;
  onToggle: (next: boolean) => void;
  title: string;
  subtitle?: string;
  leftSlot?: React.ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function CheckableRow({
  checked,
  onToggle,
  title,
  subtitle,
  leftSlot,
  disabled = false,
  style,
  testID,
}: CheckableRowProps) {
  const { colors, typography, spacing, radius } = useTheme();

  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      onPress={disabled ? undefined : () => onToggle(!checked)}
      android_ripple={{ color: colors.primaryMuted }}
      style={({ pressed }) => [
        styles.row,
        {
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          backgroundColor: pressed ? colors.surfaceMuted : colors.background,
          opacity: disabled ? 0.55 : 1,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.box,
          {
            backgroundColor: checked ? colors.primary : colors.transparent,
            borderColor: checked ? colors.primary : colors.border,
            borderRadius: radius.xs,
            marginRight: spacing.md,
          },
        ]}
      >
        {checked ? <Text style={styles.tick}>✓</Text> : null}
      </View>
      {leftSlot ? <View style={{ marginRight: spacing.sm }}>{leftSlot}</View> : null}
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
  },
  box: {
    width: 22,
    height: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tick: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
    lineHeight: 16,
  },
  center: {
    flex: 1,
  },
});

/* -------------------------------------------------------------------------- */
/* Story                                                                     */
/* -------------------------------------------------------------------------- */
export function CheckableRowStory() {
  const { spacing, colors } = useTheme();
  const [items, setItems] = React.useState([
    { id: 'a', title: '热身组 50% × 12', subtitle: '5 分钟前', checked: true },
    { id: 'b', title: '正式组 60kg × 8', subtitle: '刚刚', checked: false },
    { id: 'c', title: '递减组 50kg × 10', subtitle: '待完成', checked: false, disabled: true },
  ]);
  return (
    <View style={{ gap: spacing.xs }}>
      {items.map((it) => (
        <CheckableRow
          key={it.id}
          title={it.title}
          subtitle={it.subtitle}
          checked={it.checked}
          disabled={'disabled' in it && Boolean((it as { disabled?: boolean }).disabled)}
          leftSlot={
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 999,
                backgroundColor: colors.primaryMuted,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: colors.primaryPressed, fontWeight: '700' }}>
                {it.title[0]}
              </Text>
            </View>
          }
          onToggle={(next) =>
            setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, checked: next } : p)))
          }
        />
      ))}
    </View>
  );
}