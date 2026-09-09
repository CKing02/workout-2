/**
 * Placeholder screen — a tiny shell originally used by Tab navigation in G1.
 *
 * Historical role (G1, since superseded):
 * - Confirm ThemeProvider works: this screen renders correctly under both
 *   light and dark schemes.
 * - Confirm the tab labels are visible & accurate ("首页 / 锻炼 / 我的").
 *
 * Current status (2026-09-09): all three tabs now wire real screens
 * (G5 / G9 / G10 long landed), so this component is no longer imported
 * anywhere in `src/`. Kept on disk for reference; safe to delete if dead
 * code audit runs.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

export interface PlaceholderProps {
  /** Tab title shown in the bottom-tab bar. */
  tabTitle: string;
  /** Big headline in the middle of the screen. */
  headline: string;
  /** Optional explanatory copy. */
  description?: string;
}

export function Placeholder({ tabTitle, headline, description }: PlaceholderProps) {
  const { colors, typography, spacing, radius, shadows } = useTheme();

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <View style={styles.container}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surfaceElevated,
              borderRadius: radius.lg,
              padding: spacing.xl,
              borderColor: colors.border,
              ...shadows.md,
            },
          ]}
        >
          <Text style={[typography.label, { color: colors.primary, marginBottom: spacing.sm }]}>
            {tabTitle}
          </Text>
          <Text style={[typography.h1, { color: colors.text, marginBottom: spacing.sm }]}>
            {headline}
          </Text>
          {description ? (
            <Text style={[typography.body, { color: colors.textSecondary }]}>
              {description}
            </Text>
          ) : null}

          <View
            style={[
              styles.tag,
              {
                backgroundColor: colors.primaryMuted,
                borderRadius: radius.full,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs,
                marginTop: spacing.xl,
                alignSelf: 'flex-start',
              },
            ]}
          >
            <Text style={[typography.caption, { color: colors.primaryPressed }]}>
              当前模式 · {tabTitle === '首页' || tabTitle === '我的' ? 'Tab' : 'Tab'}
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  tag: {},
});