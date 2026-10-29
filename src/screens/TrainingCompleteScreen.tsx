/**
 * TrainingCompleteScreen — G8 训练完成总结页(显式保存版)
 *
 * 布局(自上而下):
 *   1. 大尺寸动画 ✓ 图标(CSS 动画;Lottie 是 P2 占位)
 *   2. 标题"训练完成" + 副标题(计划名)
 *   3. 2x2 统计卡:时长 / 训练量 / 动作数 / 完成组数
 *   4. 底部双按钮:
 *      - 主:保存训练记录(primary, full-width) — 三态 idle / saving / saved
 *      - 副:不保存(ghost, 紧凑) — Dialog 二次确认后丢内存态
 *
 * 交互约束:
 *   - 全屏沉浸 (RootNavigator `headerShown: false` + `gestureEnabled: false`)
 *   - 用户必须显式选一条路径才能离开 —— 没有左上"返回"
 *
 * 设计:
 *   - 居中 ✓ 图标与简洁的训练结果，减少持续动态效果
 *   - 4 个统计卡用 Card 组件组合:矢量图标 + label + value
 *   - 保存成功后:spring 弹簧(380/0.7,"Expressive" 弹簧)scale 1.0→1.08→1.0
 *     庆祝 overshoot + 背景 primary → success + 文案 "✓ 已保存",保持 900ms
 *     让用户看到落库成功的视觉锚点,然后 popToTop() 回首页
 *   - theme-aware:浅深色自动切换
 *
 * 数据:
 *   - 通过 `route.params` 接收训练总结 stats(activeTraining 在内存中,DB 写
 *     尚未发生;`trainingId` 是 `activeTraining.id` 的快照,startTraining 已
 *     写过 orphan 行,等用户点保存才真正落库,点不保存则 cancelTraining 删)。
 *   - 重量与训练量底层保持 kg，展示按 settingsStore.unit 换算。
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useNavigation,
  useFocusEffect,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { haptic } from '@/utils/haptics';

import { Button } from '@/components/Button';
import { AppIcon, type AppIconName } from '@/components/AppIcon';
import { Card } from '@/components/Card';
import { Dialog } from '@/components/Dialog';
import { CountUp } from '@/components/CountUp';
import { ConfettiBurst } from '@/components/ConfettiBurst';
import { Sheet } from '@/components/Sheet';
import { useTheme } from '@/theme';
import { motion } from '@/theme/motion';
import { useTrainingStore } from '@/store/trainingStore';
import { useSettingsStore } from '@/store/settingsStore';
import type { RootStackParamList } from '@/navigation/types';
import { formatWeight, kgToLb } from '@/utils/units';

type Navigation = NativeStackNavigationProp<
  RootStackParamList,
  'TrainingComplete'
>;
type Route = RouteProp<RootStackParamList, 'TrainingComplete'>;

type SaveState = 'idle' | 'saving' | 'saved';

export function TrainingCompleteScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const { colors, spacing, typography, radius } = useTheme();
  const unit = useSettingsStore((state) => state.unit);
  const reduceMotion = useReducedMotion();

  const params = route.params;
  const summary = useTrainingStore((s) => s.completionSummary);
  const currentSummary = summary?.trainingId === params.trainingId ? summary : null;
  const {
    trainingId,
    durationSeconds,
    totalVolume,
    exerciseCount,
    setCount,
    planNameSnapshot,
  } = { ...params, ...currentSummary };
  const bestSet = currentSummary?.bestSet ?? null;
  const [showBestSet, setShowBestSet] = useState(false);
  const celebratedRef = useRef<string | null>(null);
  const [entryReady, setEntryReady] = useState(false);

  // Android 系统返回不能绕过保存或放弃的选择。
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, []));

  // 原生淡入期间页面尚不可见，等入场完成再播放 260ms 计数与庆祝。
  useEffect(() => navigation.addListener('transitionEnd', (event) => {
    if (!event.data.closing) setEntryReady(true);
  }), [navigation]);

  const completeTraining = useTrainingStore((s) => s.completeTraining);
  const cancelTraining = useTrainingStore((s) => s.cancelTraining);

  // ----------------------------------------------------------------
  // Entry haptic — celebration when the screen opens.
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!reduceMotion && entryReady && bestSet && celebratedRef.current !== trainingId) {
      celebratedRef.current = trainingId;
      haptic.heavy();
    }
  }, [entryReady, bestSet, reduceMotion, trainingId]);

  // ----------------------------------------------------------------
  // Save state machine: idle → saving → saved
  // saved 后 900ms 自动 popToTop() 回首页(让用户看到成功视觉锚点)
  // ----------------------------------------------------------------
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const handleSave = useCallback(async () => {
    if (saveState !== 'idle') return;
    setSaveState('saving');
    try {
      const result = await completeTraining();
      if (!result) {
        setSaveState('idle');
        Alert.alert('保存失败', '找不到当前训练。');
        return;
      }
      setSaveState('saved');
      haptic.success();
      // 给 saved 微动效播完 + 用户看清「✓ 已保存」的时间,然后自动回首页。
      setTimeout(() => {
        navigation.popToTop();
      }, 900);
    } catch (err) {
      setSaveState('idle');
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert('保存失败', msg);
    }
  }, [saveState, completeTraining, navigation]);

  // 不保存 — Dialog 二次确认后丢内存态 + orphan 行
  const [pendingDiscard, setPendingDiscard] = useState(false);

  const handleConfirmDiscard = useCallback(() => {
    setPendingDiscard(false);
    cancelTraining();
    navigation.popToTop();
  }, [cancelTraining, navigation]);

  // ----------------------------------------------------------------
  // Keep the completion mark still; the numeric counters supply the brief
  // entry feedback and respect the system's reduced-motion setting.
  // ----------------------------------------------------------------
  const pulse = useSharedValue(0);

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
  const displayVolume = unit === 'kg' ? totalVolume : kgToLb(totalVolume);
  const formattedVolume = `${formatAmount(displayVolume)} ${unit}`;

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
            { width: 116, height: 116, marginBottom: spacing.lg },
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
            <AppIcon name="check" size={48} color={colors.onPrimary} strokeWidth={2.2} />
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
          {`${planNameSnapshot ? `${planNameSnapshot} · ` : ''}完成 ${exerciseCount} 个动作 · ${setCount} 组`}
        </Text>

        {/* ====== 2x2 stat grid ====== */}
        <View style={[styles.statsGrid, { gap: spacing.md, marginBottom: spacing.xl }]}>
          <StatCard
            icon="clock"
            label="时长"
            value={formattedDuration}
            animatedValue={entryReady ? durationSeconds : 0}
            format={formatDuration}
            testID="summary-duration"
            countUpDuration={reduceMotion ? 0 : motion.duration.base}
            accessibilityHint={`本次训练总时长 ${formattedDuration}`}
          />
          <StatCard
            icon="trend"
            label="训练量"
            value={formatAmount(displayVolume)}
            animatedValue={entryReady ? displayVolume : 0}
            format={formatAmount}
            testID="summary-volume"
            unit={unit}
            countUpDuration={reduceMotion ? 0 : motion.duration.base}
            accessibilityHint={`总训练量 ${formattedVolume}`}
          />
          <StatCard
            icon="dumbbell"
            label="动作数"
            value={String(exerciseCount)}
            unit={exerciseCount === 1 ? '个' : '个'}
            accessibilityHint={`共完成 ${exerciseCount} 个动作`}
          />
          <StatCard
            icon="list"
            label="完成组数"
            value={String(setCount)}
            animatedValue={entryReady ? setCount : 0}
            testID="summary-sets"
            unit="组"
            countUpDuration={reduceMotion ? 0 : motion.duration.base}
            accessibilityHint={`共完成 ${setCount} 组`}
          />
        </View>
        {bestSet ? (
          <Card padding="md" style={{ alignSelf: 'stretch' }}>
            <Text accessibilityRole="header" style={[typography.h3, { color: colors.primary }]}>本次最佳组</Text>
            <Text style={[typography.h2, { color: colors.text, marginVertical: spacing.sm }]}>
              {formatWeight(bestSet.weight, unit)} × {bestSet.reps} 次
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
              单组容量 {formatAmount(unit === 'kg' ? bestSet.value : kgToLb(bestSet.value))} {unit} · 次
            </Text>
            <Button variant="ghost" onPress={() => setShowBestSet(true)} accessibilityLabel="查看本次最佳组">查看详情</Button>
          </Card>
        ) : null}
      </ScrollView>

      {/* ====== Bottom CTA: 双按钮(主:保存 / 副:不保存) ====== */}
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
        <SaveButton
          state={saveState}
          onPress={handleSave}
          primaryColor={colors.primary}
          successColor={colors.success}
          onPrimaryColor={colors.onPrimary}
          radius={radius.md}
          label="保存训练记录"
        />
        <View style={{ height: spacing.sm }} />
        <Button
          variant="ghost"
          size="md"
          disabled={saveState !== 'idle'}
          onPress={() => setPendingDiscard(true)}
          accessibilityLabel="不保存训练记录"
          accessibilityHint="放弃本次训练,不写入训练历史"
          style={{ alignSelf: 'stretch' }}
        >
          不保存
        </Button>
      </View>

      {!reduceMotion && entryReady && bestSet ? (
        <ConfettiBurst trigger={bestSet.value} testID="training-confetti" />
      ) : null}
      {bestSet ? (
        <Sheet visible={showBestSet} onClose={() => setShowBestSet(false)} title="本次最佳组" testID="best-set-sheet">
          <Text style={[typography.h2, { color: colors.text, marginBottom: spacing.md }]}>
            {formatWeight(bestSet.weight, unit)} × {bestSet.reps} 次
          </Text>
          <Text style={[typography.body, { color: colors.textSecondary, marginBottom: spacing.md }]}>
            本次已完成的非热身负重组中，重量 × 次数最高的一组。
          </Text>
          <Button onPress={() => setShowBestSet(false)}>继续查看</Button>
        </Sheet>
      ) : null}

      {/* ====== 不保存二次确认 ====== */}
      <Dialog
        visible={pendingDiscard}
        variant="danger"
        title="放弃训练记录？"
        message="放弃后本次训练不会写入训练历史,已完成的组数据也会丢失。"
        confirmText="放弃"
        cancelText="继续查看"
        onCancel={() => setPendingDiscard(false)}
        onConfirm={handleConfirmDiscard}
      />
    </View>
  );
}

