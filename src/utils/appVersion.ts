import Constants from 'expo-constants';

/**
 * App 版本号的**唯一来源**：`app.json` 的 `expo.version`。
 *
 * ## 为什么要有这个文件
 *
 * 2026-10-01 出 1.0.0 正式包时，真机上「我的」页页脚写的是 **`v0.1.0`**，
 * 导出的备份 JSON 里 `appVersion` 也是 `0.1.0` —— 三个地方各自硬编码了一份
 * 从没被更新过的字面量：
 *
 *   - `screens/ProfileScreen.tsx`   界面页脚
 *   - `utils/exportData.ts`         写进每份备份 JSON
 *   - `screens/DiagnosticsScreen.tsx` 复制诊断日志
 *
 * 值本身是错的（包是 1.0.0），但更根本的问题是**它可以和 app.json 不一致而没有任何
 * 东西会报错**：发版只改 `app.json` 的 `version`，这三处就永久停在旧值上。
 * 备份 JSON 里的 `appVersion` 尤其有实际影响 —— 将来做迁移/兼容判断时会照着它走。
 *
 * ## 为什么用函数而不是模块级常量
 *
 * 模块级常量在 import 时求值一次。若那时 `Constants.expoConfig` 尚未就绪（或被
 * 测试环境 mock 成 null），值会被永久冻成兜底值，且**再也不会恢复**。
 * 函数每次调用重新读，没有这个陷阱；调用点只有三处 UI，无性能顾虑。
 *
 * 兜底值取 `'0.0.0'` 而不是空串：空串渲染出来是「锻炼2点零 · v」，看起来像 UI bug；
 * `0.0.0` 一眼就是「没读到」，好排查。真机读不到 `expoConfig.version` 只可能是
 * 原生工程没重新 prebuild，那时任何非 `0.0.0` 的值反而会误导。
 */
export function getAppVersion(): string {
  return Constants.expoConfig?.version ?? '0.0.0';
}
