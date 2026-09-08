# 锻炼2点零 — 目标驱动开发清单

> 本文档是 Agent 实现的唯一指令源。每完成一个目标，必须按"自检清单"逐项打勾并提交报告。

## 工作约定

- **技术栈**：React Native + Expo (TypeScript) / expo-sqlite / Zustand / React Navigation / Reanimated / Lottie
- **状态管理**：Zustand 单一 store 树（按业务域切片）
- **样式**：StyleSheet.create + Design Token（避免内联魔法数字）
- **目录约定**：
  ```
  src/
    app/            # 入口、根 Provider、路由注册
    features/       # 业务功能（每个目标一个子目录）
      plan/         # G5
      training/     # G6
      ...
    components/     # 通用组件（设计系统）
    db/             # SQLite schema、迁移、查询
    store/          # Zustand store 切片
    screens/        # 页面（与 features 解耦时可省略）
    navigation/     # 路由配置
    theme/          # Design Token、ThemeProvider
    utils/          # 通用工具
    constants/      # 内置动作库、MUSCLE_GROUPS、EQUIPMENT 等
  ```
- **每完成一个目标**：Agent 必须输出一份 Markdown 自检报告（每条 AC 一个 ✅/❌），并说明实现位置（文件:行号）

### 🎨 设计 Skill 调用约定（所有 UI 类目标必读）

**所有涉及页面、组件、视觉、交互的 Agent 必须遵守：**

1. **设计情报获取**：开工前调用 Skill `ui-ux-pro-max` —— 它含 84 种风格、192 种配色、192 种产品类型、98 条 UX 准则、22 种技术栈（React Native 在内）。明确选定：本项目用 `style`、`color palette`、`product type`、`stack (react-native)` 的哪一组参考
2. **交互原则校验**：用 `nng-ux-heuristics`（Nielsen 10 大启发式）自检 10 条 —— 在自检报告里列出"启发式 #N 通过/待优化"
3. **动画与微交互**（G6 训练执行、G7 计时器必读）：用 `interaction-motion-design`
4. **无障碍**（每个交互组件）：用 `accessibility-inclusive-design` 校验 `accessibilityLabel`、`accessibilityRole`、对比度

**自检报告必须包含 "🎨 设计决策" 小节**：
- 选用的 design system / style（Materially / iOS HIG / 自研）
- 调色板来源（健身蓝/绿/橙 等）
- 关键交互反馈（按下/聚焦/选中/错误的视觉/触觉反馈）
- 触发的 NNG 启发式（至少 3 条）

**违反此约定的自检报告视为不通过。**

---

## G1. 项目脚手架 + 目录结构 + 主题基础

**优先级**：P0  |  **依赖**：无  |  **阶段**：1

### 涉及
- 启动 Expo + TypeScript 项目（使用 Expo SDK 最新稳定版，blank-typescript 模板）
- 安装核心依赖：expo-sqlite, zustand, @react-navigation/native, @react-navigation/native-stack, @react-navigation/bottom-tabs, react-native-screens, react-native-safe-area-context, react-native-gesture-handler, react-native-reanimated, lottie-react-native, expo-haptics, expo-keep-awake, @react-native-community/datetimepicker（按需）
- 配置 babel（reanimated/plugin 必须最后）、metro、tsconfig（strict + path alias `@/*`）
- 创建上述目录结构（空文件夹用 `.gitkeep` 占位）
- 实现 `src/theme/`：colors / typography / spacing / radius / shadows Token，支持 light + dark
- 实现 `ThemeProvider` + `useTheme` hook（基于系统色 + 手动切换）
- 在 `app.json` 配置 Android/iOS 启动屏、图标占位、应用名称 "锻炼2点零"
- 在根布局渲染一个 Tab 骨架（3 个 Tab：首页/锻炼/我的），每个 Tab 一个空屏 `Placeholder`

### 验收标准（AC）
- AC-1.1 `npx expo start` 启动无报错
- AC-1.2 目录结构与上述一致
- AC-1.3 `tsconfig.json` 启用 strict + path alias `@/*`，`import x from '@/theme'` 可解析
- AC-1.4 `useTheme()` 在浅/深色下返回对应 token
- AC-1.5 App 启动显示 3 Tab 骨架，标题正确
- AC-1.6 切换模拟器色模式，App 颜色随之变化（跟随系统）

### 自检清单
- [ ] `package.json` 依赖完整、`expo start` 无 error/warning（reanimated babel 插件已配置）
- [ ] `tsconfig.json` strict + paths
- [ ] `src/theme/` 至少 5 个 token 文件
- [ ] `ThemeProvider` 通过 `Appearance.getColorScheme()` 监听系统
- [ ] 3 Tab 渲染，placeholder 文案明确"首页/锻炼/我的"
- [ ] 切换系统色 → App 立即跟随

---

## G2. SQLite 数据层 + Zustand Store + 内置动作库种子

**优先级**：P0  |  **依赖**：G1  |  **阶段**：1

### 涉及
- 设计 SQLite 表结构（见附录 A）
- 实现 `src/db/schema.ts`、`src/db/migrations.ts`、`src/db/index.ts`（expo-sqlite 异步 API）
- 实现 `src/db/repositories/`：exerciseRepo / planRepo / trainingRepo / settingsRepo
- 实现 `src/store/`：exerciseStore / planStore / trainingStore / settingsStore（Zustand）
- 内置动作库种子（≥30 个常见动作，覆盖所有肌群 + 器械），写入数据库
- 定义 `MUSCLE_GROUPS` / `EQUIPMENT` / `METRIC_TYPES` 常量

### 验收标准（AC）
- AC-2.1 首次启动自动建表 + 写入种子动作
- AC-2.2 Repository CRUD 通过（写一个 `__dbTest` 屏幕或临时日志输出结果）
- AC-2.3 Zustand store 调用 repository 完成持久化
- AC-2.4 至少 30 个内置动作，按肌群分布合理（每肌群 ≥2）
- AC-2.5 杀进程重启 → 数据保留

### 自检清单
- [ ] 6 张表全部创建（参见附录 A）
- [ ] 种子数据写入成功，涵盖胸/背/肩/臂/腿/腹/核心
- [ ] repository 函数返回 Promise，错误抛出而非静默
- [ ] store 调用后刷新页面 / 重启 App 数据一致

---

## G3. 设计系统组件库

**优先级**：P0  |  **依赖**：G1  |  **阶段**：1

### 涉及
- 在 `src/components/` 实现基础组件（每个文件 = 一个组件 + Story）：
  - `Button`（primary/secondary/ghost/danger × sm/md/lg）
  - `IconButton`
  - `Input` / `NumberInput`（带 +/- 步进按钮，过滤非法字符）
  - `Card`
  - `ListItem`（带 left/right slot）
  - `Badge`（chip 形态，支持主题色变体）
  - `Sheet`（基于 Modal/Reanimated 的底部抽屉）
  - `Dialog`（确认对话框）
  - `SegmentedControl`
  - `EmptyState`（插画位 + 标题 + 副标题 + CTA）
  - `TimerRing`（SVG 圆环倒计时组件，集成 Reanimated）
  - `CheckableRow`（打钩行）
- 每个组件 props 强类型，使用 Design Token

### 验收标准（AC）
- AC-3.1 所有组件可在示例页（`/src/screens/_dev/Showcase.tsx`）渲染，深浅色都美观
- AC-3.2 组件不依赖任何业务 store
- AC-3.3 TimerRing 接受 `duration` / `onComplete`，倒计时到 0 回调

### 自检清单
- [ ] `Showcase.tsx` 截图/可访问，所有组件渲染
- [ ] 组件通过 token 取色，无硬编码颜色
- [ ] TimerRing 单独可演示

---

## G4. 动作库浏览 + 搜索 + 多选

**优先级**：P0  |  **依赖**：G2, G3  |  **阶段**：1

### 涉及
- 动作库页（Stack 屏幕）：
  - 顶部搜索框（按名称实时过滤）
  - 肌群 Tabs（按主要肌群单选筛选）+ 器械 SegmentedControl
  - 动作列表：左缩略图（无图用名称首字占位）/ 名称 / 肌群 badge / 器械
  - 多选模式：右上角"完成(N)"按钮，进入多选后左侧出现复选框
- 路由：Tab·锻炼 → "添加动作" → 动作库（多选模式） → 返回勾选集合

### 验收标准（AC）
- AC-4.1 输入关键词实时过滤（无需回车）
- AC-4.2 切换肌群 Tab 只显示该主要肌群动作
- AC-4.3 切换器械过滤生效
- AC-4.4 多选模式可勾选/取消勾选，右上角计数正确
- AC-4.5 点击"完成"返回上一页并把勾选数组回传

### 自检清单
- [ ] 列表滚动流畅（FlatList + getItemLayout 或固定高度）
- [ ] 无图占位首字美观
- [ ] 多选切换有视觉反馈

---

## G5. 训练计划 CRUD

