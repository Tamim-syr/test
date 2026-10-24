# Rendu « dessin blanc sur noir » : illustrations qui « bouillonnent », typo cinétique grattée,
# sous-titres manuscrits. Usage : python3 render.py out_silent.mp4 [t_start t_end]
import sys, math, random, subprocess
import numpy as np
import cv2, pickle
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H, FPS = 1080, 1920, 30
DUR = 48.2
F_BIG = "fonts/Anton.ttf"
F_HAND = "fonts/Gochi.ttf"

# ---------- scènes : (début, fin, image ou None, ancre du texte 'top'/'bottom') ----------
SCENES = [
    (0.00, 1.90, "img/s01.png", "bottom"),
    (1.90, 5.25, "HAFEZ", "top"),
    (5.25, 6.90, None, "mid"),
    (6.90, 12.10, "img/s03.png", "top"),
    (12.10, 17.70, "img/s04.png", "top"),
    (17.70, 22.20, "img/s05.png", "top"),
    (22.20, 26.80, "img/s06.png", "bottom"),
    (26.80, 29.80, "img/s08.png", "top"),
    (29.80, 34.05, "img/s07.png", "top"),
    (34.05, 38.85, "CHART", "top"),
    (38.85, 42.25, "img/s09.png", "top"),
    (42.25, 46.50, "img/s10.png", "top"),
    (46.50, DUR, "END", "mid"),
]

# ---------- typo cinétique : blocs (début, fin, [(t, texte, taille, strike_t)]) ----------
# chaque ligne apparaît à son mot ; strike_t = moment où un trait la barre
K = [
    (0.00, 1.90, [(0.00, "EN CE MÊME JOUR", 110, None), (1.10, "IL Y A", 110, None), (1.22, "26 ANS", 330, None)]),
    (1.94, 5.25, [(1.94, "HAFEZ AL-JAHESH", 110, 2.50), (2.16, "الجحش", 90, 2.50), (2.64, "HAFEZ AL-ASSAD", 110, None), (3.28, "EST", 140, None), (3.54, "TOMBÉ", 300, None)]),
    (5.30, 6.90, [(5.30, "ENFIN...", 150, None), (5.68, "JE VOULAIS DIRE", 110, None), (6.18, "QU'IL EST", 150, None), (6.50, "MORT.", 360, None)]),
    (7.02, 9.90, [(7.02, "2000", 380, None), (7.64, "IL A QUITTÉ", 120, None), (7.84, "CE BAS MONDE", 120, None)]),
    (9.94, 12.10, [(9.94, "AUX CÔTÉS", 120, None), (10.40, "D'ABOU LAHAB", 140, None), (11.10, "& DE PHARAON", 140, None), (11.30, "أبو لهب وفرعون", 100, None)]),
    (12.22, 15.50, [(12.22, "24 ANS", 300, None), (12.72, "PLUS TARD", 140, None), (13.82, "SA TOMBE BRÛLE", 120, None)]),
    (15.56, 17.70, [(15.56, "UNE SCÈNE", 140, None), (16.00, "HISTORIQUE", 190, None)]),
    (17.80, 22.20, [(17.80, "LORS DE LA", 110, None), (18.36, "LIBÉRATION", 200, None)]),
    (22.28, 26.80, [(22.58, "2024", 330, None), (23.56, "BACHAR", 150, None), (25.74, "A FUI", 200, None)]),
    (26.88, 29.80, [(26.88, "PLUS RIEN NE VA", 110, None), (28.34, "ABANDONNÉ", 190, None), (28.92, "PAR SON PROPRE FILS", 100, None)]),
    (29.82, 34.05, [(29.82, "LE DIRIGEANT", 120, None), (32.14, "INTOUCHABLE", 180, 33.20), (33.52, "EXILÉ", 300, None)]),
    (34.14, 38.85, [(34.14, "PÈRE & FILS", 150, None), (35.26, "EN COMPÉTITION", 120, None)]),
    (38.94, 42.25, [(38.94, "IL NE RESTE RIEN", 110, None), (40.70, "NI DU PÈRE.", 160, None), (41.50, "NI DU FILS.", 160, None)]),
    (42.34, 46.50, [(42.34, "IL NE RESTE QUE", 110, None), (43.04, "LE PEUPLE", 190, None), (43.24, "SYRIEN", 270, None)]),
]

