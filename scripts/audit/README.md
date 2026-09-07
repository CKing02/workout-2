# scripts/audit/

G22 复现排查用工具脚本。**只在「再次出现 training_sets.id 重复」时跑**,平时不调用。

## 何时跑

详见 memory `project-g22-closed-as-self-healed.md`(G22 自愈关闭说明 + 重开 G22 流程)。

典型触发:
- 真机冒烟出现 React duplicate-key warning(LogBox 红屏)
- G21 idx 后缀保护下仍报错(说明根因非 React 层)

## 脚本清单

### `audit-dup-rows.js`

从 `expo-file-system` 导出或 debug 导出的 `backup.json` 中扫描 `training_sets.id` 重复行。

```bash
node scripts/audit/audit-dup-rows.js path/to/backup.json
```

输出:
- 数据概览(各表行数)
- `training_sets.id` 重复检测(精确到具体 id 出现次数)
- 同 id 的 trainings / planExercises / exercises 上下文

### `audit-id-shape.js`

链路 B 验证 — `training_sets.id` 是否曾被 `clientId`(`c_xxx` 串)污染。

```bash
node scripts/audit/audit-id-shape.js path/to/backup.json
```

输出:
- id 前缀分布(2 字符切片)
- id 长度分布

## 不放进项目 package.json

这些脚本**不通过 npm run 调用**,纯命令行一次性工具。放进 package.json scripts 会污染 npm 接口。