# Photo -> gravure « carte à gratter » blanc sur noir (traits + hachures selon la lumière).
# Usage : python3 engrave.py in.png out.png [échelle] [angle_hachures]
import sys
import cv2
import numpy as np

def engrave(img, scale=4, angle=35, spacing=7, seed=1, lo=0.30, mask=None, ec=6, eb=15, clahe=2.0):
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    g = cv2.resize(g, None, fx=scale, fy=scale, interpolation=cv2.INTER_LANCZOS4)
    g = cv2.bilateralFilter(g, 9, 40, 9)
    g = cv2.createCLAHE(clahe, (8, 8)).apply(g)
    h, w = g.shape
    t = g.astype(np.float32) / 255.0

    # contours : traits blancs nets
    blur = cv2.GaussianBlur(g, (0, 0), 1.6)
    edges = cv2.adaptiveThreshold(blur, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY_INV, eb, ec)
    edges = cv2.morphologyEx(edges, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))

    # hachures : plus c'est clair, plus le trait blanc est épais ; deuxième passe croisée pour les hautes lumières
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    rng = np.random.default_rng(seed)
    wob = cv2.resize(rng.normal(0, 1, (h // 40 + 2, w // 40 + 2)).astype(np.float32), (w, h), interpolation=cv2.INTER_CUBIC) * 2.5
    def hatch(a, sp):
        r = np.deg2rad(a)
        u = xx * np.cos(r) + yy * np.sin(r) + wob
        return np.abs(((u / sp) % 1.0) - 0.5) * 2  # 0 au centre du trait, 1 entre deux traits
    h1 = hatch(angle, spacing)
    h2 = hatch(angle + 70, spacing * 1.3)
    tone = np.clip((t - lo) / (0.95 - lo), 0, 1) ** 0.8
    white = (h1 < tone * 0.95).astype(np.float32)
    white = np.maximum(white, (h2 < np.clip((tone - 0.55) * 1.6, 0, 1)).astype(np.float32))
    white[tone > 0.93] = 1.0
    out = np.maximum(white * 255, edges.astype(np.float32))
    if mask is not None:
        m = cv2.resize(mask, (w, h)).astype(np.float32) / 255
        m = cv2.GaussianBlur(m, (0, 0), 3)
        # contour blanc épais autour du sujet détouré, comme un trait d'encre
        ring = cv2.dilate((m > 0.5).astype(np.uint8), np.ones((7, 7), np.uint8)) - (m > 0.5).astype(np.uint8)
        out = out * m
        out = np.maximum(out, ring.astype(np.float32) * 255)
    out = cv2.GaussianBlur(out, (0, 0), 0.7)
    return np.clip(out, 0, 255).astype(np.uint8)

if __name__ == "__main__":
    im = cv2.imread(sys.argv[1])
    sc = float(sys.argv[3]) if len(sys.argv) > 3 else 4
    ang = float(sys.argv[4]) if len(sys.argv) > 4 else 35
    cv2.imwrite(sys.argv[2], engrave(im, sc, ang))
