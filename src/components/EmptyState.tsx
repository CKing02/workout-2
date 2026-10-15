/**
 * EmptyState — the standard "nothing here yet" surface.
 *
 * Used on the Plans tab, the History tab, the search results page, etc. The
 * G49 adds a small theme-aware SVG illustration set. The legacy `icon` prop
 * remains available for callers that need a custom React node.
 *
 * CTA: when `onAction` is provided, an action button appears below the
 * description.
 */

import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { useTheme } from '@/theme';
import { Button } from './Button';

export interface EmptyStateProps {
  /** Custom illustration override. Prefer `illustration` for built-in states. */
  icon?: React.ReactNode;
  illustration?: EmptyStateIllustrationKind;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

export type EmptyStateIllustrationKind =
  | 'training'
  | 'plan'
  | 'measurement'
  | 'search'
  | 'chart'
  | 'missing'
  | 'healthy';

export function EmptyState({
  icon,
  illustration = 'training',
  title,
  description,
  actionLabel,
  onAction,
  style,
}: EmptyStateProps) {
  const { colors, typography, spacing } = useTheme();

  return (
    <View
      style={[
        styles.wrap,
        { paddingHorizontal: spacing.xl, paddingVertical: spacing.xxxl },
        style,
      ]}
    >
      <View
        style={[styles.iconWrap, { marginBottom: spacing.lg }]}
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {typeof icon === 'string' ? (
          <Text style={{ fontSize: 40 }}>{icon}</Text>
        ) : icon ? (
          icon
        ) : (
          <EmptyStateIllustration kind={illustration} />
        )}
      </View>
      <Text
        accessibilityRole="header"
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
          accessibilityLabel={actionLabel}
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
    width: 96,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

function EmptyStateIllustration({ kind }: { kind: EmptyStateIllustrationKind }) {
  const { colors } = useTheme();
  const common = {
    fill: 'none',
    stroke: colors.primary,
    strokeWidth: 3,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  return (
    <Svg
      testID={`empty-state-illustration-${kind}`}
      width={96}
      height={80}
      viewBox="0 0 96 80"
    >
      <Rect x={10} y={12} width={76} height={56} rx={18} fill={colors.primaryMuted} />
      {kind === 'training' ? (
        <>
          <Line x1={26} y1={40} x2={70} y2={40} {...common} />
          <Line x1={31} y1={29} x2={31} y2={51} {...common} />
          <Line x1={37} y1={33} x2={37} y2={47} {...common} />
          <Line x1={59} y1={33} x2={59} y2={47} {...common} />
          <Line x1={65} y1={29} x2={65} y2={51} {...common} />
        </>
      ) : null}
      {kind === 'plan' ? (
        <>
          <Rect x={29} y={20} width={38} height={44} rx={6} {...common} />
          <Line x1={38} y1={33} x2={58} y2={33} {...common} />
          <Line x1={38} y1={43} x2={58} y2={43} {...common} />
          <Line x1={38} y1={53} x2={49} y2={53} {...common} />
          <Line x1={55} y1={49} x2={55} y2={57} {...common} />
          <Line x1={51} y1={53} x2={59} y2={53} {...common} />
        </>
      ) : null}
      {kind === 'measurement' ? (
        <>
          <Rect x={25} y={20} width={46} height={43} rx={8} {...common} />
          <Circle cx={48} cy={36} r={9} {...common} />
          <Line x1={48} y1={36} x2={54} y2={30} {...common} />
          <Line x1={37} y1={54} x2={59} y2={54} {...common} />
        </>
      ) : null}
      {kind === 'search' ? (
        <>
          <Circle cx={42} cy={35} r={13} {...common} />
          <Line x1={51} y1={44} x2={65} y2={58} {...common} />
        </>
      ) : null}
      {kind === 'chart' ? (
        <>
          <Line x1={28} y1={57} x2={68} y2={57} {...common} />
          <Line x1={28} y1={25} x2={28} y2={57} {...common} />
          <Rect x={35} y={43} width={7} height={14} rx={2} {...common} />
          <Rect x={47} y={35} width={7} height={22} rx={2} {...common} />
          <Rect x={59} y={27} width={7} height={30} rx={2} {...common} />
        </>
      ) : null}
      {kind === 'missing' ? (
        <>
          <Path d="M34 21h20l9 9v29H34z" {...common} />
          <Path d="M54 21v10h9" {...common} />
          <Line x1={39} y1={53} x2={58} y2={34} {...common} />
        </>
      ) : null}
      {kind === 'healthy' ? (
        <>
          <Path d="M48 18l19 8v14c0 12-7 21-19 27-12-6-19-15-19-27V26z" {...common} />
          <Path d="M39 41l6 6 12-13" {...common} />
        </>
      ) : null}
    </Svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Story                                                                     */
/* -------------------------------------------------------------------------- */
export function EmptyStateStory() {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.lg }}>
      <EmptyState
        illustration="plan"
        title="创建你的第一个训练计划"
        description="把今天想练的动作组合起来，下次训练一点就能开始。"
        actionLabel="新建计划"
        onAction={() => undefined}
      />
      <EmptyState illustration="training" title="开始你的第一次训练吧" description="完成训练后会在这里出现历史记录。" />
    </View>
  );
}
