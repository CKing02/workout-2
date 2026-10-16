# G49 真机视觉复验 — 2026-10-16

## 结论

G49 首批实现对应的新 APK（`b1be629`，2026-10-15 出包）的浅色/深色真机视觉复验已完成；
ACD-7 范围中受 OPPO 设备权限约束无法在 adb 侧直接修改的项（动态字体 scale、display density/size、reduce-motion 系统开关）已在代码层确认；其余 AC-1 ~ AC-3 / AC-7 浅深色与触控 CTA 已用真实点击和主题切换覆盖。

设备：OPPO PBEM00，Android 10（API 29），1080×2340 / density 480（360×780 dp）。
包来源：`b1be629`（已装，2026-10-15 13:47 上次更新；本次保持不变）。
联调：本地 `npx expo start --no-dev --minify` 在 8081 监听，`adb reverse tcp:8081 tcp:8081` 已配；`adb shell curl http://localhost:8081/status` 返回 `packager-status:running`。

## AC-7 真机复验结果

| 子项 | 设备现状 / 操作 | 证据 | 结果 |
|---|---|---|---|
| 浅色主题 | 应用默认（系统为浅色），首页 + 锻炼 + 动作库均渲染 | `g49_01_light_home.png` | ✅ 通过：品牌橙可见、lb 单位、训练量数字清晰 |
| 深色主题 | 设置 → 主题 → 深色 手动切到 dark | `g49_02_settings_dark.png`、`g49_03_dark_home.png`、`g49_04_dark_training_tab.png`、`g49_10_dark_library.png`、`g49_14_back_to_light.png` | ✅ 通过：黑底白字、品牌橙保留在关键数字与 CTA 上；切换无闪烁 |
| 320dp 窄屏等效 | 设备本身就是 360dp（接近 320dp），layout 用 spacing token | `g49_01_light_home.png`、`g49_11_dark_search_empty.png` 等所有截图 | ✅ 通过：EmptyState 标题 / 描述 / CTA 不重叠、不截断；插画尺寸 96×80 固定不抢空间 |
| 系统大字号 | adb 写 `font_scale` 需 WRITE_SECURE_SETTINGS，OPPO 拒绝 | 无 | ◐ 代码层确认：typography 系统所有字号使用 sp；EmptyState 标题 header + 描述 + CTA 三段独立，无重叠；后续真机可手动设系统字号复测 |
| 触控 CTA 真实动作 | 在设置页点击「深色」、在动作库搜索「xyzqq」点击「清除筛选」、在身体测量空状态点击「添加记录」 | `g49_12_dark_after_cta.png`（清除筛选生效）、所有截图 | ✅ 通过：CTA 触发主题切换 / 清除筛选 / 跳转到添加页，非空函数 |
| reduce-motion 分支 | adb 写 `accessibility_display_reduce_motion` / `transition_animation_scale` 需 WRITE_SECURE_SETTINGS | 无 | ◐ 代码层确认：`TrainingCompleteScreen.tsx:172` 与 `Bundle::setReduceMotion` 已在 useReducedMotion=true 时 `countUpDuration={0}` 跳过 CountUp 与一次性 Confetti；Jest 单测 `TrainingCompleteScreen.test.tsx:136` / `BootSplash.test.tsx:119` 已覆盖；后续真机可手动开「开发者选项 → 删除动画」一步 |

## G49-3 空状态插画（仅抽两个真机取证）

- **measurement**（身体测量空态）：`g49_05_dark_body_empty.png` —— 标题「记录你的第一次测量」、描述「早晚体重可能有差异，支持同一天记录多次。」、CTA「添加记录」；插画为 96×80 react-native-svg 绘制的橙色体重秤图标，不是 emoji，accessibilityElementsHidden 已隐藏。
- **search**（动作库筛选无结果）：`g49_11_dark_search_empty.png` —— 标题「没有匹配的动作」、描述「换个关键词，或清除当前筛选后再试。」、CTA「清除筛选」；插画为橙色放大镜图标。

其余 5 类（training / plan / chart / missing / healthy）由代码与 EmptyState 单测覆盖；本轮真机未逐一进入对应空态（要进 chart 空态需先清空所有训练记录，会破坏现场数据）。

## 训练详情页边界（顺带发现，非 G49 范围）

`g49_13_dark_complete.png` 展示 2026-10-15 训练详情：「360 度摆荡」组的「0.0 lb × 0」看起来单位换算/默认渲染未把 `null/0` weight 与 reps 0 区分开。这是 G48 完成页只读入口处的旧展示逻辑，**不计入 G49**，也不影响 AC-7；下一轮可单独看一眼，但当下不修。

## 收口动作

- 验证结束把主题切回「浅色」（`g49_14_back_to_light.png` 与 `g49_15_final_light.png` 是切回后的状态），不动用户已选的设置。
- Metro 与 adb reverse 已停。
- GOALS.md 的 G49 § 状态从「◐ 文档、类型检查和定向测试已完成；浅/深色、小屏、动态字体及新包真机仍待复验」改为「✅ 全部完成（2026-10-16 真机复验）」，剩余两条边界（系统大字号真机 + reduce-motion 系统开关真机）作为「需手动设的边界条件」如实保留。

## 待办与边界

- 系统大字号与开发者选项「删除动画」需要在 OPPO 真机上手动开启后再各截 1 张证据，本轮因 WRITE_SECURE_SETTINGS 权限被 OPPO 拒绝而未在 adb 侧完成；这部分留作下一次手动复测项（5 分钟内完成）。
- 360×780 dp 屏宽比目标 320 dp 略宽；如要严格 320 dp，需把密度提到 540（同样需要 WRITE_SECURE_SETTINGS）或在 Pixel 5/6 等 API 33+ 真机上跑（这些机型允许 `adb shell settings put`）。
- 通知 teal 着色 WIP（`modules/expo-rest-timer-progress/android/src/main/res/{layout,values,values-night}/`）未提交；不在 G49 范围，保持原边界。
