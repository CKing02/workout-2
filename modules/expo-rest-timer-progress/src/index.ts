/**
 * expo-rest-timer-progress — JS 端包装
 *
 * 暴露五个函数给 src/features/training/restTimerNotification.ts:
 *   - ensureChannel() : 建/复用 channel
 *   - showOrUpdate(rem, total, title, colorHex) : 首次全量 show
 *   - setProgress(rem, total) : 增量更新进度
 *   - dismiss() : 取消通知
 *   - consumeExpired() : 读 + 清 SharedPreferences 里 receiver 写的"已到点"标记
 *
 * iOS 路径整体 noop —— 本模块 Android-only。
 */

import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

type Native = {
  ensureChannel: () => Promise<void>;
  show: (
    remainingSec: number,
    totalSec: number,
    title: string,
    colorHex: string | null,
  ) => Promise<void>;
  setProgress: (remainingSec: number, totalSec: number) => void;
  dismiss: () => Promise<void>;
  /**
   * 读 + 清 SP "expired_at_elapsed_ms"。返回 elapsedRealtime ms(0 = 无)。
   * 见 RestTimerProgressModule.kt 注释 —— 跨进程通道,receiver → JS。
   */
  consumeExpired: () => Promise<number>;
};

const Native: Native | null =
  Platform.OS === 'android'
    ? requireNativeModule<Native>('RestTimerProgress')
    : null;

export async function ensureChannel(): Promise<void> {
  if (!Native) return;
  await Native.ensureChannel();
}

export async function showOrUpdate(
  remainingSec: number,
  totalSec: number,
  title: string,
  colorHex: string | null,
): Promise<void> {
  if (!Native) return;
  await Native.show(remainingSec, totalSec, title, colorHex);
}

/**
 * 增量更新进度 — sync fire-and-forget。
 * Native 是 in-place rebuild + notify,通常 <5ms;无需 await。
 */
export function setProgress(remainingSec: number, totalSec: number): void {
  if (!Native) return;
  Native.setProgress(remainingSec, totalSec);
}

export async function dismiss(): Promise<void> {
  if (!Native) return;
  await Native.dismiss();
}

/**
 * "消费" alarm receiver 写入的"已到点"标记。
 *
 * 为什么需要:退后台 + 锁屏期间 App 进程被 freezer/cache,JS 端 RAF tick 不再
 * 触发,receiver 唤起时已经 cancel 通知 + 震动 + 写 SP,但 **App 内
 * RestTimerOverlay 还停留在 0 秒**(JS 端没机会推进 state)。
 *
 * 用户回前台时 bridge mount + AppState 'active' 调本方法:
 *   - 返回 > 0 → 走过 `markCompleted() + skip()`,overlay 立即消失
 *   - 返回 0   → 没发生过 receiver 唤起,JS 走正常 RAF tick 路径
 *
 * native 是 read + clear 原子(commit 同步),so 多次调用安全:第一次拿到值,
 * 第二次起 return 0。
 *
 * 返回:`number`(elapsedRealtime ms),0 = 无未消费的到点事件。
 */
export async function consumeExpired(): Promise<number> {
  if (!Native) return 0;
  return await Native.consumeExpired();
}