/**
 * Haptic feedback wrapper — G13.
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
 * - 不导出 `Haptics.*` —— 业务代码只通过 `haptic.{selection,success,warning}`
 *   间接调用，禁止绕过开关（lint 友好 + 单一入口好审计）。
 */

import * as Haptics from 'expo-haptics';

import { useSettingsStore } from '@/store/settingsStore';

function isEnabled(): boolean {
  return useSettingsStore.getState().hapticsEnabled;
}

export const haptic = {
  /** 轻触反馈：选项切换、按钮按下、chip 选择、表单输入反馈。 */
  selection(): void {
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

  /** Warning 通知震动：删除组等不可逆操作。 */
  warning(): void {
    if (!isEnabled()) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
      () => undefined,
    );
  },

  /** Error 通知震动（当前未使用，预留给 P1 错误反馈增强）。 */
  error(): void {
    if (!isEnabled()) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
      () => undefined,
    );
  },
};