**优先级**：P0  |  **依赖**：G2, G3, G4  |  **阶段**：1

### 涉及
- 锻炼 Tab：
  - 顶部"开始自由训练"按钮（占位即可，实现留给 G11）
  - 计划列表（按更新时间倒序）：卡片显示名称 + 动作数 + 上次训练日期
  - 卡片点击 → 计划详情/编辑
  - 长按 → 删除（带确认对话框）
- 新建/编辑计划页：
  - 名称输入（顶部）
  - 动作列表（已添加动作）
  - 每个动作可：删除 / 添加组（复制上一组数据，**不预设组数/次数**）
  - 底部"添加动作"按钮 → 跳 G4 动作库（多选）→ 回填
- 动作拖拽排序 → **不属于 MVP**

### 验收标准（AC）
- AC-5.1 创建计划：输入名称 + 至少 1 个动作 → 保存 → 列表出现
- AC-5.2 编辑计划：进入详情修改名称 / 增删动作 / 添加组 → 保存生效
- AC-5.3 删除计划：长按 → 二次确认 → 列表消失
- AC-5.4 添加组：点击"添加组" → 自动复制第 n 组数据，序号 +1
- AC-5.5 不预设组数：新建计划时动作不带组数（用户后续在训练中或编辑中添加）

### 自检清单
- [ ] 名称为空时禁用保存按钮
- [ ] 删除有确认对话框
- [ ] 添加组复制数据正确（包括 weight/reps/type）

---

## G6. 训练执行核心（逐组打钩 + 数据录入 + 组标记）

**优先级**：P0  |  **依赖**：G2, G3, G5  |  **阶段**：1

### 涉及
- 训练中页（全屏沉浸，`headerShown: false`，**禁止手势返回**）：
  - 顶部：当前动作名 / 第 n 组 / 总组数 / 训练总计时
  - 中部：数据录入（重量 + 次数 + 运动类型对应字段；kg 类型输入 weight/reps；时间类型输入 seconds；km 类型输入 km）
  - 组类型选择行：W(热身) / 正式 / D(递减) / F(力竭)（点击序号弹出 Sheet，含 4 个类型 + 底部"删除组"红色按钮）
  - 底部大按钮"完成本组 ✓" → 触发 G7 休息计时器
- 当前训练数据存 store + 内存（完成时一次性写入 DB，PRD 风险评估要求）
- 支持左右滑动查看上一组/下一组数据
- 组删除：左滑出现删除按钮

### 验收标准（AC）
- AC-6.1 进入训练中页全屏沉浸，无 Tab 栏、无导航栏
- AC-6.2 顶部计时器实时累计（mm:ss）
- AC-6.3 完成本组 → 组状态变 ✓，自动触发休息计时器（G7）
- AC-6.4 点击组序号弹出 Sheet：可切换 W/D/F/正式，底部"删除组"可删除该组
- AC-6.5 左滑组出现删除按钮，确认后删除
- AC-6.6 输入数字过滤非法字符（仅允许数字 + 1 位小数）
- AC-6.7 键盘弹出时当前输入行可见（KeyboardAvoidingView 配合）
- AC-6.8 切后台再回来：训练计时器和休息计时器都基于时间戳补偿正确

### 自检清单
- [ ] 完成本组后焦点自动到下一组
- [ ] 删除最后一组时按钮禁用
- [ ] 手势返回被禁用（Android：BackHandler；iOS：gestureEnabled false）

---

## G7. 休息计时器

**优先级**：P0  |  **依赖**：G6  |  **阶段**：1

### 涉及
- 完成本组后自动弹出 `Sheet`/覆盖层：`TimerRing` + 剩余秒数 + "跳过"/"+15s" 按钮
- 倒计时到 0 → `expo-haptics` 触发震动（heavy）→ 1 秒后自动收起
- 倒计时基于 `Date.now()` 时间戳（不被 setInterval 漂移影响）
- 设置中的"默认休息时间"作为默认值（单位：秒）
- 后台/锁屏期间：基于时间戳补偿
- 训练中状态栏显示倒计时（iOS 不强制，Android 用 notification 或常驻提示）

### 验收标准（AC）
- AC-7.1 完成本组立即弹出休息计时器
- AC-7.2 TimerRing 视觉进度平滑（Reanimated 驱动，不用 setState）
- AC-7.3 到 0 触发震动，1 秒后自动收起
- AC-7.4 切到后台 30 秒后回 App：剩余时间正确（不是 30-切走秒数）
- AC-7.5 "跳过"立即收起进入下一组；"+15s"增加 15 秒

### 自检清单
- [ ] 快速连续完成多组时计时器不重叠（后一组的计时器覆盖前一组的）
- [ ] 后台补偿逻辑有单元测试或可复现验证

---

## G8. 训练完成 + 取消训练

**优先级**：P0  |  **依赖**：G6  |  **阶段**：1

### 涉及
- 全部组完成（或用户主动结束）：
  - 弹出训练完成页（Lottie 动画 + 总结：时长 / 总训练量 / 动作数 / 完成组数）
  - "完成"按钮回到锻炼 Tab
- 取消训练：
  - 训练中页左上角"×"或返回按钮 → 确认对话框"放弃本次训练？"
  - 确认 → 清空内存训练状态 + 不写入 DB

### 验收标准（AC）
- AC-8.1 完成全部组后自动跳转训练完成页
- AC-8.2 总结数字正确（时长 = 训练总秒数；训练量 = Σ weight × reps）
- AC-8.3 取消训练二次确认
- AC-8.4 取消后历史记录不出现本次数据

### 自检清单
- [ ] 训练数据批量写入 DB（一次事务）
- [ ] Lottie 动画占位 OK（没有 Lottie 文件用 CSS 动画兜底）

---

## G9. 历史记录

**优先级**：P0  |  **依赖**：G2, G8  |  **阶段**：1

### 涉及
- 首页 Tab（锻炼动态）：
  - 顶部"开始锻炼"快捷入口
  - 历史列表按日期分组（今天 / 昨天 / 本周 / 更早）
  - 每条训练卡片：开始时间 + 时长 + 动作数 + 训练量
- 训练详情页（只读）：
  - 顶部：日期 / 时长 / 训练量
  - 动作列表：每个动作下展开每组数据（重量 × 次数 / 类型标签）
  - 不允许编辑（避免数据回写问题）

### 验收标准（AC）
- AC-9.1 首页按日期分组展示训练记录
- AC-9.2 点击训练进入详情
- AC-9.3 详情显示每个动作的每组数据
- AC-9.4 详情页无编辑入口

### 自检清单
- [ ] 列表滚动流畅
- [ ] 日期分组标题 sticky 或清晰可见

---

## G10. 设置

**优先级**：P0  |  **依赖**：G2  |  **阶段**：1

### 涉及
- 我的 Tab：
  - 用户名（可编辑，纯本地）
  - 设置入口（Stack 屏）：
    - 重量单位 kg / lb（影响所有重量输入和显示）
    - 主题：浅色 / 深色 / 跟随系统
    - 默认休息时间：30s / 60s / 90s / 120s / 自定义
    - 震动反馈开关（P1 预留位，默认开）
    - 数据管理 → 导出 JSON/CSV（P2 占位）
- 设置存 `settings` 表

### 验收标准（AC）
- AC-10.1 切换 kg/lb → 训练中输入和历史详情都同步换算（1 lb ≈ 0.4536 kg）
- AC-10.2 主题切换立即生效（重启保留）
- AC-10.3 默认休息时间影响 G7 计时器初始值
- AC-10.4 用户名保存后显示在"我的"页

### 自检清单
- [ ] 设置写入 DB，重启保留
- [ ] 单位换算逻辑单元测试或可复现

---

## G11. 自由训练模式

**优先级**：P0  |  **依赖**：G6, G7, G8  |  **阶段**：1

### 涉及
- 锻炼 Tab 顶部"开始自由训练"按钮（已在 G5 占位）
- 点击 → 进入动作库（多选模式，但顶部标题"选择训练动作"）→ 回填后直接进入训练中页
- 训练中页逻辑复用 G6，差异：训练记录不绑定 planId（NULL）

### 验收标准（AC）
- AC-11.1 自由训练可选 ≥1 个动作
- AC-11.2 完成训练后历史记录正常显示（planName 为空 / 显示"自由训练"）

### 自检清单
- [ ] 数据库 `trainings.plan_id` 可为 NULL
- [ ] 列表/详情正确处理 planName 缺失

---

## G12. 空状态 + 启动体验 + 边界打磨

**优先级**：P0  |  **依赖**：G4-G11 全部  |  **阶段**：1

### 涉及
- 各页空状态接入 `EmptyState` 组件：
  - 无计划：锻炼 Tab → "创建你的第一个训练计划" + CTA
  - 无历史：首页 → "开始你的第一次训练吧" + CTA
  - 动作库空筛选结果 → "没有匹配的动作，试试其他筛选"
