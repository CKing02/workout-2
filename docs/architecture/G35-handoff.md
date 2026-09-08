# G35 任务交接 — 动作详情页(批量接 1,324 动作)

> 起草日:2026-09-08 · 前置:G33 pilot(2D 肌肉图,已删)、G34 pilot(详情页 demo,定版 UI 锁死)
>
> 状态:**未开始**。本文件描述已定版 UI + 数据源 + 实施清单,新会话按本文档直接开做。

---

## 1. 背景与目标

- 用户原话:"目前只接入有 gif 的开源仓库,那个正背面的不需要"
- G35 范围:把 hasaneyldrm/exercises-dataset 的 1,324 动作接进 App,让用户能查任意动作的 GIF 演示 + 中文步骤
- G34 已经把 1 个动作的 UI 跑通真机,定版 layout 见 §2

---

## 2. 定版 UI 布局(锁死,不要改)

```
┌─────────────────────────────────────┐
│ ←  动作名                         ⋯ │  ← Stack header(系统自带的返回)
├─────────────────────────────────────┤
│ [主肌群] [器械]                      │  ← 2 个 Badge
│                                     │
│      ┌────────────────────┐         │
│      │   GIF 240×240     │         │  ← 居中,自动循环
│      └────────────────────┘         │
│   © Gym visual — gymvisual.com     │  ← attribution(GIF 下方)
│                                     │
│ ─── 分步演示 ──────────────         │  ← 中文步骤列表(6 步左右)
│   ① 步骤一文字                       │
│   ② 步骤二文字                       │
│   ...                                │
└─────────────────────────────────────┘
```

### 明确不做(用户多次确认,不要再问)

- ❌ 2D 前后肌肉图(hasaneyldrm 的 muscle_group / secondary_muscles 字段语义混乱,硬映射会误导)
- ❌ 动作要领描述段(和"分步演示"内容重复)
- ❌ 次要肌群 Badge
- ❌ 底部 CTA(开始训练 / 加入计划)— 这屏纯展示,看完回动作库

### UI 已有资源

- `src/screens/ExerciseDetailDemoScreen.tsx` — 写好的 demo 屏(硬编码 1 个动作,见 §3)
- 实际是 G35 的 UI 模板,接数据时把 `PILOT_EXERCISE` 常量改成从 store 读即可

---

## 3. 数据源 — hasaneyldrm/exercises-dataset

仓库:https://github.com/hasaneyldrm/exercises-dataset

### 许可证(关键)

| 内容 | 许可证 |
|------|--------|
| 代码 / JSON / 翻译文本 | **MIT** (可商用) |
| 图片 / GIF | **© Gym visual (gymvisual.com) 版权** — 必须保留 attribution OR 自购授权 |

**当前选择**:保留 attribution,在每条记录详情页底部小字显示 `© Gym visual — https://gymvisual.com/`。

### 数据集规格

- 1,324 个动作
- 字段:`id, name(英), category, body_part, equipment, instructions{10lang}, instruction_steps{10lang}, muscle_group, secondary_muscles, target, image, gif_url, media_id, created_at, attribution`
- 语言:en / es / it / tr / ru / **zh** / hi / pl / ko / fr
- 名字 + 器械是**英文**;instructions.zh + instruction_steps.zh **已翻译**

### 关键观察

- ⚠️ `muscle_group` / `secondary_muscles` 字段语义对项目 schema 不可用(例:dumbbell bent over row 写 `muscle_group: biceps` 而非 `back`),**不要用来映射主/次肌群**
- ✅ `target` 字段 = 真实主肌(如 `upper back`),G35 用这个映射到 `category`
- ⚠️ `name` / `equipment` 是英文,G35 需要中文翻译
- ✅ `gif_url` 是相对路径,本地 bundle 即可

### 已下载的源数据

- `scripts/audit/exercises-source.json` — 16.59 MB,1,324 条全数据
- ⚠️ **不入 git**(临时数据,跑完 G35 后可删)

### 已下载的 GIF

- `assets/exercises/0293-dumbbell-bent-over-row.gif` — 102 KB,180×180,GIF89a,12 帧,3 秒循环

### GIF 节奏(已知特性)

- 10 FPS(100ms/帧),行业惯例 fitness GIF 节奏
- 总长 3 秒,头尾各 1 秒停顿,中间 1 秒动作
- 用户已接受这个节奏

