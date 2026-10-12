# Vidéo 4 « Mon histoire » — style Hafez + plans EffectCraft (feu, gaz, neige, marionnettes)
# Usage : python3 render4.py out.mp4 [t_debut t_fin]
import sys, os, math, random, subprocess
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFilter
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "proj"))
import render as R                       # moteur du style Hafez (titres, sous-titres, enchaînements guidés)

W, H, FPS = R.W, R.H, R.FPS
DUR = 45.4
AUDIO_END = 43.75

# (début, fin, source, ancre) — source : img/… (dessin + parallaxe 3D), PHOTO:… (photo gravée), VID:… (plan EffectCraft), TXT, END
SCENES = [
    (0.00, 2.50, "PHOTO:img/e_child.png", "top"),
    (2.50, 3.80, "img/a2.png", "top"),
    (3.80, 5.25, "MAP", "top"),
    (5.25, 6.60, "img/a3.png", "top"),
    (6.60, 7.85, "VID:ec/plate_BOMB.mp4", "top"),
    (7.85, 11.80, "VID:ec/plate_SURV.mp4", "bottom"),
    (11.80, 14.50, "PHOTO:img/e_bashar.png", "top"),
    (14.50, 17.20, "PHOTO:img/e_family.png", "top"),
    (17.20, 18.85, "img/a6.png", "top"),
    (18.85, 21.95, "img/a7.png", "top"),
    (21.95, 25.70, "VID:ec/plate_GAS.mp4", "top"),
    (25.70, 28.90, "img/a9.png", "top"),
    (28.90, 31.25, "VID:ec/plate_CAMP.mp4", "top"),
    (31.25, 33.40, "img/a11.png", "top"),
    (33.40, 34.75, "PHOTO:img/e_child.png", "top"),
    (34.75, 40.05, "VID:ec/plate_MEGA.mp4", "bottom"),
    (40.05, AUDIO_END, "TXT", "mid"),
    (AUDIO_END, DUR, "END", "mid"),
]
K = [
    (0.00, 2.50, [(0.00, "J'ÉTAIS EN SYRIE", 120, None), (1.40, "MON ENFANCE", 170, None)]),
    (2.50, 3.80, [(2.56, "PUIS", 130, None), (3.24, "LA GUERRE", 230, None)]),
    (3.82, 5.25, [(3.82, "DERAA", 300, None), (4.36, "MA VILLE NATALE", 110, None)]),
    (5.25, 6.60, [(5.30, "ASSIÉGÉE", 220, None), (5.82, "PAR LE RÉGIME", 120, None)]),
    (6.62, 7.85, [(6.78, "BOMBARDÉE", 200, None), (7.32, "SANS CESSE", 140, None)]),
    (7.88, 9.30, [(7.88, "MALGRÉ TOUT", 130, None), (8.68, "SURVIVANT", 220, None)]),
    (9.30, 11.80, [(9.82, "SUR LES RÉSEAUX", 130, None), (10.84, "POUR UNE RAISON", 120, None)]),
    (11.82, 14.50, [(12.06, "DÉNONCER", 250, None), (12.70, "LE RÉGIME SYRIEN", 120, None)]),
    (14.52, 17.20, [(14.52, "CE QUE NOUS VIVIONS", 100, None), (16.20, "DEPUIS LES ASSAD", 140, None)]),
    (17.24, 18.85, [(17.78, "UN COUP D'ÉTAT", 130, None), (18.42, "1970", 330, None)]),
    (18.88, 21.95, [(19.16, "AU POUVOIR", 160, None), (19.46, "DEPUIS 1970", 120, None), (20.88, "ILS NE LÂCHENT PAS", 100, None)]),
    (21.98, 23.38, [(22.52, "MASSACRER", 220, None), (22.98, "UN PEUPLE", 150, None)]),
    (23.38, 25.70, [(23.78, "ARMES", 250, None), (23.96, "CHIMIQUES", 200, None)]),
    (25.72, 28.90, [(25.72, "ÉLOIGNEZ-VOUS", 140, None), (26.64, "DE LA PROPAGANDE", 110, None)]),
    (28.94, 31.25, [(29.06, "RAPPROCHEZ-VOUS", 120, None), (29.76, "DES SYRIENS", 140, None), (30.56, "LA MISÈRE", 190, None)]),
    (31.28, 33.40, [(31.28, "CHAQUE SYRIEN", 140, None), (32.22, "A SON HISTOIRE", 130, None)]),
    (33.40, 34.75, [(33.46, "VOICI", 160, None), (34.38, "LA MIENNE", 200, None)]),
    (34.78, 36.55, [(34.78, "AVANT TOUT", 130, None), (35.74, "UNE CHOSE", 170, None)]),
    (36.55, 40.05, [(36.60, "REPUBLIEZ", 230, None), (37.16, "AU MAXIMUM", 150, None), (38.32, "POUR LEUR VOIX", 110, None)]),
    (40.12, AUDIO_END, [(40.12, "PLUSIEURS VIDÉOS", 120, None), (41.82, "BIENTÔT", 230, None), (42.82, "RESTEZ BRANCHÉS", 120, None)]),
]
CAPS = [
    (0.00, 1.18, "J'étais en Syrie,"), (1.20, 2.52, "j'ai vécu mon enfance là-bas,"), (2.56, 3.78, "et puis j'ai vécu la guerre."),
    (3.82, 5.04, "Deraa, ma ville natale,"), (5.08, 6.56, "a été assiégée par le régime syrien,"), (6.62, 7.85, "puis bombardée sans cesse."),
    (7.88, 9.26, "Malgré tout, je suis survivant,"), (9.30, 10.56, "et si je me suis lancé sur les réseaux,"),
    (10.58, 11.78, "c'est pour une raison particulière :"), (11.82, 14.48, "vous dénoncer ce que le régime syrien faisait au peuple syrien,"),
    (14.52, 16.38, "ce que nous, les Syriens, vivions depuis que"), (16.40, 18.86, "la famille Assad a pris le pouvoir par un coup d'État."),
    (18.88, 20.72, "Ça fait quand même 70 ans qu'ils sont au pouvoir,"), (20.76, 21.95, "ils ne veulent pas lâcher le pouvoir."),
    (21.98, 23.36, "Ils sont prêts à massacrer un peuple,"), (23.38, 25.68, "à utiliser les armes chimiques, etc., pour rester au pouvoir."),
    (25.72, 27.26, "Éloignez-vous des propagandes"), (27.28, 28.90, "et de ce que les médias veulent vous faire croire,"),
    (28.94, 31.24, "et rapprochez-vous des Syriens qui n'ont vu que la misère."), (31.28, 33.34, "Chaque Syrien a sa propre histoire à raconter,"),
    (33.36, 34.75, "et aujourd'hui, je vous raconte la mienne."), (34.78, 36.56, "Mais avant tout, je vous demande une chose :"),
    (36.58, 38.30, "c'est de republier au maximum,"), (38.32, 40.05, "pour faire entendre la voix de mes frères et sœurs en Syrie."),
    (40.12, 42.58, "Plusieurs vidéos explicatives seront publiées bientôt,"), (42.62, AUDIO_END, "donc restez branchés."),
]
R.SCENES, R.K, R.CAPS, R.DUR = SCENES, K, CAPS, DUR

