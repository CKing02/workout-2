/**
 * expo-rest-timer-progress — JS 端包装
 *
 * 暴露三个函数给 src/features/training/restTimerNotification.ts:
 *   - ensureChannel() : 建/复用 channel
 *   - showOrUpdate(rem, total, title, colorHex) : 首次全量 show
 *   - setProgress(rem, total) : 增量更新进度
 *   - dismiss() : 取消通知
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