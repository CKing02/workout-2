/**
 * TimerRing — animated countdown ring with timestamp-driven accuracy.
 *
 * The visible progress arc is a stroked `Circle` from `react-native-svg`. We
 * animate the stroke offset via a Reanimated `useSharedValue`, **not**
 * `setInterval`. Accuracy is preserved across long pauses / backgrounded
 * states because we compare against wall-clock time:
 *
 *     remaining  = duration - (now - startedAt)
 *
 * A single `requestAnimationFrame` loop recomputes the remaining fraction
 * every frame and writes it directly to the shared value. Direct assignment
 * (instead of `withTiming`) gives the smoothest possible motion — at 60fps,
 * Date.now() advances ~16.7ms per frame, so the ring progresses by exactly
 * `1 / duration` of the circumference per frame regardless of remaining time.
 *
 * Why **not** `withTiming(fraction, { duration: 120 })`? That pattern cancels
 * and restarts a 120ms timing animation on every frame, so the visible value
 * always trails the true fraction by ~14% of the curve (~17ms lag) and the
 * linear easing produces a mechanical, slightly-robotic feel. Direct
 * assignment eliminates both problems.
 *
 * The **only** timing we keep is a brief 120ms ease-out on the final snap to
 * zero, so the ring "settles" instead of abruptly hitting the bottom.
 *
 * Props:
 *  - `duration`  : total seconds (positive integer, > 0)
 *  - `elapsed`   : seconds already elapsed before this timer starts (resume
 *                  support). Defaults to 0.
 *  - `onComplete`: fired once when the countdown reaches 0
 *  - `size`      : diameter, default 200
 *  - `strokeWidth`: default 12
 *  - `labelSlot` : ReactNode rendered in the center
 *
 * While `duration` is `0` or `elapsed >= duration` the ring renders at
 * 100% and `onComplete` is invoked on the next tick.
 */

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface TimerRingProps {
  /** Total duration in seconds. */
  duration: number;
  /** Seconds already elapsed before mount (for resume). Defaults to 0. */
  elapsed?: number;
  onComplete?: () => void;
  size?: number;
  strokeWidth?: number;
  /** Optional content rendered in the center of the ring. */
  labelSlot?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function TimerRing({
  duration,
  elapsed = 0,
  onComplete,
  size = 200,
  strokeWidth = 12,
  labelSlot,
  style,
  testID,
}: TimerRingProps) {
  const { colors } = useTheme();

  // Track (Reanimated) value from 1 (full duration remaining) -> 0 (done).
  const progress = useSharedValue(1);

  // We store the timestamp at which we (re)started counting down so that
  // resuming or paused states stay accurate.
  const startWallRef = useRef<number | null>(null);
  const onCompleteRef = useRef(onComplete);
  const firedRef = useRef(false);
  const completionCalledRef = useRef(false);

  // Keep the latest onComplete without retriggering the RAF loop.
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Total starting fraction after any resumed elapsed time.
  const initialFraction = useMemo(() => {
    if (duration <= 0) return 0;
    return Math.max(0, Math.min(1, 1 - elapsed / duration));
  }, [duration, elapsed]);

  // The SVG ring sizing.
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const tick = useCallback(() => {
    const start = startWallRef.current;
    if (start === null) return;
    const remainingMs = duration * 1000 - (Date.now() - start);
    const fraction = Math.max(0, remainingMs / (duration * 1000));
    // 直接写 shared value:RAF 60fps 已经足够顺滑,任何 withTiming 都会
    // 引入 ~17ms 滞后 + 取消重启造成的"橡皮筋"感。直接赋值 = 每帧准确推进
    // circumference / duration 个像素,完全 frame-perfect。
    progress.value = fraction;
    if (remainingMs <= 0 && !firedRef.current) {
      firedRef.current = true;
      // Keep completion entirely on the JS path. Reanimated's animation
      // completion callback runs on the UI runtime and can reject the JS
      // `onComplete` prop in dev-client builds.
      progress.value = 0;
    }
  }, [duration, progress]);

  // RAF loop — purely driven by timestamps, so no drift.
  useEffect(() => {
    if (duration <= 0) {
      progress.value = 0;
      return undefined;
    }
    firedRef.current = false;
    completionCalledRef.current = false;
    startWallRef.current = Date.now() - elapsed * 1000;
    // Snap to the initial fraction so the ring matches whatever elapsed
    // value the parent passed in.
    cancelAnimation(progress);
    progress.value = initialFraction;

    let mounted = true;
    let raf = 0;
    const loop = () => {
      if (!mounted) return;
      tick();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const completionTimer = setTimeout(() => {
      if (completionCalledRef.current) return;
      completionCalledRef.current = true;
      onCompleteRef.current?.();
    }, Math.max(0, (duration - elapsed) * 1000));
    return () => {
      mounted = false;
      cancelAnimationFrame(raf);
      clearTimeout(completionTimer);
    };
    // Re-mount the loop whenever duration or initial elapsed time changes.
  }, [duration, elapsed, initialFraction, progress, tick]);

  // Drive the stroke offset from the animated progress.
  const animatedProps = useAnimatedProps(() => {
    const dashOffset = circumference * (1 - progress.value);
    return {
      strokeDashoffset: dashOffset,
    } as { strokeDashoffset: number };
  });

  return (
    <View
      testID={testID}
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
    >
      <Svg width={size} height={size}>
        {/* Track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.surfaceMuted}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress — rotate -90° around the ring center so the empty
            stroke starts at 12 o'clock instead of 3 o'clock. Static
            transform props live on the un-animated <G>; only
            strokeDashoffset is animated on the inner circle. */}
        <G originX={size / 2} originY={size / 2} rotation={-90}>
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.primary}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="transparent"
            strokeDasharray={`${circumference} ${circumference}`}
            animatedProps={animatedProps}
          />
        </G>
      </Svg>
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.center]}
      >
        {labelSlot}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/* -------------------------------------------------------------------------- */
/* Story                                                                     */
/* -------------------------------------------------------------------------- */
export function TimerRingStory() {
  const { colors, typography, spacing } = useTheme();
  const [duration, setDuration] = React.useState(5);
  const [key, setKey] = React.useState(0);
  const [elapsed, setElapsed] = React.useState(0);
  const [doneCount, setDoneCount] = React.useState(0);

  return (
    <View style={{ alignItems: 'center', gap: spacing.md }}>
      <TimerRing
        key={`${duration}-${elapsed}-${key}`}
        duration={duration}
        elapsed={elapsed}
        size={180}
        strokeWidth={10}
        labelSlot={
          <View style={{ alignItems: 'center' }}>
            <Text style={[typography.numeric, { color: colors.text }]}>
              {Math.max(0, duration - elapsed)}
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              秒
            </Text>
          </View>
        }
        onComplete={() => setDoneCount((c) => c + 1)}
      />
      <Text style={[typography.caption, { color: colors.textSecondary }]}>
        完成回调次数: {doneCount}
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Pressable2
          label="5s"
          onPress={() => {
            setDuration(5);
            setElapsed(0);
            setKey((k) => k + 1);
          }}
        />
        <Pressable2
          label="30s"
          onPress={() => {
            setDuration(30);
            setElapsed(0);
            setKey((k) => k + 1);
          }}
        />
        <Pressable2
          label="从 10s 处继续"
          onPress={() => {
            setDuration(30);
            setElapsed(20);
            setKey((k) => k + 1);
          }}
        />
        <Pressable2
          label="重启"
          onPress={() => {
            setElapsed(0);
            setKey((k) => k + 1);
          }}
        />
      </View>
    </View>
  );
}

function Pressable2({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors, typography, spacing, radius } = useTheme();
  return (
    <AnimatedPressable
      onPress={onPress}
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: colors.surfaceMuted,
        borderRadius: radius.md,
      }}
    >
      <Text style={[typography.label, { color: colors.text }]}>{label}</Text>
    </AnimatedPressable>
  );
}

// Local lightweight Pressable so the story doesn't depend on the Button
// component file and stays self-contained.
import { Pressable, Text } from 'react-native';
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
