/**
 * Haptic feedback wrapper —— G13 + G46。
 *
 * ## G13（原始设计）
 *
 * 单一通道：所有 `expo-haptics` 调用走这里，util 内部同步读
 * `settingsStore.hapticsEnabled`。用户在"设置 → 震动反馈"关掉开关后，
 * 全 App 的 selection / success / warning 全部静默：
 *   - 训练中完成本组（Success）
 *   - 休息计时器倒计时归零（Success）
 *   - 休息计时器启动/跳过/+15s（Selection）
 *   - 删除组（Warning）
 *   - 计划编辑器增删动作 / 切组类型（Selection）
 *   - 训练完成页入场（Success）/ 点完成（Selection）
 *
 * 设计要点：
 * - 同步读 `useSettingsStore.getState()`，不订阅 store：util 是
 *   fire-and-forget 副作用，不进入 React 渲染；订阅会无谓触发重渲染。
 *   设置页切换时新值在**下一次**调用生效 —— 切到开启时那次主动触发
 *   让用户感知"已开启"，与 iOS 系统 toggle 行为一致。
 * - 错误一律 catch：haptics 是 best-effort 体验，原生层未挂载或失败都吞掉，
 *   不向用户暴露。
 * - 不导出 `Haptics.*` —— 业务代码只通过 `haptic.*` 间接调用，
 *   禁止绕过开关（lint 友好 + 单一入口好审计）。
 *
 * ## G46（触感分层）
 *
 * G13 只有 selection / success / warning 三个 API，覆盖太粗：现在把语义扩成
 * **6 个 API** 与产品场景一一对应：
 *
 * | API             | 调用场景                       | 底层                                   |
 * | --------------- | ------------------------------ | -------------------------------------- |
 * | `tick()`        | 切组、按钮按下                 | `Haptics.selectionAsync()`             |
 * | `success()`     | 完成一组                       | `Haptics.notificationAsync(Success)`   |
 * | `warning()`     | 重复键、超时前                 | `Haptics.notificationAsync(Warning)`   |
 * | `error()`       | 删除、清空                     | `Haptics.notificationAsync(Error)`     |
 * | `heavy()`       | PR 达成                       | `Haptics.impactAsync(Heavy)`           |
 * | `restComplete()`| 休息结束                       | `Haptics.impactAsync(Medium)` + 二次 |
 *
 * **为何 success 用 notificationAsync 而非 impactAsync？**
 * Notification feedback 在 iOS / Android 上是系统级的"任务结果"事件，触发
 * 一个完整的振动"事件"（iOS 上的 success/warning/error 三段式节奏 + Android
 * 上的预设 effect 模式）。impactStyle 是"碰撞"模型，没有"完成"的语义。
 * 用户训练中完成一组 / 休息结束——本质是"任务完成"，用 notification( Success )
 * 比 impact( Medium / Heavy ) 语义更准。同时 Android 上 notification(Success) 会
 * 走 `VibrationEffect.createPredefined(EFFECT_CLICK)` 这条预定义通道，比
 * 自定义 `Vibrator.vibrate(duration)` 更节电、更符合 M3 节制手感 —— 详见
 * https://developer.android.com/reference/android/os/VibrationEffect
 * （G46 motion 评审 §触感 §3）。
 *
 * `restComplete` 用 impact(Medium) + 二次轻触：因为休息结束需要的不是"完成"
 * 而是"该动了"——一种催促感。比 success 更硬、更短促；二次轻触给视觉/触觉上的
 * "签到"信号。本节（G46）只交付 util 改造，**G48** 训练完成页接入。
 *
 * 兼容 G13 旧调用点：`haptic.selection()` / `success()` / `warning()` 签名与
 * 原版完全一致 —— 不破坏现有 18+ 调用点。
 */

import * as Haptics from 'expo-haptics';

import { useSettingsStore } from '@/store/settingsStore';

function isEnabled(): boolean {
  return useSettingsStore.getState().hapticsEnabled;
}

/**
 * 二次轻触（restComplete 用）：
 * 90ms 后再触发一次 impact(Light)，制造"叮咚"双击节奏。
 */
function secondaryTap(): void {
  if (!isEnabled()) return;
  setTimeout(() => {
    if (!isEnabled()) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  }, 90);
}

export const haptic = {
  /** 轻触反馈：选项切换、按钮按下、chip 选择、表单输入反馈。 */
  tick(): void {
    if (!isEnabled()) return;
    void Haptics.selectionAsync().catch(() => undefined);
  },

  /** Success 通知震动：完成本组 / 训练完成 / 休息结束。 */
  success(): void {
    if (!isEnabled()) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => undefined,
    );
  },

  /** Warning 通知震动：删除组等不可逆操作、即将超时。 */
  warning(): void {
    if (!isEnabled()) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
      () => undefined,
    );
  },

  /** Error 通知震动：删除、清空、错误反馈。 */
  error(): void {
    if (!isEnabled()) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
      () => undefined,
    );
  },

  /** Impact Heavy：PR 达成的"重锤"感受。 */
  heavy(): void {
    if (!isEnabled()) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
  },

  /**
   * 休息结束的"该动了"双击节奏：Medium + 90ms 后 Light。
   *
   * 注意：内含 setTimeout —— 不要在 unmount 频繁路径（每组训练）调；
   * 只用于计时器归零这种"一次性事件"。
   */
  restComplete(): void {
    if (!isEnabled()) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    secondaryTap();
  },

  // -------- G13 旧签名保留（向下兼容 G46 之前的所有调用点） --------

  /** @deprecated 自 G46 起用 `tick` 更语义化；保留签名避免破坏现有调用。 */
  selection(): void {
    if (!isEnabled()) return;
    void Haptics.selectionAsync().catch(() => undefined);
  },
};
