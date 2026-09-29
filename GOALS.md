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
- 根因（二分回退锁定）：**当时**判断为「用户 DB 中存在 `training_sets.id` 重复行」（errorLogs 一次性写入 186 条同 fingerprint，186 次 LogBox 升级到 red overlay）
- 修复：`key={s.id}` → `key={\`${s.id}#${i}\`}`（idx 后缀保证 React 兄弟节点唯一性）

> ### ⚠️ 根因更正（2026-09-27，`f4bef66`）
>
> 上面那条根因是**误诊**，已推翻。真根因是 **SQL 查询的列名覆盖**：
> `SELECT *` + JOIN 时 `trainings.id` 与 `training_sets.id` 同名，结果集里**后者把前者静默覆盖**，
> 于是多行 `training_sets.id` 拿到同一个值 → React 兄弟节点 key 重复 → red overlay。
> **数据库里没有重复行**，G22「自愈关闭」的结论因此说对了（表是干净的），只是当时没查出真正的机制。
>
> - 判据：**JOIN + `SELECT *` + 同名列 → 后者静默覆盖**。以后再见到「id 重复」先查这条，不要先怀疑 DB。
> - `key={\`${s.id}#${i}\`}` 的 idx 兜底**保留**（它治的是症状，仍然有效），但查询侧的列名歧义才是必须修的。
> - **AC-21.1 已于 2026-09-27 真机 A/B 验证通过**（改前红屏 / 改后不红屏），提交 `f4bef66`，已合入 master。
> - 🟡 **残留观察（未验证）**：训练页 logcat 仍会打 `[DIAG:dup-key] lastSets[xxx] has dup s.id count=2 unique=1`。
>   红屏不再出现，但产生重复 key 的**数据条件本身**在某个路径上仍存在。已登记在测试清单 §13，待顺手查。
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

### 决策记录（2026-09-09 收口）

**Showcase 保留** —— `_dev/Showcase.tsx` (662 行) 已有完整路由注册（`src/navigation/RootNavigator.tsx:127-129`，name='Showcase', title='组件 Showcase（开发自检）'），覆盖 G3 全部基础组件（Button / Input / NumberInput / TimerRing / SegmentedControl / Card / Badge / IconButton / Dialog / Sheet / CheckableRow / EmptyState / ListItem）。未来 G*/US-* 接新组件时可直接复用做自检台，价值持续。**G20 收口不再动 Showcase 路由或文件。**

> 顺手清掉的过期 stub 注释（不在 G20 原 spec 三处清单里，但同主题）：
> - `src/components/Placeholder.tsx` 顶部 JSDoc（"Real screens will replace this file in later goals (G5+, G9, G10)"）—— G5/G9/G10 早已落地，组件当前无人引用（孤儿），标注现状后保留
> - `src/navigation/TabNavigator.tsx:5`（"Each tab renders a `Placeholder` (real screens come in later goals)"）—— 三个 tab 早已接真实屏（HomeScreen / TrainingScreen / ProfileScreen）

### 自检清单
- [x] 决策记录：保留 Showcase 作为开发期自检工具（2026-09-09 用户拍板）
- [x] 若保留，路由注册后真机可访问（`RootNavigator.tsx:127-129`，name='Showcase'）

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

## G33. 2D 前后肌肉图（Pilot，已废弃）

**优先级**：P3（探索性 pilot）  |  **状态**：❌ **未排进正式目标 — pilot 阶段被废**

### 背景

原计划用 hasaneyldrm/exercises-dataset 的 `muscle_group` / `secondary_muscles` 字段做 2D 前后肌肉图高亮，**但实测字段语义不可用**（例：`dumbbell bent over row` 写 `muscle_group: biceps` 而非 `back`，硬映射会误导用户）。见 `docs/architecture/G35-handoff.md:73-75`。

### 决策

**不再做**。G35 改用 `target` 字段映射主肌群，详情屏不展示前后肌肉图。

### 涉及

无（pilot 阶段丢弃，未落代码）

---

## G34. 动作详情页 Pilot（已完成定版 UI 锁死）

**优先级**：P3（探索性 pilot）  |  **状态**：🟡 **Pilot 完成 / UI 锁死 / 数据接入留 G35**

### 背景

G33 路线（2D 肌肉图）被废后，转向详情页 prototype。`ExerciseDetailDemoScreen.tsx` 写死 1 个动作把 layout 跑通真机：
- 头部（动作名 + ⋯）
- 2 个 Badge（主肌群 + 器械）
- GIF 240×240 居中
- © Gym visual attribution
- 中文步骤列表

**用户多次确认 UI 锁死**（详见 `docs/architecture/G35-handoff.md` §2）

### 决策

**G34 pilot 不立独立目标**——仅作为 G35 实施前的 UI 模板/验收基准。后续 G35 直接复用 `ExerciseDetailDemoScreen` 的 layout。

---

## G35. 动作详情屏 + 1,324 动作批量接入 ✅

**优先级**：P2（内容扩展）  |  **依赖**：G4  |  **阶段**：3  |  **状态**：✅ **2026-09-08 真机验收通过**

### 涉及

- `exercises` 表加 5 字段：`instructions_zh` / `instruction_steps_zh` / `gif_uri` / `target_muscle` / `attribution`（migration v6）
- 接入 **hasaneyldrm/exercises-dataset** 1,324 条动作（MIT 许可 + Gym Visual 版权 GIF）
- 仓库层 `exerciseRepo` 聚合视图适配新字段；测试 fixture 补全
- `ExerciseDetailScreen`（G34 pilot 替换为真实数据）+ 入口接通（动作库长按 / 训练中组行 → 详情）
- `ExerciseThumbnail` 抽象组件（GIF 静态首帧）+ 架构文档

### 验收标准（AC）

- AC-35.1 动作库任一动作 → 详情屏 → 看到 GIF + 中文步骤 + 2 个 Badge + attribution
- AC-35.2 长按动作库行可跳详情；训练中组行 `→` 也可跳
- AC-35.3 杀进程重启后 GIF 仍能从本地 bundle 加载
- AC-35.4 1,324 动作数据全量入库（去重 by hasaneyldrm id）
- AC-35.5 `target` 字段正确映射到本项目的 `category`（不是 `muscle_group`）

### 自检清单

- [x] `exercises` 表加 5 字段 + migration v6
- [x] 1,324 动作数据批量入库
- [x] 仓库层聚合视图适配 + 测试 fixture
- [x] ExerciseDetailScreen 落地 + 入口接通 + 抽象头像组件 + 架构文档
- [x] 真机：动作库/训练中均能跳详情 + GIF 播放 — 2026-09-08 用户实测通过

### 提交记录

- `b79a97c` feat(G35): exercises 表加 5 字段 + 1,324 动作数据接入(MIT + Gym Visual 版权)
- `8ed11ec` feat(G35): 仓库层聚合视图适配 5 个新字段 + 测试 fixture 补全
- `9309ed7` feat(G35): 动作详情屏 + 入口接通 + 抽象头像组件 + 架构文档

---

## G36. 动作头像 GIF 静态化落地 ✅

**优先级**：P2（性能/视觉）  |  **依赖**：G35  |  **阶段**：3  |  **状态**：✅ **2026-09-08 真机验收通过**

### 背景

G35 接 1,324 动作后，列表全用 GIF 动态播放 → 滚动卡顿 + iOS/Android 内存暴涨。G36 把列表头像降级为 **GIF 静态首帧**（仅详情屏播放动画）。

### 涉及

- `ExerciseThumbnail` 组件：默认显示 GIF 第 1 帧（用 `Image.resizeMode` + 不循环），详情屏用全 GIF
- 3 处落地：动作库列表 / 计划编辑器动作卡 / 训练中组行
- HomeScreen（首页热力图卡）**回退**到字符占位（首字）—— 不需要 GIF 视觉
- `ExerciseThumbnail` Jest 单测（6 用例）+ jest config 收 `.tsx`

### 验收标准（AC）

- AC-36.1 动作库 / 计划编辑 / 训练中 3 处均显示 GIF 静态首帧
- AC-36.2 列表滚动帧率稳定（无动画占用）
- AC-36.3 详情屏仍播完整 GIF（不静态化）
- AC-36.4 HomeScreen 热力图卡仍走字符占位

### 自检清单

- [x] ExerciseThumbnail 组件落地
- [x] 3 处列表头像替换
- [x] HomeScreen 回退字符占位
- [x] Jest 单测 6 用例全过
- [x] 真机：列表滚动流畅 + 详情屏 GIF 正常播放 — 2026-09-08 用户实测通过

### 提交记录

- `fef0107` feat(G36): 动作头像 GIF 静态化落地 2 屏
- `b3aff7e` test(G36-3): ExerciseThumbnail Jest 单测(6 用例) + jest config 收 .tsx

---

## G37. 补 20 个常用动作（变体 / 有氧 / 核心）✅

**优先级**：P2（内容扩展）  |  **依赖**：G35  |  **阶段**：3  |  **状态**：✅ **2026-09-08 完成**

### 背景

G35 1,324 动作虽多，但 hasaneyldrm 数据集**侧重器械训练**（杠铃/哑铃/固定器械），常用变体（蝴蝶机夹胸、龙门架夹胸、悬垂举腿…）和有氧（跑步/划船机）、核心（平板支撑）覆盖不全。G37 从 **G35 之外**手动补 20 个。

### 涉及

- 在 G35 1,324 基础上**额外**入库 20 个动作（中文步骤 + GIF bundle）
- 覆盖：胸 / 三头 / 背 / 肩 / 二头 / 腿 / 腹 / 有氧 8 个肌群

### 验收标准（AC）

- AC-37.1 动作库动作总数 = 1,324（G35）+ 20（G37）= 1,344
- AC-37.2 8 个肌群各 ≥2 个变体/核心/有氧
- AC-37.3 中文步骤 + GIF 完整入库

