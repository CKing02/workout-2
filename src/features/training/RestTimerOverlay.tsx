/**
 * G7 — 休息计时器覆盖层
 *
 * 渲染一个底部 `Sheet`，中央是 `TimerRing`（G3 组件）+ 大字剩余秒数 + 跳过/+15s
 * 两个动作按钮。
 *
 * 行为：
 * 1. 当 store 的 `startedAt !== null` 时打开 Sheet。
 * 2. TimerRing 自驱 SVG 倒计时圆环动画（基于 Date.now() 时间戳，背景补偿）。
 * 3. `useRestTimerSecondsRemaining` 同步刷新中央数字。
 * 4. 倒计时到 0 → 触发 `expo-haptics notificationAsync(Success)` 震动
 *    + `setTimeout(1000)` 后自动调用 `skip()` 收起（PRD：1 秒后自动结束）。
 * 5. 启动时 `selectionAsync()` 轻触反馈；跳过 / +15 时也轻触反馈。
 * 6. 后台/锁屏期间 TimerRing + RAF 自动补偿，不需要 UI 层额外逻辑。
 *
 * 卸载清理：组件 unmount 时清掉 auto-close setTimeout，避免"用户取消训练后
 * 1 秒内被自动收起"这种诡异行为；同时如果 store 还残留进行中的计时，一并 skip
 * 掉，保证下一次进入 ActiveTrainingScreen 时是干净的。
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { Button } from '@/components/Button';
import { Sheet } from '@/components/Sheet';
import { TimerRing } from '@/components/TimerRing';
import { useTheme } from '@/theme';

import { useRestTimerStore } from './restTimerStore';
import { useRestTimerSecondsRemaining } from './useRestTimer';

const AUTO_CLOSE_DELAY_MS = 1000;
const EXTEND_DELTA_SECONDS = 15;

export function RestTimerOverlay() {
  const { colors, spacing, typography } = useTheme();

  const runId = useRestTimerStore((s) => s.runId);
  const startedAt = useRestTimerStore((s) => s.startedAt);
  const durationMs = useRestTimerStore((s) => s.durationMs);
  const completedAt = useRestTimerStore((s) => s.completedAt);
  const skip = useRestTimerStore((s) => s.skip);
  const extend = useRestTimerStore((s) => s.extend);
  const markCompleted = useRestTimerStore((s) => s.markCompleted);

  const remainingSec = useRestTimerSecondsRemaining();

  const isActive = startedAt !== null && durationMs !== null;
  // Sheet 在进行中 OR 已自然完成（1 秒等待收起）期间都保持可见
  const visible = isActive || completedAt !== null;

  const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 启动新一轮：selectionAsync 轻触反馈
  useEffect(() => {
    if (isActive && completedAt === null) {
      void Haptics.selectionAsync().catch(() => undefined);
    }
  }, [runId, isActive, completedAt]);

  // 倒计时到 0：标记完成 + 震动 + 1s 后自动收起
  useEffect(() => {
    if (!isActive || completedAt !== null) return;
    if (remainingSec > 0) return;

    markCompleted();
    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success,
    ).catch(() => undefined);

    if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
    autoCloseRef.current = setTimeout(() => {
      skip();
      autoCloseRef.current = null;
    }, AUTO_CLOSE_DELAY_MS);
  }, [isActive, completedAt, remainingSec, markCompleted, skip]);

  // Bug-2 fix defense — when a *new* timer round starts (runId bumped),
  // clear any pending auto-close left over from a previous round. Without
  // this, the old `setTimeout(..., AUTO_CLOSE_DELAY_MS)` could fire 1s
  // after the new round started and `skip()` the fresh timer, killing the
  // rest overlay mid-countdown.
  useEffect(() => {
    if (autoCloseRef.current) {
      clearTimeout(autoCloseRef.current);
      autoCloseRef.current = null;
    }
  }, [runId]);

  // 卸载清理：清掉 pending auto-close；如 store 残留进行中的计时，**只在仍
  // 在进行中时**才 skip —— 已进入"自然完成"态的，1s 后会自动收起，不要
  // 在 unmount 提前 skip 破坏 Sheet 的关闭节奏（防止下一次进
  // ActiveTrainingScreen 时看到上次的脏数据）。
  useEffect(() => {
    return () => {
      if (autoCloseRef.current) {
        clearTimeout(autoCloseRef.current);
        autoCloseRef.current = null;
      }
      const state = useRestTimerStore.getState();
      // Only skip if we're still mid-countdown. If the user already reached
      // 0 and is seeing the "准备下一组" prompt, the 1s auto-close is in
      // flight (or has just fired) — let it run, don't double-skip.
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
    void Haptics.selectionAsync().catch(() => undefined);
  }, [skip]);

  const handleExtend = useCallback(() => {
    // +15 之后倒计时重新跑，必须清掉 pending 的 auto-close，否则 1s 后会被强行收起
    if (autoCloseRef.current) {
      clearTimeout(autoCloseRef.current);
      autoCloseRef.current = null;
    }
    extend(EXTEND_DELTA_SECONDS);
    void Haptics.selectionAsync().catch(() => undefined);
  }, [extend]);

  // 给 TimerRing 的初始 elapsed：从 store.startedAt 推算（首次挂载时拿一次）
  // TimerRing 内部会在 duration/elapsed 变化时重启 startWallRef，extend 后
  // 也会自然衔接（elapsed prop 重新计算）。
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

  const centerLabel = completedAt !== null ? '准备下一组' : '秒';

  return (
    <Sheet
      visible={visible}
      onClose={handleSkip}
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
});