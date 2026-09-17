/**
 * G7 + G38.1 — 休息计时器覆盖层(双态:展开/折叠)
 *
 * 历史:
 *   G7 初版:全屏 Sheet,背景点击 → skip。用户报 bug:训练中点屏幕其他位置
 *   倒计时被立即关闭,且看不到当前 set 状态。
 *
 * G38.1 改造:
 *   1. **双态**:expanded(全屏 Sheet) + collapsed(底部 56dp 窄条,pointerEvents=box-none,
 *      用户可看/可操作训练列表)
 *   2. **背景点击不再 skip** — 改为 setExpanded(false) 折叠
 *   3. **窄条 tap** → 重新展开
 *   4. **自然到 0** → 自动折叠成窄条(显示"准备下一组"),1s 后 skip 整体消失
 *   5. **后台/前台切换** — store 时间戳驱动,AppState=active 回前台时秒数自动
 *      校准(由 RestTimerNotificationBridge 处理)
 *
 * 卸载清理(同 G7):
 *   - 清掉 pending auto-close setTimeout
 *   - 仅在仍进行中时才 skip;已进入"自然完成"态的让 1s 自动收起跑完
 *
 * runId 变化时:重置 expanded=true,清 pending auto-close
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { Sheet } from '@/components/Sheet';
import { TimerRing } from '@/components/TimerRing';
import { useTheme } from '@/theme';
import { haptic } from '@/utils/haptics';

import { useRestTimerStore } from './restTimerStore';
import { useRestTimerSecondsRemaining } from './useRestTimer';

const AUTO_CLOSE_DELAY_MS = 1000;
const EXTEND_DELTA_SECONDS = 15;
const COLLAPSED_BAR_HEIGHT = 56;
/** 进度条窄条上的细横条宽度(dp)。 */
const COLLAPSED_PROGRESS_TRACK_WIDTH = 96;