### 自检清单

- [x] 20 个动作入库（commit `5236e7f`）
- [x] GIF bundle + 中文步骤同步

### 提交记录

- `5236e7f` feat(G37): 补 20 个健身常用动作(变体/有氧/核心) + GIF bundle + 中文步骤

---

## G38. RestTimer 通知栏同步 ✅

**优先级**：P2（体验补全）  |  **依赖**：G7  |  **阶段**：3  |  **状态**：✅ **2026-09-09 真机验收通过（经 G38.1 重构落地）**

### 背景

训练中切后台 / 锁屏，RestTimer Overlay（应用内倒计时）会因系统限制冻结；G38 想用 `expo-notifications` 在系统通知栏同步显示剩余秒数，让用户息屏也能看到休息剩余。

### 涉及（已实现后回滚）

- 装 `expo-notifications` + 配 Android channel/permissions（`app.json`）
- `RestTimerOverlay` 在前台每 1s 更新通知 content；切后台 / 锁屏由系统保留
- 切回前台重新校准（系统通知已冻结秒数 vs store 时间戳）
- 单测 mock `expo-notifications` + iOS 跳过分支
- 顺手：补 `expo-constants` 传递依赖（避免 `expo-asset` bundle 500）
- `expo prebuild` 自动改 scripts 为 `expo run:android/run:ios`

### 历程：暂停 → G38.1 重构落地

- **2026-09-08**：原 G38 5 个 commit 因 dev client 下载慢被 revert（代码回到 G37 基线）
- **2026-09-09**：G38.1（commit `59f7a99`）在 RestTimer Overlay 折叠/展开 UX 修复中**重新实现了通知同步**（改进点：两行布局 + 块字符进度条），并加 `RestTimerNotificationBridge.tsx` 把 store tick → 通知更新接起来
- **2026-09-09**：真机验收通过

### 当前实现（G38.1 重构版）

- `src/features/training/restTimerNotification.ts` — 通知模块（channel 建/权限问/scheduleNotificationAsync 覆盖式更新/dismiss）
- `src/features/training/RestTimerNotificationBridge.tsx` — AppState 监听 + restTimerStore tick → 调 `showOrUpdateRestTimerNotification`；进入后台冻结，切回前台用时间戳校准
- `app.json` — `expo-notifications` plugin + `POST_NOTIFICATIONS`/`VIBRATE` 权限
- `src/features/training/__tests__/restTimerNotification.test.ts` — 13 个单测（Android schedule / iOS noop / dismiss 路径 + 块字符 0%/50%/100% 边界）

### 已知限制（不阻塞通过）

- 锁屏停留 >60s：通知秒数停在锁屏瞬间值（系统冻结 JS，managed workflow 无法绕过）
- iOS 路径本期 noop（`Platform.OS !== 'android'` 直接 return）

### 提交记录

当前实现（G38.1 重构版，**在 master**）：
- `59f7a99` feat(G38.1): RestTimer 真机验收 2 个 UX 修复（含通知两行布局 + `RestTimerNotificationBridge`）
- `4cc8f86` fix(G38.1): +15s 数学 no-op + 去'准备下一组' + 添加组复制上组数据

原 G38 5 个 commit 已被 revert（仅作历史参考，**未保留到 master**）：
- `792bed1` / `ea4829d` / `911270d` / `541422a` / `2f820a0` — 原 G38 实现
- `44751f7` / `43462cc` / `6a26083` / `31db3a2` / `50d81af` — 对应 5 个 revert

---

## G38.1. RestTimer 真机验收 UX 修复 ✅

**优先级**：P1（体验收口）  |  **依赖**：G7  |  **阶段**：3  |  **状态**：✅ **2026-09-09 真机验收通过**

### 背景

G38 通知栏同步回滚后,基于 G7/G37 基线重做真机验收,暴露出 RestTimer 在「应用内」交互的几个体感 bug —— G38.1 一次性修干净,并把通知栏同步以更稳的形式重新实现(两行布局 + bridge + 块字符进度条)。**通知功能从此段起重新生效**(详见 G38 段)。

### 涉及

- **bug1**:`RestTimerOverlay` 双态(展开/折叠)+ 自然完成 → 1.1s 后滚动回视 + 0.6s 高亮(`SetRow` 2dp primary 顶边光带)
- **bug2**:通知栏 2 行布局(`title="休息中　剩 N 秒"` + `body=20 段 unicode 块字符进度条` + 数字比例)
- **fix**:`restTimerStore.extend` 只加 `durationMs` 不动 `startedAt`(原写法 `startedAt -= delta` 与 `durationMs += delta` 在 `remaining = durationMs - (now - startedAt)` 公式里相抵,+15s 体感 no-op)
- **去文案**:Sheet/窄条 统一显示'秒',不再切到'准备下一组'
- **加组**: `appendEmptySet` 继承上组 weight/reps/durationSeconds/distanceKm 实际值(上组 null 也继承 null)
- **附加**:数据库 migration v3/v5/v6 `safeAddColumn` 幂等化(吞 `duplicate column name`,新装路径不再炸)
- **测试**:`restTimerStore` +5(extend 三种路径/skip no-op),`restTimerNotification` 加块字符 0%/50%/100% 三边界 → **220/220 全过(22 suites)**

### 验收标准(AC)

- AC-38.1.1 展开 Overlay → 点 +15s → 数字 / 圆环比例明显推进 ✅
- AC-38.1.2 展开 + 折叠态文案统一显示倒计时,不再切到'准备下一组' ✅
- AC-38.1.3 + 添加组 → weight/reps/durationSeconds/distanceKm 继承上一组实际值 ✅
- AC-38.1.4 通知栏 title="休息中　剩 N 秒",body 是 unicode 块字符进度条 ✅(G38 真机已验)

### 提交

- `59f7a99` feat(G38.1): RestTimer 真机验收 2 个 UX 修复
- `4cc8f86` fix(G38.1): +15s 数学 no-op + 去'准备下一组' + 添加组复制上组数据

---

## US-12. 身体测量追踪（体重 + 体脂）✅

**优先级**：P1（MVP 补全）  |  **依赖**：无  |  **阶段**：3  |  **状态**：✅ **2026-09-09 真机 13 条验收全过**

### 背景

G33-G38 解决训练内数据闭环，但「训练 → 体型变化」这条 user-facing 反馈链缺失。US-12 加身体测量追踪：用户定期记录体重 / 体脂，看趋势，让训练效果可视化。

**MVP 范围**（用户主动定版）：
- 仅 **2 项指标**：体重（kg）+ 体脂（%）
- 可编辑可删除
- 同一天允许多条记录
- 列表 tab + 趋势 tab 双视图

### 涉及

- **数据层**：`body_measurements` 表（migration v7） + `bodyMeasurementRepo` + `bodyMeasurementStore`（独立 store，不复用 trainingStore）
- **备份 / 清除兼容**：`exportBackup.ts` / `wipeAllData.ts` 同步含新表
- **UI**：
  - `BodyMeasurementScreen`（Stack 屏，Profile 入口）
  - 列表 tab（按日分组 + 同日多条折叠）+ 趋势 tab（折线 + 双 y 轴）
  - FAB 新建 / 编辑屏（体重 + 体脂 双输入）
  - 复用 G32 `LineChart` 组件 + 加 G32 wrapper（趋势 tab 用）
- **测试**：`bodyMeasurementRepo` + `bodyMeasurementStore` 单测
- **修复**：首页热力图 + 删除后实时刷新（`useFocusEffect` 重拉）

### 验收标准（AC）

- AC-12.1 Profile → 身体测量 → 列表 tab 显示已记录条目（按日倒序）
- AC-12.2 点 FAB → 编辑屏 → 输入体重 / 体脂 → 保存 → 列表立即出现
- AC-12.3 同一天可加 2 条以上记录（无 UNIQUE 约束）
- AC-12.4 长按 / 左滑条目 → 编辑 / 删除（带二次确认）
- AC-12.5 趋势 tab 显示体重 + 体脂 双折线（双 y 轴 / 共享 x 时间轴）
- AC-12.6 切换 kg / lb 单位 → 体重同步换算，体脂百分比不动
- AC-12.7 空数据 → 友好提示「还没有记录，去加一条」+ CTA
- AC-12.8 杀进程重启后数据保留
- AC-12.9 备份 JSON 含 `body_measurements`；wipeAllData 后无残留
- AC-12.10 首页热力图 + 删除后 useFocusEffect 重拉生效
- AC-12.11 `tsc --noEmit` 通过；既有单测无 regression
- AC-12.12 9 个新单测全过（repo + store 覆盖 CRUD / 同日多条 / 备份/清除）
- AC-12.13 真机 13 条验收全过

### 自检清单

- [x] body_measurements 表 + v7 migration + repo + store
- [x] 备份 / 清除兼容
- [x] UI 列表 / 趋势 tab + FAB + 编辑屏 + Profile 入口
- [x] LineChart 组件泛化 + G32 wrapper
- [x] repo + store 单测
- [x] useFocusEffect 重拉修复（首页热力图 + 删除后刷新）
- [x] tsc --noEmit 通过
- [x] 既有单测无 regression
- [x] 真机 13 条全过 — 2026-09-09 用户实测通过

### 提交记录

- `4bab5e8` feat(US-12a): body_measurements 表 + v7 migration + repo + store + 备份/清除兼容
- `b344e2b` feat(US-12b): 身体测量 UI — 列表/趋势 tab + FAB + 编辑屏 + Profile 入口
- `10e28ef` feat(US-12c): 泛化 LineChart 组件 + G32 wrapper + 身体测量趋势 tab 接入
- `62e5446` test(US-12d): bodyMeasurementRepo + bodyMeasurementStore 单测
- `204a297` fix(US-12): 首页热力图 useFocusEffect 重拉,删除后实时刷新

---

