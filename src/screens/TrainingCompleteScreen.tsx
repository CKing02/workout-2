/**
 * TrainingCompleteScreen — G8 训练完成总结页
 *
 * 布局（自上而下）：
 *   1. 大尺寸动画 ✓ 图标（CSS 动画；Lottie 是 P2 占位）
 *   2. 标题"训练完成" + 副标题(计划名)
 *   3. 2x2 统计卡：时长 / 训练量 / 动作数 / 完成组数
 *   4. 底部"完成"大按钮 → navigation.popToTop()
 *
 * 交互约束：
 *   - 全屏沉浸 (RootNavigator `headerShown: false` + `gestureEnabled: false`)
 *   - 用户必须点底部"完成"按钮离开 —— 没有左上"返回"
 *
 * 设计：
 *   - 居中 ✓ 图标: Reanimated scale 1.0 → 1.15 → 1.0 循环；颜色循环
 *     primary ↔ success，营造"完成"庆祝感
 *   - 4 个统计卡用 Card 组件组合：图标（emoji）+ label + value
 *   - theme-aware：浅深色自动切换
 *
 * 数据：
 *   - 通过 `route.params` 接收训练总结 stats（G8 已写入 DB，本页不再读取 DB）。
 *   - 数值/单位显示格式化为本地习惯（中文千分位、kg 保留 0 位小数）。
 */

import React, { useEffect } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { haptic } from '@/utils/haptics';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useTheme } from '@/theme';
import type { RootStackParamList } from '@/navigation/types';

type Navigation = NativeStackNavigationProp<
  RootStackParamList,
  'TrainingComplete'
>;
type Route = RouteProp<RootStackParamList, 'TrainingComplete'>;

export function TrainingCompleteScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const { colors, spacing, typography, radius } = useTheme();

  const {
    trainingId,
    durationSeconds,
    totalVolume,
    exerciseCount,
    setCount,
    planNameSnapshot,
  } = route.params;

  // ----------------------------------------------------------------
  // Entry haptic — celebration when the screen opens.
  // ----------------------------------------------------------------
  useEffect(() => {
    haptic.success();
  }, []);

  // ----------------------------------------------------------------
  // Animation: ✓ icon does a soft scale + color cycle to evoke "celebration"
  // without Lottie. Reanimated 4 worklet runs on the UI thread.
  // ----------------------------------------------------------------
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      ),
      -1, // loop forever
      false,
    );
  }, [pulse]);

  const iconAnimatedStyle = useAnimatedStyle(() => {
    const scale = 1 + 0.12 * pulse.value;
    const bg = interpolateColor(
      pulse.value,
      [0, 1],
      [colors.success, colors.primary],
    );
    return {
      transform: [{ scale }],
      backgroundColor: bg,
    };
  });

  const ringAnimatedStyle = useAnimatedStyle(() => {
    const scale = 1 + 0.35 * pulse.value;
    const opacity = 0.35 * (1 - pulse.value);
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  // ----------------------------------------------------------------
  // Stat formatters — Chinese-friendly number formatting.
  // ----------------------------------------------------------------
  const formattedDuration = formatDuration(durationSeconds);
  const formattedVolume = formatKg(totalVolume);

  const handleDone = () => {
    haptic.selection();
    // popToTop sends the user back to the Tabs root (锻炼 tab). From there
    // Home is the initial route of Tabs — so this lands on Home.
    navigation.popToTop();
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing.xxl,
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.xxl,
          alignItems: 'center',
        }}
        accessibilityLiveRegion="polite"
        accessibilityLabel={`训练完成。时长 ${formattedDuration}，训练量 ${formattedVolume}，${exerciseCount} 个动作，${setCount} 组完成。`}
      >
        {/* ====== Animated checkmark + halo ring ====== */}
        <View
          style={[
            styles.iconAnchor,
            { width: 192, height: 192, marginBottom: spacing.xl },
          ]}
        >
          <Animated.View
            pointerEvents="none"
            style={[
              styles.halo,
              {
                backgroundColor: colors.primaryMuted,
                borderRadius: radius.full,
              },
              ringAnimatedStyle,
            ]}
          />
          <Animated.View
            style={[
              styles.iconCircle,
              {
                borderRadius: radius.full,
              },
              iconAnimatedStyle,
            ]}
            accessibilityElementsHidden
          >
            <Text
              style={styles.checkmark}
              accessibilityElementsHidden
              importantForAccessibility="no"
            >
              ✓
            </Text>
          </Animated.View>
        </View>

        {/* ====== Title + subtitle ====== */}
        <Text
          style={[
            typography.display,
            { color: colors.text, textAlign: 'center', marginBottom: spacing.xs },
          ]}
          accessibilityRole="header"
        >
          训练完成
        </Text>
        <Text
          style={[
            typography.body,
            { color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl },
          ]}
        >
          {planNameSnapshot ? `${planNameSnapshot} · 干得漂亮` : '干得漂亮'}
        </Text>

        {/* ====== 2x2 stat grid ====== */}
        <View style={[styles.statsGrid, { gap: spacing.md, marginBottom: spacing.xl }]}>
          <StatCard
            icon="⏱"
            label="时长"
            value={formattedDuration}
            accessibilityHint={`本次训练总时长 ${formattedDuration}`}
          />
          <StatCard
            icon="💪"
            label="训练量"
            value={formattedVolume}
            unit="kg"
            accessibilityHint={`总训练量 ${totalVolume.toFixed(0)} 公斤`}
          />
          <StatCard
            icon="🏋️"
            label="动作数"
            value={String(exerciseCount)}
            unit={exerciseCount === 1 ? '个' : '个'}
            accessibilityHint={`共完成 ${exerciseCount} 个动作`}
          />
          <StatCard
            icon="✓"
            label="完成组数"
            value={String(setCount)}
            unit="组"
            accessibilityHint={`共完成 ${setCount} 组`}
          />
        </View>

        <Text
          style={[
            typography.caption,
            { color: colors.textTertiary, textAlign: 'center', marginBottom: spacing.lg },
          ]}
          accessibilityLabel={`训练记录 id ${trainingId}`}
        >
          已写入训练历史 · #{trainingId.slice(0, 8)}
        </Text>
      </ScrollView>

      {/* ====== Bottom "完成" CTA ====== */}
      <View
        style={[
          styles.bottomBar,
          {
            paddingBottom: insets.bottom + spacing.md,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            backgroundColor: colors.background,
            borderTopColor: colors.divider,
          },
        ]}
      >
        <Button
          variant="primary"
          size="lg"
          onPress={handleDone}
          accessibilityLabel="完成，回到首页"
          accessibilityHint="结束本总结页，返回应用首页"
          style={{ alignSelf: 'stretch' }}
        >
          完成
        </Button>
      </View>
    </View>
  );
}