export function RestTimerOverlay() {
  const { colors, spacing, typography, radius } = useTheme();
  const insets = useSafeAreaInsets();

  const runId = useRestTimerStore((s) => s.runId);
  const startedAt = useRestTimerStore((s) => s.startedAt);
  const durationMs = useRestTimerStore((s) => s.durationMs);
  const completedAt = useRestTimerStore((s) => s.completedAt);
  const skip = useRestTimerStore((s) => s.skip);
  const extend = useRestTimerStore((s) => s.extend);
  const markCompleted = useRestTimerStore((s) => s.markCompleted);

  const remainingSec = useRestTimerSecondsRemaining();

  const isActive = startedAt !== null && durationMs !== null;
  // 进行中 OR 自然完成 1s 等待收起期间都保持可见
  const visible = isActive || completedAt !== null;

  // 双态:expanded(全屏 Sheet) / collapsed(底部窄条)
  const [expanded, setExpanded] = useState(true);

  const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 折叠时窄条进入动画(Reanimated shared value,跟 CollapsedBar 的 RAF 进度条
  // 共用同一渲染管线,避免一帧里 legacy Animated + Reanimated 双跑)
  const collapseAnim = useSharedValue(0);

  // 新一轮:自动展开 + 清 pending auto-close + 跑入动画
  useEffect(() => {
    setExpanded(true);
    if (autoCloseRef.current) {
      clearTimeout(autoCloseRef.current);
      autoCloseRef.current = null;
    }
    // 切到 expanded 时让窄条退场(如果还在)
    collapseAnim.value = withTiming(0, { duration: 140 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  // 倒计时到 0:标记完成 + 震动 + 折叠成窄条 + 1s 后整体 skip
  useEffect(() => {
    if (!isActive || completedAt !== null) return;
    if (remainingSec > 0) return;

    markCompleted();
    haptic.success();
    setExpanded(false);
    collapseAnim.value = withTiming(1, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });

    if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
    autoCloseRef.current = setTimeout(() => {
      skip();
      autoCloseRef.current = null;
    }, AUTO_CLOSE_DELAY_MS);
  }, [isActive, completedAt, remainingSec, markCompleted, skip, collapseAnim]);

  // 卸载清理:清 pending auto-close;仅在仍进行中时 skip(让已完成态的 1s 跑完)
  useEffect(() => {
    return () => {
      if (autoCloseRef.current) {
        clearTimeout(autoCloseRef.current);
        autoCloseRef.current = null;
      }
      const state = useRestTimerStore.getState();
      if (state.startedAt !== null && state.completedAt === null) {
        skip();
      }
    };
  }, [skip]);

  const handleSkip = useCallback(() => {
    if (autoCloseRef.current) {
      clearTimeout(autoCloseRef.current);
      autoCloseRef.current = null;
    }
    skip();
    haptic.selection();
  }, [skip]);

  const handleExtend = useCallback(() => {
    if (autoCloseRef.current) {
      clearTimeout(autoCloseRef.current);
      autoCloseRef.current = null;
    }
    extend(EXTEND_DELTA_SECONDS);
    haptic.selection();
  }, [extend]);

  // 展开态被点背景 → 折叠
  const handleCollapse = useCallback(() => {
    setExpanded(false);
    collapseAnim.value = withTiming(1, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [collapseAnim]);

  // 折叠态被点窄条 → 重新展开
  const handleExpand = useCallback(() => {
    setExpanded(true);
    collapseAnim.value = withTiming(0, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
    });
  }, [collapseAnim]);

  // TimerRing 用的初始 elapsed(基于 startedAt)
  const totalSec =
    durationMs !== null ? Math.max(1, Math.round(durationMs / 1000)) : 1;
  const initialElapsed =
    startedAt !== null && durationMs !== null
      ? Math.max(
          0,
          Math.min(
            durationMs / 1000,
            (Date.now() - startedAt) / 1000,
          ),
        )
      : 0;

  // 设计优化 #2: 窄条进度条改用 Reanimated + RAF,不再需要父组件预计算 progressFrac。
  // 父组件只负责传 startedAt/durationMs,CollapsedBar 自己跑 RAF 推 shared value。
  // (代码注释保留 — 后续若需要外部读此值,知道去 CollapsedBar 内部拿)

  // G38.1:倒计时归 0 时不再切到"准备下一组"文案 ——
  // 1s 后 overlay 整体消失,中间没有用户需要做的决策,显示"秒"更克制
  const centerLabel = '秒';

  if (!visible) return null;

  return (
    <>
      {expanded ? (
        <Sheet
          visible={true}
          onClose={handleCollapse}
          title="休息一下"
          maxHeightRatio={0.65}
        >
          <View style={styles.content}>
            <TimerRing
              key={runId}
              duration={totalSec}
              elapsed={initialElapsed}
              size={220}
              strokeWidth={12}
              labelSlot={
                <View style={styles.center} pointerEvents="none">
                  <Text
                    style={[
                      typography.display,
                      {
                        color: completedAt !== null ? colors.primary : colors.text,
                        fontVariant: ['tabular-nums'],
                      },
                    ]}
                    accessibilityLabel={`剩余 ${remainingSec} 秒`}
                  >
                    {remainingSec}
                  </Text>
                  <Text
                    style={[
                      typography.caption,
                      { color: colors.textSecondary, marginTop: spacing.xxs },
                    ]}
                  >
                    {centerLabel}
                  </Text>
                </View>
              }
            />

            <View style={[styles.row, { gap: spacing.md }]}>
              <Button
                variant="secondary"
                size="lg"
                onPress={handleSkip}
                accessibilityLabel="跳过休息"
                accessibilityHint="立即关闭休息计时器，进入下一组"
                style={styles.flexBtn}
              >
                跳过
              </Button>
              <Button
                variant="primary"
                size="lg"
                onPress={handleExtend}
                accessibilityLabel={`延长 ${EXTEND_DELTA_SECONDS} 秒`}
                accessibilityHint={`为当前休息增加 ${EXTEND_DELTA_SECONDS} 秒`}
                style={styles.flexBtn}
              >
                {`+${EXTEND_DELTA_SECONDS}s`}
              </Button>
            </View>
          </View>
        </Sheet>
      ) : (
        <CollapsedBar
          remainingSec={remainingSec}
          totalSec={totalSec}
          startedAt={startedAt!}
          durationMs={durationMs!}
          isCompleted={completedAt !== null}
          bottomInset={insets.bottom}
          onTap={handleExpand}
          onSkip={handleSkip}
          onExtend={handleExtend}
          animValue={collapseAnim}
        />
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* CollapsedBar — 底部 56dp 窄条                                              */
/* -------------------------------------------------------------------------- */

interface CollapsedBarProps {
  remainingSec: number;
  totalSec: number;
  /** 用于秒级重渲的整秒剩余秒数(Reanimated 进度条独立 RAF,跟秒数节流解耦) */
  startedAt: number;
  durationMs: number;
  isCompleted: boolean;
  bottomInset: number;
  onTap: () => void;
  onSkip: () => void;
  onExtend: () => void;
  animValue: Animated.SharedValue<number>;
}

function CollapsedBar({
  remainingSec,
  totalSec,
  startedAt,
  durationMs,
  isCompleted,
  bottomInset,
  onTap,
  onSkip,
  onExtend,
  animValue,
}: CollapsedBarProps) {
  const { colors, spacing, typography, radius } = useTheme();

  // 设计优化 #2: 进度条用 Reanimated 共享值 + RAF 直接写,而不是父组件
  // 每秒传 progressFrac 再硬切宽度。原方案每秒跳一次 + View 宽度重渲,
  // 视觉上"一格一格掉",而且在 background→foreground 时无补间会突跳。
  // 现在 RAF 60fps 驱动,frame-perfect,后台回前台自动校准(因为是
  // Date.now()-startedAt 推导,跟 TimerRing 一致)。
  const progress = useSharedValue(1);

  useEffect(() => {
    let raf = 0;
    let mounted = true;
    const loop = () => {
      if (!mounted) return;
      const ms = durationMs - (Date.now() - startedAt);
      const fraction = Math.max(0, Math.min(1, ms / durationMs));
      progress.value = fraction;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      mounted = false;
      cancelAnimationFrame(raf);
    };
  }, [startedAt, durationMs, progress]);

  // 完成态用 200ms ease-out 收尾到 0,跟 TimerRing 的最终 snap 同步
  useEffect(() => {
    if (!isCompleted) return;
    progress.value = withTiming(0, {
      duration: 200,
      easing: Easing.out(Easing.quad),
    });
  }, [isCompleted, progress]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  // 入场 translateY:32→0 + opacity:0→1(动画值是 shared value)
  const wrapperStyle = useAnimatedStyle(() => ({
    opacity: animValue.value,
    transform: [
      {
        translateY: (1 - animValue.value) * 32,
      },
    ],
  }));

  return (
    <View
      pointerEvents="box-none"
      style={StyleSheet.absoluteFill}
      // 最高 zIndex,盖在 Bottom CTA 之上。Rest 期间用户不应再点 CTA。
      // 等到 overlay 完全消失(skip)后,ActiveTrainingScreen 自然显示新 CTA。
    >
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.collapsedWrapper,
          {
            bottom: bottomInset + spacing.md,
            left: spacing.md,
            right: spacing.md,
          },
          wrapperStyle,
        ]}
      >
        <View
          style={[
            styles.collapsedBar,
            {
              backgroundColor: colors.surfaceElevated,
              borderRadius: radius.lg,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderColor: colors.divider,
            },
          ]}
        >
          {/* 主点击区(窄条左侧 80%) */}
          <Pressable
            onPress={onTap}
            accessibilityRole="button"
            accessibilityLabel={
              isCompleted ? '休息结束,点击展开' : `休息中,剩 ${remainingSec} 秒,点击展开`
            }
            accessibilityHint="展开完整休息计时器"
            style={({ pressed }) => ({
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            {/* 文字块 */}
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={[
                  typography.label,
                  {
                    color: isCompleted ? colors.primary : colors.textSecondary,
                    fontSize: 12,
                  },
                ]}
                numberOfLines={1}
              >
                休息中
              </Text>
              <Text
                style={[
                  typography.numeric,
                  {
                    color: isCompleted ? colors.primary : colors.text,
                    fontSize: 18,
                    fontWeight: '700',
                    fontVariant: ['tabular-nums'],
                  },
                ]}
                numberOfLines={1}
              >
                {`剩 ${remainingSec} 秒`}
              </Text>
            </View>
            {/* 细进度条 — 用 Reanimated 直接写 width(60fps frame-perfect) */}
            <View
              style={{
                width: COLLAPSED_PROGRESS_TRACK_WIDTH,
                height: 6,
                borderRadius: 3,
                backgroundColor: colors.surfaceMuted,
                overflow: 'hidden',
              }}
            >
              <Animated.View
                style={[
                  {
                    height: '100%',
                    backgroundColor: colors.primary,
                  },
                  fillStyle,
                ]}
              />
            </View>
            {/* 展开 chevron */}
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 18,
                fontWeight: '600',
                marginLeft: spacing.xs,
              }}
              accessibilityElementsHidden
            >
              ⌃
            </Text>
          </Pressable>

          {/* 右侧操作区(独立按压,不触发展开) */}
          {!isCompleted && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                marginLeft: spacing.sm,
                paddingLeft: spacing.sm,
                borderLeftWidth: StyleSheet.hairlineWidth,
                borderLeftColor: colors.divider,
              }}
            >
              <Pressable
                onPress={onExtend}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`延长 ${EXTEND_DELTA_SECONDS} 秒`}
              >
                <Text
                  style={[
                    typography.label,
                    { color: colors.primary, fontSize: 14, fontWeight: '700' },
                  ]}
                >
                  +15
                </Text>
              </Pressable>
              <Pressable
                onPress={onSkip}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="跳过休息"
              >
                <Text
                  style={[
                    typography.label,
                    { color: colors.danger, fontSize: 14, fontWeight: '600' },
                  ]}
                >
                  跳过
                </Text>
              </Pressable>
            </View>
          )}
        </View>
        {totalSec > 0 && !isCompleted ? (
          <Text
            style={[
              typography.caption,
              {
                color: colors.textTertiary,
                fontSize: 11,
                marginTop: spacing.xxs,
                textAlign: 'right',
                paddingHorizontal: spacing.sm,
              },
            ]}
            accessibilityElementsHidden
          >
            {`${Math.max(0, remainingSec)}/${totalSec} 秒`}
          </Text>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  flexBtn: {
    flex: 1,
  },
  collapsedWrapper: {
    position: 'absolute',
  },
  collapsedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: COLLAPSED_BAR_HEIGHT,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
  },
});