## G38.3. 动作编辑/Plan editor SetRow 按 metricType 动态渲染 ✅

**优先级**：P2（UX 收口）  |  **依赖**：G15（自定义动作）+ G24a（plan_sets 持久化）  |  **阶段**：3  |  **状态**：✅ 2026-09-15 真机验收通过（含 1 个 hotfix 的架构层根治）

### 涉及

- `src/components/ExerciseFormSheet.tsx`（新，321 行）— create/edit 双模表单组件，字段 name / muscleGroup / secondaryMuscles / equipment / metricType；名称必填 canSave 校验，主/次肌群互斥
- `src/components/MenuRow.tsx`（新，66 行）— Sheet 内单行菜单通用件，支持 danger 色
- `ExerciseLibraryScreen`：`CreateExerciseForm` 255 行删除，改用 `ExerciseFormSheet mode="create"`
- `ExerciseDetailScreen`：仅自定义动作挂 headerRight '⋯'；Sheet '更多操作' 内 MenuRow 编辑 + MenuRow(danger) 删除；编辑走 `ExerciseFormSheet mode="edit"`，删除走 Dialog 二次确认 → `exerciseStore.remove` → goBack
- `PlanEditorScreen`：
  - `SetRow` 按 `draft.exercise.metricType.fields` 动态渲染字段；`SetRowField` 单字段分发（weight / reps / duration_seconds / distance_km）
  - `MenuRow` 替换原内嵌 ⋯ 菜单 UI
  - `metricType` 语义拆分：'reps' → 'reps'（自重）+ 'weight_reps'（负重）；migration v8 加 `plan_sets.duration_seconds/distance_km`；58 条 seed 负重动作从 'reps' → 'weight_reps'

### G38.3 hotfix（2026-09-15）— 架构层修快照陈旧

**根因**：`PlanExerciseDraft.exercise: Exercise`（`planStore.ts:79`）与 `ActiveExercise.exercise: Exercise`（`trainingStore.ts:50`）是 `loadDetail` / `startTraining` 时的快照，`useExerciseStore.update` 不传播。用户从动作库或计划内点动作名→详情→⋯ 编辑改 metricType，第 2/3 次起 SetRow 字段不刷新。

**旧 hotfix（commit 359c6c7 同行）**：`ExerciseEditorCard` 局部订阅 `useExerciseStore` 拿 live exercise + `?? draft.exercise` fallback。**只修一处**，ActiveTrainingScreen 仍有同类隐患。

**架构层根治（commit 34c0824）**：
- 新建 `src/store/syncExerciseToStores.ts`：单一订阅源，useExerciseStore 变化时 walk planStore.detailById[].exercises[] 和 trainingStore.activeTraining.exercises[]，按 `exerciseId` 查 live，引用不等才替换（没变的行引用不刷新，React 重渲染精确）
- `index.ts` 调 `initExerciseSync()`（幂等，多次调用只装一份订阅）
- 回退 `ExerciseEditorCard` 局部订阅，继续读 `draft.exercise`（架构层已保证它是 live）
- 单测 9 用例：同步 / no-op / 多 plan / 删除保旧 snapshot / trainingStore active null / 幂等 / teardown / 启动立即同步

### 验收标准（AC）

- AC-38.3.1 动作库 `+` → 弹 Sheet → 名称必填校验 ✅
- AC-38.3.2 动作库任一行 → 详情 → **内置动作不显示 ⋯**（系统返回） ✅
- AC-38.3.3 自定义动作详情 → 右上 ⋯ → Sheet「更多操作」2 行 ✅
- AC-38.3.4 编辑 → ExerciseFormSheet prefill → 改 name → toast「已保存 XXX」+ 详情页立即反映 ✅
- AC-38.3.5 删除 → Dialog 二次确认 → toast + goBack → 列表少一条 ✅
- AC-38.3.6 Plan editor 不同 metricType → SetRow 字段数量/类型动态切 ✅
- AC-38.3.7 metricType 拆分后老 'reps' 数据迁移 → migration v8 升列 + UPDATE is_custom=0 行到 'weight_reps' ✅
- AC-38.3.8 hotfix: 第 N 次编辑自定义动作，Plan editor SetRow 字段每次都跟新 ✅（架构层根治）
- AC-38.3.9 `tsc --noEmit` 通过，23 suites / 229 tests 全过（含 1 新 suite / 9 tests）✅

### 提交记录

G38.3 主体 3 commit：
- `bb0ce42` feat(G38.3): 拆分 reps/weight_reps + plan_sets 加 duration_seconds/distance_km
- `08ab73b` feat(G38.3): Plan editor SetRow 按 metricType 动态渲染 + 提取 MenuRow
- `359c6c7` feat(G38.3): ExerciseFormSheet 抽取 + 详情页 ⋯ 菜单接入编辑/删除

hotfix + 架构根治 1 commit：
- `34c0824` fix(G38.3): 架构层修 PlanExerciseDraft/ActiveExercise 快照陈旧

并行收口（worklets 0.12 bundle mode，与本目标主题不同但同日 commit）：
- `085bf39` chore(G38.1): 收口 worklets 0.12 bundle mode 配置

---

## G39. GIF 资源三态 + asset: 前缀 + v9 migration ✅

**优先级**：P2（资源工程）  |  **依赖**：G35 / G36  |  **阶段**：3  |  **状态**：✅ **2026-09-15 commit（真机验证中途被新会话打断，由 G40/G41 覆盖）**

### 背景

G35 把 1,324 个动作的 GIF 全指向 `github.com/.../raw/...` remote URL —— 冷启首屏缩略图大面积空白，每次都要联网拉。G39 建立「本地优先 + 远程兜底」的三态资源层，是 G40/G41 的地基。

### 涉及

- `exercises.gif_url` **三态约定**（列为 migration v6 所加，v9 做前缀规范化）：

  | 取值 | 语义 | 路径 |
  |---|---|---|
  | `'asset:{file}'` | bundled 静态资源 | `require()` → 秒开 |
  | `'https://...'` | 远程 | 下载 + 本地缓存 → `file://` |
  | `null` | 无图 | 名称首字占位 |

- `src/screens/exerciseGifAssets.ts` — `classifyGifSource()`（三分类）+ `resolveGifSource()`（同步 → `ImageSourcePropType`）
- `src/screens/exerciseGifCache.ts` — `getCachedOrDownload()`（异步 → `file://` URI）+ LRU 200MB 阈值 + CDN URL 解析（basename 提取 + 白名单清洗）
- `src/components/ExerciseGifImage.tsx` — 三态渲染（Skeleton → 200ms transition 淡入）
- `src/components/Skeleton.tsx` + `expo-image` 接入
- 30 张热门 GIF 落盘 `assets/exercises/`
- migration **v9** — 老路径 `assets/exercises/xxx.gif` → `asset:xxx.gif` 前缀规范化

### 踩坑（G41 直接复用，别再踩）

- migration 的 `run()` 内**不能嵌套 `withTransactionAsync`** —— `71a0ce1` 为 v9 修过一次，G41 的 v10 又踩了同一个坑（见 G41 Bug 3）
- `jest.mock` factory 闭包里的变量名必须以 `mock` 开头，否则报 `Invalid variable access`
- `findAllByProps({ testID })` 会同时匹配函数组件实例 + host child，要用 `findAllByType(View)` 过滤

### 提交记录

- `cf67d02` refactor(G39): 30 张 bundle + asset: 前缀 + migration v9
- `b18c811` chore(G39): expo-image 接入 + Skeleton 组件
- `69ddbac` feat(G39): ExerciseGifImage + CDN GIF 本地缓存(单测覆盖)
- `71a0ce1` fix(G39): migration v9 嵌套事务导致 cannot rollback

---

## G40. 52 张 GIF 全 bundled + 动作库多选行改版 ✅

**优先级**：P2（性能 / 视觉）  |  **依赖**：G39  |  **阶段**：3  |  **状态**：✅ **2026-09-15 commit（真机视觉验证被 AVD ANR 阻塞，由后续 APK 覆盖验收）**

### 背景

G39 还有 22 张走 remote。G40 把这 22 张下载落盘 —— 动作库达到 **52 张全 bundled**，列表彻底不依赖网络；同时把动作库多选行从「24×24 checkbox」升级成「40×40 圆形 GIF 首帧 + 右上角勾选徽章」。

### 涉及

- 22 张 GIF 从 `hasaneyldrm/exercises-dataset` 下载 → `assets/exercises/`（22/22 通过 GIF89a magic 校验）
- `src/db/seeds/exerciseG35Mapping.ts` — 22 项 `bundled: false` → `bundled: true`
- `src/screens/exerciseGifAssets.ts` — 顶部 `require()` 列表扩到 52 项，`G35_GIF_ASSETS` map 52 项
- `ExerciseLibraryScreen` 多选行改版：
  - 左侧 checkbox → `ExerciseThumbnail` 40×40 圆形 GIF 首帧
  - 右上角绝对定位 22×22 ✓ 徽章（`primary` / `onPrimary` / `shadows.sm`）
  - selected 行：`bg=primaryMuted` + `border=primary 1.5px`，徽章 `border=surfaceElevated` 形成层次
- 5 个测试断言从「30 bundled + 22 remote」改为「52 bundled + 0 remote」

### 遗留

动作库总数停在 **52**，相对数据集 1,324 条覆盖率仅 4% → 触发 G41。

### 提交记录

- `c03c29c` feat(G40): ExerciseLibrary avatar+badge + 22 GIF 全 bundled

---

## G41. 动作库 52 → 306（CDN 混合加载路径）✅ 代码完成 / ⚠️ Bug 2 推迟

**优先级**：P2（内容扩展，与 G37 同级） | **依赖**：G40（52 bundled 路径稳定） | **阶段**：3
**状态**：**✅ 代码已完成并真机验证（2026-09-17，含闪退修复）；⚠️ Bug 2（R2 未部署）用户拍板推迟**

