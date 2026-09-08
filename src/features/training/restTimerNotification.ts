/**
 * G38 §2 — RestTimer 通知栏同步模块(占位)
 *
 * 责任(由 G38-2 commit 实现,本 commit 只挂占位):
 *   - ensureChannelAndPermissions():建 Android notification channel + 请求权限
 *   - showOrUpdateRestTimerNotification(remainingSec, totalSec):覆盖式更新固定 ID 通知
 *   - dismissRestTimerNotification():隐藏通知
 *
 * iOS 路径先留 Platform.OS check 占位,G38-2 实现时具体处理。
 */
export {};