- App 启动屏 / 应用图标占位
- 常见 Toast/提示：保存成功、删除成功、网络不可用（虽然 MVP 无网络）

### 验收标准（AC）
- AC-12.1 三个空状态都有合适文案 + CTA
- AC-12.2 启动无白屏闪烁
- AC-12.3 真机/模拟器首次启动体验顺滑

### 自检清单
- [ ] 全部空状态视觉一致
- [ ] 启动屏配置正确（背景色 = 主题色）

---

## G13. 震动反馈开关生效 ✅

**优先级**：P1  |  **依赖**：G10  |  **阶段**：2

### 涉及
- 新增 `src/utils/haptics.ts` 单一通道 wrapper（`haptic.{selection,success,warning,error}`）
- 替换所有裸 `Haptics.*` 调用（约 12 处：ActiveTraining ×6、RestTimerOverlay ×4、TrainingComplete ×2、PlanEditor ×2、Settings 切换反馈 ×1）
- util 内部同步读 `settingsStore.hapticsEnabled`，关闭后全 App 静默

### 验收标准（AC）
- AC-13.1 设置关闭震动后，完成本组、休息归零、删除组、训练完成等场景**均无震动**
- AC-13.2 切换为「开启」时立即给一次 selection 反馈，让用户感知开启生效

### 自检清单
- [x] 业务代码无 `import 'expo-haptics'`（仅 util 内一处）
- [x] 12+ 处 `Haptics.*` 全部走 wrapper
- [x] util 同步读 `getState()`，不订阅（fire-and-forget 不进 React 渲染）

---

## G14. 清除全部数据真做 ✅

**优先级**：P1  |  **依赖**：G2  |  **阶段**：2

### 涉及
- 新增 `db.wipeAllData()`：事务内清 7 张表（training_sets / trainings / plan_exercises / plans / exercises / settings / error_logs）+ reseed 内置动作
- Profile + Settings 两处「清除全部数据」按钮接上：调 wipeAllData → 4 个 store 全部 reload → toast
- 用户设置（kg/lb / 主题 / 休息 / 震动 / 用户名）一并清，回到 defaults

### 验收标准（AC）
- AC-14.1 点击「清除全部数据」→ 二次确认 → 真实清空数据库（重启验证）
- AC-14.2 清完后 4 个 store UI 立即清空（首页/锻炼/我的 无残留）
- AC-14.3 内置动作库自动恢复（动作库 picker 仍有 30+ 动作）
- AC-14.4 设置回到默认（kg、跟随系统、90s、震动开、空用户名）

### 自检清单
- [x] `wipeAllData` 事务包裹，失败回滚
- [x] Profile + Settings 两处都接上
- [x] `useTrainingStore.cancelTraining()` 兜底清内存 active 态

---

## G15. 自定义动作 ✅

**优先级**：P1  |  **依赖**：G2, G3, G4  |  **阶段**：2

### 涉及
- 动作库页右上角加「+」按钮 → 创建表单 Sheet
- 表单字段：名称、主要肌群（单选）、次要肌群（多选）、器械（单选）、运动类型（单选）
- 提交后写 `exercises` 表 `is_custom=1`，刷新 exerciseStore
- 动作库列表里自定义动作可长按删除（二次确认）
- 仓库层 `exerciseRepo.createCustom` / `delete` 已有，UI 接入即可

### 验收标准（AC）
- AC-15.1 在动作库创建自定义动作 → 列表立即出现新动作（顶部 is_custom ASC 排序）
- AC-15.2 选「自定」可在计划编辑器中被引用
- AC-15.3 长按自定义动作可删除（带二次确认）；内置动作无删除入口
- AC-15.4 杀进程重启后自定义动作仍存在

### 自检清单
- [ ] 表单字段全部校验（名称必填、肌群/器械/类型必选）
- [ ] 次要肌群多选 UI 不与主肌群冲突
- [ ] 排序：自定义排在自定义之后，名称次之

---

## G16. 计划内动作拖拽排序 ✅

**优先级**：P1  |  **依赖**：G5, G3  |  **阶段**：2

### 涉及
- 计划编辑器动作卡片左侧加「≡」拖拽手柄
- 拖动时卡片半透明 + 占位指示线
- 释放后调 `planStore.reorderExercises(planId, fromIndex, toIndex)` 持久化
- 集成 `react-native-gesture-handler` + Reanimated 4 worklet 做位移

### 验收标准（AC）
- AC-16.1 长按拖拽手柄可拖动卡片
- AC-16.2 拖动到新位置释放后，顺序更新持久化
- AC-16.3 跨边界拖动（最上/最下）不卡死

### 自检清单
- [ ] 拖动期间不影响其他屏渲染
- [ ] 取消拖动（中途放手）恢复原位置
- [ ] 拖动期间键盘/Sheet 不弹

---

## G17. 训练中显示上次数据 ✅

**优先级**：P1  |  **依赖**：G6, G9  |  **阶段**：2

### 涉及
- 新增 `trainingSetRepo.getLastSetsForExercise(exerciseId, limit=3)`
- `useTrainingStore` 加 `lastSetsByExerciseId: Record<string, TrainingSet[]>` 缓存
- 进入训练中页（每个动作首次聚焦时）按需查 last sets
- 训练中页数据录入区上方显示「上次：60kg × 8」（最近 3 组，3 行小字）

### 验收标准（AC）
- AC-17.1 当前动作下方显示最近 3 组数据（重量×次数+组类型标签）
- AC-17.2 自由训练的动作（无历史）显示「无历史数据」占位
- AC-17.3 单位切换（kg/lb）显示同步换算

### 自检清单
- [ ] 进入训练页一次性查全部 N 个动作的 last sets（不每切一个查一次）
- [ ] 缓存命中优先，避免重复 DB 查询

---

## G18. P1 数据可视化（4 屏合一）✅

**优先级**：P1  |  **依赖**：G9  |  **阶段**：2

### 涉及
- 我的 Tab 新增「数据」入口（Stack 屏）
- 4 屏共享一个 Stack：`DataOverview` → `CalendarHeatmap` / `VolumeTrend` / `MuscleGroupDistribution` / `OneRMRecords`
- 数据来源：trainings + training_sets 聚合查询（按周/月/动作）
- 图表：日历热力图（深浅色格） + 训练量柱状图（按周/月） + 肌肉群饼图（按训练量占比） + 1RM 列表（按动作）

### 验收标准（AC）
- AC-18.1 数据屏能进 4 个子页
- AC-18.2 热力图：过去 12 周每天一格，颜色深度 = 当日总训练量
- AC-18.3 趋势图：过去 12 周每周训练量柱状
- AC-18.4 肌肉群分布：饼图（按主要肌群聚合训练量）
- AC-18.5 1RM 列表：每个动作最高 weight × reps（按 Epley 公式估算 1RM = weight × (1 + reps/30)）

### 自检清单
- [ ] 4 屏统一空状态文案
- [ ] 浅深色都美观（用 Design Token 取色）
- [ ] 图表无第三方依赖（用 react-native-svg + Reanimated 绘制）

---

## G19. 数据导出 JSON ✅

**优先级**：P1  |  **依赖**：G2  |  **阶段**：2

### 涉及
- Profile + Settings「数据导出」入口接上真逻辑
- 导出 = 全表 dump 为 JSON（exercises / plans / plan_exercises / trainings / training_sets / settings）
- 用 `expo-sharing` 或 `expo-document-picker` 弹原生分享面板
- 导出文件名：`workout2-backup-YYYYMMDD-HHmm.json`

### 验收标准（AC）
- AC-19.1 点击导出 → 原生分享面板弹出（保存到文件 / 分享给他人）
- AC-19.2 导出 JSON 包含所有用户数据 + 设置
- AC-19.3 空数据也能导出（结构完整、数组为空）

### 自检清单
- [ ] 导出前 toast「正在导出…」
- [ ] 失败 toast「导出失败：xxx」并保留页面状态
- [ ] JSON 字段命名 camelCase（与 store 一致）

---

## G21. 训练中页 duplicate-key warning 修复 ✅

**优先级**：P0  |  **依赖**：G6  |  **阶段**：2

### 涉及
- 定位：`src/screens/ActiveTrainingScreen.tsx:1166`（`LastSetsPreview` 内 `lastSets.map((s, i) => <Text key={s.id} ... />)`）
- 根因（二分回退锁定）：在用户 DB 中存在 `training_sets.id` 重复行（errorLogs 一次性写入 186 条同 fingerprint，186 次 LogBox 升级到 red overlay）
- 修复：`key={s.id}` → `key={\`${s.id}#${i}\`}`（idx 后缀保证 React 兄弟节点唯一性）
- 顺手：`src/lib/diagnostics/installErrorHandlers.ts` 扩 console.error 过滤条件，让 `Encountered two children with the same key` 也能进 errorLogs（之前漏抓）+ `captureProjectFrames()` 抓 native JS 栈筛 src/ 帧（Hermes dev build 下拿不到，作为诊断基建保留）