### GIF 播放技术决策(已验证)

- 用 **RN 自带 Image**(不装 expo-image)
- iOS 原生支持,Android Fresco 也支持,真机验证过双端自动播放
- 不要再为 GIF 装额外依赖

---

## 4. 实施清单(G35 4 步)

### 步骤 1:翻译 30+ 常见动作(0.5 天)

- 范围:用项目现有 30 个 seed(已在 `src/db/seeds/exercises.ts`)做锚点
- 给每个 seed 写 3 个英文同义词,匹配 hasaneyldrm 里的 `name`
- 例:`杠铃卧推` → hasaneyldrm 的 `barbell bench press`
- 翻译规则:
  - `name(en) → name(zh)`:一对一映射
  - `equipment(en) → equipment(zh)`:一对一映射(如 `dumbbell → 哑铃`)
  - `target(en) → category(zh)`:en `upper back` → zh `背`;en `chest` → zh `胸`;en `shoulders` → zh `肩`...

### 步骤 2:bundle 30 张 GIF(0.5 天)

- 从 hasaneyldrm `videos/{id}.gif` 下到 `assets/exercises/{slug}.gif`
- 写脚本批量下载(用 agent 或 curl)
- 单张 ~60-160 KB,30 张约 4-5 MB
- 不引 `expo-image`,用 RN 自带 `<Image source={require()} />`

### 步骤 3:Schema 迁移(0.5 天)

`exercises` 表加 5 个字段:
```sql
description_zh TEXT       -- 来自 hasaneyldrm instructions.zh
steps_zh TEXT            -- 来自 hasaneyldrm instruction_steps.zh(JSON 数组字符串)
gif_url TEXT             -- 资产路径,如 "assets/exercises/0001-*.gif"
target_zh TEXT           -- 来自 hasaneyldrm target(英文,自己再映射到中文)
attribution TEXT         -- 固定 "© Gym visual — https://gymvisual.com/"
```

- 写 `migrations.ts` 增量,不要动老数据
- 新数据用 seed 注入,带 i18n 字段

### 步骤 4:动作库 → 详情页 入口(0.5 天)

- `src/screens/ExerciseLibraryScreen.tsx` 的 browse mode:tap 一行 → `navigate('ExerciseDetail', { exerciseId })`
- 把 `ExerciseDetailDemoScreen` 改名为 `ExerciseDetailScreen`,加 `route.params.exerciseId`,从 store 查 exercise
- 用动态 `require()` / 资产映射表,根据 `gif_url` 字段找对应 GIF

---

## 5. 现有可复用资源

| 资源 | 路径 | 状态 |
|------|------|------|
| 详情页 UI 模板 | `src/screens/ExerciseDetailDemoScreen.tsx` | ✅ 跑通,改硬编码为查 store 即可 |
| GIF 资源 | `assets/exercises/0293-dumbbell-bent-over-row.gif` | ✅ 1 张 |
| hasaneyldrm 源数据 | `scripts/audit/exercises-source.json` | ✅ 1,324 条 |
| 测试通过 | 138 单测全过,TypeScript 干净 | ✅ |
| Expo dev server | 后台 task ID `b5vd5acqq`,跑在 8081 | ✅ |

---

## 6. 风险与决策记录

| 风险 | 应对 |
|------|------|
| bundle +4-5 MB | 可接受;扩全部 1,324 动作前换 lazy 下载策略 |
| GIF 视觉质量低(180×180) | 用户已接受,当前路线不重做 |
| 翻译 30+ 动作名 | 人工手动映射,先 30 个,后续自动化(G36+) |
| 1,324 动作全量接入 | 留作 G36,先验证 30 个的链路完整 |
| Gym Visual 法律风险 | attribution 保留,不发版前再读 LICENSE 确认 |

---

## 7. ProfileScreen 入口(暂存)

- 我的 → `🧪 G34 详情 Pilot` 按钮 → 进 demo 屏
- G35 完成时,**改名为正式入口**(或保留作 dev 入口)

---

## 8. 新会话开场白建议

新会话第一条消息模板:
```
开 G35,看 docs/architecture/G35-handoff.md
定版 UI 已锁死不要再讨论
按 §4 的 4 步清单开做
第一步:翻译 30+ 动作
```
