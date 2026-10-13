/**
 * 品牌标记 / 启动屏的"同源守卫"。
 *
 * 同一个标记存在于四个地方，任何两处对不上都会产生**只有真机冷启动才看得见**的
 * 瑕疵，所以必须机械地对账，不能靠人记得：
 *
 *   1. `assets/brand/mark-barbell.svg`  —— 几何唯一真源
 *   2. `scripts/brand/generate-brand-assets.py` —— 解析 ①，生成桌面图标/启动图 PNG
 *   3. `src/components/brand/markGeometry.ts` —— ①②的 JS 镜像，启动屏用它画标记
 *   4. `app.json` 的 `expo-splash-screen` —— 决定原生启动页的底色与标记宽度
 *
 * 本文件盯住 ①↔③ 和 ④↔③ 两组：
 *   - ①↔③ 漂移 → 原生启动页和 JS 启动屏的标记形状不同，交接时"变脸"
 *   - ④↔③ 漂移 → 原生启动页和 JS 启动屏的底色/标记大小不同，交接时跳一下
 *
 * 另外钉住一条推导出来的硬约束：Android 12+ 会把启动图标放进**直径 192dp 的
 * 圆形安全区**里（本项目的 splash 没配 icon background，所以适用 288/192 那一档）。
 * 标记是 1.42:1 的扁长形，所以约束落在**对角线**上。这条如果破了，真机上
 * 配重片会被圆形遮罩切掉 —— 而且只在 Android 12+ 出现，很难联想到是这里。
 *
 * 故意**不 import BootSplash.tsx**：那会把 react-native / reanimated 拖进
 * node 环境的测试里。常量从源码文本解析，和本项目其它守卫测试的做法一致。
 */
import fs from 'node:fs';
import path from 'node:path';

import {
  MARK_BBOX,
  MARK_CENTER_X,
  MARK_CENTER_Y,
  MARK_SHAPES,
  MARK_UNIT_HEIGHT,
  MARK_UNIT_WIDTH,
  MARK_VIEWBOX_SIZE,
  markScale,
} from '../markGeometry';

const HERE = __dirname;
const SVG_SRC = fs.readFileSync(
  path.resolve(HERE, '../../../../assets/brand/mark-barbell.svg'),
  'utf8',
);
const BOOT_SPLASH_SRC = fs.readFileSync(path.resolve(HERE, '../BootSplash.tsx'), 'utf8');
const APP_JSON = JSON.parse(
  fs.readFileSync(path.resolve(HERE, '../../../../app.json'), 'utf8'),
) as { expo: { plugins: unknown[] } };

type SvgRect = { x: number; y: number; w: number; h: number; r: number };

/** 从 SVG 抠出 `<rect>` 列表（顺序即文档顺序）。注释先删掉，注释里也有 `<rect` 字样。 */
function parseSvgRects(src: string): SvgRect[] {
  const noComments = src.replace(/<!--[\s\S]*?-->/g, '');
  const rects: SvgRect[] = [];
  for (const m of noComments.matchAll(/<rect\b([^>]*?)\/>/g)) {
    const attrs: Record<string, string> = {};
    for (const a of m[1].matchAll(/([\w-]+)="([^"]*)"/g)) attrs[a[1]] = a[2];
    rects.push({
      x: Number(attrs.x),
      y: Number(attrs.y),
      w: Number(attrs.width),
      h: Number(attrs.height),
      r: Number(attrs.rx ?? 0),
    });
  }
  return rects;
}

/** 从 BootSplash.tsx 源码里读一个 `export const NAME = '<string>'`。 */
function readStringConst(src: string, name: string): string {
  const m = new RegExp(`export const ${name}\\s*=\\s*'([^']*)'`).exec(src);
  if (!m) throw new Error(`BootSplash.tsx 里找不到 ${name}`);
  return m[1];
}

/** 从 BootSplash.tsx 源码里读一个 `export const NAME = <number>`。 */
function readNumberConst(src: string, name: string): number {
  const m = new RegExp(`export const ${name}\\s*=\\s*(\\d+(?:\\.\\d+)?)`).exec(src);
  if (!m) throw new Error(`BootSplash.tsx 里找不到 ${name}`);
  return Number(m[1]);
}

/** 取 app.json 的 expo-splash-screen 插件配置（插件数组里那一对 [name, config]）。 */
function readSplashPluginConfig(): Record<string, unknown> {
  const entry = APP_JSON.expo.plugins.find(
    (p) => Array.isArray(p) && p[0] === 'expo-splash-screen',
  );
  if (!entry) throw new Error('app.json 里没有配置 expo-splash-screen');
  return (entry as [string, Record<string, unknown>])[1];
}

const SVG_RECTS = parseSvgRects(SVG_SRC);
const SVG_BBOX = {
  x0: Math.min(...SVG_RECTS.map((r) => r.x)),
  y0: Math.min(...SVG_RECTS.map((r) => r.y)),
  x1: Math.max(...SVG_RECTS.map((r) => r.x + r.w)),
  y1: Math.max(...SVG_RECTS.map((r) => r.y + r.h)),
};

