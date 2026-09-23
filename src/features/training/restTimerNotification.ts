/**
 * RestTimer 通知栏同步模块 — 原生 ProgressBar 版
 *
 * 责任:
 *   1. ensureChannelAndPermissions : 建 channel + 申请 POST_NOTIFICATIONS 权限
 *   2. showOrUpdateRestTimerNotification : 固定 ID 覆盖式更新通知。
 *      排版极简(用户拍板,2026-09-20 起内容区自绘 RemoteViews):
 *        title :  动作名(单行;无动作名时兜底 "休息中")
 *        倒计时 :  <Chronometer> —— **注意不是 title 的一部分**。SystemUI 自己
 *                 每秒刷新它,所以 App 进程被冻结时数字照样在走。2026-09-22 之前的
 *                 实现把 mm:ss 拼进 title 由 App 每秒重写,退后台 JS 一停摆
 *                 那个数字就成了假的
 *        进度条 :  主题色着色,收起态与展开态是同一份 RemoteViews
 *                 (展开不会多出内容,原来的 "倒计时中" body 行已删)
 *   3. dismissRestTimerNotification : 隐藏通知
 *
 * 设计选择(2026-09-18 重构):
 *   - 进度条不再用 unicode 块字符(█/░)伪造 —— expo-notifications SDK 57
 *     不暴露 progress 字段,unicode 在 body 字符串里手画看起来字宽不一、
 *     一格一格跳,完全不像视频播放器
 *   - 改成本地 expo-module `expo-rest-timer-progress`,内部用
 *     NotificationCompat.Builder.setProgress() + 主题色 .color —— Android
 *     系统用自带 ProgressBar 模板渲染,跨 OEM 一致、每秒平滑前移
 *   - module 内部 setProgress 增量更新,每秒 1 次;bridge 不再每秒 re-build
 *   - colorHex 由调用方(bridge)从 useTheme().colors.primary 传入,
 *     light/dark 自动切换 + JS 单一真源
 *   - iOS 路径本期直接 return —— 用户已确认 Android 优先
 *
 * 限制(必须在调用方 bridge 内消化):
 *   - App 进 background 后 Android 会挂起 JS 线程,**进度条**会停在最后一次刷新的值
 *     (倒计时数字与"到点提醒"已由原生兜底,见 2026-09-22 注)
 *   - 用户切回前台时 bridge 监听 AppState='active' 立刻再调一次 showOrUpdate 自动校准
 *
 * 2026-09-22 后台可见性修复(两处都在原生侧,本文件只是配合):
 *   - mm:ss 从 title 拆出 → 原生 <Chronometer>,SystemUI 自绘自走
 *   - 到点提醒 → 原生 AlarmManager + RestTimerAlarmReceiver,不依赖 JS 存活。
 *     原因是休息计时器的主场景就是"人不在看屏幕",靠 JS 存活等于没有提醒
 *
 * 调用方约定:
 *   - showOrUpdateRestTimerNotification 的 colorHex 参数:bridge 必须传
 *     useTheme().colors.primary,不要传 undefined/null —— null 让 native
 *     沿用 channel 默认 accent
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  ensureChannel as nativeEnsureChannel,
  showOrUpdate as nativeShowOrUpdate,
  dismiss as nativeDismiss,
  consumeExpired as nativeConsumeExpired,
} from 'expo-rest-timer-progress';

/* -------------------------------------------------------------------------- */
/* Channel / ID 常量                                                          */
/* -------------------------------------------------------------------------- */

/** Android notification channel id —— 原生模块的 NotificationChannel 也用这个。 */
export const REST_TIMER_CHANNEL_ID = 'rest_timer';

/** 全局通知固定 id —— expo-notifications 旧路径仍用,新原生模块用 int 1001;两个并存,语义一致。 */
export const REST_TIMER_NOTIFICATION_IDENTIFIER = 'rest_timer_notification';

/* -------------------------------------------------------------------------- */
/* Module-level guards — 避免重复 init                                        */
/* -------------------------------------------------------------------------- */

let channelAndPermissionsEnsured = false;

