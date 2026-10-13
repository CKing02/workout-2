#!/usr/bin/env python3
"""
从 assets/brand/mark-barbell.svg 生成全套品牌 PNG 资产。

为什么要写脚本而不是手工导图：
  同一个标记要生成 6 个 PNG（桌面图标 + 自适应图标三层 + 启动图 + favicon），
  尺寸、安全区、底色各不相同。手工导出意味着改一次标记要重做 6 遍，
  而且没人能证明这些文件真的同源 —— 迟早对不上。

几何**从 SVG 解析**，不在这里重抄一遍：
  SVG 是唯一真源。这里再抄一份 rect 坐标，就等于又多了一个会漂移的
  手写清单（本项目 13.1 那个 bug 就是这么来的）。

依赖：Pillow（本项目开发机有 PIL 10.4；没装的话 `pip install pillow`）。
4 倍超采样 + LANCZOS 降采样得到抗锯齿边缘 —— PIL 不抗锯齿，
直接按目标尺寸画的话胶囊端点会有明显台阶。

用法：
  python scripts/brand/generate-brand-assets.py
  python scripts/brand/generate-brand-assets.py --check
"""

import argparse
import re
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError:
    sys.exit("需要 Pillow：pip install pillow")

ROOT = Path(__file__).resolve().parents[2]
SVG = ROOT / "assets" / "brand" / "mark-barbell.svg"

BRAND = (255, 107, 53, 255)  # #FF6B35 与 theme/colors.ts 的 lightPalette.primary 一致
WHITE = (255, 255, 255, 255)
CLEAR = (0, 0, 0, 0)

SS = 4  # 超采样倍数

# Android 自适应图标：前景层 108dp，但只有**中心 66dp 直径的圆**保证可见
# （启动器会套各种遮罩，圆形遮罩会切掉圆外的东西）。
# 安全圆直径占比是 66/108，不是 0.66。用 bbox 对角线作保守约束。
ADAPTIVE_SAFE_DIAMETER = 66 / 108
ADAPTIVE_SAFE_FRACTION = 0.49


def parse_mark(svg_path: Path):
    """从 SVG 里抠出 rect 列表 + 整体 bbox。返回 (rects, bbox)。"""
    src = svg_path.read_text(encoding="utf-8")
    src = re.sub(r"<!--.*?-->", "", src, flags=re.S)  # 注释里也有 <rect 字样
    rects = []
    for m in re.finditer(r"<rect\b([^>]*?)/>", src):
        a = dict(re.findall(r'([\w-]+)="([^"]*)"', m.group(1)))
        rects.append(
            (
                float(a["x"]),
                float(a["y"]),
                float(a["width"]),
                float(a["height"]),
                float(a.get("rx", 0)),
            )
        )
    if not rects:
        sys.exit(f"{svg_path} 里没解析到任何 <rect>")
    x0 = min(r[0] for r in rects)
    y0 = min(r[1] for r in rects)
    x1 = max(r[0] + r[2] for r in rects)
    y1 = max(r[1] + r[3] for r in rects)
    return rects, (x0, y0, x1, y1)


def render(rects, bbox, size, mark_fraction, fg, bg, supersample=SS):
    """把标记按 mark_fraction（占画布宽度比例）居中画到 size x size 画布上。"""
    w, h = size
    W, H = w * supersample, h * supersample
    x0, y0, x1, y1 = bbox
    unit = (mark_fraction * W) / (x1 - x0)  # 每 SVG 单位对应多少像素
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2  # 标记自身中心（单位）

    layer = Image.new("RGBA", (W, H), CLEAR)
    d = ImageDraw.Draw(layer)
    for rx, ry, rw, rh, rrad in rects:
        # 以画布中心为锚，把标记中心对上去 —— SVG 里的 bbox 不是严格居中的
        px = W / 2 + (rx - cx) * unit
        py = H / 2 + (ry - cy) * unit
        pw, ph = rw * unit, rh * unit
        # 半径不能超过短边一半，否则 PIL 会抛
        d.rounded_rectangle(
            [px, py, px + pw, py + ph],
            radius=min(rrad * unit, min(pw, ph) / 2),
            fill=fg,
        )

    base = Image.new("RGBA", (W, H), bg)
    out = Image.alpha_composite(base, layer).resize((w, h), Image.LANCZOS)
    return out


