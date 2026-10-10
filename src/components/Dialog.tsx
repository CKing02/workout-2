/**
 * Dialog — centered confirmation modal.
 *
 * Built on React Native's `Modal` (system chrome — fades nicely on iOS,
 * slides on Android). Animations are driven by Reanimated for the scale-in
 * of the card and the fade-in of the backdrop. The native `Modal` itself
 * uses the `fade` animation prop on iOS for a coherent effect.
 *
 * Two variants:
 *  - `default` — neutral (used for "取消训练？" / "确认导出？" etc.).
 *  - `danger`  — destructive CTA in danger color (used for deletes).
 */

import React, { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { motion } from '@/theme/motion';

import { Button } from './Button';
import { useTheme } from '@/theme';

export interface DialogProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'default' | 'danger';
  testID?: string;
}

export function Dialog({
  visible,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  onConfirm,
  onCancel,
  variant = 'default',
  testID,
}: DialogProps) {
  const { colors, typography, spacing, radius } = useTheme();
  const backdrop = useSharedValue(0);
  const scale = useSharedValue(0.94);

  useEffect(() => {
    if (visible) {
      backdrop.value = withTiming(1, { duration: motion.duration.fast });
      scale.value = withTiming(1, { duration: motion.duration.fast, easing: motion.easing.standard });
    } else {
      backdrop.value = withTiming(0, { duration: motion.duration.instant });
      scale.value = withTiming(0.94, { duration: motion.duration.instant });
    }
  }, [backdrop, scale, visible]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdrop.value,
  }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: backdrop.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
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
          testID={testID ? `${testID}-backdrop` : undefined}
          accessibilityRole="button"
          accessibilityLabel="dismiss dialog"
          onPress={onCancel}
          style={StyleSheet.absoluteFill}
        />
        <View pointerEvents="box-none" style={styles.center}>
          <Animated.View
            testID={testID}
            style={[
              styles.card,
              {
                backgroundColor: colors.surfaceElevated,
                borderRadius: radius.lg,
                padding: spacing.lg,
                borderColor: colors.border,
              },
              cardStyle,
            ]}
          >
            <Text style={[typography.h3, { color: colors.text }]}>{title}</Text>
            {message ? (
              <Text
                style={[
                  typography.body,
                  { color: colors.textSecondary, marginTop: spacing.sm },
                ]}
              >
                {message}
              </Text>
            ) : null}
            <View style={[styles.actions, { marginTop: spacing.lg }]}>
              <Button variant={variant === 'danger' ? 'ghost' : 'secondary'} onPress={onCancel}>
                {cancelText}
              </Button>
              <View style={{ width: spacing.sm }} />
              <Button
                variant={variant === 'danger' ? 'danger' : 'primary'}
                onPress={onConfirm}
                style={{ flex: 1 }}
              >
                {confirmText}
              </Button>
            </View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderWidth: StyleSheet.hairlineWidth,
  } as ViewStyle,
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
});

/* -------------------------------------------------------------------------- */
/* Story                                                                     */
/* -------------------------------------------------------------------------- */
export function DialogStory() {
  const { spacing } = useTheme();
  const [open1, setOpen1] = React.useState(false);
  const [open2, setOpen2] = React.useState(false);
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
      <Button variant="primary" onPress={() => setOpen1(true)}>
        打开普通 Dialog
      </Button>
      <Button variant="danger" onPress={() => setOpen2(true)}>
        打开危险 Dialog
      </Button>
      <Dialog
        visible={open1}
        title="确认保存？"
        message="保存后会将本次训练写入历史。"
        onCancel={() => setOpen1(false)}
        onConfirm={() => setOpen1(false)}
      />
      <Dialog
        visible={open2}
        variant="danger"
        title="删除这条计划？"
        message="删除后无法恢复。"
        confirmText="删除"
        onCancel={() => setOpen2(false)}
        onConfirm={() => setOpen2(false)}
      />
    </View>
  );
}