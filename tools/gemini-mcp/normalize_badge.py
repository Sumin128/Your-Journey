"""Rohes Gemini-Badge (auf Magenta-Flaeche) auf die finale, einheitliche
Web-Form bringen.

    python normalize_badge.py <in.png> <out.png>

Schritte:
 1. Magenta-Hintergrund (#FF00FF) chroma-keyen + Magenta-Saum daempfen.
 2. Auf Inhalt zuschneiden, groesste Kante auf CONTENT skalieren.
 3. Den hellen runden CREMEKERN finden und die Grafik so verschieben
    UND leicht skalieren, dass der Kern EXAKT mittig sitzt und bei
    allen 16 Varianten denselben Radius hat.  -> die HTML-Levelzahl
    steht danach immer perfekt zentriert, ganz ohne per-Variante-Offset.
 4. 256x256, optimiertes PNG (< 100 KB).
"""
import os
import sys
from PIL import Image, ImageFilter

SIZE = 256
CONTENT = 244          # groesste Kante der Form vor der Kern-Normalisierung
TARGET_CORE_R = 54     # Ziel-Radius des Cremekerns in der 256er-Flaeche


def chroma_key(im, bg):
    """bg = 'magenta' (Standard) | 'green' | 'cyan'. Keyt die flache
    Hintergrundfarbe weg und daempft den farbigen Saum."""
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if bg == "green":
                key = g - max(r, b)
            elif bg == "cyan":
                key = min(g, b) - r          # Cyan: viel Gruen+Blau, wenig Rot
            else:
                key = min(r, b) - g          # Magenta: viel Rot+Blau, wenig Gruen
            if key > 45:
                px[x, y] = (r, g, b, 0)
            elif key > 8:
                fac = max(0.0, 1.0 - (key - 8) / 37.0)
                if bg == "magenta":
                    g = min(255, int(g + (key - 8) * 0.9))
                elif bg == "green":
                    g = max(0, int(g - (key - 8) * 0.9))
                else:  # cyan -> Rot anheben, Gruen/Blau daempfen
                    r = min(255, int(r + (key - 8) * 0.7))
                px[x, y] = (r, g, b, int(a * fac))
    return im


def crop_scale(im):
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    w, h = im.size
    s = CONTENT / max(w, h)
    return im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)


def find_core(im):
    """Zentroid + Radius der hellen, wenig gesaettigten Kreisflaeche
    moeglichst nahe der Bildmitte."""
    rgb = im.convert("RGB")
    w, h = im.size
    px = rgb.load()
    pa = im.getchannel("A").load()
    cx0, cy0 = w / 2, h / 2
    sx = sy = n = 0
    # nur den zentralen Bereich absuchen (der Kern liegt grob mittig)
    for y in range(int(h * 0.20), int(h * 0.80), 2):
        for x in range(int(w * 0.20), int(w * 0.80), 2):
            if pa[x, y] < 200:
                continue
            r, g, b = px[x, y]
            if min(r, g, b) > 188 and (max(r, g, b) - min(r, g, b)) < 46:
                sx += x
                sy += y
                n += 1
    if n < 30:
        return cx0, cy0, min(w, h) * 0.22
    cx, cy = sx / n, sy / n
    # Radius ~ aus der Flaeche (n zaehlt jeden 2. Pixel in beide Richtungen)
    area = n * 4
    r = (area / 3.14159) ** 0.5
    return cx, cy, r


def normalize_core(im):
    cx, cy, r = find_core(im)
    scale = TARGET_CORE_R / r
    scale = max(0.72, min(1.28, scale))          # nur moderate Korrektur
    nw, nh = max(1, round(im.width * scale)), max(1, round(im.height * scale))
    im = im.resize((nw, nh), Image.LANCZOS)
    cx, cy = cx * scale, cy * scale
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    canvas.alpha_composite(im, (round(SIZE / 2 - cx), round(SIZE / 2 - cy)))
    return canvas


def main():
    src, dst = sys.argv[1], sys.argv[2]
    bg = sys.argv[3] if len(sys.argv) > 3 else "magenta"
    im = Image.open(src)
    im = chroma_key(im, bg)
    im = crop_scale(im)
    im = normalize_core(im)

    # leichtes Kanten-Clean-up + Alpha auf wenige Stufen (kleinere PNG)
    a = im.getchannel("A").filter(ImageFilter.GaussianBlur(0.6))
    a = a.point(lambda v: 0 if v < 12 else (255 if v > 243 else int(round(v / 16) * 16)))
    im.putalpha(a)

    # PNG deutlich unter 100 KB halten: RGB-Palette + separater Alpha-
    # Kanal, notfalls Farbanzahl weiter senken (Ziel <= 90 KB).
    for colors in (120, 100, 80, 64, 48):
        q = im.convert("RGB").quantize(colors=colors, method=Image.MEDIANCUT,
                                       dither=Image.NONE).convert("RGBA")
        q.putalpha(a)
        q.save(dst, optimize=True)
        if os.path.getsize(dst) <= 90 * 1024:
            break
    print(f"{dst}  {q.size}  {colors}c  {os.path.getsize(dst) / 1024:.0f} KB")


main()
