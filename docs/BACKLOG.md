# Backlog — UX / 交互打磨优化项

> 集中登记尚未排期实现的小型 UX 优化项。每条具备「可拉成 G 目标」所需的最小上下文（问题、影响、验收、涉及文件）。
> 维护原则：用户口述 → 当条登记 → 待用户确认后逐条转 G 目标并迁移到 GOALS.md。

| 字段 | 含义 |
| --- | --- |
| 状态 | 🟡 待评估 / 🟠 实施中 / ✅ 已完成 / ❌ 已驳回 |
| 优先级 | P0(必须修) / P1(应修) / P2(可修) |
| 复杂度 | S(单文件<半天) / M(2–3 文件<1 天) / L(跨模块>1 天) |

---

## BL-001 计划页「添加运动」需支持内联自定义运动 ✅

- **状态**：✅ 已完成（→ G50）
- **优先级**：P1
- **复杂度**：M
- **原始反馈**：训练计划页 → 添加运动 → 运动列表界面需要支持自定义运动（不用再跳转到动作库自定义动作）
- **落地位置**：`src/screens/ExerciseLibraryScreen.tsx`（picker mode 始终显示 ＋ + 创建后自动勾选）

### 实现摘要
不动 PlanEditor，让 ExerciseLibrary 的 picker mode 暴露已存在的「+」按钮：
1. Header `＋` 按钮可见条件由 `!selectMode` 改为 `browseMode && selectMode ? null : (...)` —— picker mode 始终可见。
2. `handleCreateCustom` 捕获 `createCustom` 返回值；picker mode 下把 `created.id` 加入 `selected` Set，关闭 sheet。
3. picker hint 文案增加「或点右上角「＋」新建自定义动作」提示。
4. 新增 `ExerciseFormSheet.test.tsx`，4 条测试覆盖 picker / browse 两条入口的 onSubmit / onCancel 契约。

### 验证
- `tsc --noEmit` 通过
- `jest ExerciseFormSheet.test` 4/4 通过
- 现有 `EmptyState.test.tsx` 11/11 通过（未受影响）
- 真机自检步骤见 GOALS.md G50

### 问题
用户从 PlanEditorScreen 点击「添加动作」后，导航到 `ExerciseLibraryScreen`（picker mode）。当前想新建自定义动作，必须先退出 picker → 进入浏览模式 → 走 `+` → 表单 → 保存 → 再回到 PlanEditor → 再次进入 picker。整个回环 5+ 步。

### 期望行为
在 PlanEditor 的「添加运动」入口（或 ExerciseLibrary 的 picker mode 内）直接提供「+ 新建自定义动作」入口，保存后自动加入当前 picker 的已选集合并保留 picker 状态。

### 验收标准
- [ ] 在「添加运动」pick 路径中可直接新建自定义动作，无需切换页面/模式
- [ ] 新建完成后立即出现在已选列表，无需手动再选一次
- [ ] 与现有浏览模式 + 号行为一致（沿用 `ExerciseFormSheet`，不重复实现）
- [ ] picker mode 下新建按钮有清晰视觉差异（如 `+ 新建` 而非 `+`，避免与「添加」混淆）

### 涉及文件
- `src/screens/PlanEditorScreen.tsx`（pick 流程：line 248–301 `handlePickExercises`）
- `src/screens/ExerciseLibraryScreen.tsx`（picker mode 入口与 `handleCreateCustom`，line 295–320）
- `src/components/.../ExerciseFormSheet.tsx`（表单复用）

### 开放问题
- 新建后是否需要支持「编辑刚创建的运动」？目前 picker 退出后才会进详情。
- 「+ 新建」按钮放 picker 顶部 toolbar 还是悬浮 FAB？

---

## BL-002 时间类运动输入需支持秒级精度 ✅

- **状态**：✅ 已完成（→ G51）
- **优先级**：P1
- **复杂度**：S–M
- **原始反馈**：时间类运动要支持秒单位
- **落地位置**：`src/screens/PlanEditorScreen.tsx::SetRowField`（行内 + Sheet 共用）

