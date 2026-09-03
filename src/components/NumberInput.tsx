/**
 * NumberInput — numeric stepper.
 *
 * Built on top of `Input` for consistent styling, but with three guarantees
 * specific to a numeric field:
 *
 *  1. **Filter** — letters, punctuation and excess dots are stripped on every
 *     keystroke so the user can never type "abc" or "1.2.3".
 *  2. **Range**  — `min` / `max` clamp the *committed* value when stepping or
 *     when the user blurs with an out-of-range value.
 *  3. **Precision** — `precision` (default 0) restricts fractional digits.
 *
 * The field reports numbers via `onChangeValue` so the caller can store them
 * directly. Internal text state is kept so partial typing like "" or "."
 * doesn't break the field mid-edit.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/theme';

export interface NumberInputProps {
  value: number;
  onChangeValue: (next: number) => void;
  /** Amount added/subtracted by the +/- buttons. Defaults to 1. */
  step?: number;
  min?: number;
  max?: number;
  /** Number of allowed decimal digits. Defaults to 0 (integers only). */
  precision?: number;
  /** Small label rendered above the field, e.g. "重量 (kg)". */
  label?: string;
  /** Inline unit shown on the right side, e.g. "kg". */
  unitLabel?: string;
  /** Custom suffix node rendered after the value (overrides `unitLabel`). */
  suffix?: React.ReactNode;
  /** Disable +/- and typing. */
  disabled?: boolean;
  /** Override the outer wrapper style. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

function toFixed(n: number, precision: number): string {
  if (!Number.isFinite(n)) return '';
  // Avoid the rounding foot-gun of `toFixed` by formatting with the desired
  // precision directly. For integers, return the integer part cleanly.
  if (precision === 0) return String(Math.round(n));
  const factor = 10 ** precision;
  return (Math.round(n * factor) / factor).toFixed(precision);
}

function sanitize(input: string, precision: number): string {
  if (input === '') return '';
  // Strip everything that is not a digit or `.` / `-`.
  let cleaned = input.replace(/[^0-9.]/g, '');
  // Keep only the first dot.
  const firstDot = cleaned.indexOf('.');
  if (firstDot !== -1) {
    cleaned =
      cleaned.slice(0, firstDot + 1) +
      cleaned.slice(firstDot + 1).replace(/\./g, '');
  }
  // Limit fractional digits.
  if (precision === 0 && cleaned.includes('.')) {
    cleaned = cleaned.split('.')[0];
  } else if (precision > 0 && cleaned.includes('.')) {
    const [intPart, fracPart = ''] = cleaned.split('.');
    cleaned = intPart + '.' + fracPart.slice(0, precision);
  }
  // Reject leading zeros like "001" -> "1" (allow "0", "0.x", ".x").
  if (cleaned.length > 1 && cleaned.startsWith('0') && !cleaned.startsWith('0.')) {
    cleaned = cleaned.replace(/^0+/, '') || '0';
  }
  return cleaned;
}

function clamp(n: number, min?: number, max?: number): number {
  let out = n;
  if (typeof min === 'number' && out < min) out = min;
  if (typeof max === 'number' && out > max) out = max;
  return out;
}

export function NumberInput({
  value,
  onChangeValue,
  step = 1,
  min,
  max,
  precision = 0,
  label,
  unitLabel,
  suffix,
  disabled = false,
  style,
  testID,
}: NumberInputProps) {
  const { colors, typography, spacing, radius } = useTheme();
  const [text, setText] = useState<string>(toFixed(value, precision));

  // Sync external value -> internal text when the parent changes the value.
  useEffect(() => {
    setText(toFixed(value, precision));
    // We intentionally don't include `text` here to avoid feedback loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, precision]);

  const commit = useCallback(
    (next: string) => {
      setText(next);
      if (next === '' || next === '.' || next === '-') {
        // Allow transient empty state but don't propagate an invalid number.
        return;
      }
      const parsed = Number(next);
      if (!Number.isFinite(parsed)) return;
      const bounded = clamp(parsed, min, max);
      // Only fire onChangeValue if the bounded result differs from current.
      if (bounded !== value) onChangeValue(bounded);
    },
    [min, max, onChangeValue, value],
  );

  const adjust = useCallback(
    (delta: number) => {
      if (disabled) return;
      const next = clamp(value + delta, min, max);
      onChangeValue(next);
    },
    [disabled, max, min, onChangeValue, value],
  );

  const dec = () => adjust(-step);
  const inc = () => adjust(step);

  const buttonColor = (pressed: boolean) => ({
    backgroundColor: pressed ? colors.surface : colors.surfaceMuted,
  });

  return (
    <View style={[{ gap: spacing.xs, opacity: disabled ? 0.55 : 1 }, style]}>
      {label ? (
        <Text style={[typography.label, { color: colors.textSecondary }]}>{label}</Text>
      ) : null}
      <View
        style={[
          styles.wrap,
          {
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            borderColor: colors.border,
            borderWidth: StyleSheet.hairlineWidth,
            paddingHorizontal: spacing.xs,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="decrement"
          onPress={dec}
          disabled={disabled}
          android_ripple={{ color: colors.primaryMuted, borderless: false }}
          style={({ pressed }) => [
            styles.btn,
            { borderRadius: radius.sm },
            buttonColor(pressed),
          ]}
        >
          <Text style={[typography.title, { color: colors.text }]}>−</Text>
        </Pressable>

        <View style={styles.valueWrap}>
          <Text
            style={[typography.h3, { color: colors.text }]}
            numberOfLines={1}
            onPress={undefined}
            // Render via a transparent TextInput sibling for true editing:
            testID={testID}
            accessibilityLabel={`${label ?? 'value'} ${text}${unitLabel ?? ''}`}
          >
            {text}
          </Text>
          {/* Hidden editable text input — tap the value to edit, +/- to step. */}
          <TextFieldOverlay
            value={text}
            onChange={(t) => commit(sanitize(t, precision))}
            onBlur={() => commit(sanitize(text, precision))}
            disabled={disabled}
            placeholder={toFixed(value, precision)}
            testID={testID}
          />
          {suffix != null || unitLabel ? (
            <View style={{ marginLeft: 4 }}>
              {suffix != null ? (
                typeof suffix === 'string' || typeof suffix === 'number' ? (
                  <Text style={[typography.caption, { color: colors.textTertiary }]}>
                    {suffix}
                  </Text>
                ) : (
                  suffix
                )
              ) : unitLabel ? (
                <Text style={[typography.caption, { color: colors.textTertiary }]}>
                  {unitLabel}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="increment"
          onPress={inc}
          disabled={disabled}
          android_ripple={{ color: colors.primaryMuted, borderless: false }}
          style={({ pressed }) => [
            styles.btn,
            { borderRadius: radius.sm },
            buttonColor(pressed),
          ]}
        >
          <Text style={[typography.title, { color: colors.text }]}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * A borderless TextInput layered over the static label. Tapping the value
 * brings up the system keyboard; on blur we sanitize & commit.
 */
function TextFieldOverlay({
  value,
  onChange,
  onBlur,
  disabled,
  placeholder,
  testID,
}: {
  value: string;
  onChange: (t: string) => void;
  onBlur: () => void;
  disabled: boolean;
  placeholder: string;
  testID?: string;
}) {
  const { colors, typography } = useTheme();
  return (
    <View style={StyleSheet.absoluteFill}>
      <TextInput
        testID={testID}
        editable={!disabled}
        value={value}
        onChangeText={onChange}
        onBlur={onBlur}
        keyboardType={value.includes('.') ? 'decimal-pad' : 'numeric'}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        style={[
          StyleSheet.absoluteFill,
          styles.overlay,
          typography.h3,
          { color: colors.transparent },
        ]}
        // Selection is fine; caret would be invisible because color is transparent.
        selectionColor={colors.transparent}
        accessible
        accessibilityRole="adjustable"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 44,
  },
  btn: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    textAlign: 'center',
  },
});

/* -------------------------------------------------------------------------- */
/* Story                                                                     */
/* -------------------------------------------------------------------------- */
export function NumberInputStory() {
  const { spacing, colors } = useTheme();
  const [weight, setWeight] = React.useState(60);
  const [reps, setReps] = React.useState(8);
  const [body, setBody] = React.useState(72.5);

  return (
    <View style={{ gap: spacing.md }}>
      <NumberInput
        label="重量"
        unitLabel="kg"
        value={weight}
        onChangeValue={setWeight}
        min={0}
        max={500}
        step={2.5}
        precision={1}
      />
      <NumberInput label="次数" value={reps} onChangeValue={setReps} min={1} max={50} />
      <NumberInput
        label="体重"
        unitLabel="kg"
        value={body}
        onChangeValue={setBody}
        min={20}
        max={250}
        step={0.1}
        precision={1}
      />
      <Text style={{ color: colors.textSecondary }}>
        Try typing "abc" — should be filtered. Pressing +/- on "重量" steps by 2.5.
      </Text>
    </View>
  );
}