/* ============================================================================
 * SaveButton — 三态主 CTA(idle / saving / saved)
 *
 * idle / saving 复用通用 Button(saved 终态需要自定义 spring + color 切换,
 * 包一层会拦截 Button 内部 Pressable 的 pressed 反馈,故独立实现)。
 *
 * spring 参数(M3 Expressive 弹簧规范):
 *   stiffness = 380, damping ratio ≈ 0.7 → 轻微 overshoot,贴合庆祝感
 *   mass = 1
 * ========================================================================== */

interface SaveButtonProps {
  state: SaveState;
  onPress: () => void;
  primaryColor: string;
  successColor: string;
  onPrimaryColor: string;
  radius: number;
  label: string;
}

function SaveButton({
  state,
  onPress,
  primaryColor,
  successColor,
  onPrimaryColor,
  radius,
  label,
}: SaveButtonProps) {
  const { typography } = useTheme();
  // saved 态微动效:背景色 primary → success + scale 1.0 → 1.08 → 1.0 spring
  const scale = useSharedValue(1);
  const bgProgress = useSharedValue(0);

  useEffect(() => {
    if (state === 'saved') {
      // 颜色:280ms ease-in-out 从 primary 过渡到 success
      bgProgress.value = withTiming(1, {
        duration: 280,
        easing: Easing.inOut(Easing.cubic),
      });
      // 弹簧庆祝:1.0 → 1.08 → 1.0,stiffness=380 / damping=17 (≈0.7 阻尼比) / mass=1
      scale.value = withSequence(
        withSpring(1.08, { stiffness: 380, damping: 17, mass: 1 }),
        withSpring(1.0, { stiffness: 380, damping: 17, mass: 1 }),
      );
    } else if (state === 'saving') {
      // 重置到 idle 视觉(防御性):防止 saved → idle 闪烁
      bgProgress.value = withTiming(0, { duration: 200 });
      scale.value = withTiming(1, { duration: 200 });
    } else {
      bgProgress.value = 0;
      scale.value = 1;
    }
  }, [state, bgProgress, scale]);

  const animatedStyle = useAnimatedStyle(() => {
    const bg = interpolateColor(
      bgProgress.value,
      [0, 1],
      [primaryColor, successColor],
    );
    return {
      backgroundColor: bg,
      transform: [{ scale: scale.value }],
    };
  });

  const isInert = state !== 'idle';

  return (
    <Animated.View style={[styles.saveBtn, { borderRadius: radius }, animatedStyle]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          state === 'saved'
            ? '已保存训练记录'
            : state === 'saving'
            ? '正在保存训练记录'
            : label
        }
        accessibilityState={{ disabled: isInert, busy: state === 'saving' }}
        accessibilityHint={
          state === 'idle'
            ? '保存后本次训练会写入训练历史'
            : state === 'saving'
            ? '写入本地数据库'
            : undefined
        }
        disabled={isInert}
        onPress={onPress}
        android_ripple={{ color: 'rgba(255,255,255,0.18)', borderless: false }}
        style={({ pressed }) => [
          styles.saveBtnPressable,
          {
            opacity: pressed && state === 'idle' ? 0.92 : 1,
          },
        ]}
      >
        {state === 'saving' ? (
          <Text
            style={[
              typography.label,
              { color: onPrimaryColor, fontSize: 16, lineHeight: 22 },
            ]}
            numberOfLines={1}
          >
            保存中…
          </Text>
        ) : state === 'saved' ? (
          <Text
            style={[
              typography.label,
              { color: onPrimaryColor, fontSize: 16, lineHeight: 22 },
            ]}
            numberOfLines={1}
          >
            ✓ 已保存
          </Text>
        ) : (
          <Text
            style={[
              typography.label,
              { color: onPrimaryColor, fontSize: 16, lineHeight: 22 },
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

/* ============================================================================
 * Sub-components
 * ========================================================================== */

interface StatCardProps {
  icon: AppIconName;
  label: string;
  value: string;
  animatedValue?: number;
  format?: (n: number) => string;
  testID?: string;
  unit?: string;
  countUpDuration?: number;
  accessibilityHint?: string;
}

function StatCard({
  icon,
  label,
  value,
  animatedValue,
  format,
  testID,
  unit,
  countUpDuration = motion.duration.base,
  accessibilityHint,
}: StatCardProps) {
  const { colors, spacing, typography, radius } = useTheme();
  return (
    <Card padding="md" style={{ flexBasis: '45%', flexGrow: 1, minWidth: 0 }}>
      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={`${label} ${value}${unit ? ' ' + unit : ''}`}
        accessibilityHint={accessibilityHint}
        style={{ gap: spacing.xs, alignItems: 'flex-start' }}
      >
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            width: 36,
            height: 36,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radius.md,
            backgroundColor: colors.primaryMuted,
          }}
        >
          <AppIcon name={icon} size={21} color={colors.primaryPressed} />
        </View>
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
          {animatedValue !== undefined ? (
            <CountUp value={animatedValue} duration={countUpDuration} format={format} testID={testID}
              style={[typography.h2, { color: colors.text, fontVariant: ['tabular-nums'], flexShrink: 1 }]} />
          ) : <Text
            style={[
              typography.h2,
              { color: colors.text, fontVariant: ['tabular-nums'] },
            ]}
            accessibilityElementsHidden
          >
            {value}
          </Text>}
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
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

function formatAmount(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 10) / 10;
  // 整数不显示小数;非整数保留 1 位
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
    width: 80,
    height: 80,
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
  statsGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  bottomBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  saveBtn: {
    alignSelf: 'stretch',
    minHeight: 52,
    overflow: 'hidden',
  },
  saveBtnPressable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
  },
});
