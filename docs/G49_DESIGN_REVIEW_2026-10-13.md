# G49 设计参考集与实施评审 — 2026-10-13

## 结论

G49 首批采用“延续现有品牌、统一空状态、补齐无障碍和减少动态效果”的小步方案。不替换现有完成页 Reanimated + Confetti，不新增设计依赖，不引入来源或授权不明的 Lottie 素材。当前代码与自动测试已完成；以下旧截图只用于设计对照，浅色/深色、小屏、动态字体及新包真机仍待验证。

## 参考来源与证据边界

| 参考 | 用途 | 边界 |
|---|---|---|
| `.tmp/g48/final-e06a82f-ready.png` | 首页信息密度、品牌橙与内容层级 | Android 10 / light 的 `e06a82f` 旧代码，不是 G49 验收图 |
| `.tmp/g48/final-active2-stable.png` | 训练中布局、紧凑控件与底部操作区 | 旧训练流程截图，不覆盖 lb 修复或 G49 空状态 |
| `.tmp/g48/final-weighted-stable.png`、`.tmp/g48/weighted-best-card.png` | 完成页 2×2 统计、最佳组卡与庆祝后的稳定态 | 旧浅色真机结果，不覆盖 reduce-motion 分支 |
| `.tmp/brand/icons-preview.png` | 品牌标记和图标系统的一致性参考 | 生成预览，不是设备截图，也不证明启动链路通过 |

这些参考均为本地忽略文件，不作为仓库可复现的视觉快照。没有当前代码的深色、小屏或无障碍大字号截图，因此不得写成已验。

## 设计取舍

### 保留

- 沿用主题 token、品牌橙、现有排版和紧凑工具型布局，不另起一套颜色或字体。
- 训练完成页保留 G48 已验证的 CountUp、Reanimated 勾选光环与 Confetti 路径。
- EmptyState 保留 `icon` 自定义入口；内置插画不可用或调用方需要特殊内容时，标题、描述和 CTA 仍可独立工作。

### 调整

- 用 7 类主题感知线性插画替换生产空状态中的 emoji：`training`、`plan`、`measurement`、`search`、`chart`、`missing`、`healthy`。
- 文案从泛化提示改为说明“为什么为空”和“下一步是什么”；已有 CTA 保持可操作，动作缺失页的“回上一页”从空函数修为 `navigation.goBack()`。
- 插画从无障碍树隐藏，标题标记为 header，CTA 提供明确可访问名称。
- 系统开启“减少动态效果”时，训练完成页使用静态勾选、计数直接到最终值，并跳过 Confetti 与装饰性 heavy；默认路径不变。

## 插画资源与版权

| 类型 | 场景 |
|---|---|
| `training` | 首页首次训练、数据概览无训练动作 |
| `plan` | 训练计划为空 |
| `measurement` | 身体测量为空 |
| `search` | 动作库筛选无结果 |
| `chart` | 热力图、1RM、容量趋势、肌群分布、动作历史无数据 |
| `missing` | 动作缺失、未指定动作 |
| `healthy` | 诊断页无错误日志 |

全部图形由 `src/components/EmptyState.tsx` 内 `react-native-svg` 基础几何代码绘制，使用仓库主题色；无下载图片、第三方插画包或外部版权素材。固定 `96 × 80` 画布只承担装饰，文本和操作不依赖图形传达。

## Lottie 评估

项目已安装 `lottie-react-native ~7.3.8`，所以“不采用”不是因为缺依赖。当前没有经过授权审核、风格匹配且能明显优于现有实现的动画素材；替换还会扩大包体、动效 QA 和回归范围。因此首批不引入 JSON 素材、不改变默认庆祝路径。未来若评估新素材，至少要同时满足：来源和许可可追溯、离线可用、浅深色可辨、低端机流畅、减少动态效果时可完全静态降级。

## 实施批次与回退

1. 单位换算先作为 G48 后续缺陷修复：底层保持 kg，输入与显示在 UI 边界换算。
2. EmptyState 组件增加内置插画、语义与兼容入口，再迁移生产调用和开发 Showcase。
3. 完成页补 reduce-motion 分支，不改变默认动画参数。
4. 回退时可逐调用点恢复 `icon`，或删除 `illustration` prop 使用默认图；完成页可单独回退 reduce-motion 分支，均不涉及 schema、数据迁移或原生依赖。

主要影响文件：`src/components/EmptyState.tsx`、`src/screens/HomeScreen.tsx`、`TrainingScreen.tsx`、`BodyMeasurementScreen.tsx`、`ExerciseLibraryScreen.tsx`、`ExerciseDetailScreen.tsx`、`ExerciseHistoryScreen.tsx`、`DiagnosticsScreen.tsx`、`src/screens/data/*`、`TrainingCompleteScreen.tsx` 及对应测试。

## 可执行 AC

- AC-1：所有生产 EmptyState 不再依赖 emoji；7 类插画按主题 token 渲染，装饰不进入无障碍树。
- AC-2：空状态标题、描述和 CTA 在 320dp 宽、浅/深色和系统大字号下不重叠、不截断；无图时仍能理解并操作。
- AC-3：首页、计划、动作筛选和动作缺失的 CTA 均触发真实导航或清除操作，无空函数。
- AC-4：默认动态设置下，训练完成页 CountUp、粒子和一次性庆祝行为不回退。
- AC-5：开启“减少动态效果”后，统计立即显示最终值，无循环光环、Confetti 或装饰性 heavy。
- AC-6：`npm run typecheck` 和 EmptyState、单位换算、训练完成页定向测试通过；不要求重跑与改动无关的 G48 真机流程。
- AC-7：新 APK 在至少一台 Android 真机复验 light/dark、320dp 或等效窄屏、系统大字号、reduce-motion；记录 commit、机型/API 与截图。

## 当前验证状态

- 已完成：类型检查；EmptyState 组件测试；单位工具、WeightInput 与训练完成页定向测试；代码层 reduce-motion 分支。
- 静态边界：插画尺寸固定，文本容器不依赖图形宽度，标题/描述可换行，CTA 使用现有 Button 响应布局。
- 待完成：新 APK 真机的浅/深色、小屏、大字号、触控 CTA 与 reduce-motion 视觉验收。当前 ADB 无连接设备，未生成或安装包含本批代码的新包。
