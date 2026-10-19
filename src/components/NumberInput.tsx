/**
 * NumberInput — single-line numeric text field.
 *
 * Behavior guarantees:
 *
 *  1. **Filter** — letters, punctuation and excess dots are stripped on every
 *     keystroke so the user can never type "abc" or "1.2.3".
 *  2. **Range**  — `min` / `max` clamp the *committed* value on blur or
 *     submit. Mid-typing is allowed to go outside the range so the user can
 *     keep editing without being yanked back.
 *  3. **Precision** — `precision` (default 0) restricts fractional digits.
 *  4. **Empty fallback** — if the user blurs/submits an empty value, we
 *     fall back to `min` (or 0 when `min` is unset). The parent never sees
 *     `NaN` or `undefined`.
 *  5. **Visual containment** — the value text never escapes the input box.
 *     Unit / suffix is absolutely positioned on the right; `paddingRight`
 *     reserves room so the text caret and value never overlap the unit.
 *     The input wrapper has `overflow: hidden` as a hard ceiling: even if
 *     the user types a very long string (e.g. past max), the visible text
 *     is clipped at the right edge instead of spilling over the border.
 *  6. **Prefill treated as hint** — when `value === min` (the typical
 *     "unset" sentinel, e.g. a freshly added set has `weight: 0, reps: 0`
 *     with `min: 0`), the input renders as empty and shows the placeholder
 *     instead. This keeps a default `0` / `0.0` from sitting in the field
 *     where the user has to delete it before typing a real value. Once the
 *     user types anything, the field switches to the committed-value
 *     presentation.
 *
 * The component used to ship with built-in +/- stepper buttons. Those were
 * removed because (a) the numeric area was cramped when the value grew in
 * digit count, causing the text to overlap the unit, and (b) the stepper
 * interaction fought the keyboard. If rapid adjustment is needed, callers
 * can layer their own buttons in a sibling row.
 *
 * Note: business bounds (max 500 for weight, max 3600 for duration, etc.)
 * keep the value within 4 digits in practice, so auto-shrinking the font
 * isn't worth the implementation cost here — the overflow:hidden ceiling
 * is enough of a safety net.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
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
  /** Lower bound for the committed value. Empty input falls back to this. */
  min?: number;
  /** Upper bound for the committed value. */
  max?: number;
  /** Number of allowed decimal digits. Defaults to 0 (integers only). */
  precision?: number;
  /** Small label rendered above the field, e.g. "重量". */
  label?: string;
  /** Inline unit shown on the right side, e.g. "kg". */
  unitLabel?: string;
  /** Custom suffix node rendered after the value (overrides `unitLabel`). */
  suffix?: React.ReactNode;
  /** Disable typing. */
  disabled?: boolean;
  /** Override the outer wrapper style. */
  style?: StyleProp<ViewStyle>;
  /** Override the input field container style. */
  inputStyle?: StyleProp<ViewStyle>;
  /** Optional placeholder. Defaults to `toFixed(min ?? 0, precision)`. */
  placeholder?: string;
  /** Optional error message — renders below the field with a red border. */
  error?: string;
  testID?: string;
  /** BL-004: called when the underlying TextInput gains focus. Useful for
   * scrolling the parent ScrollView so the input stays above the keyboard.
   * Fires AFTER the built-in select-all-on-focus logic so callers can rely
   * on text content already being selected when their handler runs. */
  onFocus?: () => void;
}

/** Reserved width on the right edge of the input for the unit label. */
const UNIT_AREA_WIDTH = 48;

function toFixed(n: number, precision: number): string {
  if (!Number.isFinite(n)) return '';
  if (precision === 0) return String(Math.round(n));
  const factor = 10 ** precision;
  return (Math.round(n * factor) / factor).toFixed(precision);
}