### 验收标准（AC）
- AC-21.1 用户实机走「开始训练」流程不再有红色 LogBox overlay
- AC-21.2 `tsc --noEmit` 通过；改动仅在 `ActiveTrainingScreen.tsx:1166`（+注释）

### 自检清单
- [x] `key={\`${s.id}#${i}\`}` + 详细注释说明根因和 idx 兜底原因
- [x] 6 个非真凶 key 全部回退原样（`ActiveTrainingScreen:855` / `TrainingDetail:331/442` / `PlanEditor:452/778` / `RestTimerOverlay:155`）
- [x] memory 写入 `feedback-g21-dup-key-binary-rollback.md`（决策树 + 二分回退模板）

> **深一层根因**（**留 G22**）：`training_sets.id` 为什么在用户 DB 中重复？需要 SQL 审计 + 客户端链路排查
> **errorLogs 累积**（**留 G23**）：186 条同 fingerprint 在 30 秒内进表，需要 30 秒内同 fingerprint 去重

---

## G22. training_sets.id 重复行根因排查 + 修复 ✅ 自愈关闭

**优先级**：P0  |  **依赖**：G21  |  **阶段**：2  |  **状态**：**✅ 已作为「自愈」关闭（2026-09-06）**

### 自愈结论（决策记录）

G21 用 `#${i}` idx 后缀掩盖了 React 重复 key，但 G22 排查发现：

| 链路 | 评级 | 依据 |
|---|---|---|
| A. DB 真实重复行 | 当前不存在 | 用户 backup `20260906-1555.json` 26 set 0 重复 |
| B. clientId 串入 DB id | **已排除** | 全部 id 是 36 字符 UUID，0 个 `c_` 前缀 |
| C. completeTraining 双触发 | 极低 | `finishing` mutex + 单调用点 |
| D. batchInsert 多次调用 | 极低 | grep 仅 1 处调用点 |

**历史证据蒸发**：用户 9/3 → 9/6 之间触发 G14「清除全部数据」，G21 修前那一刻的重复行被抹除，无法回查 gold standard。

**当前代码路径已无 root cause**：`ActiveSet → CreateTrainingSetInput` 显式剥掉 `clientId`，DB id 唯一来源是 `newId()` (UUID v4)。

**保留**：G21 idx 后缀兜底作为 React 层幂等保护（不动）。

### 涉及
- **不做修复**：无 root cause 可修
- **保留审计脚本**：`_diag/audit-dup-rows.js` + `_diag/audit-id-shape.js`（untracked，commit 时跳过）
- **写 memory**：`project-g22-closed-as-self-healed.md`（决策记录 + 未来再次复现时的重开流程）

### 验收标准（AC）
- AC-22.1 ✅ 拿到用户当前 DB 状态（26 set 0 重复、0 个 c_ 前缀）
- AC-22.2 ✅ 排查报告：4 条候选链路各给出 1-2 段代码证据 + 评级（链路 A/B/C/D 当前均不成立）
- AC-22.3 ⚠️ 不适用 — 无修复 commit，无需重跑训练验证
- AC-22.4 ⚠️ 不适用 — 无 DB 脏数据，无需 migration

### 自检清单
- [x] 不靠推理改代码：**只读审计，每个结论有 DB 状态/代码 grep 证据**
- [x] 审计脚本保留在 `_diag/` 下（untracked）
- [x] GOALS.md 标 ✅「自愈关闭」
- [x] memory `project-g22-closed-as-self-healed.md` 写好（含未来再次复现时的"重开 G22"流程）

> **未来再次复现时**（如果用户在 G21 idx 后缀保护下仍报 dup-key LogBox 升级）：
> 1. 重跑 `_diag/audit-dup-rows.js` + `_diag/audit-id-shape.js` 看 DB 端状态
> 2. 若 `c_` 前缀非 0 → 链路 B 命中，git blame `trainingSetRepo.ts` 找历史 clientId 串入 commit
> 3. 若纯 UUID 重复 → 链路 A 命中，查是否有外部 SQL 写入或迁移脚本被多次执行
> 4. 详见 [[project-g22-closed-as-self-healed]]

---

## G23. errorLogs 30 秒内同 fingerprint 去重 ✅

**优先级**：P2  |  **依赖**：G21  |  **阶段**：2  |  **状态**：**✅ 完成（2026-09-06）**

### 背景
- G21 扩 console.error 拦截后，单次 dup-key 事件 5 秒内进表 186 条同 fingerprint（`e4227087`）
- 同样问题会影响 P0 `Text strings must be rendered`（虽然修好后不再产生，但未来任何高频 warning 都会爆表）
- `MAX_BUFFER=200` ring buffer 容量有限
- 导出 JSON 越来越大（260KB → 用户能感知）

### 涉及
- `src/lib/diagnostics/installErrorHandlers.ts` 加 30 秒滑动窗口去重：
  - 内存中维护 `Map<fingerprint, lastRecordedAt>`
  - 进 enqueue 前查 `Date.now() - last < 30_000` → skip
  - 否则 enqueue + 更新 `lastRecordedAt`
- `src/db/repositories/errorLogRepo.ts` `record()` 接受 `fingerprint` 参数（已经有这个字段了）
- 同样的去重策略也要在 `installJsErrorHandler` 和 `installPromiseRejectionHandler` 里加（js/promise 错误可能也高频）
- **不清空已累积的脏数据**（用户可手动「清除全部数据」或迁移删）

### 实现
- 新增 `src/lib/diagnostics/dedupByFingerprint.ts`（in-memory Map + LRU 256 + `DEDUPE_WINDOW_MS=30_000` + `MAX_TRACKED=256` + 模块单例 + 测试用 `resetForTests`）
- `errorLogRepo.ts` 新增 export `fingerprintOf(error: unknown): string`（单一真相源 wrapper，调用 computeFingerprint）
- `installErrorHandlers.ts` `enqueue()` 入口加 dedupe 检查（同时覆盖 db 和 buffer 两条路径）
- 9 个单测全过，覆盖 AC-23.1 / AC-23.2 / AC-23.3 + LRU 容量上限 + reset

### 验收标准（AC）
- AC-23.1 ✅ 同样 fingerprint 在 30 秒内只产生 1 条 errorLog
- AC-23.2 ✅ 跨过 30 秒边界后再次触发，会新增第 2 条（不永久去重）
- AC-23.3 ✅ 单测覆盖：模拟 100 次同 fingerprint 在 5 秒内触发 → errorLog 增量 = 1

### 自检清单
- [x] 去重 Map 容量上限（避免内存泄漏；超过 N 条时 LRU 淘汰）— `MAX_TRACKED=256`
- [x] `tsc --noEmit` 通过、单元测试通过（11 套件 / 95 用例全过）
- [x] 30 秒阈值在常量中命名清晰（`export const DEDUPE_WINDOW_MS = 30_000`）
- [x] 写 memory `feedback-g23-errorlog-dedupe.md`：触发原因 + 设计选择

---

## G20. 技术债清理：过期注释 + Showcase 路由 ✅

**优先级**：P2  |  **依赖**：G1  |  **阶段**：2

### 涉及
- 清理 3 处过期 stub 注释：
  - `src/screens/ActiveTrainingScreen.tsx:22, 436`（"G6 stub" / "G7 will replace this stub"）
  - `src/features/training/restTimerTrigger.ts:2`（"替换之前的 G6 stub"）
- `_dev/Showcase.tsx` 注册为隐藏 Dev 路由：从 Profile 入口长按版本号 / 摇一摇触发，跳到 Showcase
- 或者直接删 `_dev/Showcase.tsx`（如果只用于开发期自检、无产品价值）

### 验收标准（AC）
- AC-20.1 全文搜「stub / 占位 / G6 stub」无残留
- AC-20.2 Showcase 有入口可进（若保留）；或者完全删除并从 components / screens 列表移除

### 自检清单
- [ ] 决策记录：保留 Showcase 作为开发期自检工具 vs 删掉（视用户偏好）
- [ ] 若保留，路由注册后真机可访问

---

## G24. 计划编辑扩展：ReorderModal 模态化 + 槽位换动作 + 每动作休息覆盖

**优先级**：P1  |  **依赖**：G5, G15, G16  |  **阶段**：2

### 背景

G16 原「单步 swap」式 reorder 拖一次写一次 DB，频繁拖动性能差；计划编辑器还缺两个能力：
1. 屏幕居中的模态拖拽 UI（更稳的视觉反馈 + 一次性 commit）
2. 槽位换动作（同一槽位换成不同动作，**保留**该槽位已配的休息/组数）
3. 每动作独立休息时长覆盖（不再全部用全局默认）

memory 反馈（2026-09-06）：「计划重排序应直接 update 整张表，别单步 swap」。

### 涉及

