"""Feste Geometrie + gemalte Fuellung.

Silhouette (Schild / Herz / 4-Zack-Stern / Baum mit Krone+Stamm+Wurzeln),
Goldrand-Breite, Cremekern-Groesse und Sicherheitsrand werden hier exakt
im Code festgelegt und sind fuer alle 16 identisch. Gemini liefert nur die
gemalten Gouache-Farbfelder (images/badges/neu/mat_*.png).

    python compose_badges.py            # 16 PNGs -> images/badges/neu/<form>_<farbe>.png (RGBA)
    python compose_badges.py sheet      # zusaetzlich _kontaktuebersicht.png (auf Grau)

Aendert nichts an sidebar/Auswahl/Speicherlogik. Die PNGs folgen dem
bestehenden Vertrag: 256x256, transparent ausserhalb der Form, gold-
berandeter Cremekern exakt mittig, Levelzahl kommt als HTML-Text darueber.
"""
import math
import os
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageChops, ImageOps

HERE = os.path.dirname(__file__)
SRC = os.path.join(HERE, "../../images/badges/neu")

FINAL = 256
SS = 3
N = FINAL * SS

MARGIN = 27 * SS               # >= 10 % Sicherheitsrand je Aussenkante
BOX = N - 2 * MARGIN
DISC_R = 44 * SS
RIM_W = 6 * SS
RING_W = 4 * SS
CENTER = (N // 2, N // 2)
CREAM = (243, 234, 208)

SHAPES = ["schild", "herz", "stern", "baum"]
COLORS = ["waldgruen", "himmelblau", "beerenrosa", "sonnengold"]


# --------------------------------------------------------------- Formen

def _poly(pts):
    m = Image.new("L", (N, N), 0)
    ImageDraw.Draw(m).polygon(pts, fill=255)
    return m


def _map(nx, ny):
    return (MARGIN + nx * BOX, MARGIN + ny * BOX)


def _bez(ctrl, steps=48):
    n = len(ctrl) - 1
    out = []
    for i in range(steps + 1):
        t = i / steps
        x = sum(math.comb(n, k) * (1 - t) ** (n - k) * t ** k * ctrl[k][0] for k in range(n + 1))
        y = sum(math.comb(n, k) * (1 - t) ** (n - k) * t ** k * ctrl[k][1] for k in range(n + 1))
        out.append((x, y))
    return out


def shape_schild():
    pts = []
    pts += _bez([_map(0.02, 0.12), _map(0.5, -0.03), _map(0.98, 0.12)])
    pts.append(_map(0.98, 0.40))
    pts += _bez([_map(0.98, 0.40), _map(0.93, 0.72), _map(0.63, 0.95), _map(0.5, 1.0)])
    pts += _bez([_map(0.5, 1.0), _map(0.37, 0.95), _map(0.07, 0.72), _map(0.02, 0.40)])
    return _poly(pts)


def shape_herz():
    raw = []
    for i in range(361):
        t = math.radians(i)
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        raw.append((x, -y))
    xs = [p[0] for p in raw]
    ys = [p[1] for p in raw]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    return _poly([_map((x - x0) / (x1 - x0), (y - y0) / (y1 - y0)) for x, y in raw])


def shape_stern():
    cx, cy = CENTER
    R = BOX / 2
    r = R * 0.46
    pts = []
    for k in range(4):
        ao = math.radians(90 * k)
        ai = math.radians(90 * k + 45)
        pts.append((cx + R * math.cos(ao), cy - R * math.sin(ao)))
        pts.append((cx + r * math.cos(ai), cy - r * math.sin(ai)))
    m = _poly(pts)
    return m.filter(ImageFilter.GaussianBlur(SS * 1.8)).point(lambda v: 255 if v > 128 else 0)


def shape_baum():
    m = Image.new("L", (N, N), 0)
    d = ImageDraw.Draw(m)
    ccx = CENTER[0]
    ccy = MARGIN + 0.43 * BOX
    cr = 0.39 * BOX

    def blob(nx, ny, rr):
        x = ccx + nx * cr
        y = ccy + ny * cr
        d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=255)

    blob(0, -0.02, cr * 0.95)
    for nx, ny in [(-0.60, 0.04), (0.60, 0.04), (-0.38, -0.42), (0.38, -0.42),
                   (0.0, -0.54)]:
        blob(nx, ny, cr * 0.52)

    tw = 0.085 * BOX
    ty0 = ccy + cr * 0.62
    ty1 = MARGIN + 0.97 * BOX
    d.rounded_rectangle([ccx - tw, ty0, ccx + tw, ty1], radius=tw * 0.45, fill=255)
    for s in (-1, 1):
        d.polygon([(ccx + s * tw * 0.2, ty1 - 0.10 * BOX),
                   (ccx + s * 0.22 * BOX, ty1 + 0.015 * BOX),
                   (ccx + s * 0.09 * BOX, ty1 + 0.03 * BOX),
                   (ccx + s * tw * 0.2, ty1)], fill=255)
    return m.filter(ImageFilter.GaussianBlur(SS * 1.4)).point(lambda v: 255 if v > 128 else 0)