# enchaînements : glissement (dx, dy) ou plongée ("zoom", (x, y)) + élément guide (types du moteur Hafez)
BOUNDS = [s[0] for s in SCENES[1:]]
TRANS = [((-1, 0), "smoke"), ((0, 1), None), (("zoom", (263, 1550)), None), ((0, -1), None), ((0, 1), "ash"),
         ((-1, 0), None), ((0, -1), "papers"), ((-1, 0), None), ((0, 1), None), ((0, -1), "smoke"),
         ((-1, 0), None), ((1, 0), None), ((0, 1), None), (("zoom", (540, 1000)), None), ((-1, 0), "birds"),
         ((0, 1), None), ((0, 1), "doves")]
R.LEADS = [(k, .5, .5) if k else (None, 0, 0) for _, k in TRANS]
PRE, POST = 0.40, 0.40

# ---------- sources ----------
_c = {}
def depth(src):
    k = ("d", src)
    if k not in _c:
        p = src.replace(".png", "_depth.png")
        d = np.asarray(Image.open(p).convert("L").resize((W, H)), np.float32) / 255 if os.path.exists(p) else np.full((H, W), 0.5, np.float32)
        _c[k] = cv2.GaussianBlur(d, (0, 0), 8)
    return _c[k]

_grid = np.mgrid[0:H, 0:W].astype(np.float32)
def depth_view(src, a, u, bx, by):
    yy, xx = _grid; d = depth(src); e = u * u * (3 - 2 * u)
    s = 1.0 + e * (0.02 + 0.10 * d); px = (e - 0.5) * 50 * (d - 0.35) + bx
    cx, cy = W / 2, H * 0.55
    return cv2.remap(a, cx + (xx - cx) / s - px, cy + (yy - cy) / s - by, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)