### 实际落地（2026-09-17）

设计期目标是「~250 CDN = 302 总动作」。落地后的**真实数字**（后续文档一律以此为准）：

| 项 | 设计期文档 | **实际** |
|---|---|---|
| bundled | 52 | **52** |
| CDN (`bundled: false`) | ~250 | **254** |
| **总动作数** | 302 | **306** |
| migration 版本 | v9 | **v10** |

数据库实测（AVD，`PRAGMA user_version`）：`user_version=10`、`is_custom=0` 行数 = **306**、`gif_url LIKE '%PLACEHOLDER%'` = **254**。

### 三个 Bug（两个已修，一个推迟）

#### Bug 1 — 老装走升级路径时 254 个 CDN 行不 INSERT ✅ 已修

- **症状**：用户从 G40 的 APK 升级到 G41，动作库仍只有原 52 个
- **根因**：`seedExercisesIfEmpty` 检查 `existingCount > 0` 就直接 `return 0`；`backfillExerciseI18n` 只按 name UPDATE 已有行，**从不新增**
- **修复**：`cde3c69` — 加 migration v10 + `upgradeExerciseSeedIfMissing(db)` 差量 INSERT，纯函数 `filterMissingSeedRows` 单测覆盖三态幂等。老装下次启动 52 → 306

#### Bug 2 — `cdnUrl` 是字面占位符，R2 bucket 没部署 ✅ **由 G44 接手完成**

- **症状**：254 个新动作会出现，但缩略图**一直是 skeleton**
- **根因**：`scripts/upload-g41-r2.js` 写好了但没跑（env 凭证没填），`pub-PLACEHOLDER.r2.dev` 没被 find-replace
- **2026-09-17 决策**：用户选**选项 C — 接受 skeleton 占位**，留后续处理
- **2026-09-23 解决**：用户拍板改走腾讯云 COS（G44），254 张 GIF 实下载 + 上传 + URL 替换全部完成；详见下文 **G44** 节

#### Bug 3 — v10 migration 嵌套事务导致真机启动闪退 ✅ 已修

完整链路见「G41 闪退根因」小节。

### G41 闪退根因（2026-09-18 闭合）

这条链路值得存档，因为它推翻了一次误诊：

1. 用户报 APK 启动闪退
2. AVD（x86_64）装 `cde3c69` 的 APK —— **正常跑**，`user_version=10`、306 条 seed 全入库
3. 「AVD 通过 = 真机通过」的误判 → commit `1427b0e`（代码是对的，但**不是真凶**）
4. ARM 真机（HONOR BVL-AN00 / Android 16）装同一个 APK → 闪退
5. logcat 抓到真错误：`FATAL EXCEPTION mqt_v_native / Cannot rollback - no transaction is active`
6. 真根因：v10 的 `run()` 内部又开了 `withTransactionAsync` —— 外层 `runMigrations` 已经 BEGIN 过，expo-sqlite 14 的 `withTransactionAsync` 是**裸 BEGIN 不是 SAVEPOINT**，嵌套 BEGIN 抛错 → 内层 catch 的 ROLLBACK 把**外层事务一起回滚** → `runMigrations` 抛 → `handleDbInit` 没有 catch → unhandled rejection → **定制 ROM 的 RN ExceptionsManager 把 JS 异常升级为 native FATAL 杀进程**。AVD 上同代码路径 SQL 也报错，但 RN 不杀进程，所以看起来"没事"

**修复**：`1427b0e`（移除嵌套事务 + 加 mock DB 防回归测试）。**EAS Build `ea61b522` 已发 + ARM 真机验证闪退彻底修复**。

**经验**：AVD 不能 100% 替代真机做 crash 验证；expo-sqlite + ExceptionsManager 在 x86_64 模拟器与 ARM 真机行为不一致。migration 的 `run()` 内**永远不要**自己包事务。

### Bug 2 修复路线（**已废弃**，由 G44 接手）

历史版本（已不用执行）：Cloudflare R2 bucket `workout2-gifs` + R2 S3-compatible API + SigV4 签名。脚本仍在 `scripts/upload-g41-r2.js` 保留作为档案（用户最后拍板改走腾讯云 COS，详见 G44）。

### 提交记录

- `3c358b3` feat(G41): 动作库 52→306(其中 250 走 CDN) + ProfileScreen 清理 dev 入口
- `cde3c69` fix(G41): v10 migration 差量 INSERT 老装缺的 254 个 CDN 动作 ← Bug 1
- `1427b0e` fix(G41): 移除 v10 migration 嵌套 withTransactionAsync 修复启动崩溃 ← Bug 3
- `350edc1` refactor(exerciseGifAssets): 删 52 行冗余模板字符串 require

### 基础设施（G39 + G40 + G41 累计，已全部就位）

| 模块 | 位置 | 状态 |
|---|---|---|
| 三种格式 `gif_url` | `exercises` 表（migration v6 + v9） | ✅ |
| `classifyGifSource`（asset / remote / none） | `src/screens/exerciseGifAssets.ts:180` | ✅ |
| `resolveGifSource`（同步 → bundled） | `src/screens/exerciseGifAssets.ts:195` | ✅ |
| `getCachedOrDownload`（异步 → file://，LRU 200MB） | `src/screens/exerciseGifCache.ts:115` | ✅ |
| `ExerciseGifImage`（三态渲染） | `src/components/ExerciseGifImage.tsx` | ✅ |
| v9 / v10 migration | `src/db/migrations.ts` | ✅ |

---

## 📎 G41 设计期原始方案（保留备查，不再维护）

> 以下为 2026-09 落笔时的设计稿。**实际落地结果以上方「实际落地」为准**（数字全部有出入：
> 250→254 CDN、302→306 总数）。保留是为了记录设计推理过程，不要再按这里的数字对账。

#### 背景

G40 把全部 52 张 GIF bundled 进 APK，约 5.2MB。但 hasaneyldrm/exercises-dataset 有 **1,324 条**动作。G52/1324 ≈ 4%，动作库仍显单薄：

- 用户从训练详情 → 看不到变体（杠铃划船有但 T 杠划船算不算同一个动作的变体？）
- 训练计划调换动作的 picker 池子只有 52 项
- 数据可视化（训练量按肌群分布）漏掉大半真实场景

把全部 1,324 张塞进 APK 不可能（≈130MB），`Path E` = CDN 在线加载 + 保留 30-50 热门动作 bundled 秒开。

#### 涉及

- **CDN 端**
  - 选型：Cloudflare **R2**（Egress 免费，存储 $0.015/GB/月；1,324 GIF 估算 ≈ 130MB ≈ $0.002/月）
  - Bucket：`workout2-gifs`，public access，`Custom Domain` 用 `pub-xxxx.r2.dev`
  - 目录：`/workout2-gifs/exercises/{hasaneyldrm-id}-{slug}.gif`（沿用 hasaneyldrm 文件名约定，basename 一致）
  - CORS：开 `GET` only（POST 不需要）
- **mapping schema 扩展**
  - `src/db/seeds/exerciseG35Mapping.ts` 新增 `cdnUrl?: string` 字段
  - `bundled: false` 项必须有 `cdnUrl`，`bundled: true` 项必须有 `assetFileName`
  - 已有的 52 项 bundled 保持不变
  - 新增 ~250 项 `bundled: false` + cdnUrl（选 hasaneyldrm 数据集里"高使用频"的子集，覆盖常见变体）
- **新增种子动作**
  - `src/db/seeds/exercises.ts` seed 函数扩展：当前 52 个中文动作；G41 新增 ~250 个 `hasaneyldrmId` 索引的中文动作
  - 中文翻译来源：**手动**（G35/G37 已建立流程，效率 ≈ 30 个/小时；或批量用 OpenAI gpt-4o-mini 一波 + 人工校对，预算 ≈ $5-10 / 250 条）
  - `target` → `category` 映射沿用 `TARGET_EN_TO_CATEGORY_ZH`（G35 §1 已建）
  - `equipment` 翻译沿用 `EQUIPMENT_EN_TO_ZH`（G35 §1 已建）
  - `instruction_steps_zh`：抽 50 个最常用动作手写（其余暂留 null，详情页 fallback 到 GIF）
- **UI 接入（已就位，零业务改动）**
  - `ExerciseThumbnail` 调 `ExerciseGifImage`（已吃三态）
  - `ExerciseDetailScreen` 调 `ExerciseGifImage`（已吃三态）
  - **唯一改动**：`ExerciseDetailScreen` 详情屏的 GIF 区域从"同步显示"变成"Skeleton → 200ms transition 淡入"，与 G39 验收一致
- **新增测试**
  - `src/screens/__tests__/exerciseGifCache.test.ts` 扩展：`cdnUrl` 解析 + LRU 200MB 触发（mock `File.info().size`）
  - `src/screens/__tests__/exerciseG35Mapping.test.ts` 扩展：bundled/CDN 互斥断言 + 250 条新项 gifUrl 全为合法 https URL
  - `src/screens/__tests__/exerciseGifImage.test.tsx` 加 remote → Skeleton → setSource({uri}) 序列测试

#### 设计决策（先定版）

1. **混合策略**：52 bundled（秒开）+ ~250 CDN（首次访问下载到 cache）= 302 总动作
2. **不一次性到 1,324**：先把 CDN 链路跑通 + 内容扩展到 300；扩到 1,324 是 G44+
3. **翻译策略**：手动 + LLM 辅助混合，首批 100 个手动核，剩下 150 个 LLM 初翻 + 抽 30% 复核
4. **失败兜底**：CDN 下载失败 → Skeleton 持续；用户下次进入详情重试（已有 LRU 留底）
5. **GIF 版权**：沿用 hasaneyldrm/exercises-dataset **MIT** + Gym Visual attribution（详情页底部 © Gym Visual 已展示），R2 上保留原始文件 + 不改 attribution
6. **不写 `react-native-config` / 远程 CDN URL 切换**：MVP 只配一个 R2 bucket；多 CDN 切换留 Phase 3