### 实现摘要
单点修复：`PlanEditorScreen.SetRowField` 中 `duration_seconds` 分支原来做 `Math.round(s/60)` 显示为分钟、`onChange` 回写 `min * 60` 秒。改掉换算：
- `value` 直接用 `setRow.durationSeconds`
- `onChange` 直接回写 `Math.max(0, Math.round(seconds))`
- `unitLabel="秒"`，`max=3600`（1 小时）
- `accessibilityLabel` 补 `(秒)` 后缀避免屏读歧义
- SetRow 头部注释同步更新（"min 输入" → "秒 输入"）

### 与现有行为对齐
- `ActiveTrainingScreen.MetricFieldInput` 早已是纯秒 (`unitLabel="秒"`, max=3600) —— 现在 PlanEditor 与训练中页输入语义一致。
- DB schema / store / repo 全部不变，无 migration 需求。
- 旧数据展示：DB 存的 `durationSeconds` 直接显示为秒值（譬如旧 30min → 1800秒），新增空组后用户重输即按真实秒数录入。
- 解析见 `formatLastSetRow` / `formatActiveSetSummary` / `formatDurationShort`，均未触碰。

### 验证
- `tsc --noEmit` 0 错误
- `jest WeightInput.test` 3/3 + `aggregations.test` 22/22 + `planRepo.test` 6/6 + `useExerciseHistory.test` 6/6（均未受影响）
- 旧版 `/60` 模式已全文 grep 0 命中
- 真机自检步骤见 GOALS.md G51

### 已知限制
- 旧数据展示不友好：30min 旧记录回读显示为 `1800 秒`。可后续加 "≥60s → X分Y秒" 格式化（独立增强，不在 BL-002 范围内）。

### 问题
`metricType = duration` 的运动在训练执行录入时，当前只接受分钟粒度（推测为整分钟 NumberInput / step=60）。现实场景：平板支撑 45s、HIIT 间歇 30s、拉伸 90s。

### 期望行为
时间类运动的 SetRow / SetSheetBody 输入支持 **秒**（含小数秒，如 12.5s 跑步机），数字 + 单位 `s` 显示，最小 1s，最大上限待定（参考现有 rest 600s 或训练现实约束）。

### 验收标准
- [ ] ActiveTrainingScreen 中 `duration` 类型的 SetRow 输入显示 `s` 单位，可输入 1–600 秒
- [ ] 输入数字不再被强制对齐到整分钟
- [ ] 已存的分钟级历史记录回读展示不破图（兼容旧数据 `value` 是分钟还是秒？需要 schema 决策）
- [ ] SetSheetBody 编辑组中的 duration 输入同样秒级
- [ ] 单位校验：< 60s 显示纯秒数，≥ 60s 可选「X 分 Y 秒」或「XX 秒」两套展示切换

### 涉及文件
- `src/screens/ActiveTrainingScreen.tsx`（SetRow 渲染逻辑）
- `src/components/.../SetSheetBody.tsx`（编辑组 sheet）
- `src/db/schema.ts`（确认 metricType=duration 时是否还有遗留分钟换算字段）
- `src/features/training/freeTraining.ts`（自由训练录入路径）

### 开放问题
- 历史数据单位兼容性：旧 DB 里 `duration` 字段是按分钟存还是按秒存？决定是否需要做 migration。
- 是否支持小数（12.5s）？键盘限制 + 验证。

---

## BL-003 动作列表需将自定义动作置顶

- **状态**：🟡 待评估
- **优先级**：P1
- **复杂度**：S
- **原始反馈**：动作库、动作列表要将自定义的动作置顶

### 问题
当前 `listExercises` 全局 `ORDER BY is_custom ASC, name COLLATE NOCASE ASC`，内置动作按字母排在前面，自定义动作被沉到列表底部。用户自建的动作往往是「我最常用」的高频项，却最难找到。