- `src/db/schema.ts` + `src/db/migrations.ts` — `plan_exercises` 新增 `rest_seconds INTEGER` 列（migration v3 升级）
- `src/db/repositories/planRepo.ts` — 新增 `replaceExercise(planId, planExerciseId, newExerciseId)` / `setExerciseRestSeconds(planId, planExerciseId, seconds)`
- `src/store/planStore.ts` — `reorderExercises(from, to)` 替换为 `replaceExerciseInPlan` + `setExerciseRestSeconds` + 整张表 commit 路径
- `src/screens/PlanEditorScreen.tsx` — 每张动作卡新增 MoreSheet（3 项：重排序 / 替换 / 删除），内嵌 ReorderModal + ReplaceSheet；休息时长入口**独立**放在卡片第一组上方（不在 MoreSheet）
- `src/components/NumberInput.tsx` — 重构以支持新 rest 输入场景
- `src/db/wipeAllData.ts` + `src/db/exportBackup.ts` — 兼容 `rest_seconds` 字段（备份导出包含；清表后无残留）
- `src/store/trainingStore.ts` + `src/screens/ActiveTrainingScreen.tsx` + `src/screens/TrainingScreen.tsx` — `ActiveExercise.restSeconds` 端到端打通（G24a）

### 验收标准（AC）

- AC-24.1 计划编辑每张动作卡点「更多」弹 MoreSheet，含 **3 项**（重排序 / 替换 / 删除）
- AC-24.2 「重新排序」打开 ReorderModal（屏幕居中），内含可拖拽列表，**松手一次性 commit**（不再单步 swap）
- AC-24.3 「替换动作」打开 ReplaceSheet → 勾选新运动 → 槽位换运动，**保留** restSeconds + sets 草稿
- AC-24.4 「调整休息」入口在每张动作卡第一组上方（不在 MoreSheet 里），写入 `plan_exercises.rest_seconds`，仅影响该动作；全局默认休息不变
- AC-24.5 训练计时器实际使用的秒数 = `ActiveExercise.restSeconds ?? settingsStore.defaultRestSeconds`（per-exercise 覆盖真正生效，训练中页不写死）
- AC-24.6 `tsc --noEmit` 通过；备份/清除/重装三件套兼容新列
- AC-24.7 杀进程重启：动作顺序、替换关系、每动作休息全部保留
- AC-24.8 **reorder 后 plan_exercise.id 不失效**：替换 / 调休息的 SQL 仍能命中（`planStore.update` 提交后必须从 DB 重读 ids 刷新 cache）

### 自检清单

- [x] tsc --noEmit 通过
- [x] 单测 11 套件 / 95 用例全过
- [ ] 真机：MoreSheet 3 项入口都可达
- [ ] 真机：休息按钮在卡片第一组上方（不在 MoreSheet）
- [ ] 真机：ReorderModal 拖多次后松手 → DB 只写一次
- [ ] 真机：reorder → 替换动作成功（不再报 "no row updated"）
- [ ] 真机：替换动作后该槽位 restSeconds + 组数未丢
- [ ] 真机：每动作休息覆盖生效（训练计时器用新值，不再用全局默认）
- [ ] 真机：杀进程重启顺序/替换/休息全部保留
- [ ] 备份 JSON 含 rest_seconds；wipeAllData 后无残留

### G24a — 修复 commit（2026-09-07，commit `bf80e82` + `4dd5f80` + `7599c32` + `dd67b43`）

> G24 WIP 落地后真机测出 4 个真 bug + 1 个设计冲突，1 个 AC 写错。诊断 + 修复 commit：
>
> | 编号 | 真根因 | commit |
> |---|---|---|
> | BUG-A | `planStore.update` 在 DELETE+INSERT 后没刷新 `pe.id` 缓存，导致 replaceExerciseInPlan / setExerciseRestSeconds 用 stale id 找行 → SQL changes=0 → 抛 "no row updated" | `bf80e82` |
> | BUG-B | `ActiveExercise` 类型没 `restSeconds` 字段 + `startTraining` 入参不接 + ActiveTrainingScreen 写死 `defaultRestSeconds` | `4dd5f80` |
> | BUG-6 | plan_sets 表从未建立过（"MVP 暂不落库"），G24 WIP 加了 UI 但没建表，杀进程重启组数 / 类型全丢。新表 `plan_sets(id, plan_exercise_id, set_index, set_type)` + migration v4，set 草稿每改一次自动写 DB | `7599c32` |
> | BUG-7 | BUG-6 commit 没存 weight / reps（组数保留了但具体值置 0）。G24a 跟单：plan_sets 加 `weight REAL` + `reps INTEGER`（migration v5），repo + toDraftState 全链路透传 | `dd67b43` |
> | AC 修 | AC-24.1 写 4 项，实际是 3 项（休息入口独立在卡片上） | `68f6c8f` |

### G24a — 新增 AC

- AC-24.9 计划编辑器加 / 删 / 改组后立即写 DB；杀进程重启组数 + 类型 + weight + reps 全部保留
- AC-24.10 新加动作通过 picker → 自动种 1 组 `normal`（G24a 设计选择：始终 ≥1 组）
- AC-24.11 reorder 后 plan_sets 跟着新 plan_exercise id 重新插入（cascade 删 → 重写，含 weight + reps）
- AC-24.12 替换动作不破坏 plan_sets（UPDATE 不触发 CASCADE，sets 自动保留，含 weight + reps）
- AC-24.13 weight / reps 是**处方级**持久化（plan_sets.weight/reps）；训练时实际值仍走 training_sets（守 G6「数据不预填」）

### G24a — 自检清单追加

- [x] tsc --noEmit 通过
- [x] 单测 11 套件 / 95 用例全过（无 regression）
- [ ] 真机：加 / 删 / 改组后杀进程 → 状态保留
- [ ] 真机：填 weight=10 / reps=10 → 杀进程 → 重开仍是 10 / 10
- [ ] 真机：从 picker 加新动作 → 自动有 1 组（默认 0/0）
- [ ] 真机：reorder → 重开计划 → sets 数仍对得上 + 处方未丢
- [ ] 真机：替换动作 → 该动作 sets（含 weight/reps）仍在

---

## G25. 首页热力图替换「开始锻炼」CTA

**优先级**：P3（视觉/动线优化）  |  **依赖**：G18（HeatmapCalendar + useDataAggregates）  |  **阶段**：3

### 背景

HomeScreen 顶部的「开始锻炼」按钮只是 `navigation.navigate('Tabs', { screen: 'Training' })`——一个跳转 proxy。
开始锻炼的真正入口在底部 Tab 「锻炼」里（计划列表 + 自由训练入口），用底部 Tab 一键可达。
把首页 CTA 改成日历热力图，更符合 Home = 「回看/状态」的角色定位。

### 设计决策

- 复用 `HeatmapCalendar`（G18 已落地，组件未改动）
- 顶部 Card = 热力图 + 摘要行（X 天训练 · Y 总训练量） + 「查看更多 ›」链接 → 完整 `CalendarHeatmapScreen`
- 空数据：热力图照常渲染（全部 `surfaceMuted`）+ 一行提示文案「暂无训练记录，去锻炼 Tab 完成第一次」
- 历史列表下方继续展示，结构不动
- 不引入「按单元格点击 → 当日详情」——MVP 不加新交互，先验证整体视觉

### 涉及

- `src/screens/HomeScreen.tsx` — `ListHeaderComponent` 由 `<Button>开始锻炼</Button>` 替换为 `<HeatmapCard />`
- 新增 `src/screens/home/HeatmapCard.tsx`（小私有组件，封装 useDataAggregates + HeatmapCalendar + Card + 摘要 + 跳转）
- `useDataAggregates` 已在 G18 实现，重复调用可接受（hook 内部缓存）

### 验收标准（AC）

- AC-25.1 首页顶部 Card 显示 12 周 × 7 天热力图
- AC-25.2 Card 含摘要行「N 天训练 · X kg/lb 总训练量」与「查看更多 ›」跳转入口
- AC-25.3 无训练记录时热力图全 surfaceMuted 显示 + 提示文案
- AC-25.4 跳转到完整 `CalendarHeatmapScreen` 仍可用（Profile → DataOverview → CalendarHeatmap 路径不破坏）
- AC-25.5 下方历史列表渲染逻辑不变（按日 / 周分组的 FlatList + swipe-to-delete）
- AC-25.6 tsc --noEmit 通过；既有单测无 regression

### 自检清单

- [ ] tsc --noEmit 通过
- [ ] 单测 11 套件 / 95 用例全过（无 regression）
- [ ] 真机：有数据时 → 首页热力图渲染正确（色阶匹配当日训练量）
- [ ] 真机：空数据 → 热力图全灰 + 提示文案显示
- [ ] 真机：点「查看更多 ›」→ 完整 CalendarHeatmapScreen（含 summary + top 5）
- [ ] 真机：下方历史列表正常滚动 + 滑动删除仍工作
- [ ] 真机：底部 Tab「锻炼」开始训练入口仍可达

---

