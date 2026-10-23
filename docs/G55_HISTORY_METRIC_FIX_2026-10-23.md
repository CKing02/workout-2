# G55 训练历史指标类型修复与数据规范化 — 2026-10-23

> 状态：✅ 代码完成 / ✅ 自动化验证通过 / ☐ 待新 APK 覆盖安装后 OPPO 真机复验

## 1. 用户反馈与真机证据

2026-10-23 在 OPPO 真机测试计划「三」时，平板支撑在计划与训练页均为时间类型，
但从首页进入训练历史详情后显示为 `0.0 kg × 0`。

抓取到的当次训练数据（10:37）显示：

| 动作 | 组 | 类型 | weight | reps | durationSeconds | 历史旧显示 |
| --- | ---: | --- | ---: | ---: | ---: | --- |
| 平板支撑 | 1（热身） | time | 0 | 0 | 25 | `0.0 kg × 0` |
| 平板支撑 | 2 | time | 0 | 0 | 30 | `0.0 kg × 0` |
| 平板支撑 | 3 | time | 0 | 0 | 5400 | `0.0 kg × 0` |
| 360°摆动 | 1 | time | 0 / null | 0 / null | null | 无有效实际时长 |

计划目标值为平板支撑 `60 / 45 / 1800` 秒；训练记录中的 `25 / 30 / 5400` 是本次实际值，
两者必须分开保存和展示。

## 2. 根因

历史详情原先没有持久化动作的指标类型，而是在渲染时根据数值列猜测：

```ts
durationSeconds != null && weight == null  // 才判断为 time
```

计划组的默认 `weight = 0`、`reps = 0` 被带进时间型训练记录，因此上述条件为假，
渲染器继续落到默认的「重量 × 次数」分支，最终显示 `0.0 kg × 0`。

这是数据语义问题，不应只在 UI 上追加 `weight === 0` 特判：零重量对部分训练类型仍可能是合法值，
继续依赖列值猜类型会在导入、旧记录及后续新指标上重复出错。

## 3. 修复与优化

### 3.1 指标类型成为历史快照

- `training_sets` 新增可空列 `metric_type_snapshot`。
- 新训练组保存时写入当时动作的 `metricType`，历史展示不受动作库后续编辑影响。
- 数据库 migration v12 为旧记录按 `exercise_id` 从 `exercises.metric_type` 回填。
- 无法回填的孤立旧记录仍保留兼容推断；推断时优先识别非空 `durationSeconds`。

### 3.2 写入前按指标类型规范化

统一通过 `normalizeSetMetricValues` 清理无关字段：

| metricType | 保留字段 | 强制清空字段 |
| --- | --- | --- |
| `time` | durationSeconds | weight / reps / distanceKm |
| `km` | distanceKm | weight / reps / durationSeconds |
| `reps` | reps | weight / durationSeconds / distanceKm |
| `kg` | weight | reps / durationSeconds / distanceKm |
| `weight_reps` / `+kg` / `-kg` | weight / reps | durationSeconds / distanceKm |

计划处方时长只进入 `targetDurationSeconds`，本次实际计时从空值开始，避免把目标值误存成实际成绩。

### 3.3 完成校验

- `time` 组必须存在大于 0 的实际时长才能完成。
- `km` 组必须存在大于 0 的实际距离才能完成。
- UI 完成按钮和 store 持久化层均有校验，防止旁路调用写入无效记录。

### 3.4 历史展示统一

新增统一格式化入口，覆盖全部 7 种指标：

- `reps`：`12 次`
- `kg`：`20.0 kg`
- `weight_reps` / `+kg` / `-kg`：`20.0 kg × 12`
- `time`：`25s`、`1m 30s`、`1h 30m`
- `km`：`3.20 km`

缺失该类型必需值时显示 `—`，不再伪造 `0 kg × 0`。

### 3.5 统计口径修正

- `exerciseCount` 只统计至少完成过一组的动作，不再把计划中未实际完成的动作计入。
- 总训练量与最佳组只对负重次数型指标计算，时间/距离记录不参与重量容量。

### 3.6 备份兼容

- 备份 `schemaVersion` 从 2 升到 3，历史组包含 `metricTypeSnapshot`。
- 导入继续接受 v1 / v2 / v3。
- v1 / v2 没有快照时，导入阶段从动作表补齐；仍无法补齐时保留旧记录兼容推断。

## 4. 主要改动文件

| 范围 | 文件 |
| --- | --- |
| 指标规范化、校验、格式化 | `src/features/training/setMetrics.ts` |
| 训练组写入与统计 | `src/store/trainingStore.ts` |
| 完成按钮前置校验 | `src/screens/ActiveTrainingScreen.tsx` |
| 历史详情展示 | `src/screens/TrainingDetailScreen.tsx` |
| DB schema / migration | `src/db/schema.ts`, `src/db/migrations.ts` |
| Repository / 查询映射 | `src/db/repositories/trainingSetRepo.ts`, `exerciseHistoryRepo.ts`, `src/features/data/aggregations.ts` |
| 备份导入导出 | `src/utils/exportData.ts`, `src/utils/importData.ts` |

## 5. 自动化验证

2026-10-23 本地验证结果：

- `npm run typecheck`：通过，0 个 TypeScript 错误。
- `npx jest --runInBand --silent`：60 个测试套件、624 个测试全部通过，1 个 snapshot 通过。
- `git diff --check`：通过；仅有 Git 的 LF/CRLF 提示，无空白错误。

新增或扩展的覆盖包括：

- `weight=0 / reps=0 / duration=25` 仍按显式 `time` 显示为 `25s`。
- 无快照旧记录优先从 duration 推断为时间型。
- 全部 7 种指标的格式化。
- 时间/距离缺少实际值时拒绝完成。
- 时间型写入清除无关零值，并且不保存计划目标为实际值。
- migration v12 回填及重复列幂等。
- v3 备份快照原样导入，v2 备份从动作类型补齐。
- 动作数仅统计实际完成的动作。

## 6. 升级与真机复验边界

本次没有重新构建或推送 APK。安装包含 G55 的新包并启动后，migration v12 才会执行。

预期旧记录迁移后：

- 平板支撑三组显示 `25s / 30s / 1h 30m`。
- 无实际时长的时间组显示 `—`。
- 不清除历史数据，不修改已记录的实际 duration。

真机需分别覆盖：

1. 覆盖安装后查看 2026-10-23 10:37 的旧记录，确认迁移结果。
2. 新建时间型计划，目标值填 60 秒；实际计时 25 秒后完成，历史必须显示 25 秒。
3. 实际计时为 0 时点击完成，应提示先记录实际时长且不能完成。
4. 距离型动作未填距离时同样不能完成。
5. 导出 v3 备份 → 导入 → 历史指标类型与数值保持一致。

## 7. 待办

- [ ] 构建包含 G55 的新 APK。
- [ ] OPPO 覆盖安装，验证 v11 → v12 迁移。
- [ ] 按 `docs/REAL_DEVICE_TEST_CHECKLIST.md` §3.1.5～3.1.9 回填结果。
- [ ] 真机全过后将 G55 状态更新为「✅ 真机通过」，并记录 APK commit、哈希与安装方式。
