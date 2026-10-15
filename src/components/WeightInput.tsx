/**
 * WeightInput keeps the public value in kg while presenting the user's unit.
 * Storage, validation bounds and caller callbacks therefore remain kg-based.
 */

import React, { useCallback } from 'react';

import { NumberInput, type NumberInputProps } from '@/components/NumberInput';
import { useSettingsStore } from '@/store/settingsStore';
import { kgToLb, lbToKg } from '@/utils/units';

type WeightInputProps = Omit<
  NumberInputProps,
  'unitLabel' | 'precision' | 'value' | 'onChangeValue'
> & {
  /** Weight in the canonical storage unit (kg). */
  value: number;
  /** Receives weight in kg regardless of the selected display unit. */
  onChangeValue: (nextKg: number) => void;
};

const DISPLAY_PRECISION = 1;

function roundForDisplay(value: number): number {
  const factor = 10 ** DISPLAY_PRECISION;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min?: number, max?: number): number {
  return Math.min(max ?? Infinity, Math.max(min ?? -Infinity, value));
}

export function WeightInput({
  value,
  onChangeValue,
  min,
  max,
  ...props
}: WeightInputProps) {
  const unit = useSettingsStore((state) => state.unit);
  const displayValue = roundForDisplay(unit === 'kg' ? value : kgToLb(value));
  const displayMin = min == null ? undefined : roundForDisplay(unit === 'kg' ? min : kgToLb(min));
  const displayMax = max == null ? undefined : roundForDisplay(unit === 'kg' ? max : kgToLb(max));

  const handleChange = useCallback(
    (nextDisplay: number) => {
      const nextKg = clamp(unit === 'kg' ? nextDisplay : lbToKg(nextDisplay), min, max);
      if (nextKg !== value) onChangeValue(nextKg);
    },
    [max, min, onChangeValue, unit, value],
  );

  return (
    <NumberInput
      key={unit}
      {...props}
      value={displayValue}
      onChangeValue={handleChange}
      min={displayMin}
      max={displayMax}
      precision={DISPLAY_PRECISION}
      unitLabel={unit}
    />
  );
}