## G26. 「我的」Tab 动作库入口接通（browse 模式）

**优先级**：P3（入口连通性）  |  **依赖**：G4（动作库）+ G15（自定义动作）  |  **阶段**：3

### 背景

ProfileScreen 的「动作库」ListItem 当前是占位 Dialog：
> 「可通过『锻炼』 Tab → 『添加动作』 进入动作库。」

用户从「我的」无法直接浏览动作库。

### 设计决策

- 复用 `ExerciseLibraryScreen`，新增 `mode: 'browse'`
  - `selectMode` 强制为 false（用户进来就是浏览态）
  - 隐藏 ☑/完成 切换按钮（保留 `+` 创建自定义）
  - 不显示 picker hint
  - 长按仍可进入多选态（保留 G4 行为）
- Profile 入口 `navigation.navigate('ExerciseLibrary', { title: '动作库', mode: 'browse' })`
- 删除 Profile 中的占位 Dialog 与 `exerciseLibDialogOpen` state

### 涉及

- `src/navigation/types.ts` — `ExerciseLibraryMode` 增 `'browse'`
- `src/screens/ExerciseLibraryScreen.tsx` — `mode === 'browse'` 分支：强制 selectMode=false、隐藏 headerRight 切换按钮
- `src/screens/ProfileScreen.tsx` — 替换 ListItem onPress；删 Dialog 与 state

### 验收标准（AC）

- AC-26.1 Profile → 动作库 → 进入 ExerciseLibraryScreen，title = "动作库"
- AC-26.2 browse 模式下右上角无 ☑/完成 按钮，只显示 `+`（新建自定义）
- AC-26.3 browse 模式下顶部不显示 picker hint
- AC-26.4 长按动作仍可进入多选态（G4 行为保留）
- AC-26.5 浏览 / 搜索 / 肌群筛选 / 器械筛选 功能未受影响
- AC-26.6 自定义动作的删除按钮仍可见可点
- AC-26.7 Profile 占位 Dialog 与 `exerciseLibDialogOpen` state 已删除
- AC-26.8 tsc --noEmit 通过；既有单测无 regression

### 自检清单

- [x] tsc --noEmit 通过
- [x] 单测 11 套件 / 95 用例全过（无 regression）
- [x] 真机：Profile → 动作库 → 进入浏览页（无多选 UI）— 2026-09-08 用户实测通过
- [ ] 真机：搜索 / 肌群 / 器械筛选正常
- [ ] 真机：长按动作 → 进入多选态（与 G4 行为一致）
- [ ] 真机：自定义动作仍可删除
- [ ] 真机：原"锻炼" Tab → "添加动作" 路径仍走 picker 模式未破坏

### G26a — 修复 MuscleTabs 行被切（commit `c2415d9`）

> G26 落地后真机进入动作库（browse 模式）看到：肌群 chips 行 "全部" chip 贴左、右侧 "二头 / 三头 / …" chip 被屏幕右边切掉。下方器械 SegmentedControl 行渲染正常。
>
> 根因：`MuscleTabs` 的 `ScrollView contentContainerStyle.paddingHorizontal: spacing.lg` 在某些设备 / RN 0.86 horizontal ScrollView + `gap` 组合下没生效（或被吞）。下方 `EquipmentControl` 用的是「外层 View 套 paddingHorizontal」的模式，正常。
>
> 修法：把 `paddingHorizontal` 从 `contentContainerStyle` 移到外层 `View`，与 `EquipmentControl` 包装方式对齐。contentContainerStyle 只留 `gap`。

---

## G27. IconButton 内字符图标（▶）四周居中

**优先级**：P3（视觉打磨）  |  **依赖**：无  |  **阶段**：3

### 背景

TrainingScreen 训练列表卡上的「开始训练」圆形按钮（`<IconButton icon="▶" size="md" variant="primary" />`）里，三角形 glyph 视觉上偏离圆心 —— 偏左上 / 偏左。其它 IconButton 用例（×、+、🗑）看不出来，但 ▶ 这种 directional 形状对字形不对称特别敏感。

### 设计决策

不改用 SVG（侵入大、只解决 ▶ 一个用例）。改用字体层调整：
- `lineHeight = fontSize`：去掉 RN 默认 ~1.2× lineHeight 留出的 descender padding，让 glyph 占满盒子 → 垂直方向居中
- `marginLeft = box × 0.08`：仅对 `▶ / ◀ / ▲ / ▼` 四个 directional 三角形生效，补偿字形视觉重心偏左（base 在左、apex 在右）的特性。其它字符（×、+、🗑）不动

### 涉及

- `src/components/IconButton.tsx` — Text 样式扩展（lineHeight 始终 + directional marginLeft 条件）

### 验收标准（AC）

- AC-27.1 训练列表卡的「开始训练」圆形按钮，三角形在 40×40 圆内视觉居中（横向 + 纵向）
- AC-27.2 其它 IconButton 用例（×、+、🗑）位置无视觉变化
- AC-27.3 tsc --noEmit 通过；既有单测无 regression

### 自检清单

- [x] tsc --noEmit 通过
- [x] 真机：训练列表卡 ▶ 圆形按钮 —— 三角视觉居中 — 2026-09-08 用户实测通过
- [x] 真机：ActiveTrainingScreen × 关闭按钮位置无变化 — 2026-09-08 用户实测通过
- [x] 真机：TrainingDetailScreen 🗑 删除按钮位置无变化 — 2026-09-08 用户实测通过
- [x] 真机：TrainingScreen + 新建计划按钮位置无变化 — 2026-09-08 用户实测通过

---

## G28. 修复：训练时不预填计划处方（G6 被过度推到训练层）

**优先级**：P0（设计 bug，用户已报） |  **依赖**：G24a（plan_sets 持久化处方） |  **阶段**：3

### 背景

用户在计划编辑器填了 `10kg × 10`，落 `plan_sets.weight / plan_sets.reps`（G24a 已做）。开始训练后 ActiveTrainingScreen 输入框仍是 `0 / 0`，每组都要重打。用户反馈："那编辑计划时设置组数据的意义是什么？"

### 根因

`trainingStore.startTraining` 把 `plan_sets` 里的 weight/reps **故意丢掉**，注释明确写：

```ts
// leave the numeric fields null so the user re-enters them fresh (G6)
weight: null,
reps: null,
```

把 G6「数据不预填」过度推到了**计划级**。G6 的原意是"不预填**上一次训练**的值"（避免渐进超负荷被"惯性拷贝"拖累），不是"任何值都不预填"。计划处方 ≠ 上次训练值。

### 修法

两处改动，零业务逻辑风险：

1. **`ActiveTrainingScreen` bootstrap**（line 263-268）—— `initialSets` 透传 `weight / reps`（之前只传 `setType`）
2. **`trainingStore.startTraining`**（line 325-348）—— `materialize` 时 `weight: h.weight ?? null` / `reps: h.reps ?? null`（之前是 `weight: null`）

自由训练路径（`hints.length === 0`）**不动**——没计划就保持 0/0 让用户首次输入。

### 涉及

- `src/screens/ActiveTrainingScreen.tsx` — bootstrap 传 weight/reps
- `src/store/trainingStore.ts` — startTraining materialize hint numeric 字段

### 验收标准（AC）

- AC-28.1 计划训练时，ActiveSet 初值 = `plan_sets.weight / plan_sets.reps`
- AC-28.2 自由训练时初值仍为 null（无计划 = 无处方）
- AC-28.3 训练时改 weight/reps → 完成 → 写入 training_sets 仍是改后值（行为不变）
- AC-28.4 tsc --noEmit 通过；既有单测无 regression

### 自检清单

- [x] tsc --noEmit 通过
- [x] 单测 11 套件 / 95 用例全过（无 regression）
- [x] 真机：编辑计划 → 设 10kg × 10 → 开始训练 → 输入框直接显示 10 / 10 — 2026-09-08 用户实测通过
- [x] 真机：自由训练（无计划）→ 输入框仍为 0 / 0 — 2026-09-08 用户实测通过
- [x] 真机：训练时改 10 → 8 → 完成 → 训练历史里仍是 8（不是 10）— 2026-09-08 用户实测通过

---

## G29. ActiveTrainingScreen UX 重构（最小干扰 + 沉浸式打钩）

### 设计原则

