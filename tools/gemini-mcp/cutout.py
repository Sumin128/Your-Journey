"""Hintergrund eines generierten Sprites entfernen (Flood-Fill von den Ecken),
zuschneiden, auf Zielhöhe skalieren. Für Mirelon-Asset-Erstellung.

    python cutout.py <in.png> <out.png> [zielhoehe]
"""
import sys
from PIL import Image, ImageDraw

src, dst = sys.argv[1], sys.argv[2]
target_h = int(sys.argv[3]) if len(sys.argv) > 3 else 440
tol = 48

im = Image.open(src).convert("RGB")
w, h = im.size

# Randfarbe = Median der vier Ecken
corners = [im.getpixel(p) for p in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]]
bg = tuple(sorted(c[i] for c in corners)[len(corners) // 2] for i in range(3))

# Flood-Fill von vielen Punkten am gesamten Rand
fillim = im.copy()
SENT = (0, 255, 1)
seeds = []
for t in range(0, w, max(1, w // 24)):
    seeds += [(t, 0), (t, h - 1)]
for t in range(0, h, max(1, h // 24)):
    seeds += [(0, t), (w - 1, t)]
for s in seeds:
    if fillim.getpixel(s) != SENT:
        ImageDraw.floodfill(fillim, s, SENT, thresh=tol)

px_src = im.load()
px_fill = fillim.load()
mask = Image.new("L", (w, h), 0)  # 0 = behalten, 255 = transparent
px_mask = mask.load()


def close_to_bg(c):
    return max(abs(c[0] - bg[0]), abs(c[1] - bg[1]), abs(c[2] - bg[2])) <= 40


for y in range(h):
    for x in range(w):
        if px_fill[x, y] == SENT or close_to_bg(px_src[x, y]):
            px_mask[x, y] = 255

out = im.convert("RGBA")
alpha = mask.point(lambda v: 255 - v)
out.putalpha(alpha)

bbox = out.getbbox()
if bbox:
    out = out.crop(bbox)

ratio = target_h / out.height
out = out.resize((max(1, round(out.width * ratio)), target_h), Image.LANCZOS)

# PNG kleiner machen: RGB auf 128 Farben, Alpha voll behalten
alpha_full = out.getchannel("A")
q = out.convert("RGB").quantize(colors=128, method=Image.MEDIANCUT, dither=Image.NONE).convert("RGBA")
q.putalpha(alpha_full)

q.save(dst, optimize=True)
print(f"{dst}  {q.size}  bg~{bg}")
