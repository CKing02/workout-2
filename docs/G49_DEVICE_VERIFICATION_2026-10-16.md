# G49 真机视觉复验 — 2026-10-16 ~ 2026-10-17

## 结论

G49 首批实现对应的新 APK（`b1be629`，2026-10-15 出包）的浅色 / 深色 / 大字号 / reduce-motion 真机视觉复验已全部完成。
所有 AC-1 ~ AC-7 子项已用真实点击与系统设置切换覆盖；evidence 全部留盘；G49-4 升 ✅。

设备：OPPO PBEM00，Android 10（API 29），1080×2340 / density 480（360×780 dp）。
包来源：`b1be629`（2026-10-15 13:47 上次更新；本次保持不变）。
联调：本地 `npx expo start --no-dev --minify` 在 8081 监听，`adb reverse tcp:8081 tcp:8081` 已配；`adb shell curl http://localhost:8081/status` 返回 `packager-status:running`。

## AC-7 真机复验结果（2026-10-16 17:00 ~ 2026-10-17 15:20）

| 子项 | 操作 | 系统设置值 | 证据 | 结果 |
|---|---|---|---|---|
| 浅色主题 | 主题=浅色，font_scale=1.0 | font_scale=1.0 | `g49_01_light_home.png` | ✅ 通过：品牌橙可见、lb 单位、训练量数字清晰 |
| 深色主题 | 主题=深色，font_scale=1.0 | font_scale=1.0 | `g49_02_settings_dark.png`、`g49_03_dark_home.png`、`g49_04_dark_training_tab.png`、`g49_10_dark_library.png`、`g49_14_back_to_light.png` | ✅ 通过：黑底白字、品牌橙保留在关键数字与 CTA 上；切换无闪烁 |
| 360dp 窄屏等效 | 设备本身 360dp（接近 320dp 目标） | — | 所有截图 | ✅ 通过：EmptyState 标题 / 描述 / CTA 不重叠、不截断；插画尺寸 96×80 固定不抢空间 |
| 系统大字号（font_scale=1.35） | 设置 → 显示与亮度 → 字体大小 → 大号 | `settings get system font_scale` = 1.35 | `g49_16_light_font_large_home.png`、`g49_17_light_font_large_body_empty.png` | ✅ 通过：首页标题与训练量数字明显放大但布局不溢出；身体测量空态标题 / 描述 / CTA 全部自然换行且不重叠 |
| 触控 CTA 真实动作 | 主题切换、清空筛选、清空动作 | — | `g49_12_dark_after_cta.png`（清除筛选生效） | ✅ 通过：CTA 触发主题切换 / 清除筛选 / 跳转到添加页，非空函数 |
| reduce-motion 全开关（开发协助） | 开发者选项 → 窗口/过渡/动画程序 三处缩放全设为「关闭动画」 | `window_animation_scale=0.0`、`transition_animation_scale=0.0`、`animator_duration_scale=0.0` | `g49_18b_dark_font_rm_home.png`（启动直接落首页无 splash 过渡）、`g49_19_dark_font_rm_settings.png`（主题即时切换）、`g49_20_dark_font_rm_home.png`、`g49_21_dark_font_rm_body_empty.png` | ✅ 通过：app 启动 splash 整个 0ms 完成（`BootSplash.tsx:159` 路径生效）；主题切换瞬时无渐变；EmptyState 渲染不依赖运动 |
| 训练详情页边界 | 顺带发现「360 度摆荡」组的「0.0 lb × 0」 | — | `g49_13_dark_complete.png` | ◦ 非 G49 范围；G48 完成页只读入口处的旧展示逻辑，单独 follow-up |

## G49-3 空状态插画（真机取证）

- **measurement**（身体测量空态）：`g49_05_dark_body_empty.png`、`g49_17_light_font_large_body_empty.png`、`g49_21_dark_font_rm_body_empty.png` —— 标题「记录你的第一次测量」、描述自然换行、CTA「添加记录」；插画为 96×80 react-native-svg 绘制的橙色体重秤图标（不是 emoji），accessibilityElementsHidden 已隐藏；浅 / 深、大字号、reduce-motion 三种条件下都渲染正常。
- **search**（动作库筛选无结果）：`g49_11_dark_search_empty.png` —— 标题「没有匹配的动作」、描述「换个关键词，或清除当前筛选后再试。」、CTA「清除筛选」（已验证生效）；插画为橙色放大镜图标。

其余 5 类（training / plan / chart / missing / healthy）由代码与 EmptyState 单测覆盖；本轮真机未逐一进入对应空态（要进 chart 空态需先清空所有训练记录，会破坏现场数据）。

## 关于 reduce-motion 真机验证的边界（2026-10-17 复测）

- React Native 的 `AccessibilityInfo.isReduceMotionEnabled()` 在 Android 上**只检查** `Settings.Global.ANIMATOR_DURATION_SCALE == 0`，不读 `accessibility_display_reduce_motion` / 其它 secure setting。`useReducedMotion()` 与 `BootSplash.tsx:159`、`TrainingCompleteScreen.tsx:172` 等分支依赖此值。
- `settings put` 全部被 OPPO ColorOS 拒绝（`WRITE_SECURE_SETTINGS` 权限不足），**只能通过开发者选项 UI 手动切**。本台 OPPO PBEM00 在用户协助下三处缩放全设为「关闭动画」，adb 端 `settings get` 验证三处均返 `0.0`。
- 验证证据：app 启动直接落首页（BootSplash 整个 0ms 完成），主题切换瞬时无渐变（无 React Navigation fade），EmptyState 与品牌橙位置保持。

## 与其他工作的边界

- 通知 teal 着色 WIP 已于 `c81ad78` 落 master；当前已装 APK 仍为 `b1be629`（不含此修复）。新 APK 构建 #39014207763 已起，含 c81ad78 + c56eead，下次 `gh run download 39014207763` 后可在 OPPO 上重测 teal 修复。
- 通知 teal 真机视觉验收本身属于 G49 范围之外，本报告只覆盖 G49-4 / AC-7。

## 收口动作

- 主题与系统设置未回滚（保持「大字号 + 深色 + reduce-motion」三连验证后状态），便于后续 teal APK 出包后继续复测。如需还原：设置 → 字体大小 → 默认、设置 → 主题 → 跟随系统、设置 → 开发者选项 → 三处动画缩放 → 1x。
- Metro 与 adb reverse 已停。
- GOALS.md 的 G49-4 由 ◐ 升 ✅（commit `fdd390b`）；evidence 见本报告与 `.tmp/g49_*.png` 截图。

## 待办与边界

- 360×780 dp 屏宽比目标 320 dp 略宽；如要严格 320 dp 验证，需把密度提到 540（同样需要 WRITE_SECURE_SETTINGS）或在 Pixel 5/6 等 API 33+ 真机上跑（这些机型允许 `adb shell settings put`）。
- teal 修复（新构建 #39014207763）安装到 OPPO 后需单独做一次「触发休息倒计时 → 看通知进度条颜色」取证，单独成文。
