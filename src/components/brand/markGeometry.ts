/**
 * 器材标记的几何 —— SVG 在 JS 侧的镜像。
 *
 * 唯一真源是 `assets/brand/mark-barbell.svg`。它同时驱动两件事：
 *   1. 生成桌面图标 / 启动图 PNG（`scripts/brand/generate-brand-assets.py` 也是
 *      解析同一个 SVG，而不是另抄一份坐标）
 *   2. 本文件 —— 启动屏 JS 侧要画一个和**原生启动页等大等位**的标记
 *
 * 为什么要"镜像"而不是各写各的：原生启动页（PNG）和 JS 启动屏之间有一次
 * 交接。两边几何对不上，交接瞬间标记会跳一下 —— 这是启动体验里最刺眼的瑕疵，
 * 而且只在真机冷启动的几十毫秒里出现，很容易漏掉。
 * 三份（SVG / PNG / JS）必须同源，所以 `__tests__/markGeometry.test.ts` 会
 * 直接解析 SVG 和本文件对账：改了一边漏改另一边，测试当场红。
 *
 * 坐标系：viewBox 0 0 100 100，y 向下。标记 bbox 不是满画布（故意留白，
 * 给 Android 自适应图标的安全区留余量），所以下面所有换算都以 **bbox** 为准，
 * 不是以 viewBox 为准。
 */

/** 与 SVG 的 `viewBox="0 0 100 100"` 对应。 */
export const MARK_VIEWBOX_SIZE = 100;

/** 标记实心区域的外接矩形（SVG 单位）。 */
export const MARK_BBOX = { x0: 13, y0: 24, x1: 87, y1: 76 } as const;

/** 标记实心区域的宽度（SVG 单位）—— 缩放基准。 */
export const MARK_UNIT_WIDTH = MARK_BBOX.x1 - MARK_BBOX.x0; // 74
/** 标记实心区域的高度（SVG 单位）。 */
export const MARK_UNIT_HEIGHT = MARK_BBOX.y1 - MARK_BBOX.y0; // 52

/**
 * 标记的宽高比（高/宽）。启动屏拿它算容器高度：
 * 给定宽度 W，标记占位高 = W * MARK_ASPECT。约 0.703。
 */
export const MARK_ASPECT = MARK_UNIT_HEIGHT / MARK_UNIT_WIDTH;

export type MarkShapeKey = 'shaft' | 'leftInner' | 'leftOuter' | 'rightInner' | 'rightOuter';

export type MarkShape = {
  key: MarkShapeKey;
  /** 左上角 x（SVG 单位） */
  x: number;
  /** 左上角 y（SVG 单位） */
  y: number;
  w: number;
  h: number;
  /** 圆角半径（SVG 单位）。等于短边一半 = 胶囊形。 */
  r: number;
  /**
   * 外侧配重片。启动动画里只有这两片会动（"装片"：先向外撑开再弹回归位），
   * 其余三块静止 —— 它们构成"原生启动页那一帧"，动它们就等于制造跳变。
   */
  outer: boolean;
};

/**
 * 五个圆角矩形。数值与 SVG 里的 `<rect>` 一一对应，顺序也保持一致
 * （测试按顺序对账，顺序变了会红，避免"改了顺序但数值巧合相同"这种假绿）。
 */
export const MARK_SHAPES: readonly MarkShape[] = [
  { key: 'shaft', x: 26, y: 46, w: 48, h: 8, r: 4, outer: false },
  { key: 'leftInner', x: 22, y: 33, w: 7, h: 34, r: 3.5, outer: false },
  { key: 'leftOuter', x: 13, y: 24, w: 7, h: 52, r: 3.5, outer: true },
  { key: 'rightInner', x: 71, y: 33, w: 7, h: 34, r: 3.5, outer: false },
  { key: 'rightOuter', x: 80, y: 24, w: 7, h: 52, r: 3.5, outer: true },
] as const;

/** 标记实心区域的水平中心（SVG 单位）—— 和 SVG 画布中心重合，用于自检。 */
export const MARK_CENTER_X = (MARK_BBOX.x0 + MARK_BBOX.x1) / 2; // 50
export const MARK_CENTER_Y = (MARK_BBOX.y0 + MARK_BBOX.y1) / 2; // 50

/**
 * 把一个 SVG 单位的长度换算成设备无关像素（dp）。
 *
 * @param markWidthDp 标记实心区域的显示宽度（dp）。启动屏必须传
 *        `SPLASH_MARK_WIDTH`，它等于 `app.json` 的 `splash.imageWidth`。
 */
export function markScale(markWidthDp: number): number {
  return markWidthDp / MARK_UNIT_WIDTH;
}