- **垂直列出当前动作的全部组**：每组一行，上→下顺序对应 setIndex 1→N；用户视觉焦点不需要横跳。
- **完成 → 自动跳下一组**：底部 CTA `完成本组 ✓` 沿用现行；点击后由 `completeAndAdvance` 自动把焦点跳到下一个未完成组（已经在 store 里实现），不再要求用户手动点 chip。
- **当前组 inline 输入**：只有当前激活行展开 NumberInput（无 label，纯靠 unitLabel / placeholder 暗示字段意义），其余已完成的组折叠成"60kg × 10 ✓"等一行总结，未来组折叠成"60kg × 10"灰字。
- **点组序号改类型**：`②` 这块数字可点 → 打开 `Sheet「选择组类型」`（沿用 G6 现成 sheet 复用），同 sheet 底部还放「删除此组」（替代原来左滑删除 — 列表行里做 swipe 容易误触）。
- **全宽进度条**：放在顶部状态栏 *下面* 一条贴边进度条，width = screenWidth，高度 4px，pct = 已完成组数 / 总组数。和原来只在 set 状态卡里塞个 `current/total` 文字相比，沉浸感更强、且一眼看到整个训练的进度。
- **顶部 ▾ 进动作总览**：原"动作导航"卡片移除。顶部右侧放一个 `▾` IconButton（和 × 同尺寸），点开 `ExerciseOverviewSheet`，列出本训练所有动作 + 每动作已完成组数；点行直接跳到该动作（同时把 currentSetIndex 重置为 0，从头开始）。**不**在总览里加"跳过当前动作"按钮 — 用户可以直接跳到想做的动作，自由度最高。
- **三档 rest 优先级（架构层已就绪，UI 暂缓）**：`per-exercise rest` 来源链是 `activeEx.restSeconds ?? defaultRestSeconds`，G24 已经实现。训练内 rest override UI（"我想这组休息 90 秒"）作为 *预留任务* 不在 G29 范围。

### 改动文件

| 文件 | 改动 |
|------|------|
| `src/screens/ActiveTrainingScreen.tsx` | 大改：top bar（去掉 X/Y，加 ▾）+ 全宽进度条 + body 重写（set 列表 / inline 输入 / 点序号改类型）+ 新增 `ExerciseOverviewSheet`（在同文件末尾） |
| `src/store/trainingStore.ts` | 不动：`completeAndAdvance` + `setCurrentExerciseIndex` 已有 API 支持 |
| `src/store/planStore.ts` | 不动 |

### AC / self-check

- [ ] 全宽进度条紧贴 status bar 下方，左右两端对齐屏幕边缘，无 padding
- [ ] 当前激活组高亮（背景色 / 边框区分），其他组无强调
- [ ] 点 `②` 等序号打开 sheet，sheet 里能切 4 个 setType + 删除组
- [ ] 点底部 CTA 自动跳到下一未完成组（同动作内 → 跨动作 → 跳到第一未完成）
- [ ] 顶部 ▾ 打开 ExerciseOverviewSheet，列出全部动作 + 进度，行点击直接跳
- [ ] ExerciseOverviewSheet 无"跳过当前动作"按钮
- [ ] 已完成组折叠显示（如 `60.0kg × 10 ✓`） — 包括"刚做完的最后一组"也立刻变灰
- [ ] 当前组 inline 输入只有 NumberInput（无 label），字段意义靠 unitLabel + placeholder
- [ ] 不影响 G6：plan 级处方仍预填（G28）— 用户不改就照着做
- [ ] G29 hotfix: 完成最后一组 → 自动跳下一动作（若有未完成）；无则 → 整体收尾
- [ ] G29 hotfix: NumberInput 在已有值时，focus 选中全部让用户覆盖输入（不与旧值冲突）
- [ ] G29 hotfix: 「+ 添加组」不跳焦点，新组出现在列表底部让用户自己点过去
- [ ] tsc 通过、单测全过
- [ ] commit

---

## G30. 工程未收口(untracked 目录 + 测试清单重写)

**优先级**：P3（工程收口）  |  **依赖**：无  |  **阶段**：3

### 背景

master 当前有 3 个 untracked 目录（`_diag/`、`_drawio_render/`、`docs/architecture/`），其中 `docs/REAL_DEVICE_TEST_CHECKLIST.md` 仍停在 G1–G12 范围。`git status` 长期脏，测试清单已无法指导 G29 之后的实测，先清。

### 子项决策

| 子项 | 决定 | 理由 |
|------|------|------|
| `_diag/`（`audit-dup-rows.js` + `audit-id-shape.js`） | **移到 `scripts/audit/`**，加 README 说明 G22 复现排查场景 | G22 自愈关闭后脚本仍可能再用，但根目录散乱不 commit |
| `_drawio_render/`（`.drawio` + `.png` + `.py` + README） | **全部移到 `docs/architecture/`**，合并 README，删 `_drawio_render/` | 现在两处都有 README 冗余；`docs/architecture/` 是正式文档位 |
| `docs/REAL_DEVICE_TEST_CHECKLIST.md` | **重写为 G1–G29 全量范围**（覆盖旧版） | 旧版 G12 范围已无法指导后续回归 |

### 涉及

- `scripts/audit/audit-dup-rows.js`（从 `_diag/` 移入）
- `scripts/audit/audit-id-shape.js`（从 `_diag/` 移入）
- `scripts/audit/README.md`（新增，说明何时跑 + 指向 memory `project-g22-closed-as-self-healed.md`）
- `docs/architecture/system-architecture.drawio`（从 `_drawio_render/` 移入）
- `docs/architecture/system-architecture.png`（从 `_drawio_render/` 移入）
- `docs/architecture/_gen_system.py`（从 `_drawio_render/` 移入）
- `docs/architecture/README.md`（合并 `_drawio_render/README.md` 与现有 `docs/architecture/README.md`，删 `_drawio_render/README.md`）
- 删除：`_diag/`、`_drawio_render/`、`_open_diagram.url`
- `docs/REAL_DEVICE_TEST_CHECKLIST.md`（重写 G1–G29 全量 AC）

### 验收标准（AC）

- AC-30.1 `git status` clean，无 untracked / uncommitted 文件
- AC-30.2 `_diag/`、`_drawio_render/` 已被删除
- AC-30.3 `scripts/audit/` 含两个脚本 + README
- AC-30.4 `docs/architecture/` 含 `.drawio` + `.png` + `.py` + 合并后单文件 README
- AC-30.5 `docs/REAL_DEVICE_TEST_CHECKLIST.md` 顶部写"G1–G29 全量"，含 G29 沉浸式打钩 + 跨动作跳转 + NumberInput 一键覆盖 AC 项
- AC-30.6 三次 commit 分开（便于 review）：（a）移脚本（b）移架构图（c）重写测试清单

### 自检清单

- [ ] 三次 commit 完成
- [ ] `git status` clean
- [ ] `scripts/audit/README.md` 描述 G22 复现排查流程
- [ ] `docs/architecture/README.md` 单文件可读，包含 11 层架构 + 4 色数据流
- [ ] `docs/REAL_DEVICE_TEST_CHECKLIST.md` 含 G29 实战 AC 项
- [ ] tsc --noEmit 通过（无代码改动，但要确认无副作用）
- [ ] 单测 11 套件 / 95 用例全过

---

## G31. JSON 导入回滚（G19 的另一半）

**优先级**：P1（补 G14 体验洞）  |  **依赖**：G19（导出）  |  **阶段**：3

### 背景

G19 实现 JSON 导出，用于备份和数据迁移。但 G14「清除全部数据」是**真·不可逆** — 没有导入路径，清错就全没。G31 补上导入路径，让 G14 真正带安全网。

### 设计决策

- **入口**：设置页 → 「数据管理」区块（暂放在「主题」区块下面），含「导出 JSON」（G19）与「导入 JSON」两个按钮
- **选文件**：用 `expo-document-picker`（新依赖，需查 v57 兼容版本）
- **导入策略**：
  - **校验**：版本号字段 `{version: 1, exportedAt, ...}`
  - **冲突**：**全表覆盖** — 导入 = 还原，语义清晰，跟 G14「清除全部」对称
  - **顺序**：先 `exercises` → `plans` → `plan_exercises` → `plan_sets`（v4 后）→ `trainings` → `training_sets` → `settings`
- **反馈**：toast「已导入 N 个计划 / M 次训练 / K 个动作」；失败行给详细错误
- **不做**：增量导入 / merge / 按 ID skip（暂不增加复杂度）

### 涉及

- `package.json` — 新增 `expo-document-picker`（版本待查 v57 docs）
- `src/screens/SettingsScreen.tsx` — 「数据管理」区块 + 导入按钮
- `src/store/settingsStore.ts` — 新增 `importFromJson(fileUri)` action
- `src/db/index.ts` — 新增 `replaceAll(json)` 事务函数（全表 delete + 写）
- 新增 `src/db/repositories/importRepo.ts`（解析 + 校验 + 写库）
- 新增 `src/utils/importSchema.ts`（JSON 结构 + 版本校验）

### 验收标准（AC）

- AC-31.1 设置页有「数据管理」区块，含「导出 JSON」（G19）与「导入 JSON」两个按钮
- AC-31.2 导入按钮 → 拉起系统文件选择器（Android:Documents / iOS:Files）
- AC-31.3 选中非 JSON / 错误版本 → toast「导入失败:xxx」，DB 不动
- AC-31.4 选中合法 JSON → 弹二次确认「这将覆盖现有全部数据，继续？」
- AC-31.5 确认后 → 7 张表全清 + 重建，toast「已导入 N 计划 / M 训练 / K 动作」
- AC-31.6 导入完成后 → 首页 / 锻炼 Tab / 我的 都反映新数据（刷新有效）
- AC-31.7 自由训练 / 计划训练功能验证不破（导入的 plan_exercises 可正常训练）