SHAPE_FN = {"schild": shape_schild, "herz": shape_herz,
            "stern": shape_stern, "baum": shape_baum}


# --------------------------------------------------------------- Helfer

def erode(mask, px):
    return mask.filter(ImageFilter.GaussianBlur(px * 0.85)).point(lambda v: 255 if v >= 205 else 0)


def dilate(mask, px):
    return mask.filter(ImageFilter.GaussianBlur(px * 0.85)).point(lambda v: 255 if v > 50 else 0)


def band_in(mask, w):
    return ImageChops.subtract(mask, erode(mask, w))


def band_out(mask, w):
    return ImageChops.subtract(dilate(mask, w), mask)


def fit_mat(name):
    im = Image.open(os.path.join(SRC, f"mat_{name}.png")).convert("RGB")
    return ImageOps.fit(im, (N, N), Image.LANCZOS)


def blob_layer(rgba, cx, cy, rx, ry, alpha, blur):
    lay = Image.new("RGBA", (N, N), rgba[:3] + (0,))
    am = Image.new("L", (N, N), 0)
    ImageDraw.Draw(am).ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=alpha)
    lay.putalpha(am.filter(ImageFilter.GaussianBlur(blur)))
    return lay


# --------------------------------------------------------------- Compose

def compose(shape, color, gold_mat):
    mask = SHAPE_FN[shape]()
    mask_soft = mask.filter(ImageFilter.GaussianBlur(SS * 0.55))
    clip = mask.point(lambda v: 255 if v > 8 else 0)

    body = fit_mat(color)
    if color == "sonnengold":                      # Gouache-Gold beruhigen (kein Holzmaser-Look)
        body = body.filter(ImageFilter.GaussianBlur(SS * 6))
    canvas = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    canvas.paste(body, (0, 0), mask_soft)

    # sehr sanftes Form-Licht (Wash, Pinseltextur bleibt sichtbar, kein Plastik-Glanz)
    hi = blob_layer((255, 250, 236, 0), N * 0.37, N * 0.33, BOX * 0.46, BOX * 0.46, 16, SS * 30)
    lo = blob_layer((30, 22, 14, 0), N * 0.66, N * 0.70, BOX * 0.5, BOX * 0.5, 18, SS * 30)
    for lay in (hi, lo):
        c2 = Image.new("RGBA", (N, N), (0, 0, 0, 0))
        c2.paste(lay, (0, 0), clip)
        canvas.alpha_composite(c2)

    # dezenter Innen-Kantenschatten direkt am Rand
    edge = band_in(mask, RIM_W * 1.6).filter(ImageFilter.GaussianBlur(SS * 3))
    sh = Image.new("RGBA", (N, N), (28, 20, 12, 0))
    sh.putalpha(edge.point(lambda v: int(v * 0.20)))
    canvas.alpha_composite(sh)

    # Goldrand
    gold = fit_mat("gold") if gold_mat is None else gold_mat
    rim = band_in(mask, RIM_W).filter(ImageFilter.GaussianBlur(SS * 0.5))
    canvas.paste(gold, (0, 0), rim)
    # heller Innensaum oben-links auf dem Rand
    inner_rim = band_in(erode(mask, RIM_W), max(2, RIM_W))
    hlm = Image.new("L", (N, N), 0)
    ImageDraw.Draw(hlm).ellipse([N * 0.02, N * 0.02, N * 0.72, N * 0.72], fill=150)
    hlm = ImageChops.multiply(inner_rim, hlm.filter(ImageFilter.GaussianBlur(SS * 8)))
    hl = Image.new("RGBA", (N, N), (255, 246, 214, 0))
    hl.putalpha(hlm)
    canvas.alpha_composite(hl)
    # zarte dunkle Aussenkontur fuer Schaerfe bei kleiner Groesse
    key = ImageChops.subtract(mask, erode(mask, SS * 1.6))
    kl = Image.new("RGBA", (N, N), (78, 54, 30, 0))
    kl.putalpha(key.point(lambda v: int(v * 0.55)))
    canvas.alpha_composite(kl)

    # Cremekern + Goldring
    disc_m = Image.new("L", (N, N), 0)
    ImageDraw.Draw(disc_m).ellipse(
        [CENTER[0] - DISC_R, CENTER[1] - DISC_R, CENTER[0] + DISC_R, CENTER[1] + DISC_R], fill=255)
    ring = band_out(disc_m, RING_W).filter(ImageFilter.GaussianBlur(SS * 0.5))
    canvas.paste(gold, (0, 0), ring)

    cream = Image.new("RGBA", (N, N), CREAM + (255,))
    cream.alpha_composite(blob_layer((255, 251, 238, 0), N * 0.45, N * 0.43,
                                     DISC_R * 0.85, DISC_R * 0.85, 55, SS * 9))
    cream.alpha_composite(blob_layer((196, 176, 132, 0), N * 0.56, N * 0.60,
                                     DISC_R * 0.95, DISC_R * 0.95, 34, SS * 11))
    canvas.paste(cream, (0, 0), disc_m.filter(ImageFilter.GaussianBlur(SS * 0.4)))

    alpha = ImageChops.lighter(mask_soft, dilate(disc_m, RING_W).filter(
        ImageFilter.GaussianBlur(SS * 0.4)))
    canvas.putalpha(alpha)
    return canvas.resize((FINAL, FINAL), Image.LANCZOS)


