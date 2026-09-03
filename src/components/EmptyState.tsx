/**
 * EmptyState — the standard "nothing here yet" surface.
 *
 * Used on the Plans tab, the History tab, the search results page, etc. The
 * illustration is intentionally a single oversized glyph rather than a
 * custom SVG so we ship zero new assets for G3.
 *
 * CTA: when `onAction` is provided, an action button appears below the
 * description.
 */

import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import { Button } from './Button';

export interface EmptyStateProps {
  /** Optional emoji / single glyph shown in a soft tinted disc. */
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  style,
}: EmptyStateProps) {
  const { colors, typography, spacing, radius } = useTheme();

  return (
    <View
      style={[
        styles.wrap,
        { paddingHorizontal: spacing.xl, paddingVertical: spacing.xxxl },
        style,
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          {
            backgroundColor: colors.primaryMuted,
            borderRadius: radius.full,
            marginBottom: spacing.lg,
          },
        ]}
      >
        {typeof icon === 'string' ? (
          <Text style={{ fontSize: 40 }}>{icon}</Text>
        ) : (
          icon
        )}
      </View>
      <Text
        style={[
          typography.h2,
          { color: colors.text, textAlign: 'center', marginBottom: spacing.xs },
        ]}
      >
        {title}
      </Text>
      {description ? (
        <Text
          style={[
            typography.body,
            { color: colors.textSecondary, textAlign: 'center', maxWidth: 280 },
          ]}
        >
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button
          variant="primary"
          style={{ marginTop: spacing.xl }}
          onPress={onAction}
        >
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/* -------------------------------------------------------------------------- */
/* Story                                                                     */
/* -------------------------------------------------------------------------- */
export function EmptyStateStory() {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.lg }}>
      <EmptyState
        icon="🏋"
        title="创建你的第一个训练计划"
        description="把今天想练的动作组合起来，下次训练一点就能开始。"
        actionLabel="新建计划"
        onAction={() => undefined}
      />
      <EmptyState icon="📓" title="开始你的第一次训练吧" description="完成训练后会在这里出现历史记录。" />
    </View>
  );
}