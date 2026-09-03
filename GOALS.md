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
