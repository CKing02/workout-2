/**
 * Sheet — bottom drawer.
 *
 * Renders a React Native `Modal` covering the bottom portion of the screen.
 * Animations:
 *  - backdrop fades in (Reanimated)
 *  - card slides up from below (Reanimated translateY)
 *
 * Drag-to-dismiss is *not* wired in G3 (gesture-handler + Reanimated
 * collaboration is non-trivial and only the rest timer uses Sheet for now).
 * The user can still close via the backdrop tap or back button.
 */

import React, { useEffect } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import { motion } from '@/theme/motion';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  /** Optional title row at the top of the sheet. */
  title?: string;
  children: React.ReactNode;
  /** Maximum height fraction (0–1). Defaults to 0.6. */
  maxHeightRatio?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Sheet({
  visible,
  onClose,
  title,
  children,
  maxHeightRatio = 0.6,
  style,
  testID,
}: SheetProps) {
  const { colors, typography, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const backdrop = useSharedValue(0);
  const translateY = useSharedValue(800);

  useEffect(() => {
    if (visible) {
      backdrop.value = withTiming(1, { duration: motion.duration.fast });
      translateY.value = withTiming(0, {
        duration: motion.duration.fast,
        easing: motion.easing.standard,
      });
    } else {
      backdrop.value = withTiming(0, { duration: motion.duration.instant });
      translateY.value = withTiming(800, { duration: motion.duration.fast });
    }
  }, [backdrop, translateY, visible]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdrop.value,
  }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: backdrop.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.fill}>
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: colors.overlay },
            backdropStyle,
          ]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="dismiss sheet"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <KeyboardAvoidingView
          pointerEvents="box-none"
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.bottomAnchor}
        >
          <Animated.View
            testID={testID}
            style={[
              styles.card,
              {
                backgroundColor: colors.surfaceElevated,
                borderTopLeftRadius: radius.xl,
                borderTopRightRadius: radius.xl,
                paddingHorizontal: spacing.lg,
                paddingTop: spacing.md,
                paddingBottom: spacing.lg + insets.bottom,
                maxHeight: `${Math.round(maxHeightRatio * 100)}%` as unknown as number,
              },
              cardStyle,
              style,
            ]}
          >
            <View
              style={[
                styles.handle,
                { backgroundColor: colors.divider, marginBottom: spacing.md },
              ]}
            />
            {title ? (
              <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.sm }]}>
                {title}
              </Text>
            ) : null}
            {children}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bottomAnchor: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  card: {
    width: '100%',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
  },
});

/* -------------------------------------------------------------------------- */
/* Story                                                                     */
/* -------------------------------------------------------------------------- */
export function SheetStory() {
  const { spacing, colors, typography } = useTheme();
  const [open, setOpen] = React.useState(false);
  return (
    <View>
      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title="选择组类型"
        maxHeightRatio={0.5}
      >
        <View style={{ gap: spacing.sm }}>
          {(
            [
              ['正式组', 'normal'],
              ['热身组 W', 'warmup'],
              ['递减组 D', 'dropout'],
              ['力竭组 F', 'failure'],
            ] as const
          ).map(([label, value]) => (
            <Pressable
              key={value}
              onPress={() => setOpen(false)}
              style={({ pressed }) => ({
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.sm,
                borderRadius: 8,
                backgroundColor: pressed ? colors.surfaceMuted : colors.transparent,
              })}
            >
              <Text style={[typography.body, { color: colors.text }]}>{label}</Text>
            </Pressable>
          ))}
          <Pressable
            onPress={() => setOpen(false)}
            style={({ pressed }) => ({
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.sm,
              borderRadius: 8,
              backgroundColor: pressed ? colors.surfaceMuted : colors.transparent,
            })}
          >
            <Text style={[typography.body, { color: colors.danger }]}>删除组</Text>
          </Pressable>
        </View>
      </Sheet>
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          backgroundColor: colors.primary,
          borderRadius: 12,
          alignSelf: 'flex-start',
        }}
      >
        <Text style={[typography.label, { color: colors.onPrimary }]}>打开 Sheet</Text>
      </Pressable>
    </View>
  );
}