def video_frame(path, t_local):
    if path not in _c:
        raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={W}:{H}", "-f", "rawvideo", "-pix_fmt", "gray", "-"], capture_output=True).stdout
        _c[path] = np.frombuffer(raw, np.uint8).reshape(-1, H, W)
    fr = _c[path]
    return fr[min(len(fr) - 1, max(0, int(t_local * FPS)))]

def photo(path):
    if path not in _c:
        im = Image.open(path).convert("RGBA"); im = im.crop(im.getchannel("A").getbbox())   # recadré sur la personne
        w = 1000; h = int(im.height * w / im.width)
        if h > 1250: h = 1250; w = int(im.width * h / im.height)
        im = im.resize((w, h), Image.LANCZOS)
        a = np.asarray(im, np.float32); lum = a[..., 0] * a[..., 3] / 255
        full = np.zeros((H, W), np.float32); x0 = (W - w) // 2; y0 = int(H * 0.60 - h / 2)
        full[y0:y0 + h, x0:x0 + w] = lum
        _c[path] = full
    return _c[path]

def map_layer():
    if "map" not in _c:
        im = np.asarray(Image.open("img/e_map.png").convert("L"), np.float32)
        full = np.zeros((H, W), np.float32); y0 = 250; full[y0:y0 + im.shape[0], :im.shape[1]] = im[: H - y0]
        _c["map"] = full
    return _c["map"]

def draw_scene_bg(canvas, scene, t):
    t0, t1, src, _ = scene
    lt = t - t0; u = lt / max(0.1, t1 - t0)
    bx, by = R.boil(t, 2.5, 1)
    if src == "END":
        R.draw_end(canvas, lt); return
    if src == "TXT":
        return
    if src.startswith("VID:"):
        a = video_frame(src[4:], lt + PRE).astype(np.float32)
        z = 1.0 + 0.03 * u
    elif src.startswith("PHOTO:"):
        a = photo(src[6:]); z = 1.0 + 0.07 * u
    elif src == "MAP":
        a = map_layer(); z = 1.0 + 0.10 * u
    else:
        a = np.asarray(R.load(src), np.float32)
        canvas.paste(Image.fromarray(np.clip(depth_view(src, a, u, bx, by), 0, 255).astype(np.uint8)))
        return
    cx, cy = (263, 1550) if src == "MAP" else (W / 2, H * 0.55)
    M = np.float32([[z, 0, cx - z * cx + bx], [0, z, cy - z * cy + by]])
    out = cv2.warpAffine(a, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
    canvas.paste(Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)))
    if src == "MAP" and t >= 3.95:        # cercle griffonné + étiquette sur Deraa
        d = ImageDraw.Draw(canvas); p = R.ease_out((t - 3.95) / 0.5)
        mx, my = cx + bx, cy + by; rr = random.Random(3); pts = []
        for k in range(int(140 * p)):
            ang = -2.2 + k / 140 * 2 * math.pi * 1.15; wob = 1 + 0.05 * math.sin(k * 0.3) + rr.uniform(-0.015, 0.015)
            pts.append((mx + 150 * wob * math.cos(ang), my + 120 * wob * math.sin(ang)))
        if len(pts) > 1:
            d.line(pts, fill=0, width=24, joint="curve"); d.line(pts, fill=255, width=11, joint="curve")

