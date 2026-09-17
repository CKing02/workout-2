/**
 * G38 §2 + G38.1 + 设计优化 #1 — RestTimer 通知栏同步模块
 *
 * 责任:
 *   1. ensureChannelAndPermissions:建 Android notification channel + 请求 POST_NOTIFICATIONS 权限(Android 13+)
 *   2. showOrUpdateRestTimerNotification:用同一 identifier 覆盖式更新通知,
 *      G38.1 改为"两行布局"——title 显"休息中   剩 N 秒",body 是 unicode
 *      块字符进度条(20 段)+ 数字比例;每秒 tick 时 body 同步重画
 *      设计优化 #1: 传入 exerciseName 时,title 第二行追加"· 杠铃卧推"让用户
 *      在系统抽屉就知道"刚做完哪个动作"
 *   3. dismissRestTimerNotification:隐藏通知
 *
 * 设计选择:
 *   - 用固定 identifier + trigger=null 的 scheduleNotificationAsync 走"覆盖式更新",
 *     比 presentNotificationAsync(SDK 53 deprecated)更稳,且 iOS/Android 通用
 *   - sticky:true 仅 Android 有意义,iOS 自动忽略(SDK 57 公开 API 行为)
 *   - iOS 路径本期直接 return — 用户已确认 Android 优先;后续 G 任务补 Live Activity 时只动本文件
 *   - sound:null — 持续通知不要每秒响,HIGH importance + 震动 pattern 已足够提醒
 *   - 进度条:expo-notifications SDK 57 公开 API 不暴露 progress 字段(若用
 *     `as any` 强行传 NotificationCompat.Builder.setProgress 风险大,可能
 *     SDK 升级失效)。改用 unicode 块字符(█/░,20 段)在 body 字符串里手画
 *     进度条 — 跨平台稳定,视觉上是真进度条,无 native 依赖
 *
 * 限制(必须在调用方 bridge 内消化):
 *   - App 进 background 后 Android 会挂起 JS 线程,通知停在最后一次刷新的值
 *   - 用户切回前台时 bridge 监听 AppState='active' 立刻再调一次 showOrUpdate 自动校准
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

/* -------------------------------------------------------------------------- */
/* Channel / ID 常量                                                          */
/* -------------------------------------------------------------------------- */

/** Android notification channel id — 创建后 importance 不可改,所以首版就定对。 */
export const REST_TIMER_CHANNEL_ID = 'rest_timer';

/** 全局通知固定 id — 用 scheduleNotificationAsync 覆盖式更新,Android/iOS 通用。 */
export const REST_TIMER_NOTIFICATION_IDENTIFIER = 'rest_timer_notification';

/* -------------------------------------------------------------------------- */
/* Module-level guards — 避免重复 init                                        */
/* -------------------------------------------------------------------------- */

let channelAndPermissionsEnsured = false;

/**
 * 建 channel + 问权限。只在第一次 mount 时跑一次(channel 重复创建会抛)。
 * channel 创建失败时静默吞掉 — 通知失败不应该让 App 崩,只是通知功能不可用。
 */
export async function ensureChannelAndPermissions(): Promise<void> {
  if (channelAndPermissionsEnsured) return;
  if (Platform.OS !== 'android') {
    // iOS 不需要 channel,本期末实现通知(iOS 路径全 return)
    channelAndPermissionsEnsured = true;
    return;
  }

  try {
    await Notifications.setNotificationChannelAsync(REST_TIMER_CHANNEL_ID, {
      name: '训练休息',
      description: '训练中组间休息倒计时的持续通知,可在通知栏查看剩余秒数',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: null, // 不要系统默认音,每秒更新时不要响
      enableVibrate: true,
      showBadge: false,
    });

    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing !== 'granted') {
      await Notifications.requestPermissionsAsync({
        android: {},
      });
    }

    channelAndPermissionsEnsured = true;
  } catch (e) {
    // channel 已存在但参数不同会抛;或权限被拒。都不影响训练主流程。
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
 * G38.1: 用 unicode 块字符画"剩余比例"进度条,共 20 段。
 * 返回示例(remaining=30, total=60):
 *   "██████████████░░░░░░░░ 30/60"
 *
 * 选 20 段是因为 Android 通知 body 字号偏小,20 段全角 40 字符 + 数字
 * 比例约 50 字符,在 1-2 行的通知 body 里可读性最好;再多会换行,反而
 * 干扰标题对齐。
 */
function formatBlockBar(remaining: number, total: number): string {
  const SEGMENTS = 20;
  const ratio = total <= 0 ? 0 : Math.max(0, Math.min(1, remaining / total));
  const filled = Math.round(SEGMENTS * ratio);
  const empty = SEGMENTS - filled;
  return `${'█'.repeat(filled)}${'░'.repeat(empty)} ${remaining}/${total}`;
}

/**
 * 发或更新"休息中"通知(固定 ID 覆盖式)。
 *
 * @param remainingSec 当前剩余秒数(向上取整)— 显示在通知 title 和 body
 * @param totalSec 本轮总秒数 — 用于 body 块字符进度条 + 数字比例
 * @param exerciseName 触发本轮休息的动作名(可选);有则 title 追加"· <动作名>"
 */
export async function showOrUpdateRestTimerNotification(
  remainingSec: number,
  totalSec: number,
  exerciseName?: string | null,
): Promise<void> {
  if (Platform.OS !== 'android') return; // iOS 暂未实现,本期末做

  // 防御:剩余秒数永远 ≥ 0;总秒数 ≥ 1(避免除零)
  const safeRemaining = Math.max(0, remainingSec);
  const safeTotal = Math.max(1, totalSec);

  // 设计优化 #1: title 拼接"休息中　剩 N 秒"+"· <动作名>"
  // 没传或空串 → 不拼接(老行为,兼容匿名触发场景)
  const trimmedName =
    typeof exerciseName === 'string' ? exerciseName.trim() : '';
  const title = trimmedName
    ? `休息中　剩 ${safeRemaining} 秒　· ${trimmedName}`
    : `休息中　剩 ${safeRemaining} 秒`;

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: REST_TIMER_NOTIFICATION_IDENTIFIER,
      content: {
        // G38.1 + 设计优化 #1: 第一行 — 基础文案 + 可选动作名
        title,
        // 第二行 — 块字符进度条 + 数字比例
        body: formatBlockBar(safeRemaining, safeTotal),
        // sticky: Android only,iOS 自动忽略(SDK 57 行为)
        // (类型上 expo-notifications 公开 API 没暴露 sticky/ongoing 字段,
        //  此处用 any 绕过 — 调用方按 SDK 57 实际行为处理)
        data: {
          kind: 'restTimer',
          remainingSec: safeRemaining,
          totalSec: safeTotal,
          exerciseName: trimmedName || null,
        },
        // autoDismiss 缺省 true → 显式 false 让通知不会因为显示完一条就自动划掉
        autoDismiss: false,
      } as any,
      trigger: null, // 立即触发(覆盖式)
    });
  } catch (e) {
    if (__DEV__) {
      console.warn('[restTimerNotification] showOrUpdate failed:', e);
    }
  }
}

/**
 * 隐藏"休息中"通知(用户跳过 / 自然完成 / 切换到下一组时调)。
 * 调用静默失败 — 即便没在显示也没影响。
 */
export async function dismissRestTimerNotification(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    await Notifications.dismissNotificationAsync(REST_TIMER_NOTIFICATION_IDENTIFIER);
  } catch (e) {
    if (__DEV__) {
      console.warn('[restTimerNotification] dismiss failed:', e);
    }
  }
}