# ---------- sous-titres manuscrits ----------
CAPS = [
    (0.00, 1.90, "En ce même jour, il y a 26 ans,"),
    (1.94, 3.25, "Hafez al-Jahesh… Hafez al-Assad"),
    (3.28, 4.33, "est tombé en Syrie,"),
    (4.38, 5.25, "et très bas."),
    (5.30, 6.90, "Enfin, je voulais dire qu'il est mort."),
    (6.94, 8.28, "En 2000, il a quitté ce bas monde"),
    (8.30, 9.90, "pour être châtié dans l'au-delà,"),
    (9.94, 12.10, "aux côtés d'Abou Lahab et de Pharaon."),
    (12.22, 13.30, "24 ans plus tard,"),
    (13.32, 15.50, "sa tombe a été brûlée par son propre peuple."),
    (15.56, 16.90, "Une scène historique."),
    (16.92, 17.75, "Et ce n'est pas tout."),
    (17.80, 19.50, "Lors de la libération de la Syrie,"),
    (19.52, 20.60, "certains Syriens sont même allés"),
    (20.62, 22.20, "jusqu'à uriner sur sa tombe."),
    (22.28, 23.25, "Et en 2024,"),
    (23.28, 25.30, "son fils Bachar al-Assad l'a laissé derrière lui"),
    (25.34, 26.85, "et a fui vers la Russie."),
    (26.88, 28.30, "Là, plus rien ne va."),
    (28.34, 29.80, "Abandonné, même par son propre fils."),
    (29.82, 32.10, "Celui qui se présentait comme un dirigeant"),
    (32.14, 34.05, "intouchable a fini dans l'exil."),
    (34.14, 35.75, "Père et fils semblaient en compétition"),
    (35.78, 37.28, "pour savoir lequel ferait le plus"),
    (37.30, 38.85, "de victimes parmi les Syriens."),
    (38.94, 40.66, "Aujourd'hui, il ne reste plus rien en Syrie,"),
    (40.70, 42.30, "ni du père, ni du fils."),
    (42.34, 43.60, "Il ne reste que le peuple syrien"),
    (43.62, 44.92, "qu'ils ont tenté de faire taire"),
    (44.94, 46.50, "pendant 54 ans."),
]

# ---------- utilitaires ----------
_fonts = {}
def font(path, size):
    k = (path, size)
    if k not in _fonts:
        _fonts[k] = ImageFont.truetype(path, size)
    return _fonts[k]

rng = np.random.default_rng(7)
def scratch_texture(w, h, seed):
    """Masque de gravure : stries noires horizontales irrégulières (rendu « carte à gratter »)."""
    r = np.random.default_rng(seed)
    m = np.ones((h, w), np.float32)
    for _ in range(int(h * 0.9)):
        y = r.integers(0, h); x = r.integers(-w // 4, w)
        ln = r.integers(w // 12, w // 2); th = r.integers(1, 3)
        m[y:y + th, max(0, x):min(w, x + ln)] *= r.uniform(0.15, 0.6)
    return Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))

_textcache = {}
def text_img(txt, size, maxw=980):
    """Ligne de titre en Anton avec texture grattée ; réduite si elle dépasse maxw."""
    k = (txt, size)
    if k in _textcache:
        return _textcache[k]
    arabic = any("\u0600" <= ch <= "\u06ff" for ch in txt)
    if arabic:
        f = ImageFont.truetype("fonts/ReemKufi.ttf", size, layout_engine=ImageFont.Layout.RAQM)
        bb = f.getbbox(txt, direction="rtl")
        tw, th = bb[2] - bb[0], bb[3] - bb[1]
        im = Image.new("L", (tw + 20, th + 20), 0)
        ImageDraw.Draw(im).text((10 - bb[0], 10 - bb[1]), txt, font=f, fill=255, direction="rtl")
        _textcache[k] = im
        return im
    f = font(F_BIG, size)
    bb = f.getbbox(txt)
    tw = bb[2] - bb[0]
    while tw > maxw:
        size = int(size * 0.94); f = font(F_BIG, size); bb = f.getbbox(txt); tw = bb[2] - bb[0]
    th = bb[3] - bb[1]
    im = Image.new("L", (tw + 20, th + 20), 0)
    ImageDraw.Draw(im).text((10 - bb[0], 10 - bb[1]), txt, font=f, fill=255)
    tex = scratch_texture(im.width, im.height, hash(txt) & 0xffff)
    a = np.asarray(im, np.float32) / 255 * (0.55 + 0.45 * np.asarray(tex, np.float32) / 255)
    # bords légèrement irréguliers
    out = Image.fromarray((a * 255).astype(np.uint8))
    _textcache[k] = out
    return out