/**
 * 建 channel + 问权限。只在第一次 mount 时跑一次(channel 重复创建会抛)。
 * channel 创建失败时静默吞掉 —— 通知失败不应该让 App 崩,只是通知功能不可用。
 */
export async function ensureChannelAndPermissions(): Promise<void> {
  if (channelAndPermissionsEnsured) return;
  if (Platform.OS !== 'android') {
    channelAndPermissionsEnsured = true;
    return;
  }

  try {
    await nativeEnsureChannel();
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing !== 'granted') {
      await Notifications.requestPermissionsAsync({ android: {} });
    }
    channelAndPermissionsEnsured = true;
  } catch (e) {
    if (__DEV__) {
      console.warn('[restTimerNotification] ensureChannelAndPermissions failed:', e);
    }
    channelAndPermissionsEnsured = true; // 别无限重试
  }
}

/* -------------------------------------------------------------------------- */
/* 主入口:发 / 更新 / 隐藏                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 发或更新"休息中"通知(原生 ProgressBar,固定 ID 覆盖式)。
 *
 * @param remainingSec 当前剩余秒数(向上取整)—— 显示在通知 title
 * @param totalSec 本轮总秒数 —— 用于原生 ProgressBar 的 max
 * @param exerciseName 触发本轮休息的动作名(可选);有则作为 title 前缀
 * @param colorHex 主题 primary 色 hex,例 "#FF6B35"(light)/ "#FF7A4D"(dark)
 */
export async function showOrUpdateRestTimerNotification(
  remainingSec: number,
  totalSec: number,
  exerciseName?: string | null,
  colorHex?: string | null,
): Promise<void> {
  if (Platform.OS !== 'android') return;

  // 防御:剩余秒数永远 ≥ 0;总秒数 ≥ 1(避免除零)
  const safeRemaining = Math.max(0, remainingSec);
  const safeTotal = Math.max(1, totalSec);

  // 极简排版(2026-09-22 起):title 只承载动作名,mm:ss 由原生 <Chronometer> 画。
  // 空动作名时兜底 "休息中" —— 否则左侧留空,右边孤零零一个倒计时很难看懂。
  const trimmedName =
    typeof exerciseName === 'string' ? exerciseName.trim() : '';
  const title = trimmedName || '休息中';

  try {
    await nativeShowOrUpdate(safeRemaining, safeTotal, title, colorHex ?? null);
  } catch (e) {
    if (__DEV__) {
      console.warn('[restTimerNotification] showOrUpdate failed:', e);
    }
  }
}

/**
 * 隐藏"休息中"通知(用户跳过 / 自然完成 / 切换到下一组时调)。
 * 调用静默失败 —— 即便没在显示也没影响。
 */
export async function dismissRestTimerNotification(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    await nativeDismiss();
  } catch (e) {
    if (__DEV__) {
      console.warn('[restTimerNotification] dismiss failed:', e);
    }
  }
}

/**
 * "消费" alarm receiver 写入的"已到点"标记 —— 读 + 清 SharedPreferences。
 *
 * 触发场景:退后台 + 锁屏期间 App 进程被 freezer/cache,JS 端 RAF tick 不再
 * 触发;receiver 唤起时已经 cancel 通知 + 震动 + 写 SP,但 **App 内
 * RestTimerOverlay 还停留在 0 秒**(JS 端没机会推进 state)。
 *
 * bridge mount + AppState 'active' 时调本方法:
 *   - 返回 > 0 → 让 store 进入"已到点"分支,跳过 1 秒折叠延迟,立即 skip
 *     让 overlay 消失(视觉与通知栏一致 — 通知栏已 cancel,App 内也别挂着)
 *   - 返回 0   → 没发生过 receiver 唤起,JS 走正常 RAF tick 路径
 *
 * native 是 read + clear 原子(commit 同步),多次调用安全。
 *
 * 返回:`number`(elapsedRealtime ms),0 = 无未消费的到点事件。
 */
export async function consumeExpiredRestTimerNotification(): Promise<number> {
  if (Platform.OS !== 'android') return 0;
  try {
    return await nativeConsumeExpired();
  } catch (e) {
    if (__DEV__) {
      console.warn(
        '[restTimerNotification] consumeExpired failed:',
        e,
      );
    }
    return 0;
  }
}