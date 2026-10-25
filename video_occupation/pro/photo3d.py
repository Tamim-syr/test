# Photo en 3D (effet « 2.5D » documentaire) : profondeur Depth Anything V2 + travelling avec parallaxe.
# Si le format de la photo est trop différent de la vidéo : photo encadrée sur un fond flou de la même photo (comme à la télé).
# Usage : python3 photo3d.py photo.jpg sortie.mp4 durée H|V push|left|right
import sys, numpy as np, cv2, subprocess
from PIL import Image
from transformers import pipeline
src, out, D, ORI, MOVE = sys.argv[1], sys.argv[2], float(sys.argv[3]), sys.argv[4], sys.argv[5]
OW, OH = (1920, 1080) if ORI == "H" else (1080, 1920)
img = Image.open(src).convert("RGB")
pipe = pipeline("depth-estimation", model="depth-anything/Depth-Anything-V2-Small-hf", device="cpu")
d0 = np.asarray(pipe(img)["predicted_depth"].squeeze().numpy(), np.float32); d0 = (d0 - d0.min()) / (d0.max() - d0.min() + 1e-6)
im0 = np.asarray(img)[:, :, ::-1].astype(np.float32)
H0, W0 = im0.shape[:2]; ra, ro = W0 / H0, OW / OH
FIT = max(ra / ro, ro / ra) > 1.3
if FIT:   # zone de la photo dans le cadre
    s = min(OW * .9 / W0, OH * .86 / H0) if ORI == "H" else min(OW * .94 / W0, OH * .7 / H0)
    FW, FH = int(W0 * s) // 2 * 2, int(H0 * s) // 2 * 2
else: FW, FH = OW, OH
sc = max(FW / W0, FH / H0) * 1.12
im = cv2.resize(im0, (int(W0 * sc), int(H0 * sc)), interpolation=cv2.INTER_LANCZOS4)
im = cv2.addWeighted(im, 1.35, cv2.GaussianBlur(im, (0, 0), 1.6), -.35, 0)          # netteté (photos souvent compressées)
d = cv2.bilateralFilter(cv2.resize(d0, (im.shape[1], im.shape[0]), interpolation=cv2.INTER_CUBIC), 9, .1, 9)
h, w = d.shape; yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
if FIT:
    bgs = max(OW / W0, OH / H0) * 1.15
    bg = cv2.resize(im0, (int(W0 * bgs), int(H0 * bgs))); bg = cv2.GaussianBlur(bg, (0, 0), 38) * .45
    by, bx = (bg.shape[0] - OH) // 2, (bg.shape[1] - OW) // 2; bg = bg[by:by + OH, bx:bx + OW]
    shadow = np.zeros((OH, OW), np.float32); x0, y0 = (OW - FW) // 2, (OH - FH) // 2
    shadow[y0 + 14:y0 + FH + 14, x0:x0 + FW] = 1; shadow = cv2.GaussianBlur(shadow, (0, 0), 22)[..., None]
enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{OW}x{OH}", "-r", "30", "-i", "-",
                        "-c:v", "libx264", "-crf", "14", "-preset", "medium", "-pix_fmt", "yuv420p", out], stdin=subprocess.PIPE)
n = int(round(D * 30))
for k in range(n):
    u = k / max(1, n - 1); e = u * u * (3 - 2 * u) * .7 + u * .3
    if MOVE == "push": z, px = 1 + .08 * e, 0.0
    else: z, px = 1.035, (e - .5) * (1 if MOVE == "right" else -1)
    zz = 1 + (z - 1) * (.3 + 1.4 * d); sx = px * 40 * (d - .3)
    mx = (xx - w / 2) / zz + w / 2 - sx; my = (yy - h / 2) / zz + h / 2
    fr = cv2.remap(im, mx.astype(np.float32), my.astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    fy, fx = (h - FH) // 2, (w - FW) // 2; fr = fr[fy:fy + FH, fx:fx + FW]
    if FIT:
        bz = 1 + .03 * e; M = cv2.getRotationMatrix2D((OW / 2, OH / 2), 0, bz); can = cv2.warpAffine(bg, M, (OW, OH), borderMode=cv2.BORDER_REFLECT)
        can = can * (1 - .55 * shadow); can[y0:y0 + FH, x0:x0 + FW] = fr
        fr = can
    g = np.random.default_rng(k).normal(0, 3.0, fr.shape[:2])[..., None]
    enc.stdin.write(np.clip(fr + g, 0, 255).astype(np.uint8).tobytes())
enc.stdin.close(); enc.wait(); print("ok", out, n, "cadre" if FIT else "plein")
