"""Generiertes Icon auf einheitliches Format bringen: quadratisch,
warmer Amber-Grundton drübergelegt, leichte Vignette, feste Größe.

    python icon-finish.py <in.png> <out.png> [groesse]
"""
import sys
from PIL import Image, ImageChops, ImageDraw, ImageFilter

src, dst = sys.argv[1], sys.argv[2]
size = int(sys.argv[3]) if len(sys.argv) > 3 else 256

im = Image.open(src).convert("RGB")
w, h = im.size
s = min(w, h)
im = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s)).resize((size, size), Image.LANCZOS)

# Warmer Amber-Radialverlauf als "soft light"-Ebene -> zieht weiße
# Hintergründe ins Warme, ohne das Motiv zu zerstören.
glow = Image.new("RGB", (size, size), (196, 132, 74))
gd = ImageDraw.Draw(glow)
for i in range(size // 2, 0, -1):
    t = i / (size / 2)
    c = (int(250 - 60 * t), int(226 - 90 * t), int(190 - 110 * t))
    gd.ellipse([size // 2 - i, size // 2 - i, size // 2 + i, size // 2 + i], fill=c)
glow = glow.filter(ImageFilter.GaussianBlur(size / 12))

# soft light mischen (ca. 22 %)
mixed = Image.blend(im, ImageChops.soft_light(im, glow), 0.22)

# leichte Vignette
vig = Image.new("L", (size, size), 0)
vd = ImageDraw.Draw(vig)
vd.ellipse([-size * 0.12, -size * 0.12, size * 1.12, size * 1.12], fill=255)
vig = vig.filter(ImageFilter.GaussianBlur(size / 8))
dark = Image.new("RGB", (size, size), (60, 38, 18))
mixed = Image.composite(mixed, Image.blend(mixed, dark, 0.28), vig)

mixed.save(dst, optimize=True)
print(f"{dst}  {mixed.size}")