#### 设计期 AC（实际结果见上方「三个 Bug」+「实际落地」）

- AC-41.1 R2 bucket 已建并 public 可访问，目录 `/workout2-gifs/exercises/{id}-{slug}.gif` 有至少 250 个 GIF；HTTP `GET` 返回 200 + `image/gif` content-type → **❌ Bug 2 未做**
- AC-41.2 `src/db/seeds/exerciseG35Mapping.ts` 新增 ~250 项 `bundled: false` + `cdnUrl`，每项的 cdnUrl basename 与 hasaneyldrm 文件名一致 → **✅ 254 项，basename 一致（域名仍是占位符）**
- AC-41.3 `exercises` 表 seed 总数 ≥ 300（52 + 250 + 用户自定义）；`gif_url` 字段混合 `asset:` 与 `https://` → **✅ 306**
- AC-41.4 `ExerciseGifImage` 在 remote URL 下首屏渲染 Skeleton，下载完成后 200ms transition 淡入 → **✅**
- AC-41.5 离线状态进入 CDN 动作详情 → Skeleton 持续不崩；联网后下次进入 → 正常渲染 → **⚠️ 无法验证（R2 未部署，永远走不到"联网正常"分支）**
- AC-41.6 缓存命中：第二次进入同一 CDN 动作详情 → 立即显示，无网络请求 → **⚠️ 同上**
- AC-41.7 LRU 触发：cache 总大小 > 200MB → 最旧 mtime 的 GIF 被删除直到 < 200MB → **✅ 单测覆盖**
- AC-41.8 真机：新装 APK → 冷启 → "杠铃卧推"（bundled）GIF 秒开；"坐姿腿屈伸"（CDN）Skeleton → GIF → **⚠️ 前半 ✅，后半被 Bug 2 阻塞**
- AC-41.9 备份 JSON 含 `cdnUrl`；wipeAllData 后重 seed 仍能恢复 → **✅**
- AC-41.10 现有 suites 全过 + G41 新增 ≥ 3 suites / ≥ 15 tests → **✅**

#### 设计期自检清单（已被上方提交记录取代）

- [x] `exerciseG35Mapping.ts` 254 项 cdnUrl 就位（basename 与 hasaneyldrm 一致）
- [x] 中文翻译 254 条完成
- [x] 备份/清除兼容 cdnUrl 字段
- [x] tsc --noEmit 通过
- [x] 全量 jest 通过（28 suites / 304 tests）
- [x] 真机：bundled 渲染正常 + 老装 52→306 升级路径打通
- [ ] **R2 bucket 已建 + CORS 已配 + 254 GIF 已上传** ← Bug 2，用户拍板推迟
- [ ] 真机：CDN 首次加载 / 离线 Skeleton / 缓存命中 / LRU 触发 ← 被 Bug 2 阻塞

#### Why

G40 暴露一个关键事实：APK bundled 不是无限容量方案。G41 把"在线加载"做出来有 3 个长期价值：(1) 动作库从 52 → 300+ 直接提升训练质量；(2) 验证 CDN + cache 链路对实际用户的体验（首次访问延迟、命中率、LRU 必要性）；(3) 为后续扩到 1,324 全量铺路，避免一次性做完大爆炸。

#### How to apply

- 看到 G41 完成 → 想给动作库加新动作，先看 `EXERCISE_G35_MAPPING`，新加走 `bundled: false` + cdnUrl，不要再 require()
- 看到 R2 bucket 502 / 404 → 走 `exerciseGifCache` 的 retry；用户多次失败 → Skeleton + 详情页给一个"重试"按钮（G41 范围外，留 G44+）
- 真机首次进入 CDN 动作 > 3s → 检查 R2 CORS + HTTP/2 + 区域节点；亚太用户应配 R2 亚洲 PoP

---

## G42. 休息通知收口 + 通知栏原生 ProgressBar ✅ 真机验收通过（着色项除外）

**优先级**：P2（体验收口）  |  **依赖**：G38 / G38.1  |  **阶段**：3
**状态**：**✅ 2026-09-27 / 09-28 两轮真机验收通过**（OPPO PBEM00 / Android 10），已合入 master
**例外**：进度条**着色**三条 AC 未达成 —— Android 10 上做不到，见「已知风险」第 1 条

本目标由四块拼成，按落地顺序排列。

### G42a — 训练完成 save flow 重构（`7c69b36`）

**要修的 bug**：`ActiveTrainingScreen.completeAndNavigate()` 在导航前先点亮通知栏 timer，紧接着父屏 unmount → bridge 的 useEffect 只跑 cleanup 不重跑 body → **通知永远卡在最后一组剩余秒数**。同样的 bug 在「主动结束训练且正处于休息间歇」时复现。

**新行为**：

- `completeAndNavigate()` **不再 await DB 写入**，只算 stats + `navigation.replace('TrainingComplete')`
- 完成页改成**双按钮**：「保存训练记录」（三态 `idle / saving / saved`）+「不保存」（ghost + Dialog 二次确认）
- 删掉「已写入训练历史 · #xxx」整行
- 两条 end 路径（自然完成 / 主动结束）都在 navigation **之前**同步做两件事：
  1. `useRestTimerStore.getState().skip()` —— store 翻 idle
  2. `dismissRestTimerNotification()` **直调** —— 这是关键兜底

> **可复用的通用规律**：`screen A unmount → screen B mount` 的路径上，只要 A 持有通知 / 定时器 / 订阅这类副作用，
> **绝不能让它依赖 unmount cleanup 自动收尾**，必须在 unmount 之前同步直调。同样适用于 Live Activity、媒体播放、传感器订阅。

### G42b — 通知排版简化（`7378dd8` → `3afb785`）

先在通知 body 里显示当前动作名，并用 unicode 块字符（`█`/`░` 20 段）手画「帧级平滑」进度条。
**结果不满意**：块字符字宽不一、每秒整段跳，不像视频播放器 → 直接引出 G42c。

### G42c — 通知栏原生 ProgressBar（`8798e50` + `8bd8142` + `f44d979`）

**方案选择**：用户在三个方案里挑了「native 模块」—— 自己 wrap `NotificationCompat.Builder.setProgress(max, current, indeterminate)`，交回 Android 系统自带 ProgressBar 渲染。

**首个本地 expo-module**：`modules/expo-rest-timer-progress/`

```
modules/expo-rest-timer-progress/
├── package.json                     # name=expo-rest-timer-progress, main=src/index.ts
├── expo-module.config.json          # {"platforms":["android"]}，无 publication 块（本地不走 Maven）
├── android/
│   ├── build.gradle                 # expo-module-gradle-plugin + androidx.core:core:1.17.0
│   └── src/main/java/expo/modules/resttimerprogress/
│       ├── RestTimerProgressModule.kt   # ModuleDefinition { Name("RestTimerProgress");
│       │                                #   AsyncFunction("ensureChannel"/"show"/"setProgress"/"dismiss") }
│       └── RestTimerProgressPackage.kt  # : BasePackage()  ← autolinking 静态扫描锚点
└── src/
    ├── index.ts                     # requireNativeModule("RestTimerProgress")；iOS 路径 null noop
    └── __tests__/index.test.ts      # 6 用例
```

**关键设计点**：

| 点 | 说明 |
|---|---|
| `BasePackage` 是 autolinking 必要 anchor | `expo-modules-autolinking` 静态扫 `sourceDir` 需要至少一个 `BasePackage` 子类，否则 `packages: []` → 模块不被 bundle 进 `:app` |
| channel id 复用 `"rest_timer"` | 与 `expo-notifications` 旧路径同 id；Android `createNotificationChannel` 幂等 |
| `NOTIFICATION_ID = 1001` | 原生模块用固定 int id（`NotificationManagerCompat` 要求） |
| `setProgress` 增量更新要 rebuild builder | `NotificationCompat.Builder` 不支持 mutate；从 `activeNotifications` 读旧 `EXTRA_TITLE`，避免 JS 每秒重传 title |
| `cachedColorHex @Volatile` | 颜色只在 `show` 时设一次，`setProgress` 沿用 |
| JS API 表面零改动 | `showOrUpdateRestTimerNotification(rem, total, name?, colorHex?)` 只多一个可选参；bridge 传 `useTheme().colors.primary` |
| 1 Hz 而非 60 fps | 沿用 bridge 现有 `setInterval(1000)`；60 fps 对 1 Hz 倒计时无意义 |

**改动文件**：`modules/expo-rest-timer-progress/*`（7 新文件）、`package.json`（加 `file:` 依赖）、`jest.config.js`（testMatch 收 `modules/**`）、`restTimerNotification.ts`（主体换调原生模块，export 签名全保留）、`RestTimerNotificationBridge.tsx`（`useTheme()` 读 color，effect 依赖加 scheme）、`restTimerNotification.test.ts`（mock 原生模块，删 4 个 unicode 断言）。

> ⚠️ 上面 G42c 设计表里 **`setProgress` 增量更新 / `cachedColorHex` 两条已作废** —— 那两个东西在 G42d 里被删掉了（前者全仓库无调用点，属于死代码；后者随之变成只写不读）。读设计表时以 G42d 为准。

### G42d — 后台进度条冻结：前台服务 + 原生 1s ticker（`787b85d` + `92e2db9` + `67024c6`）

**真机暴露的矛盾现象**（2026-09-28 22:55 实测）：

```
22:55:19  按 Home 后   Chronometer 00:49  进度条填充 ~99%   ← 应为 82%
22:55:27  回前台后     Chronometer 00:41  进度条填充 ~70%   ← 恢复正确
```

