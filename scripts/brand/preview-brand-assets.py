"""Generate a static icon QA sheet from the real exported PNGs (not device screenshots)."""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SIZE = 192
sheet = Image.new("RGB", (1200, 304), "#F3F4F6")
draw = ImageDraw.Draw(sheet)


def asset(name):
    with Image.open(ROOT / "assets" / name) as image:
        return image.convert("RGBA").resize((SIZE, SIZE), Image.Resampling.LANCZOS)


def masked(icon, circular):
    mask = Image.new("L", (SIZE, SIZE))
    pen = ImageDraw.Draw(mask)
    if circular:
        pen.ellipse((0, 0, SIZE - 1, SIZE - 1), fill=255)
    else:
        pen.rounded_rectangle((0, 0, SIZE - 1, SIZE - 1), radius=44, fill=255)
    icon.putalpha(mask)
    return icon


background = asset("android-icon-background.png")
foreground = asset("android-icon-foreground.png")
adaptive = Image.alpha_composite(background, foreground)
mono = asset("android-icon-monochrome.png").getchannel("A")
items = [
    ("Legacy / iOS", asset("icon.png")),
    ("Adaptive circle", masked(adaptive.copy(), True)),
    ("Adaptive rounded", masked(adaptive.copy(), False)),
]
for label, surface, ink in [("Themed light", "#DFE7E3", "#233C30"), ("Themed dark", "#233C30", "#DFE7E3")]:
    themed = Image.new("RGBA", (SIZE, SIZE), surface)
    themed.paste(Image.new("RGBA", (SIZE, SIZE), ink), (0, 0), mono)
    items.append((label, masked(themed, True)))

draw.text((24, 14), "BRAND ICON QA - rendered assets; launcher tint examples; not device screenshots", fill="#374151")
for index, (label, icon) in enumerate(items):
    x = index * 240 + 24
    sheet.paste(icon, (x, 48), icon)
    draw.text((x, 260), label, fill="#111827")
destination = ROOT / ".tmp" / "brand" / "icons-preview.png"
destination.parent.mkdir(parents=True, exist_ok=True)
sheet.save(destination)
print(destination)