describe('标记几何：SVG ↔ markGeometry.ts', () => {
  it('rect 数量一致', () => {
    expect(SVG_RECTS).toHaveLength(MARK_SHAPES.length);
  });

  it('每个 rect 的 x/y/宽/高/圆角逐一对得上（含顺序）', () => {
    const fromTs = MARK_SHAPES.map((s) => ({ x: s.x, y: s.y, w: s.w, h: s.h, r: s.r }));
    expect(fromTs).toEqual(SVG_RECTS);
  });

  it('bbox 与 SVG 实际外接矩形一致', () => {
    expect(MARK_BBOX).toEqual(SVG_BBOX);
    expect(MARK_UNIT_WIDTH).toBe(SVG_BBOX.x1 - SVG_BBOX.x0);
    expect(MARK_UNIT_HEIGHT).toBe(SVG_BBOX.y1 - SVG_BBOX.y0);
  });

  it('标记在画布里居中（原生启动页是居中画的，JS 侧必须同锚点）', () => {
    // 不居中会让原生→JS 交接时标记平移一段距离，比尺寸不符更容易被看出来。
    expect(MARK_CENTER_X).toBe(MARK_VIEWBOX_SIZE / 2);
    expect(MARK_CENTER_Y).toBe(MARK_VIEWBOX_SIZE / 2);
  });

  it('恰好两块外侧配重片参与"装片"动画', () => {
    expect(MARK_SHAPES.filter((s) => s.outer)).toHaveLength(2);
    expect(MARK_SHAPES.filter((s) => s.outer).map((s) => s.key)).toEqual([
      'leftOuter',
      'rightOuter',
    ]);
  });

  it('markScale 把标记宽度线性映射成 dp', () => {
    expect(markScale(MARK_UNIT_WIDTH)).toBe(1);
    expect(markScale(MARK_UNIT_WIDTH * 2)).toBe(2);
  });
});

describe('启动屏契约：app.json ↔ BootSplash.tsx', () => {
  const cfg = readSplashPluginConfig();

  it('底色一致 —— 否则原生启动页和 JS 启动屏会换色', () => {
    const fromTs = readStringConst(BOOT_SPLASH_SRC, 'SPLASH_FIELD');
    expect(String(cfg.backgroundColor).toUpperCase()).toBe(fromTs.toUpperCase());
  });

  it('标记宽度一致 —— 否则交接瞬间标记会跳大小', () => {
    const fromTs = readNumberConst(BOOT_SPLASH_SRC, 'SPLASH_MARK_WIDTH');
    expect(cfg.imageWidth).toBe(fromTs);
  });

  it('前景色是白的（与生成的启动图 PNG 一致）', () => {
    expect(readStringConst(BOOT_SPLASH_SRC, 'SPLASH_ON_FIELD').toUpperCase()).toBe('#FFFFFF');
  });

  it('resizeMode 是 contain（脚本按 contain 预估显示尺寸）', () => {
    expect(cfg.resizeMode).toBe('contain');
  });
});

describe('Android 12+ 圆形安全区：标记对角线必须塞得进 192dp', () => {
  it('imageWidth 对应的标记对角线 <= 192dp', () => {
    const markWidth = readNumberConst(BOOT_SPLASH_SRC, 'SPLASH_MARK_WIDTH');
    // 标记是扁长的，遮罩是圆的 —— 卡住的是对角线，不是宽度。
    const diagonalUnits = Math.hypot(MARK_UNIT_WIDTH, MARK_UNIT_HEIGHT);
    const diagonalDp = (diagonalUnits / MARK_UNIT_WIDTH) * markWidth;
    expect(diagonalDp).toBeLessThanOrEqual(192);
  });

  it('留有一点余量，不是贴着上限', () => {
    // 贴着上限意味着换一张更"方"的标记就会立刻越界；留 5dp 余量当作缓冲。
    const markWidth = readNumberConst(BOOT_SPLASH_SRC, 'SPLASH_MARK_WIDTH');
    const diagonalUnits = Math.hypot(MARK_UNIT_WIDTH, MARK_UNIT_HEIGHT);
    const diagonalDp = (diagonalUnits / MARK_UNIT_WIDTH) * markWidth;
    expect(192 - diagonalDp).toBeGreaterThanOrEqual(5);
  });
});

describe('Android 自适应图标的 66/108 安全圆', () => {
  it('生成配置的前景和单色标记都在安全圆内', () => {
    const generator = fs.readFileSync(
      path.resolve(HERE, '../../../../scripts/brand/generate-brand-assets.py'), 'utf8',
    );
    const match = /ADAPTIVE_SAFE_FRACTION\s*=\s*([\d.]+)/.exec(generator);
    expect(match).not.toBeNull();
    const fraction = Number(match![1]);
    const diagonal = fraction * Math.hypot(MARK_UNIT_WIDTH, MARK_UNIT_HEIGHT) / MARK_UNIT_WIDTH;
    expect(diagonal).toBeLessThan(66 / 108);
  });
});