### 期望行为
**所有**展示动作的列表（动作库浏览、picker 模式、按肌群/器械筛选、搜索结果）都将自定义动作排在最前，内置动作再按原有规则（字母/肌群）排。

### 验收标准
- [ ] `ExerciseLibraryScreen` 列表自定义动作置顶
- [ ] `PlanEditorScreen` 的 ReplaceSheet（替换运动）自定义动作置顶
- [ ] picker mode 选区列表中也按同样规则（若 picker 内有自定义则置顶）
- [ ] 训练中/历史回看中的动作 chip 不受影响（已经是按训练记录排）
- [ ] 自定义动作之间保留原有的 `created_at DESC`（最新创建的最上面）
- [ ] 排序变更通过单测覆盖（修改排序 SQL 后跑现有 listExercises 相关测试）

### 涉及文件
- `src/db/repositories/exerciseRepo.ts`（4 处 ORDER BY：listExercises、by muscle_group、by equipment、search）
- `src/db/repositories/exerciseRepo.ts` 的单测
- 视情况在 store 层加派生排序（避免改 SQL 引起不必要 SQLite 迁移）

### 实施建议
两条路：
- **A. 改 SQL**：`ORDER BY is_custom DESC, ...` 一行解决，覆盖全部查询。风险最低。
- **B. 改 store 层**：保留 SQL，在 store 端 `sort(ex => Number(b.is_custom) - Number(a.is_custom))`。更可控但要改多处。

---

## BL-003 动作列表需将自定义动作置顶 ✅

- **状态**：✅ 已完成（→ G52）
- **优先级**：P1
- **复杂度**：S
- **原始反馈**：动作库、动作列表要将自定义的动作置顶
- **落地位置**：`src/db/repositories/exerciseRepo.ts`（4 处 ORDER BY）

### 实现摘要
4 处 `ORDER BY is_custom ASC, name COLLATE NOCASE ASC` → `ORDER BY is_custom DESC, name COLLATE NOCASE ASC`：
- `listExercises` (line 41)
- `queryByMuscleGroup` (line 147)
- `queryByEquipment` (line 161)
- `searchByName` (line 177)
- 注释同步更新："排在后面" → "置顶"。

### 范围控制
- 内置动作内部仍按 `name COLLATE NOCASE ASC`（中英文不敏感字母序）—— 行为不变。
- 自定义动作内部也按 `name ASC`（与内置同规则，最简单的可预测顺序）。如要按 `created_at DESC`（最近创建在前），可独立增强。
- 不引入 store 层 sort，避免双层排序埋坑。
- 不动 SQL 之外的任何代码，下游 store / 组件 / picker / browse 全自动受益。

### 验证
- `tsc --noEmit` 0 错误
- 新增 `exerciseRepo.test.ts` 5/5 通过（锁定 4 条查询的 ORDER BY）
- 现有 seedRunnerUpgrade 7/7 + seedRunnerUpgradeCdnUrls 2/2 + toExerciseRowsG35 12/12 + exportData 8/8 通过
- 真机自检步骤见 GOALS.md G52

### 已知行为变化
- 此前所有 list 路径（动作库 browse、肌群/器械筛选、搜索、picker、ReplaceSheet）一律按字母序、custom 沉底；现在改为 custom 置顶、内置按字母序。
- 训练中 / 历史回看中的动作 chip 不受影响——那里按 `training_sets` 表的真实记录排，不走 `exercises` 排序。
## BL-004 训练中底部动作组输入被键盘遮挡 ✅

- **状态**：✅ 已完成（→ G53）
- **优先级**：P0（影响录入正确性）
- **复杂度**：M
- **原始反馈**：在运动计划列表输入组数据时，当遇到最底下的动作需要输入时，被输入法遮挡住输入框，导致我不知道自己输入了什么
- **落地位置**：`src/components/NumberInput.tsx` + `src/screens/ActiveTrainingScreen.tsx`（含 SetRow / MetricFieldInput）