def jag_line(d, x0, y0, x1, y1, seed, width=10, fill=255):
    r = random.Random(seed)
    n = 14
    pts = [(x0 + (x1 - x0) * i / n + r.uniform(-6, 6), y0 + (y1 - y0) * i / n + r.uniform(-9, 9)) for i in range(n + 1)]
    d.line(pts, fill=fill, width=width, joint="curve")
    pts2 = [(x + r.uniform(-4, 4), y + r.uniform(-4, 4)) for x, y in pts]
    d.line(pts2, fill=fill, width=max(2, width // 3))

def boil(t, amp=3, seed=0):
    """Tremblement « dessin animé » à 10 images/s."""
    k = int(t * 10)
    r = random.Random(k * 31 + seed)
    return r.uniform(-amp, amp), r.uniform(-amp, amp)

def ease_out(x):
    x = min(max(x, 0), 1); return 1 - (1 - x) ** 3

_imgcache = {}
def load(path):
    if path not in _imgcache:
        im = Image.open(path).convert("L").resize((W, H), Image.LANCZOS)
        # contraste « encre » : noirs vraiment noirs
        a = np.asarray(im, np.float32)
        a = np.clip((a - 30) * 1.25, 0, 255)
        _imgcache[path] = Image.fromarray(a.astype(np.uint8))
    return _imgcache[path]

# ---------- outils open source (masques SAM, profondeur Depth Anything, tracé VTracer) ----------
_c = {}
def _grid():
    if "x" not in _c:
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32); _c["x"], _c["y"] = xx, yy
    return _c["x"], _c["y"]

def mask(name, grow=9, blur=6):
    k = ("m", name, grow, blur)
    if k not in _c:
        m = np.asarray(Image.open(f"masks/{name}.png").convert("L").resize((W, H)), np.float32) / 255
        if grow: m = cv2.dilate(m, np.ones((grow, grow), np.uint8))
        _c[k] = cv2.GaussianBlur(m, (0, 0), blur) if blur else m
    return _c[k]

def depth(src):
    k = ("d", src)
    if k not in _c:
        d = np.asarray(Image.open(src.replace(".png", "_depth.png")).convert("L").resize((W, H)), np.float32) / 255
        _c[k] = cv2.GaussianBlur(d, (0, 0), 8)
    return _c[k]

def depth_view(src, a, u, bx, by):
    """Parallaxe 3D : la caméra avance doucement, le premier plan grossit et glisse plus que le fond."""
    xx, yy = _grid(); d = depth(src)
    e = u * u * (3 - 2 * u)
    s = 1.0 + e * (0.02 + 0.10 * d)
    px = (e - 0.5) * 50 * (d - 0.35) + bx
    cx, cy = W / 2, H * 0.55
    xs = cx + (xx - cx) / s - px; ys = cy + (yy - cy) / s - by
    return cv2.remap(a, xs, ys, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)

def inpainted(src, name):
    """Élément retiré du dessin (l'avion part, les pigeons s'envolent) : le trou est rebouché."""
    k = ("inp", src, name)
    if k not in _c:
        a = np.asarray(load(src), np.uint8)
        m = (cv2.dilate((mask(name, 0, 0) > 0.5).astype(np.uint8), np.ones((21, 21), np.uint8)) * 255)
        _c[k] = cv2.inpaint(a, m, 9, cv2.INPAINT_TELEA).astype(np.float32)
    return _c[k]

def live_elements(src, a, t):
    """Éléments vivants trouvés automatiquement : drapeaux qui flottent, feu qui ondule, pigeons, neige."""
    xx, yy = _grid()
    dx = None
    if src == "img/s10.png":
        m = mask("s10_flag", 15, 10)
        dx = m * 9 * np.sin(t * 9 + xx / 22); dy = m * 7 * np.cos(t * 7 + xx / 30)
    elif src == "img/s03.png":
        m = mask("s03_fire", 9, 12)
        dx = m * (6 * np.sin(yy / 19 + t * 12) + 2 * np.sin(yy / 7 - t * 19)); dy = -m * np.abs(5 * np.sin(xx / 25 + t * 8))
    elif src == "img/s04.png":
        zone = np.clip((yy - 380) / 100, 0, 1) * np.clip((860 - yy) / 100, 0, 1)
        dx = zone * (5 * np.sin(yy / 21 + t * 11) + 2 * np.sin(yy / 9 - t * 17)); dy = -zone * np.abs(4 * np.sin(xx / 30 + t * 7))
    elif src == "img/s09.png" and "birds" not in HIDE:
        m = mask("s09_pigeons", 5, 4)
        dx = m * 2 * np.sin(t * 6); dy = m * 3 * np.abs(np.sin(t * 5 + xx / 50))
    if dx is not None:
        a = cv2.remap(a, (xx + dx).astype(np.float32), (yy + dy).astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    if src == "img/s08.png":                     # la neige tombe derrière la fenêtre de Moscou
        m = mask("s08_window", 0, 3)
        r = random.Random(5); layer = np.zeros((H, W), np.float32)
        img = Image.new("L", (W, H), 0); d = ImageDraw.Draw(img)
        for k in range(160):
            x0, sp, sz = r.uniform(0, W), r.uniform(60, 160), r.uniform(2, 6)
            y = (r.uniform(0, H) + t * sp) % H; x = x0 + 18 * math.sin(t * 1.5 + k)
            d.ellipse((x - sz, y - sz, x + sz, y + sz), fill=235)
        a = np.maximum(a, np.asarray(img, np.float32) * m)
    return a

def pen_draw(canvas, src, p):
    """Ouverture : le dessin se trace trait par trait (VTracer), puis se remplit."""
    from vector_draw import draw_progress
    k = ("vec", src)
    if k not in _c:
        _c[k] = pickle.load(open("masks/s01_vec.pkl", "rb"))
    lines, tip = draw_progress(_c[k], p)
    fill = np.clip((p - 0.72) / 0.28, 0, 1)
    a = np.asarray(canvas, np.float32)
    out = np.maximum(a * fill, np.asarray(lines, np.float32))
    canvas.paste(Image.fromarray(out.astype(np.uint8)))
    if tip:
        ImageDraw.Draw(canvas).ellipse((tip[0] - 9, tip[1] - 9, tip[0] + 9, tip[1] + 9), fill=255)

# ---------- éléments ----------
HIDE = set()          # éléments détachés de leur scène pendant un enchaînement
KPOS = {}             # centre à l'écran de chaque ligne de titre (pour la détacher)
PLANE_BOX = (300, 525, 890, 870)
_erased = {}
def load_erased(path, box):
    if path not in _erased:
        im = load(path).copy(); ImageDraw.Draw(im).rectangle(box, fill=0); _erased[path] = im
    return _erased[path]

def draw_scene_bg(canvas, scene, t):
    t0, t1, src, _ = scene
    lt = t - t0
    if src is None:
        return
    if src == "END":
        draw_end(canvas, lt); return
    if src == "CHART":
        draw_chart(canvas, lt, t1 - t0); return
    if src == "HAFEZ":
        draw_hafez(canvas, t); return
    if src == "img/s06.png" and "plane" in HIDE:
        a = inpainted(src, "s06_plane")
    elif src == "img/s09.png" and "birds" in HIDE:
        a = inpainted(src, "s09_pigeons")
    else:
        a = np.asarray(load(src), np.float32)
    a = live_elements(src, a, t)
    u = lt / max(0.1, t1 - t0)
    bx, by = boil(t, 2.5, 1)
    canvas.paste(Image.fromarray(np.clip(depth_view(src, a, u, bx, by), 0, 255).astype(np.uint8)))
    if src == "img/s01.png" and t < 1.15:
        pen_draw(canvas, src, t / 1.15)

CHART_PTS = None
def draw_chart(canvas, lt, dur):
    d = ImageDraw.Draw(canvas)
    bx, by = boil(lt, 2, 5)
    ox, oy = 120 + bx, 1520 + by
    # axes
    jag_line(d, ox, oy, ox + 860, oy, 11, 7)
    jag_line(d, ox, oy, ox, oy - 850, 12, 7)
    d.polygon([(ox + 880, oy), (ox + 840, oy - 22), (ox + 840, oy + 22)], fill=255)
    d.polygon([(ox, oy - 875), (ox - 22, oy - 835), (ox + 22, oy - 835)], fill=255)
    hf = font(F_HAND, 54)
    d.text((ox + 640, oy + 25), "TEMPS", font=hf, fill=255)
    d.text((ox + 30, oy - 900), "VICTIMES", font=hf, fill=255)
    # deux courbes en dents de scie qui grimpent, le fils dépasse le père
    def curve(seed, slope_end, start):
        r = random.Random(seed)
        pts = []
        for i in range(25):
            x = ox + 40 + i * 32
            base = start + (slope_end * (i / 24) ** 1.6)
            pts.append((x, oy - 30 - base + r.uniform(-28, 28)))
        return pts
    p_pere = curve(3, 280, 20)
    p_fils = curve(9, 760, 0)
    prog = ease_out(lt / (dur * 0.85))
    for pts, w, lab, lt0 in ((p_pere, 12, "PÈRE", 0.0), (p_fils, 16, "FILS", 0.35)):
        pr = max(0, min(1, (lt - lt0) / (dur * 0.8)))
        n = max(2, int(len(pts) * ease_out(pr)))
        seg = pts[:n]
        d.line(seg, fill=255, width=w, joint="curve")
        x, y = seg[-1]
        d.polygon([(x + 34, y - 24), (x - 10, y - 30), (x + 14, y + 12)], fill=255)
        d.text((x - 150, y - 40), lab, font=font(F_HAND, 68), fill=255)
        if lab == "PÈRE":
            hd = hafez_head()
            canvas.paste(255, (int(x) - 400, int(y) - 60), hd)

_hz = {}
_head = []
def hafez_head():
    if not _head:
        p = Image.open("ref/e_hafez.png").convert("RGBA")
        w, h = p.size
        c = p.crop((int(w * .12), int(h * .02), int(w * .88), int(h * .62))).resize((170, 214), Image.LANCZOS)
        m = Image.new("L", c.size, 0); ImageDraw.Draw(m).ellipse((0, 0, c.width, c.height), fill=255)
        a = Image.fromarray(np.minimum(np.asarray(c.split()[0]), np.asarray(m)))
        _head.append(a)
    return _head[0]
def hafez_layer(cracked):
    """Portrait gravé d'Hafez (photo de la vidéo source) posé sur un calque plein cadre."""
    if cracked not in _hz:
        p = Image.open("ref/e_hafez.png").convert("RGBA")
        pw = 600; p = p.resize((pw, int(p.height * pw / p.width)), Image.LANCZOS)
        if cracked:
            d = ImageDraw.Draw(p)
            for k, (x0, y0, x1, y1) in enumerate([(300, 0, 250, 420), (250, 420, 120, 600), (250, 420, 420, 700), (420, 700, 380, 850)]):
                jag_line(d, x0, y0, x1, y1, 500 + k, 9, fill=(0, 0, 0, 255))
        lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        lay.paste(p, ((W - pw) // 2, H - p.height - 20), p)
        _hz[cracked] = lay
    return _hz[cracked]

HAFEZ_FALL = 3.50
def draw_hafez(canvas, t):
    """Hafez debout, puis il bascule et s'effondre sur « tombé », le portrait se fissure."""
    if "hafez" in HIDE:
        return
    f = t - HAFEZ_FALL
    if f < 0:
        ang, dy, shake = 0.0, 0, 0
    else:
        p = min(1, f / 0.35)
        ang = -20 * p ** 2 + (2.5 * math.sin(min(f - 0.35, 0.4) * 25) * max(0, 1 - (f - 0.35) / 0.4) if f > 0.35 else 0)
        dy = int(260 * p ** 2)
        shake = 14 * max(0, 1 - abs(f - 0.35) / 0.25)
    lay = hafez_layer(f > 0.35)
    if ang:
        lay = lay.rotate(ang, center=((W + 600) // 2, H - 20), resample=Image.BILINEAR)
    bx, by = boil(t, 2.5, 1)
    r = random.Random(int(t * FPS))
    sx = int(bx + r.uniform(-shake, shake)); sy = int(by + dy + r.uniform(-shake, shake))
    canvas.paste(lay.convert("L"), (sx, sy), lay)

def draw_end(canvas, lt):
    d = ImageDraw.Draw(canvas)
    a = int(255 * ease_out(lt / 0.4))
    ti = text_img("@SYRIEN_LIBRE", 150)
    x = (W - ti.width) // 2; y = 820
    canvas.paste(Image.new("L", ti.size, a), (x, y), ti)
    hf = font(F_HAND, 70)
    s = "Mémoire & Actualité"
    bb = hf.getbbox(s)
    d.text(((W - (bb[2] - bb[0])) // 2, y + ti.height + 30), s, font=hf, fill=a)

def draw_kinetic(canvas, t, anchor):
    for b0, b1, lines in K:
        if not (b0 <= t < b1):
            continue
        shown = [(lt, txt, sz, st) for lt, txt, sz, st in lines if t >= lt]
        if not shown:
            break
        imgs = [(text_img(txt, sz), lt, st) for lt, txt, sz, st in shown]
        total = sum(im.height for im, _, _ in imgs) + 10 * (len(imgs) - 1)
        if anchor == "top":
            y = 150
        elif anchor == "bottom":
            y = 1560 - total
        else:
            y = (H - total) // 2 - 80
        d = ImageDraw.Draw(canvas)
        # tache d'encre noire adoucie derrière tout le bloc de texte
        maxw = max(im.width for im, _, _ in imgs)
        m = Image.new("L", (W, H), 0)
        ImageDraw.Draw(m).rounded_rectangle(((W - maxw) // 2 - 60, y - 50, (W + maxw) // 2 + 60, y + total + 50), 80, fill=225)
        m = m.filter(ImageFilter.GaussianBlur(45))
        canvas.paste(0, (0, 0), m)
        for i, (im, lt, st) in enumerate(imgs):
            age = t - lt
            bx, by = boil(t, 2, 100 + i)
            sc = 1 + 0.18 * (1 - ease_out(age / 0.18))
            im2 = im if sc == 1 else im.resize((int(im.width * sc), int(im.height * sc)), Image.BILINEAR)
            x = (W - im2.width) // 2 + int(bx); yy = y - (im2.height - im.height) // 2 + int(by)
            # fond noir derrière le texte pour qu'il reste lisible sur le dessin
            sh = im2.filter(ImageFilter.MaxFilter(9)).point(lambda v: 255 if v > 10 else 0)
            KPOS[shown[i][1]] = (x + im2.width / 2, yy + im2.height / 2)
            if shown[i][1] in HIDE:
                y += im.height + 10
                continue
            canvas.paste(0, (x, yy), sh)
            canvas.paste(255, (x, yy), im2)
            if st is not None and t >= st:
                p = ease_out((t - st) / 0.2)
                cy = yy + im.height // 2
                jag_line(d, x - 10, cy + 8, x - 10 + (im.width + 20) * p, cy - 8, 77 + i, 14)
            y += im.height + 10
        break

def wrap(txt, f, maxw):
    words, lines, cur = txt.split(), [], ""
    for w in words:
        test = (cur + " " + w).strip()
        if f.getbbox(test)[2] > maxw and cur:
            lines.append(cur); cur = w
        else:
            cur = test
    lines.append(cur)
    return lines

def draw_caption(canvas, t, anchor):
    for c0, c1, txt in CAPS:
        if c0 <= t < c1:
            f = font(F_HAND, 62)
            lines = wrap(txt.upper(), f, 900)
            d = ImageDraw.Draw(canvas)
            y0 = 1640 if anchor != "bottom" else 1660
            bx, by = boil(t, 1.5, 300)
            m = Image.new("L", (W, H), 0)
            ImageDraw.Draw(m).rounded_rectangle((70, y0 - 40, W - 70, y0 + len(lines) * 74 + 40), 60, fill=200)
            canvas.paste(0, (0, 0), m.filter(ImageFilter.GaussianBlur(35)))
            for i, ln in enumerate(lines):
                bb = f.getbbox(ln)
                x = (W - (bb[2] - bb[0])) // 2 + bx
                d.text((x, y0 + i * 74 + by), ln, font=f, fill=255, stroke_width=7, stroke_fill=0)
            break

def grain(canvas, t):
    a = np.asarray(canvas, np.int16)
    k = int(t * 10)
    n = np.random.default_rng(k).integers(-10, 10, (H // 4, W // 4), dtype=np.int16)
    n = np.kron(n, np.ones((4, 4), np.int16))
    return Image.fromarray(np.clip(a + n, 0, 255).astype(np.uint8))

# ---------- enchaînements : un élément quitte la scène et guide la caméra vers la suivante ----------
CAM_PRE, CAM_POST = 0.40, 0.40          # fenêtre du glissement de caméra autour de la jointure
BOUNDS = [sc[0] for sc in SCENES[1:]]
# sens de déplacement des pages (dx, dy) : (-1,0) = la caméra part à droite, (0,1) = elle monte
DIRS = [(-1, 0), (0, -1), (0, -1), (0, 1), (-1, 0), (0, 1), (-1, 0), (0, -1), (-1, 0), (0, 1), (-1, 0), (0, 1)]
# élément guide de chaque jointure : (type, début avant la jointure, fin après)
LEADS = [("page", .55, .40), ("hafez", .50, .40), ("mort", .30, .45), ("embers", .60, .50),
         ("smoke", .60, .45), ("ash", .50, .50), ("plane", .75, .50), ("papers", .50, .55),
         ("shards", .45, .45), ("arrow", .50, .45), ("birds", .50, .60), ("doves", .40, .65)]

def ease_io(x):
    x = min(max(x, 0), 1)
    return 4 * x ** 3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2

def bez(p0, c, p1, q):
    return ((1 - q) ** 2 * p0[0] + 2 * (1 - q) * q * c[0] + q * q * p1[0],
            (1 - q) ** 2 * p0[1] + 2 * (1 - q) * q * c[1] + q * q * p1[1])

def scene_at(t):
    return next((s for s in SCENES if s[0] <= t < s[1]), SCENES[-1])

def scene_layer(sc, t):
    c = Image.new("L", (W, H), 0)
    draw_scene_bg(c, sc, t)
    draw_kinetic(c, t, sc[3])
    return c

def motion_blur(img, dx, dy, s):
    if s < 2:
        return img
    a = np.asarray(img, np.float32)
    acc = np.zeros_like(a); n = 0
    for k in range(-s, s + 1, max(1, s // 6)):
        acc += np.roll(a, (k * dy, k * dx), axis=(0, 1)); n += 1
    return Image.fromarray((acc / n).astype(np.uint8))

def blit(canvas, spr, cx, cy, scale=1.0, rot=0.0, alpha=1.0, mask=None):
    """Colle un sprite (blanc sur noir = éclaircir ; avec masque = opaque) centré en (cx, cy)."""
    if scale < 0.02 or alpha <= 0.01:
        return
    sz = (max(1, int(spr.width * scale)), max(1, int(spr.height * scale)))
    s = spr.resize(sz, Image.BILINEAR)
    m = mask.resize(sz, Image.BILINEAR) if mask is not None else None
    if rot:
        s = s.rotate(rot, resample=Image.BILINEAR, expand=True)
        if m is not None:
            m = m.rotate(rot, resample=Image.BILINEAR, expand=True)
    x, y = int(cx - s.width / 2), int(cy - s.height / 2)
    if m is not None:
        canvas.paste(s, (x, y), m.point(lambda v: int(v * alpha)))
    else:
        layer = Image.new("L", canvas.size, 0); layer.paste(s, (x, y))
        a = np.maximum(np.asarray(canvas), (np.asarray(layer, np.float32) * alpha).astype(np.uint8))
        canvas.paste(Image.fromarray(a))

# --- sprites ---
_spr = {}
def page_sprite():
    if "page" not in _spr:
        p = Image.new("L", (300, 380), 255); d = ImageDraw.Draw(p)
        d.rectangle((0, 0, 299, 379), outline=0, width=8)
        for k in range(6):
            jag_line(d, 30, 90 + k * 48, 270, 90 + k * 48, 40 + k, 3, fill=0)
        jag_line(d, 150, 60, 150, 350, 49, 3, fill=0)
        _spr["page"] = (p, Image.new("L", p.size, 255))
    return _spr["page"]

def plane_sprite():
    if "plane" not in _spr:
        _spr["plane"] = load("img/s06.png").crop(PLANE_BOX)
    return _spr["plane"]

def scene_zoom(sc, t):
    return 1.0 + 0.06 * ((t - sc[0]) / max(0.1, sc[1] - sc[0]))

def kpos(txt, t, anchor):
    """Position à l'écran d'une ligne de titre (calculée une fois)."""
    key = ("kpos", txt, anchor)
    if key not in _spr:
        KPOS.clear(); draw_kinetic(Image.new("L", (W, H)), t, anchor)
        if txt in KPOS:
            _spr[key] = KPOS[txt]
    return _spr.get(key, (W / 2, H / 2))

def bird(d, x, y, size, phase, fill=255):
    f = math.sin(phase)
    pts = [(x - size, y - size * 0.45 * f), (x - size * 0.45, y - size * 0.1), (x, y + size * 0.12),
           (x + size * 0.45, y - size * 0.1), (x + size, y - size * 0.45 * f)]
    d.line(pts, fill=fill, width=max(3, int(size / 9)), joint="curve")

def particles(n, seed, a0, a1, spread0, spread1):
    r = random.Random(seed)
    return [((a0[0] + r.uniform(-spread0[0], spread0[0]), a0[1] + r.uniform(-spread0[1], spread0[1])),
             (a1[0] + r.uniform(-spread1[0], spread1[0]), a1[1] + r.uniform(-spread1[1], spread1[1])),
             r.uniform(0, 0.35), r.uniform(0.5, 1.4), r.uniform(0, 6.28)) for _ in range(n)]

def draw_lead(canvas, i, b, t):
    kind, pre, post = LEADS[i]
    t0, t1 = b - pre, b + post
    q = (t - t0) / (t1 - t0)
    if not (0 <= q <= 1):
        return
    d = ImageDraw.Draw(canvas)
    fade = 1 - max(0, (q - 0.8) / 0.2)
    if kind == "page":            # une page du calendrier s'arrache et vole vers Hafez
        spr, m = page_sprite()
        x, y = bez((540, 600), (980, 250), (560, 1150), ease_io(q))
        blit(canvas, spr, x, y, 0.95 * (1 - 0.7 * q), 40 * math.sin(q * 9) + 300 * q, fade, m)
    elif kind == "hafez":         # Hafez continue sa chute, la caméra le suit vers le bas
        lay = _spr.get("hz")
        if lay is None:
            HIDE.discard("hafez"); lay = Image.new("L", (W, H), 0); draw_hafez(lay, t0); _spr["hz"] = lay; HIDE.add("hafez")
        blit(canvas, lay, W / 2, H / 2 + 1900 * q ** 2.2, 1.0, -18 * q, 1.0)
    elif kind == "mort":          # le mot MORT. tombe dans le gouffre
        p0 = kpos("MORT.", b - 0.2, "mid")
        x, y = bez(p0, (540, 900), (540, 1330), q ** 1.5)
        blit(canvas, text_img("MORT.", 360), x, y, 1 - 0.92 * q, 220 * q ** 2, fade)
    elif kind in ("embers", "ash"):   # braises / cendres qui montent et emmènent la caméra
        a1 = (540, 380) if kind == "embers" else (600, 700)
        for k, (p0, p1, dl, sp, ph) in enumerate(particles(60, i, (540, 1250), a1, (300, 220), (330, 260))):
            qq = min(1, max(0, (q - dl) / (1 - dl)))
            if qq <= 0 or qq >= 1:
                continue
            x, y = bez(p0, ((p0[0] + p1[0]) / 2 + 120 * math.sin(ph), p0[1] - 300), p1, ease_io(qq))
            g = int(255 * (1 - qq) ** 0.5)
            L = 10 + 26 * sp
            d.line([(x, y), (x + 8 * math.sin(ph + q * 10), y + L * 1.6)], fill=g, width=5 + int(sp * 3))
    elif kind == "smoke":         # volutes de fumée qui partent à droite
        for k, (p0, p1, dl, sp, ph) in enumerate(particles(9, i, (540, 420), (760, 300), (120, 80), (260, 160))):
            qq = min(1, max(0, (q - dl * 0.6) / (1 - dl * 0.6)))
            if qq <= 0 or qq >= 1:
                continue
            x, y = bez(p0, (p0[0] + 300, p0[1] - 200), p1, ease_io(qq))
            rad = 60 + 160 * qq * sp
            g = int(230 * (1 - qq))
            for j in range(3):
                rr = rad * (1 - j * 0.25)
                d.arc((x - rr, y - rr * 0.7, x + rr, y + rr * 0.7), 20 + j * 50 + ph * 30, 300 + j * 40, fill=g, width=8)
    elif kind == "plane":         # l'avion s'échappe, la caméra le suit jusqu'à Moscou
        spr = plane_sprite()
        z0 = scene_zoom(scene_at(b - 0.001), t0)
        p0 = (W / 2 + (592 - W / 2) * z0, H / 2 + (697 - H / 2) * z0)
        qq = ease_io(q)
        x, y = bez(p0, (1050, 520), (650, 470), qq)
        sc = z0 * (1 - 0.92 * qq ** 1.4)
        # traînée et traits de vitesse
        for k in range(4):
            yy = y + (k - 1.5) * 30 * sc
            d.line([(x - 260 * sc - 90 * (1 - qq), yy), (x - 330 * sc - 260 * (1 - qq), yy + 10)], fill=int(200 * fade), width=4)
        blit(canvas, spr, x, y, sc, -6 * math.sin(qq * 3.14), fade)
    elif kind == "papers":        # des feuilles tombent de la fenêtre jusqu'au sol du palais
        spr, m = page_sprite()
        for k, (p0, p1, dl, sp, ph) in enumerate(particles(5, i, (540, 820), (540, 1550), (250, 120), (330, 80))):
            qq = min(1, max(0, (q - dl) / (1 - dl)))
            if qq <= 0:
                continue
            x, y = bez(p0, (p0[0] + 200 * math.sin(ph), (p0[1] + p1[1]) / 2), p1, ease_io(qq))
            x += 60 * math.sin(qq * 8 + ph)
            blit(canvas, spr, x, y, 0.45 * sp, 35 * math.sin(qq * 7 + ph), fade, m)
    elif kind == "shards":        # les éclats de verre volent jusqu'à l'origine du graphique
        for k, (p0, p1, dl, sp, ph) in enumerate(particles(7, i, (540, 1000), (240, 1450), (200, 200), (80, 60))):
            qq = min(1, max(0, (q - dl * 0.5) / (1 - dl * 0.5)))
            if qq <= 0:
                continue
            x, y = bez(p0, (p0[0] + 400, p0[1] - 400), p1, ease_io(qq))
            a = ph + qq * 12; r0 = 40 * sp * (1 - 0.6 * qq)
            pts = [(x + r0 * math.cos(a + o), y + r0 * math.sin(a + o) * 0.8) for o in (0, 2.3, 4.1)]
            d.polygon(pts, outline=int(255 * fade), width=4)
    elif kind == "arrow":         # la flèche du FILS s'envole jusqu'au socle vide
        qq = ease_io(q)
        x, y = bez((935, 720), (1000, -200), (540, 520), qq)
        x0, y0 = bez((935, 720), (1000, -200), (540, 520), max(0, qq - 0.12))
        d.line([(x0, y0), (x, y)], fill=int(255 * fade), width=22)
        ang = math.atan2(y - y0, x - x0); s_ = 80 * (1 - 0.3 * qq)
        d.polygon([(x + s_ * math.cos(ang), y + s_ * math.sin(ang)),
                   (x + s_ * math.cos(ang + 2.5), y + s_ * math.sin(ang + 2.5)),
                   (x + s_ * math.cos(ang - 2.5), y + s_ * math.sin(ang - 2.5))], fill=int(255 * fade))
    elif kind in ("birds", "doves"):  # les pigeons s'envolent, la caméra les suit
        if kind == "birds":
            src, dst, spr0, spr1 = (540, 1500), (560, 380), (330, 200), (380, 140)
        else:
            src, dst, spr0, spr1 = (540, 1300), (540, 640), (360, 300), (420, 120)
        for k, (p0, p1, dl, sp, ph) in enumerate(particles(8, i, src, dst, spr0, spr1)):
            qq = min(1, max(0, (q - dl * 0.6) / (1 - dl * 0.6)))
            if qq <= 0:
                continue
            x, y = bez(p0, (p0[0] + 250, p0[1] - 500), p1, ease_io(qq))
            bird(d, x, y, 60 * sp * (1.2 - 0.4 * qq), t * 18 + ph, fill=int(255 * fade))

def frame(t):
    sc = scene_at(t)
    HIDE.clear()
    lead = next(((i, b) for i, b in enumerate(BOUNDS) if b - LEADS[i][1] <= t <= b + LEADS[i][2]), None)
    if lead:
        HIDE.add({"mort": "MORT."}.get(LEADS[lead[0]][0], LEADS[lead[0]][0]))
    tr = next(((i, b) for i, b in enumerate(BOUNDS) if b - CAM_PRE < t < b + CAM_POST), None)
    if tr is None:
        canvas = scene_layer(sc, t)
    else:
        i, b = tr
        prev = scene_at(b - 0.001); nxt = scene_at(b)
        u = (t - (b - CAM_PRE)) / (CAM_PRE + CAM_POST)
        p = ease_io(u)
        dx, dy = DIRS[i % len(DIRS)]
        lo = scene_layer(prev, min(t, b - 0.001))
        li = scene_layer(nxt, max(t, b))
        ox, oy = int(p * dx * W), int(p * dy * H)
        canvas = Image.new("L", (W, H), 0)
        canvas.paste(lo, (ox, oy))
        canvas.paste(li, (ox - dx * W, oy - dy * H))
        canvas = motion_blur(canvas, dx, dy, int(16 * math.sin(math.pi * min(max(u, 0), 1))))
    if lead:
        draw_lead(canvas, lead[0], lead[1], t)
    if sc[2] != "END":
        draw_caption(canvas, t, sc[3])
    return grain(canvas, t)

if __name__ == "__main__":
    out = sys.argv[1]
    ta = float(sys.argv[2]) if len(sys.argv) > 2 else 0
    tb = float(sys.argv[3]) if len(sys.argv) > 3 else DUR
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "gray", "-s", f"{W}x{H}",
                          "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "18",
                          "-pix_fmt", "yuv420p", out], stdin=subprocess.PIPE)
    n0, n1 = int(round(ta * FPS)), int(round(tb * FPS))
    for n in range(n0, n1):
        p.stdin.write(frame(n / FPS).tobytes())
    p.stdin.close(); p.wait()