**数字在走、进度条卡死**。根因是两者刷新机制**不对称**：RemoteViews 里唯一会自走的控件是
`<Chronometer>`（SystemUI 每秒按 time base 重画，与 App 进程死活无关）—— 上一条修复正是靠它；
而 `<ProgressBar>` 没有对应机制，值只能由 App 主动写 `RemoteViews.setProgressBar`。
退后台后进程被 Android 的 **cached-app freezer** 冻住，JS `setInterval` 停摆 → 最后一帧定格。
回前台 JS 复活、下一推立刻校准 —— 所以看上去像「一回来就正常了」。

**改法**：把每秒重画从 JS **挪进原生前台服务**，前台后台走同一条渲染路径。

```
modules/expo-rest-timer-progress/android/src/main/java/expo/modules/resttimerprogress/
├── RestTimerTickerService.kt     # 新增：前台服务 + 1s Handler ticker，每帧重建 RemoteViews
├── RestTimerProgressModule.kt    # show() 从"渲染"降级为"同步权威状态"
└── RestTimerAlarmReceiver.kt     # 到点路径，与服务共用 handleRestExpired + 5s 去抖
```

**架构三条要点（改动时别破坏）**：

| # | 要点 | 说明 |
|---|---|---|
| 1 | **渲染入口唯一** | 服务活着时它是唯一渲染者；JS 的 `show()` 降级为同步权威状态，由 `RestTimerTickerService.matches()`（total/title/color 相同 + 到点时刻差 ≤1.5s）去重成 no-op。**不去重的话两边同时写同一条通知，谁赢看时序，进度条会来回跳。** 1.5s 容差是为了吸收 JS 侧 `ceil` 量化带来的 ≤1s 抖动，否则服务会被每秒重启 |
| 2 | **AlarmManager 仍是到点的保证** | 服务**不持 wake lock**，息屏进 Doze 后 CPU 睡、ticker 同样会停。所以**进度条只在亮屏时有意义**（ticker 够用），**到点必须准**（靠 `setExactAndAllowWhileIdle`）。两条路径共用一个 `handleRestExpired` |
| 3 | **`onDestroy` 分两种收尾** | 到点 → `STOP_FOREGROUND_DETACH`（刚发的「休息结束」用的是**同一个** `NOTIFICATION_ID`，`REMOVE` 会把它一起抹掉，是真会踩到的竞态）；跳过 / 切换 → `REMOVE`，别在通知栏留一条冻死的倒计时 |

**manifest 要点**：`FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_SPECIAL_USE`；service 声明
`foregroundServiceType="specialUse"` + `PROPERTY_SPECIAL_USE_FGS_SUBTYPE`（targetSdk 36 下类型是**强制**的，
不给会 `MissingForegroundServiceTypeException`）。**没用 `shortService`** —— 它有 3 分钟上限，而
`REST_PRESETS` 最大 240s，会撞。API 29–33 传 `TYPE_NONE` 走传统路径，API 34+ 才传 specialUse。
另关掉 Android 12+ 对前台服务通知的 10s 延迟显示（`FOREGROUND_SERVICE_IMMEDIATE`）—— 倒计时通知要人看着走。

**顺带修掉的既存 bug**：`show(0)` 原来是 cancel + cancelAlarm，本意是「别挂一条 00:00 的进行中通知」，
但它操作的是**共享** `NOTIFICATION_ID` → 会把刚发的「休息结束」一起删掉，还会在闹钟兑现前把它取消掉。
现在改成**纯 no-op**，收摊交给 `dismiss()`。

### 验收状态

- [x] `npm run typecheck` 干净
- [x] `npm test` 全绿 —— 截至 2026-09-29 为 **31/31 suites、328/328 tests**（G42c 时为 304/304；
      模块 wrapper 的 7 个用例此前因 mock 写法问题**从未真正跑起来**，已于 09-29 修复，见测试清单 §13.10）
- [x] `npx expo-modules-autolinking resolve --platform android` 显示 `packages: ['expo.modules.resttimerprogress.RestTimerProgressPackage']`
- [x] 训练完成三条路径（自然完成 / 主动结束空闲 / 主动结束间歇中）通知栏正确消失 + 双按钮工作 — 2026-09-18 用户确认「测试正常」
- [ ] **真机**：light 模式进度条颜色 = `#FF6B35` ← ❌ **未达成**，见下方「已知风险」第 1 条
- [ ] **真机**：dark 模式进度条颜色 = `#FF7A4D` ← ❌ **未达成**（同上，且 dark 从未单独实测）
- [ ] **真机**：切主题 → 通知栏进度条颜色跟随切换 ← ❌ **未达成**（同上）
- [x] **真机**：退后台通知停留 + 进度条继续推进 — 2026-09-28 ✅

**真机验收记录（OPPO PBEM00 / Android 10 / arm64-v8a / serial `3c66de59`）**

| 验收点 | 证据 | 日期 |
|---|---|---|
| 后台倒计时数字不冻结 | 锁屏 + 黑屏约 50s，计时器 89s → 38s 正常推进 | 09-27 |
| 通知栏 RemoteViews 进度条渲染 | 像素测量确认填充段 `x=[69..407]` 339px | 09-27 |
| 到点 AlarmManager 触发 + 通知 cancel | receiver 准点唤起 | 09-27 |
| **后台进度条继续走**（G42d 主验收） | 按 Home 后 23:49:27 `00:21`/条 ~65%；23:49:38 `00:11`/条 **~37%**（= 11/30 ✅） | 09-28 |
| **前台服务真的起来** | `dumpsys activity services`：`isForeground=true foregroundId=1001`，无 `MissingForegroundServiceTypeException` | 09-28 |
| 到点「休息结束」发一次 | 23:49:49 帧显示「休息结束 / T杠划船」，倒计时那条被**干净替换**（不是并排） | 09-28 |
| 到点震动唯一不重复 | `dumpsys vibrator`：alarm 段 `usageHint:4` ×1 + notification 段 `usageHint:5` ×1，同一时刻 | 09-28 |
| skip 收尾干净 | 点「跳过」后服务无记录、活跃 `NotificationRecord` 数 = 0 | 09-28 |

> 逐条 AC 的勾选状态见 `docs/REAL_DEVICE_TEST_CHECKLIST.md` §9.5 —— 那份是逐项对照表，
> 其中**未单独记录**的若干项（+15s / 下一组重置 / 权限弹窗 / channel 设置）没有虚勾。

### 已知风险

1. **❌ 进度条着色在 Android 10 上做不到** —— `setProgressTintList` 走 `RemoteViews.setColorStateList`
   需要 **API ≥ 31**。验收机 OPPO PBEM00 是 Android 10（API 29），进度条呈现为**系统 teal 而非主题橙**。
   代码里已注释说明。**上面三条颜色 AC 因此判为未达成**，不是没测，是这套实现方案在该 API 级别上无解。
   若产品上必须着色：换 RemoteViews 自绘 ProgressBar widget（可着色），或放弃系统 ProgressBar。
2. 通知小图标当前用系统占位 `android.R.drawable.ic_menu_recent_history`（灰白时钟），**不是 App adaptive icon**，待后续目标换 `app_icon` resource
3. iOS 路径仍是 noop（`Platform.OS !== 'android'` 直接 return），**Live Activity 未做**
4. **息屏后进度条仍会停**（有意取舍）—— 服务不持 wake lock，Doze 下 CPU 睡、ticker 停。
   只有**亮屏**时进度条才有意义；**到点始终准**（靠 AlarmManager）。
5. 1 Hz 是 `NotificationManager` 的安全更新频率；想要真 60 fps 需要 RemoteViews + ProgressBar widget 局部更新

### 提交记录

- `7c69b36` feat(training-complete): 通知栏 timer 收尾 + 完成页显式保存按钮 ← G42a
- `7378dd8` feat(rest timer): notification 显示当前动作名 + 进度条 60fps 帧级平滑 ← G42b
- `3afb785` feat(rest-timer-notification): 极简化通知排版(mm:ss + 动作名 + 纯进度条) ← G42b
- `8798e50` feat(G42): 通知栏原生 ProgressBar — 本地 expo-module expo-rest-timer-progress ← G42c
- `8bd8142` chore(G42): add packageManager pnpm@10.33.0（试 pnpm 强制，**没用**）
- `f44d979` fix(G42): 同步 package-lock.json 加入 expo-rest-timer-progress（**真修复**）
- `787b85d` fix(G42): 后台到点 popup 直接消失 — receiver 写 SP，bridge 回前台 consume 立即清 ← G42d
- `92e2db9` fix(G42): 直调震动补 `AudioAttributes.USAGE_ALARM`（后台 `USAGE_UNKNOWN` 被 AOSP 静默丢弃）← G42d
- `67024c6` fix(G42): 通知栏进度条后台不再冻 — 前台服务 + 原生 1s ticker ← G42d

---

## G43. dev-client 工程链路修复（跨 G39–G42）✅ 真机验收通过

**优先级**：P1（**阻塞全部真机验收**）  |  **依赖**：G39（首次引入 dev-client）  |  **阶段**：3
**状态**：**✅ 2026-09-27 真机验收通过** —— 全部 6 commit 在栈上，dev-client 输 URL 后**不红屏、无 SIGSEGV、首页完整渲染**；
`patches/` 的 rnscreens `setupFabric` 兜底 + worklets 0.10.1 锁版**均确认生效**（验收 APK: run `35883827334`，commit `787b85d`）

### 为什么单开一节

G39 起项目从 Expo Go 转向 **dev-client + EAS Build**（worklets 必须走 dev-client）。
这条链路上的坑全是「代码没问题但装不上 / 起不来」，与业务功能无关，却**阻塞了所有后续真机验收**。按 G30「工程收口」的先例单列。

### G43a — dev-client 接入（`4a80a43`）