### 实现摘要
基于现成的 `setRowRefs` + `scrollViewRef` + `measureLayout`（rest timer auto-scroll 已在用）扩展出 input-focus 路径：

1. **NumberInput** 加 `onFocus?: () => void` prop，`handleFocus` 内部先调 `onFocus?.()` 再做 select-all —— caller 在内置行为之前拿到通知，避免文本选择动画影响测量的位置感。
2. **MetricFieldInput** + **SetRow** 透传 `onInputFocus` 给每个 WeightInput / NumberInput；SetRowProps + MetricFieldInputProps 加新 prop。
3. **ActiveTrainingScreen** 新增 `handleSetInputFocus(clientId)` —— 从 `setRowRefs.current.get(clientId)` 拿行 view，`requestAnimationFrame` 包一层让 KeyboardAvoidingView 的 padding 先生效再 measureLayout，最后 `scrollTo({y: y - 100, animated: true})` 把行带到屏顶 100dp 之下。
4. **主组件 render**：每个 SetRow 收 `onInputFocus={() => handleSetInputFocus(s.clientId)}`；仅 `isActive` 的行传（非 auto 行无 TextInput）。
5. **测试**：新增 `NumberInput.test.tsx` 4 条契约测试（不报错 / 回调被调 / 顺序契约 / 不依赖 prefill）。

### 复用现有基础设施
- `scrollViewRef`（line 244）和 `setRowRefs`（line 246）早已存在并被 rest-timer auto-scroll 路径使用 —— 不增加新 ref。
- 同样的 `measureLayout` + `scrollTo` 模式直接复用，行为可预测。
- 不动 `KeyboardAvoidingView` 配置 / 顶部状态栏 / Bottom CTA —— 0 改动。

### 验收
- [x] NumberInput 新增 onFocus prop，handler 顺序契约锁定
- [x] SetRow / MetricFieldInput 透传 onInputFocus
- [x] ActiveTrainingScreen 新增 handleSetInputFocus
- [x] 仅 active set 收 onInputFocus（性能 + 语义）
- [x] 复用现有 scrollViewRef + setRowRefs（无新 ref）
- [x] `tsc --noEmit` 0 错误
- [x] `jest NumberInput.test` 4/4 通过
- [x] 现有 EmptyState / ExerciseFormSheet / WeightInput / exerciseRepo / aggregations / useExerciseHistory / planRepo / seedRunnerUpgrade 全绿
- [ ] 真机：滚到最后一组 → 点 weight → 输入法弹起 → 输入框滚动到屏顶可见区，不再被遮

### 已知限制
- 仅对 ScrollView 内可见的 input 生效；若 input 在视口外，会被先滚到屏顶再编辑（这是 BL-004 的核心诉求）。
- iOS 与 Android 键盘弹出时机不同（iOS 有 keyboardWillShow），但 KeyboardAvoidingView 已封装差异，这里 `requestAnimationFrame` 一帧足够覆盖两端的 100~200ms 弹起动画。
- measureLayout 在 RN 新版偶尔返回 0（罕见），失败时回调静默 —— 用户输入不被打断，下次 focus 重试。
---

## 变更记录

| 日期 | 改动 | 作者 |
| --- | --- | --- |
| 2026-10-18 | 初始登记 BL-001 ~ BL-004（用户口述） | Codex |
| 2026-10-18 | BL-001 完成 → G50（ExerciseLibraryScreen picker mode ＋ + 自动勾选） | Codex |
| 2026-10-18 | BL-002 完成 → G51（SetRowField duration_seconds 改为纯秒录入） | Codex |
| 2026-10-18 | BL-003 完成 → G52（listExercises 等 4 处 ORDER BY is_custom DESC） | Codex |
| 2026-10-19 | BL-004 完成 → G53（NumberInput onFocus 透传 + SetRow scrollTo above keyboard） | Codex |