def save(img, rel, *, rgb=False, check=False):
    dst = ROOT / rel
    out = img.convert("RGB") if rgb else img
    if check:
        if not dst.exists():
            sys.exit(f"缺少品牌资源：{rel}；请重新生成")
        with Image.open(dst) as existing:
            if existing.mode != out.mode or existing.size != out.size or existing.tobytes() != out.tobytes():
                sys.exit(f"品牌资源与 SVG / 生成配置不一致：{rel}；请重新生成")
    else:
        dst.parent.mkdir(parents=True, exist_ok=True)
        out.save(dst)
    print(f"  {rel:44s} {img.size[0]}x{img.size[1]}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="只校验现有 PNG，不写文件")
    args = parser.parse_args()
    rects, bbox = parse_mark(SVG)
    x0, y0, x1, y1 = bbox
    bw, bh = x1 - x0, y1 - y0
    diag = (bw**2 + bh**2) ** 0.5

    print(f"标记源: {SVG.relative_to(ROOT)}")
    print(f"  {len(rects)} 个 rect, bbox {bw:.0f}x{bh:.0f} 单位, 对角线 {diag:.1f}")

    # 自检：自适应图标前景必须真的落在安全圆里，否则某些遮罩会切掉配重片。
    # 标记按 fraction 缩放后：宽 = fraction*画布, 高 = (bh/bw)*fraction*画布
    # 对角线 = fraction*画布*diag/bw，要求 <= (66/108)*画布。
    safe_max = ADAPTIVE_SAFE_DIAMETER * bw / diag
    if ADAPTIVE_SAFE_FRACTION > safe_max:
        sys.exit(
            f"ADAPTIVE_SAFE_FRACTION={ADAPTIVE_SAFE_FRACTION} "
            f"超过安全上限 {safe_max:.3f}，外围配重片可能被切"
        )

    print("校验:" if args.check else "生成:")
    # ① 桌面图标（旧版方形，全出血）—— 橙底白标
    save(render(rects, bbox, (1024, 1024), 0.625, WHITE, BRAND), "assets/icon.png", rgb=True, check=args.check)
    # ② 自适应图标三层
    save(
        render(rects, bbox, (512, 512), ADAPTIVE_SAFE_FRACTION, WHITE, CLEAR),
        "assets/android-icon-foreground.png",
        check=args.check,
    )
    save(
        Image.new("RGBA", (512, 512), BRAND),
        "assets/android-icon-background.png",
        check=args.check,
    )
    save(
        render(rects, bbox, (432, 432), ADAPTIVE_SAFE_FRACTION, WHITE, CLEAR),
        "assets/android-icon-monochrome.png",
        check=args.check,
    )
    # ③ 启动图 —— 白标记**正好铺满**画布宽度（透明底）。
    #    内缩必须是 0：显示宽度由 app.json 的 imageWidth 决定，而 JS 侧
    #    首帧要画一个和原生启动页**等宽**的标记，否则切换瞬间标记会跳大小。
    #    让标记 = 画布宽度，imageWidth 就直接等于标记实宽，JS 不用再乘系数
    #    （少一个跨语言魔数就少一处会漂移的地方）。有测试守着这两个常量相等。
    save(
        render(rects, bbox, (1024, 1024), 1.0, WHITE, CLEAR),
        "assets/splash-icon.png",
        check=args.check,
    )
    # ④ web favicon
    save(render(rects, bbox, (48, 48), 0.62, WHITE, BRAND), "assets/favicon.png", rgb=True, check=args.check)

    print("完成。改了 SVG 记得重跑本脚本。")


if __name__ == "__main__":
    main()