def save_png(im, path):
    a = im.getchannel("A").point(lambda v: 0 if v < 8 else (255 if v > 246 else v))
    im.putalpha(a)
    for colors in (128, 96, 72, 56):
        q = im.convert("RGB").quantize(colors=colors, method=Image.MEDIANCUT,
                                       dither=Image.NONE).convert("RGBA")
        q.putalpha(a)
        q.save(path, optimize=True)
        if os.path.getsize(path) <= 95 * 1024:
            break
    return colors, os.path.getsize(path)


def check_margin(path):
    """Abnahme: kein sichtbarer Alpha-Pixel im aeusseren Sicherheitsrand."""
    im = Image.open(path).convert("RGBA")
    a = im.getchannel("A")
    b = a.point(lambda v: 255 if v > 24 else 0).getbbox()
    lim = 25   # ~10 % Sicherheitsrand auf 256
    ok = b is not None and b[0] >= lim and b[1] >= lim and b[2] <= 256 - lim and b[3] <= 256 - lim
    return ok, b


def contact_sheet():
    from PIL import ImageFont
    BG = (150, 152, 155)
    LB = (245, 243, 238)

    def font(sz):
        for pth in ("C:/Windows/Fonts/segoeui.ttf", "C:/Windows/Fonts/arial.ttf"):
            if os.path.exists(pth):
                return ImageFont.truetype(pth, sz)
        return ImageFont.load_default()

    def grid(cell, pad, label, headers=True):
        lab = 92
        im = Image.new("RGB", (lab + 4 * (cell + pad) + pad,
                               62 + 4 * (cell + pad) + pad), LB)
        d = ImageDraw.Draw(im)
        d.text((pad, pad), label, (50, 44, 34), font=font(20))
        if headers:
            for ci, c in enumerate(COLORS):
                d.text((lab + pad + ci * (cell + pad), 40), c, (50, 44, 34), font=font(12))
        for ri, s in enumerate(SHAPES):
            y = 62 + ri * (cell + pad)
            d.text((pad, y + cell // 2), s, (50, 44, 34), font=font(12))
            for ci, c in enumerate(COLORS):
                tile = Image.new("RGB", (cell, cell), BG)
                bd = Image.open(os.path.join(SRC, f"{s}_{c}.png")).convert("RGBA").resize(
                    (cell, cell), Image.LANCZOS)
                tile.paste(bd, (0, 0), bd)
                im.paste(tile, (lab + pad + ci * (cell + pad), y))
        return im

    parts = [grid(256, 16, "256 px"), grid(64, 26, "64 px", headers=False),
             grid(26, 40, "26 px", headers=False)]
    W = max(p.width for p in parts)
    sheet = Image.new("RGB", (W, sum(p.height for p in parts) + 20), LB)
    y = 0
    for p in parts:
        sheet.paste(p, (0, y))
        y += p.height + 10
    out = os.path.join(SRC, "_kontaktuebersicht.png")
    sheet.save(out)
    print("->", out, sheet.size)


def main():
    gold_mat = fit_mat("gold")
    fails = []
    for s in SHAPES:
        for c in COLORS:
            p = os.path.join(SRC, f"{s}_{c}.png")
            colors, size = save_png(compose(s, c, gold_mat), p)
            ok, bb = check_margin(p)
            flag = "" if ok else "  <-- RAND!"
            if not ok:
                fails.append((f"{s}_{c}", bb))
            print(f"{s}_{c:12s} {colors}c  {size/1024:5.0f} KB  bbox {bb}{flag}")
    print("Abnahme:", "OK - kein Emblem beruehrt den Rand" if not fails else f"FEHLER {fails}")
    if len(sys.argv) > 1 and sys.argv[1] == "sheet":
        contact_sheet()


main()
