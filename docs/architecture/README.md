# 架构图目录 (Architecture)

本目录存放「锻炼 2.0」项目的系统架构图。

## 文件清单

| 文件 | 用途 | 何时使用 |
|------|------|----------|
| `system-architecture.drawio` | 架构图源文件 (draw.io XML 格式，可编辑) | 需要调整/扩展示意图时 |
| `system-architecture.png` | 架构图 PNG 导出 (500KB, 2400x3200 等比缩放) | 文档/Slack/PPT 直接引用 |
| `_open_diagram.url` | Windows 快捷方式，双击在浏览器打开 draw.io 编辑器 | 临时查看/编辑 |
| `_gen_system.py` | 架构图生成脚本 (Python)，可重复生成 | 节点变动时 |

## 图内容

主图是一张 11 层系统架构图，覆盖：

1. **L1 应用入口** - `index.ts` (Expo registerRootComponent)
2. **L2 Provider 嵌套树** - GestureHandler / SafeArea / SQLite / Theme / ErrorBoundary / DatabaseBootstrap / ToastHost / RootNavigator
3. **L3 导航层** - RootNavigator (NativeStack) + 9 个子路由
4. **L4 屏幕层** - 12 个 Screen 组件
5. **L5 UI 基础** - components / theme / constants / utils
6. **L6 业务特性** - features/training / features/data / features/data/charts / hooks
7. **L7 状态管理** - trainingStore / planStore / exerciseStore / settingsStore (Zustand)
8. **L8 数据访问** - 6 个 Repository
9. **L9 持久化** - db/index.ts / schema.ts / migrations.ts / seeds
10. **L10 SQLite 存储** - 7 张表
11. **L11 平台/原生能力** - Expo + RN 全套 native bridge

## 标注的数据流（彩色箭头）

| 颜色 | 含义 | 端到端路径 |
|------|------|-----------|
| 红 | 训练核心闭环 | TrainingScreen → trainingStore → trainingRepo → training_sets → HomeScreen (loadHistory) |
| 蓝 | 启动序列 | index.ts → SQLiteProvider → initDatabase → schema/seeds → RootNavigator (ready) |
| 橙 | 错误流 | ErrorBoundary → errorLogRepo → DiagnosticsScreen |
| 紫 | 主题同步 | settingsStore.themeMode → ThemeProvider |
| 灰 | 普通依赖/调用 | 各 store ↔ repo ↔ db/index 等 |

## 重新生成

如果项目结构有变化，可以重跑生成脚本：

```bash
python _gen_system.py
```

脚本会读取硬编码的 `LAYERS` 列表，按层级计算坐标并写出新的 .drawio 文件。
需要 PNG 时用 msedge headless 渲染 `_open_diagram.url` 即可。

## 在 draw.io 中打开

- 桌面版：draw.io Desktop -> File -> Open -> 选 `system-architecture.drawio`
- 网页版：双击 `_open_diagram.url` (Windows 快捷方式)
- VS Code：装 Draw.io Integration 扩展，直接打开 .drawio 文件