- `eas.json` 加 `development` profile：`developmentClient: true` + `:app:assembleDebug` + APK + `distribution: internal`
- 加 `eas:development` / `eas:preview` 脚本
- `patch-package` + `postinstall` hook（为 G43c 的 patch 服务）

### G43b — worklets / reanimated 版本锁定（`c1f8785` + `948efa5`）

| 版本 | 结果 |
|---|---|
| worklets **0.12.x** bundle mode | ❌ `expo-modules-core` peer dep 上限是 `^0.10.0`，跑 expo-dev-client → **SIGSEGV** |
| reanimated **4.6.0** + worklets 0.10.4 | ❌ 4.6.0 带硬运行时检查，拒绝 worklets < 0.12.x → **每次 bundle 加载红屏** |
| **reanimated 4.5.1 + worklets 0.10.1** | ✅ **canonical 配置** |

- `c1f8785` 锁回 0.10.1 + 4.5.1，`bundleMode: false`
- `948efa5` 把 `^4.5.1` / `^0.10.1` 的 **`^` 去掉**：lockfile 漂移会让 `pnpm install` 解析到 4.6.0 + 0.10.4，重新触发红屏。精确锁版后不可能再漂

> 这条配置是**硬约束**——升 reanimated / worklets 前先读本节。

### G43c — rnscreens setupFabric NPE patch（`8b75202` + `1e06421`）

**症状**：dev-client 输入 `exp://` URL 后红屏：

```
[runtime not ready]: Error: Exception in HostObject::get for prop 'RNSModule':
java.lang.NullPointerException: null cannot be cast to non-null type
  com.facebook.react.fabric.FabricUIManager
    at com.swmansion.rnscreens.ScreensModule.setupFabric(ScreensModule.kt:59)
    at com.swmansion.rnscreens.ScreensModule.initialize(ScreensModule.kt:54)
```

**根因**：RN 0.86 + dev-client 启动时是 Fabric 启动顺序 race —— `UIManagerHelper.getUIManager(ctx, FABRIC)` 在 `ScreensModule.initialize()` 阶段返回 null，而 screens 4.x 直接 `as FabricUIManager` 强转 → NPE → 进程挂。

**上游确认未修**：4.26.2（本机装的）/ 4.28.0 / 5.0.0-alpha.3 三版的 `setupFabric` 都是同一个强转。→ 只能本地 patch。

**Patch**：`patches/react-native-screens+4.26.2.patch`

1. `setupFabric()` 改 `as?` nullable cast + null guard + 幂等 flag `fabricListenerAttached`
2. 加 `onHostResume()` 兜底：initialize 阶段 Fabric 没就绪时，host resume 时重试一次（flag 保护不会重复 add listener）

`1e06421` 修掉第一次打 patch 时引入的重复 `onHostResume`（Kotlin 编译错误）。

> **长期保留项**：screens 升级前先确认上游是否原生修了 `setupFabric`；没修就得同步更新 patch 文件。
> 有人报「dev-client 输 URL 后红屏，栈里带 `ScreensModule.setupFabric`」→ 100% 是这个 patch 没生效。

### G43d — EAS 云端双 lockfile 坑（`f44d979`）

**症状**：前 4 次 build 全部 fail with `Unknown error`（通用错误，无具体信息）。

**排查路径**：`eas build:view --json` → 取 `logFiles` URL → `curl --compressed` 拿到真实日志：

```
Running "npm ci --include=dev"
npm error `npm ci` can only install packages when your package.json
          and package-lock.json are in sync
npm error Missing: expo-rest-timer-progress@1.0.0 from lock file
```

**关键发现**：EAS cloud 跑的是 **`npm ci`**，尽管 `pnpm-lock.yaml` 也在仓库里。双 lockfile 共存时 EAS 默认选 npm。
`packageManager: pnpm@10.33.0` 字段（`8bd8142`）**没能**强制切换；`postinstall-postinstall`（`2d0e3eb` 移除）反而会把 `packageManager` 字段弄坏。

**修复**：`npm install --package-lock-only --ignore-scripts` 把新依赖同步进 `package-lock.json`。

> **✅ 已收口（2026-09-29 核实）**：原本登记的「双 lockfile 共存，待决策删哪个」**已不成立** ——
> pnpm 已完全退场，不存在二选一：
> - `pnpm-lock.yaml` 不在磁盘上，且**从未被 git 跟踪**（`git log --diff-filter=D -- pnpm-lock.yaml` 为空）
> - git 跟踪的 lockfile 只有 `package-lock.json`；CI（`.github/workflows/android-apk.yml`）只消费它
> - `packageManager: pnpm@10.33.0` 字段已在 `9898685` 删掉
> - 核实命令：`npm ci --dry-run --ignore-scripts` → exit 0（`package.json` 与 lock 同步）
>
> ⚠️ 教训：这条过时隐患在 2026-09-29 的进度汇报里被**照抄引用**，当成待办报给了用户。
> 文档里的隐患清单要定期核实，**过时的必须删** —— 见测试清单 §13 的维护规则。

### G43 收口（2026-09-23 核实 → 2026-09-27 真机验收通过）

| 项 | 值 |
|---|---|
| **G43 全部 6 commit 是否在栈** | ✅ 全部：`4a80a43` + `c1f8785` + `8b75202` + `2d0e3eb` + `1e06421` + `948efa5` |
| **patches/react-native-screens+4.26.2.patch** | ✅ 文件存在（1730 bytes, 9-18） |
| **验收用 APK** | GH Actions run `35883827334`（commit `787b85d`，157MB，sha256 `43bcca81...d9fd0`） |
| **真机结果** | ✅ 输 `exp://` 进 App **不红屏**、**无 SIGSEGV**、首页三 Tab 完整渲染 |

**G43 + G42 + G44 一次性验收结论（2026-09-27，OPPO PBEM00 / Android 10）**：

| 目标 | 结果 | 依据 |
|---|---|---|
| **G43** | ✅ 通过 | rnscreens patch + worklets 锁版双双生效 |
| **G44** | ✅ 通过 | 抽查 4 个 `bundled: false` 动作 GIF 全部渲染；logcat 零图片加载错误；COS 独立 curl 返回 `200 image/gif 92KB` |
| **G42** | ⚠️ → ✅ | 当天「三缺一」（直调震动被系统丢），`92e2db9` 修复后通过 |

> 若 G43 真机仍红屏带 `ScreensModule.setupFabric` 栈 → `patches/` 目录在 CI 没生效（postinstall 没跑或 lockfile 没装 `patch-package`），查 GH Actions 日志 `npm run postinstall` 步骤。

### 提交记录

- `4a80a43` chore(EAS): 加 development profile + expo-dev-client 接入
- `c1f8785` fix(worklets): 锁回 0.10.1 + reanimated 4.5.1 兼容 expo-modules-core peer dep
- `8b75202` fix(rnscreens): patch setupFabric NPE on RN 0.86 dev-client
- `2d0e3eb` fix(EAS): drop postinstall-postinstall (mangles packageManager field)
- `1e06421` fix(rnscreens): remove duplicate onHostResume (Kotlin compile error)
- `948efa5` fix(deps): pin reanimated 4.5.1 + worklets 0.10.1 (drop ^)

---

## G44. 254 张 CDN GIF 落地腾讯云 COS ✅

**优先级**：P0（**Bug 2 收口**）  |  **依赖**：G41（已规划 R2 CDN 路径）  |  **阶段**：3
**状态**：✅ **全部完成**（2026-09-23）

### 为什么从 R2 改 COS

G41 当时定 Cloudflare R2 做 CDN 托管，但 **R2 bucket 在大陆访问稳定性差 + 绑卡 / PayPal 摩擦大**，Bug 2 一拖就是一周。G44 用户拍板改走腾讯云 COS，理由：

| 维度 | Cloudflare R2 | 腾讯云 COS |
|------|---------------|------------|
| 国内访问 | 经常被墙 / 不稳定 | 稳定（公网覆盖）|
| 注册摩擦 | 需海外卡 / PayPal | 微信扫码 + 身份证实名 |
| 出口流量 | 免费 | 10 GB/月免费，超出 0.5 元/GB |
| 存储 | 10 GB 免费 | 5 GB 免费 |
| 月成本（254 张 ~25 MB / 9 万次读） | $0 | ~0.9 元 |

**G44 选了按量付费（不买资源包）**—— 254 张图 + 9 万次/月请求完全在免费额度内。

### 实际步骤

1. **开通 COS** → 控制台 → 对象存储 → 开通服务（免费，10 秒）
2. **创建 bucket**：
   - 名称：`workout-gifs-cdn-20260923-1327489994`（用户输入 `workout-gifs-cdn-20260923`，腾讯云自动追加 APPID `-1327489994`）
   - 地域：公有云园区-中国-**上海**（ap-shanghai）
   - 访问权限：**公有读私有写**（关键！不是私有读写）
   - 存储类型：标准存储
   - **数据冗余策略改为「单 AZ 存储」**（默认勾的是多 AZ，存储费贵 1.5-2 倍；254 张图根本不需要三机房冗余）
3. **配 CORS**：来源 `*`、Methods `GET, HEAD`、Allow-Headers `*`、Expose-Headers `ETag, Content-Length, Content-Type`、Max-Age `3600`
   - **OPTIONS 不需要勾**——腾讯云 COS 把 GET/HEAD 当简单方法，OPTIONS 预检自动放行
4. **下载 254 张 GIF** 到 `.tmp/exercises/`：
   - `scripts/download-g44-gifs.js`（基于 hasaneyldrm GitHub raw + 自动 fallback jsDelivr CDN，单一文件超时 22s 时换镜像秒过）
   - 8 路并发 GitHub 限速（ECONNRESET），降为 4 并发 + retry 5 次后稳定
