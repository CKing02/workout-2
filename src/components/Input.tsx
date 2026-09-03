/**
 * Input — single-line text field with label / error / helper support.
 *
 * Wraps React Native's `TextInput` with consistent theme styling. Validation
 * states:
 *  - default: border = `colors.border`
 *  - focus:   border = `colors.primary`
 *  - error:   border = `colors.danger`, helper text shown in danger color
 *
 * The native placeholder respects the active color scheme automatically
 * because we set `placeholderTextColor` from `colors.textTertiary`.
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/theme';

export interface InputProps
  extends Omit<TextInputProps, 'style' | 'placeholderTextColor' | 'value' | 'onChangeText'> {
  label?: string;
  value: string;
  onChangeText: (next: string) => void;
  error?: string;
  helperText?: string;
  /** Override the default keyboard. */
  keyboardType?: KeyboardTypeOptions;
  autoFocus?: boolean;
  /** Optional element rendered on the right edge (e.g. unit suffix, eye toggle). */
  rightSlot?: React.ReactNode;
  /** Optional element rendered on the left edge (e.g. icon, currency symbol). */
  leftSlot?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Input({
  label,
  value,
  onChangeText,
  error,
  helperText,
  keyboardType,
  autoFocus,
  rightSlot,
  leftSlot,
  containerStyle,
  testID,
  ...rest
}: InputProps) {
  const { colors, typography, spacing, radius } = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? colors.danger
    : focused
    ? colors.primary
    : colors.border;

  return (
    <View style={[{ gap: spacing.xs }, containerStyle]}>
      {label ? (
        <Text style={[typography.label, { color: colors.textSecondary }]}>{label}</Text>
      ) : null}
      <View
        style={[
          styles.fieldWrap,
          {
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            borderColor,
            borderWidth: StyleSheet.hairlineWidth,
            paddingHorizontal: spacing.md,
          },
        ]}
      >
        {leftSlot ? (
          <View style={[styles.slot, { marginRight: spacing.xs }]}>{leftSlot}</View>
        ) : null}
        <TextInput
          testID={testID}
          autoFocus={autoFocus}
          value={value}
          onChangeText={onChangeText}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          keyboardType={keyboardType}
          placeholderTextColor={colors.textTertiary}
          style={[
            styles.input,
            typography.body,
            { color: colors.text },
          ]}
          {...rest}
        />
        {rightSlot ? (
          <View style={[styles.slot, { marginLeft: spacing.xs }]}>{rightSlot}</View>
        ) : null}
      </View>
      {error ? (
        <Text style={[typography.caption, { color: colors.danger }]}>{error}</Text>
      ) : helperText ? (
        <Text style={[typography.caption, { color: colors.textTertiary }]}>{helperText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fieldWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
  },
  slot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/* -------------------------------------------------------------------------- */
/* Story                                                                     */
/* -------------------------------------------------------------------------- */
export function InputStory() {
  const { spacing, colors } = useTheme();
  const [v1, setV1] = React.useState('');
  const [v2, setV2] = React.useState('卧推 60kg');
  const [v3, setV3] = React.useState('');
  return (
    <View style={{ gap: spacing.md }}>
      <Input label="动作名称" value={v1} onChangeText={setV1} placeholder="例如：杠铃卧推" />
      <Input label="带初始值" value={v2} onChangeText={setV2} />
      <Input
        label="错误状态"
        value={v3}
        onChangeText={setV3}
        error="数量必须大于 0"
        keyboardType="numeric"
      />
      <Input
        label="带右侧插槽"
        value="kg"
        onChangeText={() => undefined}
        rightSlot={<Text style={{ color: colors.textSecondary }}>kg</Text>}
        editable={false}
      />
    </View>
  );
}