# Mosaïque satellite + raster des zones de contrôle (27 nov. -> 8 déc. 2024) en Web Mercator
import math, json, numpy as np, cv2
z, X0, X1, Y0, Y1 = map(int, open("tiles/extent.txt").read().split())
T = 256; W, H = (X1 - X0 + 1) * T, (Y1 - Y0 + 1) * T
mos = np.zeros((H, W, 3), np.uint8)
for x in range(X0, X1 + 1):
    for y in range(Y0, Y1 + 1):
        im = cv2.imread(f"tiles/{z}_{x}_{y}.jpg")
        if im is not None: mos[(y - Y0) * T:(y - Y0 + 1) * T, (x - X0) * T:(x - X0 + 1) * T] = im
S = 4096 / W; SW, SH = 4096, int(H * S)
cv2.imwrite("sat.jpg", cv2.resize(mos, (SW, SH), interpolation=cv2.INTER_AREA), [cv2.IMWRITE_JPEG_QUALITY, 92])
def px(lon, lat, s=1.0):   # lon/lat -> pixel de la mosaïque (échelle s)
    r = math.radians(lat)
    gx = (lon + 180) / 360 * 2**z; gy = (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * 2**z
    return ((gx - X0) * T * S * s, (gy - Y0) * T * S * s)
CW, CH = SW // 2, SH // 2      # raster de contrôle
def poly(m, pts, val):
    cv2.fillPoly(m, [np.array([px(a, b, .5) for a, b in pts], np.int32)], val)
C = json.load(open("countries.json")); syr = [c for c in C if c["id"] == "SYR"][0]["geometry"]["coordinates"][0]
zone = np.zeros((CH, CW), np.uint8); poly(zone, syr, 1)   # 1 = régime
inside = zone == 1
def paint(pts, v):
    m = np.zeros_like(zone); poly(m, pts, 1); zone[(m == 1) & inside] = v
SDF = [(37.98,36.95),(42.6,37.4),(42.4,36.4),(41.3,35.6),(40.9,35.12),(40.55,34.85),(40.35,34.82),(40.1,35.02),(39.75,35.3),(39.2,35.62),(38.55,35.95),(38.25,36.35),(38.08,36.6)]
MANBIJ = [(37.7,36.42),(37.95,36.8),(38.2,36.7),(38.25,36.4),(37.9,36.33)]
IDLIB = [(35.9,35.9),(36.17,35.83),(36.3,35.62),(36.45,35.58),(36.62,35.72),(36.78,35.86),(36.97,35.98),(37.02,36.12),(36.95,36.2),(36.8,36.26),(36.62,36.24),(36.45,36.3),(36.2,36.4),(35.9,36.3)]
SNA = [(36.4,36.5),(36.55,36.95),(37.2,36.85),(38.05,36.95),(38.05,36.7),(37.95,36.55),(37.6,36.36),(37.3,36.38),(37.05,36.42),(36.9,36.36),(36.62,36.3)]
SNA2 = [(38.85,36.95),(40.2,37.0),(40.18,36.55),(38.9,36.6)]
paint(SDF, 3); paint(MANBIJ, 3); paint(IDLIB, 2); paint(SNA, 2); paint(SNA2, 2)
GOLAN = [(35.62,32.68),(35.66,32.76),(35.62,32.9),(35.63,33.0),(35.68,33.12),(35.75,33.27),(35.82,33.33),(35.86,33.25),(35.88,33.12),(35.93,33.0),(35.86,32.85),(35.84,32.75),(35.77,32.71),(35.69,32.69)]
gm = np.zeros_like(zone); poly(gm, GOLAN, 1); zone[gm == 1] = 4
# temps de libération (jours depuis le 27 nov.) : fronts qui avancent depuis Idlib, puis le sud, puis le reste
deg = (px(1, 0, .5)[0] - px(0, 0, .5)[0])                  # pixels par degré
reg = zone == 1
def front(seed_mask, t0, v):
    d = cv2.distanceTransform((~seed_mask).astype(np.uint8), cv2.DIST_L2, 5) / deg
    return t0 + d / v
def pt(lon, lat, r=.06):
    m = np.zeros_like(zone, bool); x, y = px(lon, lat, .5); cv2.circle(m.view(np.uint8), (int(x), int(y)), int(r * deg), 1, -1); return m
t = front(zone == 2, 0.0, 0.075)
for (lon, lat, t0, v) in [(36.75, 35.13, 8.6, 0.22), (36.72, 34.73, 10.6, 0.35), (36.10, 32.62, 9.2, 0.42), (36.57, 32.71, 9.5, 0.4),
                          (36.29, 33.51, 11.2, 0.6), (35.79, 35.52, 11.6, 0.5), (35.89, 34.89, 11.8, 0.5)]:
    t = np.minimum(t, np.where(True, front(pt(lon, lat), t0, v), 99))
g11 = ((t <= 11.3) & reg) | (zone == 2)
t = np.minimum(t, front(g11, 11.3, 1.3))   # le reste tombe en une journée
t = np.where(reg, np.clip(t, 0, 13.5), 14.0)
print('max', round(float(t[reg].max()), 2))
ctrl = np.dstack([zone * 50, (t * 18).astype(np.uint8), np.zeros_like(zone)]).astype(np.uint8)
cv2.imwrite("ctrl.png", ctrl[..., ::-1])
for n, ll in [("Alep", (37.16, 36.20)), ("Hama", (36.75, 35.13)), ("Homs", (36.72, 34.73)), ("Damas", (36.29, 33.51)), ("Deraa", (36.10, 32.62))]:
    x, y = px(*ll, .5); print(n, round(float(t[int(y), int(x)]), 1))
geo = {"W": SW, "H": SH, "countries": {c["id"]: [[list(px(a, b)) for a, b in ring] for ring in (c["geometry"]["coordinates"] if c["geometry"]["type"] == "Polygon" else [p[0] for p in c["geometry"]["coordinates"]])] for c in C},
       "golan": [list(px(a, b)) for a, b in GOLAN],
       "cities": {n: list(px(*ll)) for n, ll in {"Idlib": (36.63, 35.93), "Alep": (37.16, 36.20), "Hama": (36.75, 35.13), "Homs": (36.72, 34.73), "Damas": (36.29, 33.51), "Deraa": (36.10, 32.62), "Lattaquié": (35.79, 35.52), "Palmyre": (38.27, 34.56), "Moscou": (37.6, 55.75), "Beyrouth": (35.5, 33.89)}.items()}}
json.dump(geo, open("geo.json", "w")); print(SW, SH)
# frontières : R = Syrie (trait + halo), G = pays voisins
bd = np.zeros((SH, SW, 3), np.uint8)
for c in C:
    rings = c["geometry"]["coordinates"] if c["geometry"]["type"] == "Polygon" else [p[0] for p in c["geometry"]["coordinates"]]
    for ring in rings:
        pts = np.array([px(a, b) for a, b in ring], np.float64) * 16
        if c["id"] == "SYR":
            cv2.polylines(bd, [pts.astype(np.int32)], True, (0, 0, 255), 6, cv2.LINE_AA, 4)
            cv2.polylines(bd, [pts.astype(np.int32)], True, (255, 0, 0), 26, cv2.LINE_AA, 4)
        else:
            cv2.polylines(bd, [pts.astype(np.int32)], True, (0, 255, 0), 3, cv2.LINE_AA, 4)
bd[..., 0] = cv2.GaussianBlur(bd[..., 0], (0, 0), 10)
cv2.imwrite("border.png", bd)
