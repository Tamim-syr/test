# Montage final (H = 1920x1080 YouTube, V = 1080x1920 TikTok) : caméra floutée + carte, transitions « whip zoom », sous-titres, grain
import cv2, numpy as np, subprocess, math, sys
ORI = sys.argv[1] if len(sys.argv) > 1 else "H"
OW, OH = (1920, 1080) if ORI == "H" else (1080, 1920)
G = "../geo3/"; FPS = 30; N = 1294
f = lambda x: math.floor(x * FPS + .5)
pre = "p_" if ORI == "H" else "v_"
MAPS = [(f(a), f(b), G + pre + n) for a, b, n in [(1.15, 3.8, "1.15.mp4"), (8.9, 14.55, "8.9.mp4"), (17.2, 21.1, "17.2.mp4"), (21.1, 25.0, "21.1.mp4"), (41.6, 43.14, "41.6.mp4")]]
if ORI == "H": WIDE, TIGHT = (0, 0, 1280, 720), (84, 22, 1112, 626)
else: WIDE, TIGHT = (388, 0, 405, 720), (410, 46, 360, 640)
PHOTOS = [(f(6.9), f(8.9), f"ph_victime_{ORI}.mp4"), (f(30.15), f(33.05), f"ph_deuil_{ORI}.mp4"), (f(33.05), f(35.8), f"ph_fun_{ORI}.mp4")]
MAPS = MAPS + PHOTOS
FACE_Z = [(0, f(1.15), WIDE), (f(3.8), f(6.9), TIGHT), (f(14.55), f(17.2), TIGHT), (f(25.0), f(28.0), WIDE), (f(28.0), f(30.15), TIGHT),
          (f(35.8), f(38.9), TIGHT), (f(38.9), f(41.6), WIDE)]
def kind(i):
    for a, b, src in MAPS:
        if a <= i < b: return ("map", src, i - a)
    for a, b, c in FACE_Z:
        if a <= i < b: return ("face", c, None)
    return ("face", WIDE, None)
CUTS = sorted(set([a for a, b, _ in MAPS] + [b for a, b, _ in MAPS if b < N]))
T = 5
SOFT = set([a for a, b, _ in PHOTOS] + [b for a, b, _ in PHOTOS])
def dec(path, w, h):
    return subprocess.Popen(["ffmpeg", "-v", "error", "-i", path, "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], stdout=subprocess.PIPE), w * h * 3
face = dec("face_bokeh.mp4", 1280, 720)
maps = {}
def read(d, w, h): b = d[0].stdout.read(d[1]); return np.frombuffer(b, np.uint8).reshape(h, w, 3) if len(b) == d[1] else None
last_map = {}
def whip(img, s):
    """s dans [-1, 1] : intensité de la transition (signe = sens). Zoom + flou de mouvement + flash."""
    a = abs(s)
    if a < 1e-3: return img
    z = 1 + .16 * a ** 1.5; h, w = img.shape[:2]
    M = cv2.getRotationMatrix2D((w / 2, h / 2), 0, z); im = cv2.warpAffine(img, M, (w, h), borderMode=cv2.BORDER_REFLECT)
    L = int(2 + 70 * a ** 1.3); k = np.zeros((L, L), np.float32); k[L // 2, :] = 1 / L
    im = cv2.filter2D(im, -1, k)
    return np.clip(im.astype(np.float32) * (1 + .35 * a ** 2) + 40 * a ** 3, 0, 255).astype(np.uint8)
ff = ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{OW}x{OH}", "-r", str(FPS), "-i", "-", "-i", "mix7.wav",
      "-filter_complex", f"[0:v]noise=alls=3:allf=t,subtitles={'subs6.ass' if ORI == 'H' else 'subs6v.ass'}:fontsdir=fonts[v]",
      "-map", "[v]", "-map", "1:a", "-c:v", "libx264", "-preset", "slow", "-b:v", "12000k" if ORI == "H" else "10000k", "-maxrate", "15000k", "-bufsize", "20000k",
      "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "256k", "-t", "43.13", "-movflags", "+faststart",
      f"/home/user/test/occupation_israelienne_{'youtube' if ORI == 'H' else 'tiktok'}.mp4"]
enc = subprocess.Popen(ff, stdin=subprocess.PIPE)
for i in range(N):
    fr = read(face, 1280, 720)
    k, a, j = kind(i)
    if k == "map":
        if a not in maps: maps[a] = dec(a, OW, OH)
        m = read(maps[a], OW, OH)
        img = m if m is not None else last_map.get(a)
        last_map[a] = img
    else:
        x, y, w, h = a; img = cv2.resize(fr[y:y + h, x:x + w], (OW, OH), interpolation=cv2.INTER_LANCZOS4)
        img = cv2.addWeighted(img, 1.5, cv2.GaussianBlur(img, (0, 0), 2.0), -.5, 0)   # netteté après agrandissement
    # transitions autour des passages caméra <-> carte
    for c in CUTS:
        d = i - c
        k2 = .55 if c in SOFT else 1.0
        if -T <= d < 0: img = whip(img, k2 * (T + d + 1) / T)
        elif 0 <= d < T: img = whip(img, -k2 * (T - d) / T)
    enc.stdin.write(np.ascontiguousarray(img).tobytes())
enc.stdin.close(); enc.wait(); print("ok", ORI)
