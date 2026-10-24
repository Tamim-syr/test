# Tracé trait par trait : le dessin est vectorisé (VTracer, MIT), puis ses formes apparaissent dans l'ordre,
# comme si une main le dessinait, avec une pointe lumineuse sur la forme en cours.
import io, re, numpy as np, vtracer
from PIL import Image, ImageDraw
from svgpathtools import parse_path

def vectorize(src, W=1080, H=1920, cache=None):
    im = Image.open(src).convert("L").resize((W, H))
    bw = im.point(lambda v: 255 if v > 110 else 0).convert("RGB")
    buf = io.BytesIO(); bw.save(buf, "PNG")
    svg = vtracer.convert_raw_image_to_svg(buf.getvalue(), img_format="png", colormode="binary",
                                           filter_speckle=6, corner_threshold=60, length_threshold=4.0, path_precision=2)
    shapes = []
    for m in re.finditer(r'<path d="([^"]+)"[^>]*?(?:transform="translate\(([-\d.]+),([-\d.]+)\)")?', svg):
        d, tx, ty = m.group(1), float(m.group(2) or 0), float(m.group(3) or 0)
        try:
            subs = parse_path(d).continuous_subpaths()
        except Exception:
            continue
        for p in subs:
            try:
                L = p.length(error=1e-2)
            except Exception:
                continue
            if L < 25:
                continue
            n = max(6, min(300, int(L / 7)))
            pts = [(p.point(k / n).real + tx, p.point(k / n).imag + ty) for k in range(n + 1)]
            xs = [q[0] for q in pts]; ys = [q[1] for q in pts]
            if min(xs) < 40 or min(ys) < 40 or max(xs) > W - 40 or max(ys) > H - 40:
                continue   # bord de l'image, pas un trait du dessin
            shapes.append((pts, (min(xs), min(ys), max(xs), max(ys)), L))
    return shapes

def order(shapes, H=1920):
    """Ordre de dessin : les grandes masses d'abord, puis du haut vers le bas avec un balayage gauche-droite."""
    return sorted(shapes, key=lambda s: (-(s[2] > 1500), round((s[1][1] + s[1][3]) / 2 / 220), (s[1][0] + s[1][2]) / 2))

def draw_progress(shapes, p, W=1080, H=1920):
    """p de 0 à 1 : contours tracés au trait (0 -> 0,75), renvoie le calque des traits et la pointe du stylo."""
    m = Image.new("L", (W, H), 0); d = ImageDraw.Draw(m)
    q = min(1.0, p / 0.75)
    total = sum(s[2] for s in shapes); goal = q * total; acc = 0; tip = None
    for pts, bb, L in shapes:
        if acc + L <= goal:
            d.line(pts, fill=255, width=3); acc += L
        else:
            f = (goal - acc) / L; sub = pts[:max(2, int(len(pts) * f))]
            if f > 0:
                d.line(sub, fill=255, width=3); tip = sub[-1]
            break
    return m, tip
