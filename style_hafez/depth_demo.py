# Démo : parallaxe 3D par carte de profondeur (Depth Anything V2 Small) façon « 3D Ken Burns »
import sys, subprocess, math, numpy as np, cv2
from PIL import Image
import render as R
W, H, FPS = R.W, R.H, R.FPS
SHOTS = [("img/s10.png", 4.0, "orbit"), ("img/s04.png", 4.0, "dolly"), ("img/s06.png", 4.0, "rise")]
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)

def shot_frame(src, u, mode):
    im = np.asarray(R.load(src), np.float32)
    d = cv2.resize(np.asarray(Image.open(src.replace(".png", "_depth.png")), np.float32) / 255, (W, H))
    d = cv2.GaussianBlur(d, (0, 0), 6)
    e = u * u * (3 - 2 * u)
    if mode == "orbit":      # la caméra tourne autour de la foule : l'avant bouge plus que le fond
        s = 1.04 + 0.06 * e * d; px = (e - 0.5) * 110 * (d - 0.35); py = 0
    elif mode == "dolly":    # la caméra avance : le premier plan grossit plus vite que le mausolée
        s = 1.0 + e * (0.03 + 0.22 * d); px = 0; py = -40 * e * d
    else:                    # la caméra monte : le palais descend, l'avion reste
        s = 1.03 + 0.04 * e; px = 0; py = (e - 0.5) * -160 * (1 - d)
    cx, cy = W / 2, H * 0.55
    xs = cx + (xx - cx) / s - px; ys = cy + (yy - cy) / s - py
    out = cv2.remap(im, xs.astype(np.float32), ys.astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    return R.grain(Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)), u * 4)

if __name__ == "__main__":
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "gray", "-s", f"{W}x{H}", "-r", str(FPS),
                          "-i", "-", "-c:v", "libx264", "-b:v", "4000k", "-pix_fmt", "yuv420p", "-movflags", "+faststart", sys.argv[1]], stdin=subprocess.PIPE)
    for src, dur, mode in SHOTS:
        n = int(dur * FPS)
        for k in range(n):
            p.stdin.write(shot_frame(src, k / (n - 1), mode).tobytes())
    p.stdin.close(); p.wait()
