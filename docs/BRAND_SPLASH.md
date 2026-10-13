# 品牌标记与启动屏

> 2026-10-13 更新。当前方案沿用 G48 WIP 的「品牌橙 `#FF6B35` + 白色杠铃」，
> 本文记录资源真源、Expo 57 原生到 JS 的交接方式，以及仍需 release 包真机验收的边界。

## 1. 标记：一个 SVG，六个 PNG 与一个 RN 实现

标记是「横杠 + 两端配重片」（viewBox `0 0 100 100`，实心区域 74×52 单位，居中）。

```text
assets/brand/mark-barbell.svg            ← 几何唯一真源（人手改这里）
        │
        ├─ scripts/brand/generate-brand-assets.py
        │        ├─ assets/icon.png
        │        ├─ assets/android-icon-foreground.png
        │        ├─ assets/android-icon-background.png
        │        ├─ assets/android-icon-monochrome.png
        │        ├─ assets/splash-icon.png
        │        └─ assets/favicon.png
        │
        └─ src/components/brand/markGeometry.ts    ← JS 几何镜像，由测试与 SVG 对账
                 └─ src/components/brand/BarbellMark.tsx
```

改了 SVG 后生成并校验：

```bash
npm run brand:generate
npm run brand:check
```

`brand:check` 会重新计算六张图片，并逐项检查尺寸、颜色模式和像素；发现缺失或漂移时
直接失败，不写文件。生成脚本解析 SVG，而不是另抄一份坐标。

### Android 自适应图标安全区

108dp 前景画布只有中心 **66dp 直径的圆**保证在各种启动器遮罩下可见，比例应为
`66 / 108 ≈ 0.611`，不能写成 `0.66`。标记是扁长形，保守地按外接矩形对角线约束：

```text
fraction × sqrt(74² + 52²) / 74 ≤ 66 / 108
```

宽度比例上限约为 50%，当前前景和 monochrome 取 **49%**。生成脚本会在配置越过
安全圆时直接失败。`android-icon-background.png` 是全画布、不透明的品牌橙背景层；
前景和 monochrome 才是透明底白色剪影。

运行 `npm run brand:preview` 会从真实 PNG 生成
`.tmp/brand/icons-preview.png`，用于快速检查旧式、圆形、圆角与浅/深色主题图标。
它是资源 QA 联系表，不是设备截图，也不能替代启动器真机验收。

## 2. 启动屏：原生页到 JS 层的显式交接

冷启动的目标顺序：

```text
原生启动页（橙底白标） → BootSplash 首帧（同底同标） → 字标/真实进度 → App
```

Expo 57 的交接代码在 `src/components/brand/nativeSplash.ts`：

- 模块加载时立即调用 `preventAutoHideAsync()`，保留原生启动页；
- 原生淡出设为 0，避免它与 JS 层的离场动画叠加；
- `BootSplash` 完成首次布局后调用 `hide()`，随后才启动 JS 入场；
- 如果 SQLiteProvider 在 JS 启动层出现前失败，现有 ErrorBoundary fallback 的首次布局
  也会隐藏原生页，避免永久卡在启动画面。

### `BootSplash` 的约束

1. 首帧只画居中的白色标记，底色固定为 `#FF6B35`；不画字标和进度条。
2. 原生与 JS 侧使用相同的 150dp 标记宽度、相同几何和居中锚点。
3. 标记单独居中；字标与进度条放在其下方的绝对定位层，不能把三者整体居中。
4. 加载比入场更快时取消未出现的动画，不闪出字标或进度条。
5. 进度值限制在 0..1，屏幕显示和无障碍数值一致；进度代表五个真实加载步骤。
6. 系统要求减少动态效果时，不做配重片或字标位移，离场不等待动画。
7. 启动层退出后不拦截触摸，并从无障碍树隐藏；卸载后忽略迟到的动画回调。

启动屏使用固定品牌色而不是主题 token：原生页没有配置深色变体，JS 侧若在深色模式
改成 `#FF7A4D`，交接时会发生底色跳变。

## 3. 自动验证

```bash
npm run brand:check
npm test -- --runInBand \
  src/components/brand/__tests__/markGeometry.test.ts \
  src/components/brand/__tests__/BootSplash.test.tsx \
  src/main/__tests__/brandBootstrap.test.tsx
npm run typecheck
```

- `markGeometry.test.ts`：SVG、TS 几何、app.json 配置和 49% / `66/108` 安全圆契约。
- `BootSplash.test.tsx`：首帧、布局交接、快速启动、回调取消、减少动态和越界进度。
- `brandBootstrap.test.tsx`：五步加载门禁、SQLite 失败 fallback、设置加载失败离场。

这些测试证明配置和代码契约，没有证明不同厂商设备上的逐像素交接或完全无白闪。

## 4. Release 包真机验收

Expo 官方说明开发构建不会完整复现独立 release 包的启动屏行为；必须用 release 包验收。
本轮尚无已连接设备，也未把 debug dev-client 构建当成 release 证据。

需要在 Android 12+ 与至少一台兼容路径设备上检查：

1. 冷启动从第一帧就是橙底白标，没有白屏或默认 Expo 图标。
2. 原生页切到 JS 层时标记不发生肉眼可见的位移、缩放或底色变化。
3. 慢启动时依次看到装片、字标、真实进度；快速启动时只见标记后离场，不闪字。
4. 开启系统「减少动态效果」后，配重片和字标没有位移动画。
5. 桌面旧式、圆形、圆角及系统主题化图标没有裁切、白边或错误底色。
6. 模拟数据库打开失败时，原生页能退出并显示已有重试界面。

已知边界：`userInterfaceStyle` 的 prebuild 警告要求安装 `expo-system-ui`，属于项目既有
问题，本任务未扩展依赖范围。白色字标压品牌橙约 2.85:1，作为 logotype 保留；
进度槽仍需在 release 真机上确认观感与对比。