5. **批量上传** 到 `exercises/` 路径：腾讯云控制台 → 「创建文件夹 `exercises/`」→「上传文件」批量选 254 张 GIF（单次最多 100 张，分 3 批）
6. **修浏览器下载问题**：腾讯云控制台批量上传时**默认**给每个文件打 `x-cos-force-download: true` metadata，响应头里出现 `Content-Disposition: attachment`，浏览器一律走"另存为"。
   - **不影响 RN 客户端**（拿字节流自己 Image 渲染，不解析 Content-Disposition）
   - 但浏览器访问要修：用 cos-nodejs-sdk-v5 写 `scripts/fix-cos-force-download.js`，对每个文件 `putObjectCopy(... MetadataDirective: 'Replaced', xCosForceDownload: 'false')`，254 张全部改完，响应头验证只剩 `Content-Type: image/gif`
7. **批量替换 URL**：
   - `src/db/seeds/exerciseG35Mapping.ts`：254 条 `cdnUrl` 从 `pub-PLACEHOLDER.r2.dev/workout2-gifs/exercises/` 替换成 `workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises/`
   - 4 个测试文件的断言 + 描述：从 G41 R2 改成 G44 腾讯云 COS（regex 模式 `.r2.dev/` → `.cos.ap-shanghai.myqcloud.com/`）
8. **jest 全跑**：298 个测试全绿（G44 相关 71 个 + 其余 227 个），唯一失败的 `modules/expo-rest-timer-progress/src/__tests__/index.test.ts` 是 expo winter/fetch 在 jest 环境的兼容问题，pre-existing，与 G44 改动无关。

### 凭据生命周期

- COS 子用户 `g44-cos-fix`，授权 `QcloudCOSFullAccess`
- 任务跑完后**必须立刻禁用该 API key**（用户已确认）
- 后续批量改 metadata / 重传等维护再临时开新 key，用完即关

### 提交记录

（待 commit——本节写完后一并提交）

### 文档

- `docs/setup/tencent-cos.md——新建 COS（配置 + CORS + 监控项）
- `docs/setup/cloudflare-r2.md` 保留作为档案，标记废弃
- `scripts/download-g44-gifs.js`——G44 增量下载工具（后续加新动作可重跑）
- `scripts/fix-cos-force-download.js`——G44 metadata 批量修复工具

### 月成本（实测估算）

| 规模 | 月成本 |
|------|---------|
| 100 用户 × 30 次/天 | < 1 元 |
| 1000 用户 × 30 次/天 | ~5 元 |
| 10000 用户 × 30 次/天 | ~50 元（此时才考虑 100GB 流量包 ¥50/6 月）|

监控建议：控制台 → 消息订阅 → **费用预警** → 预算 ¥10/月，超阈值短信通知。

---

## G45. 用户自定义头像（相册选图）⏳ 代码完成 / 待真机验收

**优先级**：P1  |  **依赖**：无（新引入原生依赖 `expo-image-picker`）  |  **阶段**：3
**状态**：代码完成 + 测试全绿；**真机验收未跑**（卡点：必须重打 APK，见下）

### 需求（用户已拍板，四条不再讨论）

1. **只做相册选图** —— 不做拍照，因此不引入 `CAMERA` 权限
2. **头像只在「我的」页显示** —— 首页/其它页不动
3. **「头像 + 用户名」编辑抽成一个共享 Sheet**，Profile 与 Settings 共用
4. **头像纯本地**：不参与导出/导入；「清除全部数据」时连同图片文件一起删

### 决策：头像路径**不进 settings 表**

`settings` 是 key-value 表，加个 `avatarUri` 键不需要 migration —— 看似最省事，
但 `exportData.ts:80,:128` 用 `listSettings(db)` **整表 dump**、
`importData.ts:210` 又 `DELETE FROM settings` **整表覆盖**：

- 存进去 → `file://` 沙盒路径进备份，还原到另一台设备指向不存在的文件
- 要绕开就得在导出端加黑名单 + 导入端加忽略 + 改 `importData.test.ts` 基线 payload
  —— 四个改动点，只为了一条不该被导出的数据
- 还会引入「DB 说有路径 / 文件其实没了」这种**无法自愈**的不一致态

**改成：文件本身就是唯一真相。** 存在 `Paths.document/avatars/` 下，DB 完全不参与。
「不参与备份」于是成了结构性保证，而不是一份要一直记着维护的过滤规则 ——
`settingsStore` / `exportData` / `importData` 一行都没动。

根目录用 `Paths.document` 而非 `Paths.cache`：后者按 `Paths.d.ts` 自己的说法
「can be deleted by the system when the device runs low on storage」，头像放 cache 会莫名消失。

### 三个实现细节（都不是偏好，是踩过后定的）

| 决定 | 理由 |
|---|---|
| 文件名唯一（`avatar-<ts>.<ext>`）+ `getStoredAvatar()` 扫目录取最新并清多余 | 固定名方案要靠 `?v=lastModified` 去顶掉 `expo-image` 按 URI 字符串做的缓存，属于「赌它能 work」—— 而且这个 bug **只有真机换第二张图才验得出来**。唯一名让 URI 每次都变，原理上不可能失败，且崩在中途能自愈 |
| 写文件走 `bytes()` + `write()`，不走 `copy()` | 这是 `file://` 与 `content://` **都成立**的唯一路径（走 `ContentResolver.openInputStream`，同 `SettingsScreen.tsx:195` 已验证的机制）。`copy()` 对 `content://` 的行为本地 `.d.ts` 看不出，验它要花一次 21 分钟的打包括 |
| **不预申请相册权限** | `ImageLibraryContract.kt:115` 老路径走 `ACTION_GET_CONTENT`、Android 13+ 走系统 Photo Picker —— **两条都不需要存储权限**。预申请会在 API 29 验收机上白弹一个授权框，正好违背「只要相册」的意图 |

### 原生配置：两个 `false` 都必须写

`expo-image-picker` 的库 manifest **无条件声明 `CAMERA`**（会被 manifest merger 并进 APK），
且 `plugin/build/withImagePicker.js` 里不显式传 `microphonePermission: false`
就会**凭空加一个 `RECORD_AUDIO`**。所以 `app.json` 里两个都写 false 才符合「只要相册」。

> ⚠️ `android/` 在 `.gitignore` 里、CI 每次 `expo prebuild` 重新生成 ——
> **手改本地 `android/app/src/main/AndroidManifest.xml` 没有任何用，`app.json` 才是唯一杠杆。**

**配置已离线核实**（不用等 21 分钟打包括）：`npx expo config --type introspect` 会把
config plugin 跑一遍并打印最终 manifest。结果里 `CAMERA` 与 `RECORD_AUDIO` **只以
`tools:node="remove"` 的形式出现**、没有任何一条授权条目 —— 即 merger 会在打包时把它们
剔掉，两个 `false` 生效。（expo 的 `withBlockedPermissions` 是**加一条 remove 指令**，
不是删条目；所以光看权限名在不在会误判，必须看 `tools:node`。）

### 顺带修好的既有缺口

`clearGifCache()`（`src/screens/exerciseGifCache.ts`）的 doc 注释白纸黑字写着
「暴露给『清除全部数据』流程」，但**从 G41 起从来没有任何地方调用过它** ——
清数据会留下 `Paths.cache/gifs`。根因是收尾清单被抄成了两份（`ProfileScreen` /
`SettingsScreen` 各一份），加项时漏了一处。

本次把清单抽成 `src/features/profile/clearAllData.ts` 一处，头像文件清理和
GIF 缓存清理都在里面，两个屏各调一次。

### 文件清单

| 文件 | 作用 |
|---|---|
| `src/utils/avatarFile.ts` | 文件 IO（唯一真相层），不碰任何 store |
| `src/utils/avatarPicker.ts` | 原生边界（拉起相册），不碰 store |
| `src/store/avatarStore.ts` | 薄响应式投影，三个方法都不抛 |
| `src/components/Avatar.tsx` | 纯展示（进 design system barrel）；首字符**始终**画在底层，图片绝对定位盖上去，加载失败自然露出兜底 |
| `src/features/profile/ProfileEditSheet.tsx` | 两屏共用的资料编辑抽屉 |
| `src/features/profile/clearAllData.ts` | 「清除全部数据」唯一收尾入口 |

### 提交记录

- `64fb756` feat(G45): 用户自定义头像（相册选图）+ 资料编辑抽屉去重

### 测试

37 suites / 397 tests 全绿（改动前 31 / 328，本次 +6 suites / +69 tests），`tsc --noEmit` 干净。

> 记一笔测试环境的坑：RN 0.86 里 `react-native` 导出的 `Pressable` 与树里那个同名
> 组件**不是同一个对象引用**，`findAllByType(Pressable)` 永远返回 0 个 ——
> 于是「不传 onPress 就没有 Pressable」会**假通过**。要按 `type.name` 或宿主 View 的
> `accessibilityRole` 查。

### 验收

见 `docs/REAL_DEVICE_TEST_CHECKLIST.md` §9.10（10 条）。两条不能省：

- **第 4 条（连换两张图）** —— 唯一能证明 expo-image 缓存不骗人的判据
- **第 7 条（`run-as ... ls files/avatars/`）** —— 唯一能证明文件真被删了，
  而不只是 UI 变回首字符的手段

---

## Phase 2 路线（P2+，待评估优先级）

> 下列项目 PRD 列入但未排期，是否纳入 Phase 2 视用户偏好决定。

| 编号 | 功能 | 备注 |
|------|------|------|
| US-11 | 杠铃片计算器 | 独立 utility；输入目标重量 + 杠铃片配置 → 输出每侧装载方案 |
| US-12 | 身体测量追踪 | ✅ 2026-09-09 真机 13 条验收全过；MVP 范围定版 2 项（体重 + 体脂），可编辑可删除，同日允许多条；4 commit:4bab5e8 数据层 → b344e2b UI → 10e28ef 趋势 → 62e5446 测试 → 204a297 useFocusEffect 修复 |
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
