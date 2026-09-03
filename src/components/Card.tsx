/**
 * Card — surface container with optional press behavior and elevation.
 *
 * A `Card` is the visual primitive behind plan cards, training summary cards,
 * and any other "lifted panel" content. Elevation is opt-in via the
 * `elevated` flag — non-elevated cards rely on the surface color alone.
 *
 * `onPress` converts the card to a pressable target. Without `onPress` it
 * renders as a plain `View` so callers can compose freely.
 */

import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/theme';

export type CardPadding = 'sm' | 'md' | 'lg';

export interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  /** Adds shadow + slight border tint to lift the card off the surface. */
  elevated?: boolean;
  padding?: CardPadding;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

const PADDING = { sm: 12, md: 16, lg: 24 } as const;

export function Card({
  children,
  onPress,
  elevated = false,
  padding = 'md',
  style,
  testID,
  accessibilityLabel,
}: CardProps) {
  const { colors, radius, shadows } = useTheme();

  const computedStyle: ViewStyle = {
    backgroundColor: elevated ? colors.surfaceElevated : colors.surface,
    borderRadius: radius.lg,
    padding: PADDING[padding],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: elevated ? colors.border : colors.divider,
    ...(elevated ? shadows.md : {}),
  };

  if (onPress) {
    return (
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        android_ripple={{ color: colors.primaryMuted, borderless: false }}
        style={({ pressed }) => [
          computedStyle,
          { opacity: pressed ? 0.9 : 1 },
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View testID={testID} style={[computedStyle, style]}>
      {children}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Story                                                                     */
/* -------------------------------------------------------------------------- */
export function CardStory() {
  const { spacing, colors, typography } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      <Card padding="sm">
        <CardExampleText label="Small padding" colors={colors} typography={typography} />
      </Card>
      <Card padding="md" elevated onPress={() => undefined}>
        <CardExampleText label="Pressable + elevated" colors={colors} typography={typography} />
      </Card>
      <Card padding="lg">
        <CardExampleText label="Large padding" colors={colors} typography={typography} />
      </Card>
    </View>
  );
}

function CardExampleText({
  label,
  colors,
  typography,
}: {
  label: string;
  colors: ReturnType<typeof useTheme>['colors'];
  typography: ReturnType<typeof useTheme>['typography'];
}) {
  return (
    <>
      <Text style={[typography.h3, { color: colors.text }]}>{label}</Text>
      <Text style={[typography.body, { color: colors.textSecondary, marginTop: 4 }]}>
        Card content lives here.
      </Text>
    </>
  );
}