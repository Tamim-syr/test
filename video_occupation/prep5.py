# Zones pour la vidéo « occupation israélienne » : 4 = Golan occupé (hachuré), 5 = zone envahie depuis déc. 2024 (approx.)
import math, json, numpy as np, cv2
z, X0, X1, Y0, Y1 = map(int, open("tiles/extent.txt").read().split())
S = 4096 / ((X1 - X0 + 1) * 256); SH = int((Y1 - Y0 + 1) * 256 * S)
def px(lon, lat, s=.5):
    r = math.radians(lat); gx = (lon + 180) / 360 * 2**z; gy = (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * 2**z
    return ((gx - X0) * 256 * S * s, (gy - Y0) * 256 * S * s)
zone = np.zeros((SH // 2, 2048), np.uint8)
def poly(pts, v): cv2.fillPoly(zone, [np.array([px(a, b) for a, b in pts], np.int32)], v)
BUF = [(35.80, 33.43), (35.97, 33.39), (35.98, 33.26), (35.96, 33.12), (36.01, 33.00), (35.98, 32.86), (35.93, 32.74), (35.85, 32.69), (35.77, 32.71),
       (35.86, 32.85), (35.93, 33.00), (35.88, 33.12), (35.86, 33.25), (35.82, 33.33)]
GOLAN = json.load(open("geo.json"))["golan"]
poly(BUF, 5)
cv2.fillPoly(zone, [(np.array(GOLAN) * .5).astype(np.int32)], 4)
ctrl = np.dstack([zone * 50, np.full_like(zone, 252), np.zeros_like(zone)])
cv2.imwrite("ctrl5.png", ctrl[..., ::-1]); print((zone == 5).sum(), (zone == 4).sum())
