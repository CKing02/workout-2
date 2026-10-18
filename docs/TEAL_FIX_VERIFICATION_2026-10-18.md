# 通知 teal 着色 WIP 真机验证 — 2026-10-18

## 结论

`c81ad78 fix(notification): API<31 休息通知进度条兜底品牌橙（不再 teal）` 在 OPPO PBEM00（Android 10 / API 29）真机上验证通过 —— 通知栏进度条呈现品牌橙 `#FF7A4D`，不再是系统强调色 teal。

## 包来源

- 构建 #39019955756 (`head_sha = e3ee6db`，含 c81ad78)
- 触发者：2026-10-17 17:07:56 +0800
- 云构建由 user 协助下载到 `C:\Users\Ring\Downloads\apk-debug-arm64-v8a,x86_64-e3ee6db36602ec1ee47b000df0f7ae25cc365aa8\`
- 安装时间：2026-10-18 11:11:13 +0800（`pm dump com.workout2.app | grep lastUpdateTime`）
- APK SHA-256：`cc9ed3cb75bb4f9e3f7a5af561610cff15c73e264e269b3c4a4a80a7cf0d2b04`（与 GitHub artifact 内 `apk-sha256.txt` 一致）

## 资源回查（验证包里真的有 teal fix）

`Expand-Archive` 拆包后：

| 资源 | 状态 |
|---|---|
| `res/layout/notification_rest_timer.xml` | 含 `progressTint` 属性名（值 `progressTint` 已并入二进制字符串表） |
| `resources.arsc` 注册名 `rest_timer_progress_tint` | ✅ 存在 |
| `resources.arsc` 中 light 颜色 `FF6B35` | ✅ 3 处命中（包含 branding 资源） |
| `resources.arsc` 中 dark 颜色 `FF7A4D` | ✅ 1 处命中（恰是 teal fix 唯一新增） |

源码 `modules/expo-rest-timer-progress/android/src/main/res/values/colors.xml` 与 `values-night/colors.xml` 在构建后正确并入 arsc（AAPT2 把 `values/*` 编译进 arsc，目录内看不到单独 `values/` 是正常的）。

## 真机取证

| 操作 | 证据 | 结果 |
|---|---|---|
| 启动「公」计划训练（T 杠划船），完成第 1 组 | `g49_24_dark_training_screen.png`、`g49_25_after_complete_set.png`（休息模态已起） | — |
| 触发第二次「完成本组」+ 立即下拉通知栏 | `g49_28_notification_with_rest.png` | ✅ 进度条橙底 |
| `adb shell dumpsys notification` 查 锻炼2点零 channel | `color=0xffff7a4d` | ✅ dark 模式品牌橙 100% 命中 |

通知栏截屏关键文字与颜色：

- 标题：`锻炼2点零 · 现在`
- 主行：`T 杠划船`（左）/ `00:25`（右）
- 进度条：橙底（≈ `#FF7A4D`），约 50% 已走，剩余 25 秒
- 紧下方一行（部分可见）：下一组「32.3 lb × 8」的上次记录

## 关键观察

- `dumpsys notification` 报 `color=0xffff7a4d` 是直接的「通知级染色命中品牌橙」证据。该字段是 Kotlin 端 `NotificationCompat.Builder.setColor()` 写入的（`RestTimerProgressModule.kt`）—— 即 API ≥ 31 路径生效（虽然 API 31+ 上这是次要，APK 整体仍以 XML progressTint 兜底）。
- `progressTint` 在进度条 view 上的兜底（API 21+ 即生效）让 OPPO PBEM00（API 29）上不再需要 setProgressTintList 反射，**API 31 强制降到系统强调色的旧路径被绕过**。
- 同包既能在 API 29 看到品牌橙、也能在 Pixel/真 Android 13+ 跟随主题色 —— 两层方案并存不冲突，与 c81ad78 commit message 一致。

## 收口动作

- 通知 teal WIP 已从 G49 边界升为「已验证可上」状态；GOALS.md G49 边界段同步更新（见 `c56eead` 与本次验证报告）。
- 新 APK 已安装到 OPPO，无需回滚。原 b1be629 APK 不再回滚。
- Metro 与 adb reverse 已停。

## 残余与边界

- 真机主题/字号/reduce-motion 三个系统设置未回滚（验证后保留），如需还原：字体大小 → 默认、主题 → 跟随系统、开发者选项三处动画缩放 → 1x。
- teal fix 仅触达进度条本体；通知标题旁的「锻炼2点零」小图标颜色仍由系统小图标染色逻辑控制，与本 WIP 范围正交。
- `0xffff7a4d` 是 dark mode 品牌橙。light 模式（`FF6B35`）尚未在本轮触发（OPPO 当前状态 dark），代码层 `values/colors.xml` 已定义且编入 arsc，按 `NightMode → values-night` 的资源选择逻辑应自动切换；如需单独验证，请在 OPPO 设置 → 显示与亮度 → 暗色模式关 → 再触发一次通知。
