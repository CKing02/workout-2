package expo.modules.resttimerprogress

import expo.modules.core.BasePackage

/**
 * RestTimerProgress — autolinking 注册入口
 *
 * 这个 Package 类本身**不**需要在 Kotlin 层面显式引用 RestTimerProgressModule:
 *   - `expo-modules-autolinking` gradle plugin 在 build 时用反射扫 sourceDir,
 *     把所有 `expo.modules.kotlin.modules.Module` 子类自动 bundle 进来
 *   - 但 autolinker 的静态 metadata 扫描需要发现至少一个 `BasePackage` 子类,
 *     否则 packages 数组会是 [] —— expo-status-bar / expo-notifications 都遵循
 *     这个模式(StatusBarPackage / NotificationsPackage 都不显式引用 Module)
 *
 * 所以本类只作为 autolinking 的 anchor,不持有 module 引用。
 */
class RestTimerProgressPackage : BasePackage()