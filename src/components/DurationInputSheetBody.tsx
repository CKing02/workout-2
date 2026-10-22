import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { NumberInput } from '@/components/NumberInput';
import { useTheme } from '@/theme';
import {
  DURATION_UNITS,
  MAX_DURATION_SECONDS,
  durationValueToSeconds,
  formatSetDuration,
  inferDurationUnit,
  secondsToDurationValue,
  type DurationUnit,
} from '@/utils/duration';
import { haptic } from '@/utils/haptics';

interface DurationInputSheetBodyProps {
  currentSeconds: number | null | undefined;
  onCommit: (seconds: number) => void;
  submitLabel?: string;
}

export function DurationInputSheetBody({
  currentSeconds,
  onCommit,
  submitLabel = '保存',
}: DurationInputSheetBodyProps) {
  const { colors, spacing, typography, radius } = useTheme();
  const [unit, setUnit] = useState<DurationUnit>(() =>
    inferDurationUnit(currentSeconds),
  );
  const [value, setValue] = useState(() =>
    secondsToDurationValue(currentSeconds, inferDurationUnit(currentSeconds)),
  );

  useEffect(() => {
    const nextUnit = inferDurationUnit(currentSeconds);
    setUnit(nextUnit);
    setValue(secondsToDurationValue(currentSeconds, nextUnit));
  }, [currentSeconds]);

  const seconds = useMemo(
    () => durationValueToSeconds(value, unit),
    [unit, value],
  );
  const unitMeta = DURATION_UNITS.find((item) => item.value === unit)!;

  const selectUnit = (nextUnit: DurationUnit) => {
    const canonicalSeconds = durationValueToSeconds(value, unit);
    setUnit(nextUnit);
    setValue(secondsToDurationValue(canonicalSeconds, nextUnit));
    haptic.selection();
  };

  return (
    <View style={{ gap: spacing.md }}>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="时间单位"
        style={{ flexDirection: 'row', gap: spacing.sm }}
      >
        {DURATION_UNITS.map((item) => {
          const selected = item.value === unit;
          return (
            <Pressable
              key={item.value}
              accessibilityRole="radio"
              accessibilityLabel={item.label}
              accessibilityState={{ selected }}
              onPress={() => selectUnit(item.value)}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 48,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: selected ? colors.primary : colors.border,
                backgroundColor: selected
                  ? colors.primaryMuted
                  : pressed
                    ? colors.surfaceMuted
                    : colors.surface,
              })}
            >
              <Text
                style={[
                  typography.label,
                  { color: selected ? colors.primaryPressed : colors.text },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <NumberInput
        label="时间"
        value={value}
        onChangeValue={setValue}
        min={0}
        max={MAX_DURATION_SECONDS / durationValueToSeconds(1, unit)}
        precision={unitMeta.precision}
        unitLabel={unitMeta.suffix}
      />

      <Text
        accessibilityLiveRegion="polite"
        style={[
          typography.bodySmall,
          { color: colors.textSecondary, fontVariant: ['tabular-nums'] },
        ]}
      >
        换算：{formatSetDuration(seconds, '00:00')}
      </Text>

      <Button
        variant="primary"
        size="lg"
        onPress={() => onCommit(seconds)}
        style={styles.fullWidth}
      >
        {submitLabel}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  fullWidth: { alignSelf: 'stretch' },
});
