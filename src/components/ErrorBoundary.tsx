/**
 * G12 — Global Error Boundary.
 *
 * Wraps the entire app below the safe-area / gesture providers so any
 * uncaught render error in any screen is captured here instead of
 * causing the classic React Native white screen.
 *
 * Behavior on error:
 *   - Renders a friendly fallback screen with a "重试" button.
 *   - Shows a Toast "出了点小问题" so the user is informed even if they
 *     were looking at a non-crashing sibling UI (the toast mounts at
 *     root level via `<Toast />`).
 *
 * Why a class component: React's only first-party error-capture API is
 * `componentDidCatch` / `getDerivedStateFromError`, both class-only.
 * Functional boundaries need `react-error-boundary` (an extra dep we're
 * avoiding for G12).
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import { toast } from '@/hooks/useToast';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional custom fallback. Defaults to the built-in recovery UI. */
  fallback?: (err: Error, reset: () => void) => React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Always log so devs can chase it via Metro / device logcat.
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] Caught render error', error, info);
    // G12: surface to user via Toast. The boundary still renders its
    // own fallback UI — this is just an extra nudge so a user who was
    // looking at a sibling subtree (e.g. a Sheet) gets the hint.
    toast.show('出了点小问题，已切到安全界面', 'error');
  }

  private readonly reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      return <DefaultFallback error={this.state.error} onReset={this.reset} />;
    }
    return this.props.children;
  }
}

/**
 * The default fallback surface. Reads theme from context for light/dark.
 */
function DefaultFallback({
  error,
  onReset,
}: {
  error: Error;
  onReset: () => void;
}) {
  const { colors, spacing, typography, radius } = useTheme();

  return (
    <SafeAreaView
      style={[styles.fill, { backgroundColor: colors.background }]}
      edges={['top', 'bottom']}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.xl,
          gap: spacing.lg,
        }}
        accessibilityLiveRegion="assertive"
      >
        <View
          style={[
            styles.glyphWrap,
            {
              backgroundColor: colors.primaryMuted,
              borderRadius: radius.full,
              marginBottom: spacing.md,
            },
          ]}
        >
          <Text style={{ fontSize: 44 }} accessibilityElementsHidden>
            ⚠
          </Text>
        </View>
        <Text
          style={[typography.h1, { color: colors.text, textAlign: 'center' }]}
          accessibilityRole="header"
        >
          出了点小问题
        </Text>
        <Text
          style={[
            typography.body,
            { color: colors.textSecondary, textAlign: 'center', maxWidth: 320 },
          ]}
        >
          应用渲染时遇到了错误。请点击下方按钮重试，或者重新打开 App。
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="重试"
          accessibilityHint="尝试重新渲染界面"
          onPress={onReset}
          style={({ pressed }) => ({
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.md,
            borderRadius: radius.md,
            backgroundColor: pressed ? colors.primaryPressed : colors.primary,
            minWidth: 160,
            alignItems: 'center',
            marginTop: spacing.md,
          })}
        >
          <Text
            style={[
              typography.label,
              { color: colors.onPrimary, fontSize: 15 },
            ]}
          >
            重试
          </Text>
        </Pressable>

        {__DEV__ ? (
          <View
            style={{
              marginTop: spacing.lg,
              padding: spacing.md,
              borderRadius: radius.sm,
              backgroundColor: colors.surfaceMuted,
              alignSelf: 'stretch',
            }}
          >
            <Text
              style={[typography.caption, { color: colors.textTertiary }]}
            >
              {error.name}: {error.message}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  glyphWrap: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