function sanitize(input: string, precision: number): string {
  if (input === '') return '';
  // Strip everything that is not a digit or `.`.
  let cleaned = input.replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot !== -1) {
    cleaned =
      cleaned.slice(0, firstDot + 1) +
      cleaned.slice(firstDot + 1).replace(/\./g, '');
  }
  if (precision === 0 && cleaned.includes('.')) {
    cleaned = cleaned.split('.')[0];
  } else if (precision > 0 && cleaned.includes('.')) {
    const [intPart, fracPart = ''] = cleaned.split('.');
    cleaned = intPart + '.' + fracPart.slice(0, precision);
  }
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
  min,
  max,
  precision = 0,
  label,
  unitLabel,
  suffix,
  disabled = false,
  style,
  inputStyle,
  placeholder,
  error,
  testID,
  onFocus,
}: NumberInputProps) {
  const { colors, typography, spacing, radius } = useTheme();
  const defaultPlaceholder = toFixed(typeof min === 'number' ? min : 0, precision);

  // "Prefill" state: when the value sits at `min` (the conventional unset
  // sentinel, e.g. a brand-new set has weight:0 / reps:0 with min:0), we
  // treat it as a hint rather than a committed value — render an empty
  // field and show the placeholder instead. This stops a default `0` /
  // `0.0` from sitting in the field where the user has to fight it before
  // typing. The moment they type anything, the field flips to the
  // committed presentation.
  const isPrefill = value === min;
  const [text, setText] = useState<string>(
    isPrefill ? '' : toFixed(value, precision),
  );
  // Marks the next sync pass to be skipped — set right before the
  // user's own onChangeText / finalize calls, because the resulting
  // `value` change from `onChangeValue` would otherwise re-format and
  // clobber the text the user just typed.
  const skipNextSyncRef = useRef(false);

  // Ref to the underlying TextInput — used by `handleFocus` to select
  // the entire committed value on focus, so the user can type a new
  // number to overwrite without first deleting the old one. (The
  // platform-native `selectTextOnFocus` prop only works on the FIRST
  // focus on Android; we want cross-platform consistency across
  // subsequent focuses too — hence the explicit ref-based selection.)
  const inputRef = useRef<TextInput>(null);

  const handleFocus = useCallback(() => {
    // BL-004: notify caller first so a parent ScrollView can start
    // measuring/scrolling on the focus event itself.
    onFocus?.();
    if (isPrefill) return;
    if (text.length === 0) return;
    // RN setSelection takes positional (start, end), not an object.
    inputRef.current?.setSelection?.(0, text.length);
  }, [isPrefill, text.length, onFocus]);

  // Sync external value -> internal text when the parent changes the
  // value *outside* of the user's typing flow. The skip flag above keeps
  // the round-trip from `onChangeText -> onChangeValue -> parent rerender
  // -> value update -> useEffect` from wiping the user's in-progress edit.
  useEffect(() => {
    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      return;
    }
    setText(isPrefill ? '' : toFixed(value, precision));
    // We intentionally don't include `text` here to avoid feedback loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, precision, isPrefill]);

  // While typing: keep the raw string the user is producing, but only
  // propagate to the parent when the parsed number is finite. We never
  // propagate "" or "." — those transient states stay local until
  // blur/submit, at which point `finalize` falls back to `min`.
  // Mid-typing is allowed to go out of range; clamping happens on commit.
  const onChangeText = useCallback(
    (next: string) => {
      skipNextSyncRef.current = true;
      const cleaned = sanitize(next, precision);
      setText(cleaned);
      if (cleaned === '' || cleaned === '.' || cleaned === '-') return;
      const parsed = Number(cleaned);
      if (!Number.isFinite(parsed)) return;
      if (parsed !== value) onChangeValue(parsed);
    },
    [precision, value, onChangeValue],
  );

  // On blur / submit: settle to a final, in-range, finite value.
  const finalize = useCallback(() => {
    skipNextSyncRef.current = true;
    const cleaned = sanitize(text, precision);
    // CASE 1: user left the field empty. Fall back to `min`. If that
    // fallback lands on the prefill sentinel (fallback === min), keep
    // the field visually empty so the placeholder stays visible — the
    // user confirmed "no value here" rather than typing a real zero.
    if (cleaned === '' || cleaned === '.' || cleaned === '-') {
      const fallback = typeof min === 'number' ? min : 0;
      setText(fallback === min ? '' : toFixed(fallback, precision));
      onChangeValue(fallback);
      return;
    }
    // CASE 2: user typed something finite but unparseable (shouldn't
    // happen after sanitize, but guarded anyway). Fall back like CASE 1.
    const parsed = Number(cleaned);
    if (!Number.isFinite(parsed)) {
      const fallback = typeof min === 'number' ? min : 0;
      setText(fallback === min ? '' : toFixed(fallback, precision));
      onChangeValue(fallback);
      return;
    }
    // CASE 3: user typed a real, finite value. Keep it visible even if it
    // happens to equal `min` — that's a deliberate "0" / "0.0" entry,
    // not the unset sentinel. Distinct from CASE 1.
    const bounded = clamp(parsed, min, max);
    const formatted = toFixed(bounded, precision);
    setText(formatted);
    if (bounded !== value) onChangeValue(bounded);
  }, [text, precision, min, max, value, onChangeValue]);

  const hasUnit = suffix != null || unitLabel != null;
  const borderColor = error ? colors.danger : colors.border;
  const unitText = suffix != null ? suffix : unitLabel;

  return (
    <View style={[{ gap: spacing.xs, opacity: disabled ? 0.55 : 1 }, style]}>
      {label ? (
        <Text style={[typography.label, { color: colors.textSecondary }]}>
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.inputWrap,
          {
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            borderColor,
            borderWidth: StyleSheet.hairlineWidth,
            paddingHorizontal: spacing.md,
          },
          inputStyle,
        ]}
      >
        <TextInput
          ref={inputRef}
          testID={testID}
          editable={!disabled}
          value={text}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={finalize}
          onSubmitEditing={finalize}
          keyboardType={precision > 0 ? 'decimal-pad' : 'number-pad'}
          returnKeyType="done"
          blurOnSubmit
          placeholder={placeholder ?? defaultPlaceholder}
          placeholderTextColor={colors.textTertiary}
          numberOfLines={1}
          style={[
            typography.h3,
            {
              color: colors.text,
              paddingVertical: spacing.sm,
              // Reserve room on the right for the unit/suffix so the text
              // caret and value never overlap it.
              paddingRight: hasUnit ? UNIT_AREA_WIDTH : 0,
              minHeight: 40,
              textAlign: 'left',
              // Reset Android's default font scaling surprises.
              includeFontPadding: false,
            },
          ]}
          accessibilityLabel={`${label ?? 'value'} ${text}${unitLabel ?? ''}`}
        />
        {/* Unit / suffix is laid over the right edge via absolute positioning
            so the value text can never run underneath it. `pointerEvents="none"`
            keeps the unit from intercepting taps meant for the TextInput.
            `accessibilityElementsHidden` hides it from screen readers (the
            value's accessibilityLabel already carries the unit string). */}
        {hasUnit ? (
          <View
            style={[
              styles.unitArea,
              { right: spacing.md, width: UNIT_AREA_WIDTH - spacing.md },
            ]}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            {typeof unitText === 'string' || typeof unitText === 'number' ? (
              <Text style={[typography.caption, { color: colors.textTertiary }]}>
                {unitText}
              </Text>
            ) : (
              unitText
            )}
          </View>
        ) : null}
      </View>
      {error ? (
        <Text style={[typography.caption, { color: colors.danger }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    // Hard ceiling: value text is clipped at the right edge instead of
    // spilling over the border, even if a user types a very long string.
    overflow: 'hidden',
  },
  unitArea: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
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
        precision={1}
      />
      <NumberInput
        label="错误态"
        unitLabel="kg"
        value={weight}
        onChangeValue={setWeight}
        min={0}
        max={500}
        precision={1}
        error="重量必须在 0–500 之间"
      />
      <Text style={{ color: colors.textSecondary }}>
        Try typing "abc" — filtered. Blur empty falls back to min. Past max
        values are clipped at the right edge (overflow:hidden), so the
        unit label never collides with the value.
      </Text>
    </View>
  );
}
