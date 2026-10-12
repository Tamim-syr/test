# Clip test : feu simulé sur le gouffre (s03) et sur le toit du mausolée (s04), 3 s chacun
import numpy as np, cv2, subprocess
from PIL import Image
from firesim import Fire, stylize
W, H, FPS = 1080, 1920, 30
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)

def ring_emit(cx, cy, rx, ry, th0, th1, thick=26, seed=1):
    r = np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)
    ang = np.arctan2(yy - cy, xx - cx)
    band = np.clip(1 - np.abs(r - 1) * rx / thick, 0, 1) * ((ang > th0) & (ang < th1))
    rng = np.random.default_rng(seed)
    tongues = 0.55 + 0.45 * np.sin(ang * 23 + rng.uniform(0, 6)) * np.sin(ang * 7 + 1)
    return cv2.GaussianBlur((band * np.clip(tongues, 0, 1)).astype(np.float32), (0, 0), 3)

def line_emit(pts, thick=22):
    m = np.zeros((H, W), np.uint8)
    cv2.polylines(m, [np.array(pts, np.int32)], False, 255, thick)
    n = 0.55 + 0.45 * np.sin(xx / 17) * np.sin(xx / 41 + 2)
    return cv2.GaussianBlur(m.astype(np.float32) / 255 * n, (0, 0), 4)

SCENES = [
    ("img/s03.png", "masks/s03_fire.png", ring_emit(540, 1240, 440, 485, -np.pi - 0.3, 0.35, thick=55), dict(buoy=4.2, conf=16.0, cool=0.978)),
    ("img/s04.png", None, line_emit([(700, 690), (760, 760), (820, 860), (870, 1000), (900, 1150)]) + line_emit([(380, 820), (450, 720), (540, 690), (620, 700)]), dict(buoy=4.0, conf=12.0, wind=0.15, cool=0.975)),
]
p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "gray", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                      "-c:v", "libx264", "-b:v", "4000k", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "/home/user/test/demo_feu_simule.mp4"], stdin=subprocess.PIPE)
for src, mpath, emit, kw in SCENES:
    base = np.asarray(Image.open(src).convert("L").resize((W, H)), np.float32)
    base = np.clip((base - 30) * 1.25, 0, 255)
    fm = np.asarray(Image.open(mpath).convert("L").resize((W, H)), np.float32) / 255 if mpath else cv2.GaussianBlur(((yy > 380) & (yy < 1000) & (xx > 330)).astype(np.float32) * (base > 150), (0, 0), 25)
    f = Fire(emit / emit.max(), **kw)
    for k in range(40):  # le feu prend avant le début du plan
        f.step(1 / 30, k / 30)
    for k in range(90):
        f.step(1 / 30, (40 + k) / 30)
        T, S = f.image()
        out = np.maximum(base * (1 - 0.45 * np.clip(fm * 1.3, 0, 1)), stylize(T, S))
        p.stdin.write(np.clip(out, 0, 255).astype(np.uint8).tobytes())
p.stdin.close(); p.wait()