### 自检清单

- [ ] tsc --noEmit 通过
- [ ] 单测 11 套件 / 95 用例全过 + 新增 `importRepo` 单测（≥3 用例：合法 / 版本错 / 字段缺失）
- [ ] `expo-document-picker` 在 v57 SDK 兼容（需 WebFetch v57 docs 验证）
- [x] 真机：导出 → G14 清除 → 导入同一文件 → 数据还原 — 2026-09-08 用户实测通过
- [ ] 真机：导入非法文件 → toast 报错，无 DB 写入
- [ ] 真机：导入确认弹窗取消 → 不执行

---

## G32. 数据可视化下钻（G18 升级）

**优先级**：P1（让 MVP 好用）  |  **依赖**：G18（`useDataAggregates`）  |  **阶段**：3

### 背景

G18 4 屏合一但只是概览（总训练量 / 时长 / 1RM 全局）。用户训练 8 周后想看「卧推这 8 周趋势」 — 现在没有。G32 加单动作详情：从概览卡片点动作行 → 该动作的历史曲线 / 容量柱状 / 1RM 趋势。

### 设计决策

- **入口**：**我的 → 数据概览** 加「按动作」Tab，点动作行进详情
- **新页**：`ExerciseHistoryScreen`
  - 顶部：动作名 + 主要肌群 + 器械 + 训练总次数 + 最高 1RM（Brzycki）
  - 中部：**1RM 趋势线**（react-native-svg 手画折线）
  - 下部：**容量（Σ weight × reps）柱状图**（按训练日，每日一根）
  - 时间区间切换：近 4 周 / 近 3 月 / 近 1 年 / 全部
  - **原始数据点**：长按图上某点 → 弹该次训练的小预览，点进 → `TrainingDetailScreen`
- **派生指标**：
  - 1RM 公式：**Brzycki**（`weight × (36 / (37 - reps))`），`reps ≥ 37` 时 cap 为 `weight × 1`
  - 容量：`Σ weight × reps`（只算 `set_type='normal'`）
- **不做**：动作对比、多动作叠加、心率区间（超出 MVP）

### 涉及

- 新增 `src/hooks/useExerciseHistory.ts`
- 新增 `src/screens/ExerciseHistoryScreen.tsx`
- 新增 `src/screens/data/ExerciseLineChart.tsx`（SVG 手画折线）
- 新增 `src/screens/data/ExerciseVolumeBars.tsx`（SVG 手画柱状）
- `src/screens/DataOverviewScreen.tsx` — 加「按动作」Tab + 动作列表（已有概览旁）
- `src/navigation/types.ts` + RootNavigator 注册新路由
- `src/utils/oneRm.ts` — Brzycki 公式 + 边界处理

### 验收标准（AC）

- AC-32.1 我的 → 数据概览 → 「按动作」Tab，显示有训练记录的动作列表（按 1RM 降序）
- AC-32.2 点动作行 → 进 `ExerciseHistoryScreen`，顶部信息正确
- AC-32.3 1RM 趋势线随时间区间切换（4 周 / 3 月 / 1 年 / 全部）
- AC-32.4 容量柱状图每日一根柱，日期对齐
- AC-32.5 长按图上点 → 弹该次训练的小预览，点进 → `TrainingDetailScreen`
- AC-32.6 1RM 公式：100kg × 5rep → 1RM ≈ 112.5kg（Brzycki）
- AC-32.7 边界：reps ≥ 37 → 用 `weight × 1` cap，避免负数
- AC-32.8 空数据（动作无训练历史） → 友好提示「还没有训练记录」

### 自检清单

- [ ] tsc --noEmit 通过
- [ ] 单测 11 套件 / 95 用例全过 + 新增 `useExerciseHistory` + `oneRm` 单测（≥5 用例）
- [ ] 真机：8 周卧推数据 → 1RM 趋势线平滑绘制，数值随区间切换
- [ ] 真机：容量柱状每日一根，日期对齐
- [ ] 真机：长按数据点 → 弹训练预览 + 跳转
- [ ] 真机：空数据动作 → 提示文案 + 不崩
- [ ] 真机：reps ≥ 37 数据 → 1RM cap 不溢出

---

## Phase 2 路线（P2+，待评估优先级）

> 下列项目 PRD 列入但未排期，是否纳入 Phase 2 视用户偏好决定。

| 编号 | 功能 | 备注 |
|------|------|------|
| US-11 | 杠铃片计算器 | 独立 utility；输入目标重量 + 杠铃片配置 → 输出每侧装载方案 |
| US-12 | 身体测量追踪 | 新增表（body_measurements：日期/体重/体脂/胸围/臂围/腰围/腿围）+ 趋势图 |
| | Lottie 训练完成动画 | 找/做 ✓ 动画 JSON 替换当前 Reanimated 兜底 |
| US-14 | AI 生成计划 | 需 LLM 接入（API key + 网络）—— 最大块、最远离 MVP |

---

## 附录 A：数据库表结构（草图，Agent 可微调）

```sql
-- 动作库（内置 + 自定义）
CREATE TABLE exercises (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  muscle_group TEXT NOT NULL,          -- 主要肌群
  secondary_muscles TEXT,              -- JSON array
  equipment TEXT NOT NULL,
  metric_type TEXT NOT NULL,           -- reps/kg/+kg/-kg/time/km
  image_uri TEXT,
  is_custom INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- 训练计划
CREATE TABLE plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 计划内的动作 + 顺序
CREATE TABLE plan_exercises (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE,
  FOREIGN KEY (exercise_id) REFERENCES exercises(id)
);

-- 计划内的预置组（可选，MVP 不强制）
-- 留作 P2 智能分析使用，MVP 不写入
-- CREATE TABLE plan_sets (...)

-- 一次训练记录
CREATE TABLE trainings (
  id TEXT PRIMARY KEY,
  plan_id TEXT,                        -- 自由训练时 NULL
  plan_name_snapshot TEXT,             -- 历史展示用
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  duration_seconds INTEGER,
  total_volume REAL,                   -- Σ weight × reps
  exercise_count INTEGER,
  set_count INTEGER
);

-- 训练中的每组记录
CREATE TABLE training_sets (
  id TEXT PRIMARY KEY,
  training_id TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  exercise_name_snapshot TEXT,         -- 历史展示用
  position INTEGER NOT NULL,           -- 动作顺序
  set_index INTEGER NOT NULL,          -- 组序号（1-based）
  weight REAL,
  reps INTEGER,
  duration_seconds INTEGER,            -- 时间类型
  distance_km REAL,                    -- 距离类型
  set_type TEXT NOT NULL DEFAULT 'normal', -- warmup/normal/dropout/failure
  completed INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE,
  FOREIGN KEY (exercise_id) REFERENCES exercises(id)
);

-- 设置（key-value）
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

## 附录 B：内置常量

```ts
// 主要肌群（次要肌群共用此列表）
MUSCLE_GROUPS = [
  '胸', '背', '肩', '二头', '三头', '前臂',
  '腹', '股四头', '腘绳', '臀', '小腿', '全身'
]

// 器械
EQUIPMENT = [
  '杠铃', '哑铃', '固定器械', '缆绳', '自重', '史密斯机', '壶铃', '弹力带'
]

// 运动类型
METRIC_TYPES = [
  { value: 'reps', label: '次数', fields: ['weight', 'reps'] },
  { value: 'kg',   label: '重量', fields: ['weight'] },
  { value: '+kg',  label: '递增', fields: ['weight', 'reps'] },
  { value: '-kg',  label: '递减', fields: ['weight', 'reps'] },
  { value: 'time', label: '时间', fields: ['duration_seconds'] },
  { value: 'km',   label: '距离', fields: ['distance_km'] },
]

// 组类型
SET_TYPES = [
  { value: 'normal',   short: '',  label: '正式组' },
  { value: 'warmup',   short: 'W', label: '热身组' },
  { value: 'dropout',  short: 'D', label: '递减组' },
  { value: 'failure',  short: 'F', label: '力竭组' },
]
```

## 附录 C：建议的内置动作（≥30 个，Agent 可调整）

胸：杠铃卧推、哑铃卧推、哑铃飞鸟、上斜哑铃推举、器械夹胸、龙门架夹胸
背：引体向上、高位下拉、杠铃划船、哑铃单臂划船、坐姿绳索划船
肩：杠铃推举、哑铃侧平举、俯身飞鸟、绳索面拉
臂：杠铃弯举、哑铃弯举、三头下压、仰卧臂屈伸
腿：深蹲、硬拉、腿推、腿屈伸、腿弯举、弓步蹲、站姿提踵
核心：平板支撑、卷腹、悬垂举腿