/* ============================================================================
 * Sub-components
 * ========================================================================== */

interface StatCardProps {
  icon: string;
  label: string;
  value: string;
  unit?: string;
  accessibilityHint?: string;
}

function StatCard({ icon, label, value, unit, accessibilityHint }: StatCardProps) {
  const { colors, spacing, typography } = useTheme();
  return (
    <Card padding="md" style={{ flex: 1, minWidth: 0 }}>
      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={`${label} ${value}${unit ? ' ' + unit : ''}`}
        accessibilityHint={accessibilityHint}
        style={{ gap: spacing.xs, alignItems: 'flex-start' }}
      >
        <Text style={{ fontSize: 24 }} accessibilityElementsHidden>
          {icon}
        </Text>
        <Text
          style={[
            typography.caption,
            { color: colors.textSecondary, marginTop: spacing.xxs },
          ]}
          accessibilityElementsHidden
        >
          {label}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.xxs }}>
          <Text
            style={[
              typography.h2,
              { color: colors.text, fontVariant: ['tabular-nums'] },
            ]}
            accessibilityElementsHidden
          >
            {value}
          </Text>
          {unit ? (
            <Text
              style={[typography.bodySmall, { color: colors.textSecondary }]}
              accessibilityElementsHidden
            >
              {unit}
            </Text>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

/* ============================================================================
 * Helpers
 * ========================================================================== */

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  if (hours > 0) {
    return `${hours} 小时 ${pad(minutes)} 分 ${pad(seconds)} 秒`;
  }
  if (minutes > 0) {
    return `${minutes} 分 ${pad(seconds)} 秒`;
  }
  return `${seconds} 秒`;
}

function formatKg(kg: number): string {
  if (!Number.isFinite(kg)) return '0';
  const rounded = Math.round(kg * 10) / 10;
  // 整数不显示小数；非整数保留 1 位
  if (Math.abs(rounded - Math.floor(rounded)) < 0.05) {
    return String(Math.floor(rounded));
  }
  return rounded.toFixed(1);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/* ============================================================================
 * Styles
 * ========================================================================== */

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  iconAnchor: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  iconCircle: {
    width: 128,
    height: 128,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 84,
    fontWeight: '700',
    lineHeight: 92,
  },
  statsGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  bottomBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