def scene_at(t):
    return next((s for s in SCENES if s[0] <= t < s[1]), SCENES[-1])

def scene_layer(sc, t):
    c = Image.new("L", (W, H), 0); draw_scene_bg(c, sc, t); R.draw_kinetic(c, t, sc[3]); return c

def ease_io(x):
    x = min(max(x, 0), 1); return 4 * x ** 3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2

def frame(t):
    sc = scene_at(t)
    tr = next(((i, b) for i, b in enumerate(BOUNDS) if b - PRE < t < b + POST), None)
    if tr is None:
        canvas = scene_layer(sc, t)
    else:
        i, b = tr; kind = TRANS[i][0]
        u = (t - (b - PRE)) / (PRE + POST); p = ease_io(u)
        lo = scene_layer(scene_at(b - 0.001), min(t, b - 0.001)); li = scene_layer(scene_at(b), max(t, b))
        if kind[0] == "zoom":
            fx, fy = kind[1]
            def zoom(img, z):
                w, h = W / z, H / z; x0 = fx * (1 - 1 / z); y0 = fy * (1 - 1 / z)
                return img.crop((int(x0), int(y0), int(x0 + w), int(y0 + h))).resize((W, H), Image.BILINEAR)
            a = np.asarray(zoom(lo, 1 + 2.4 * p ** 1.6), np.float32) * (1 - p) + np.asarray(zoom(li, 1.4 - 0.4 * p), np.float32) * p
            canvas = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
        else:
            dx, dy = kind
            ox, oy = int(p * dx * W), int(p * dy * H)
            canvas = Image.new("L", (W, H), 0); canvas.paste(lo, (ox, oy)); canvas.paste(li, (ox - dx * W, oy - dy * H))
            d = ImageDraw.Draw(canvas)
            if dx:
                sx = ox + (0 if dx > 0 else W); R.jag_line(d, sx - 320, int(H * 0.47), sx + 320, int(H * 0.47) + 40, 900 + i, 9)
            else:
                sy = oy + (0 if dy > 0 else H); R.jag_line(d, W // 2, sy - 320, W // 2 + 60, sy + 320, 900 + i, 9)
            canvas = R.motion_blur(canvas, dx, dy, int(16 * math.sin(math.pi * min(max(u, 0), 1))))
    lead = next(((i, b) for i, b in enumerate(BOUNDS) if R.LEADS[i][0] and b - 0.5 <= t <= b + 0.5), None)
    if lead:
        R.draw_lead(canvas, lead[0], lead[1], t)
    if sc[2] != "END":
        R.draw_caption(canvas, t, sc[3])
    return R.grain(canvas, t)

if __name__ == "__main__":
    out = sys.argv[1]
    ta = float(sys.argv[2]) if len(sys.argv) > 2 else 0
    tb = float(sys.argv[3]) if len(sys.argv) > 3 else DUR
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "gray", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                          "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", out], stdin=subprocess.PIPE)
    for n in range(int(round(ta * FPS)), int(round(tb * FPS))):
        p.stdin.write(frame(n / FPS).tobytes())
    p.stdin.close(); p.wait()
