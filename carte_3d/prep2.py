# v2 : fond satellite large (Moyen-Orient), relief (Mapzen terrarium), étendues en coordonnées de la carte détaillée
import math, json, os, subprocess, numpy as np, cv2, concurrent.futures as cf
z9, X0, X1, Y0, Y1 = map(int, open("tiles/extent.txt").read().split())
S9 = 4096 / ((X1 - X0 + 1) * 256)
def gxy(lon, lat, z):
    r = math.radians(lat); return (lon + 180) / 360 * 2**z, (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * 2**z
def to_det(gx, gy, z):   # coordonnées tuile (zoom z) -> pixels de la carte détaillée
    k = 2 ** (z9 - z); return ((gx * k - X0) * 256 * S9, (gy * k - Y0) * 256 * S9)
def fetch(url, f):
    if not os.path.exists(f) or os.path.getsize(f) < 500: subprocess.run(["curl", "-s", "--max-time", "40", "-o", f, url])
def mosaic(z, lon0, lon1, lat0, lat1, kind, out_w):
    a, b = gxy(lon0, lat1, z); c, d = gxy(lon1, lat0, z); xa, xb, ya, yb = int(a), int(c), int(b), int(d)
    os.makedirs(f"tiles_{kind}", exist_ok=True); jobs = []
    for x in range(xa, xb + 1):
        for y in range(ya, yb + 1):
            u = (f"https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg" if kind == "sat"
                 else f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png")
            jobs.append((u, f"tiles_{kind}/{z}_{x}_{y}.{'jpg' if kind == 'sat' else 'png'}"))
    with cf.ThreadPoolExecutor(8) as ex: list(ex.map(lambda j: fetch(*j), jobs))
    W, H = (xb - xa + 1) * 256, (yb - ya + 1) * 256
    m = np.zeros((H, W, 3), np.uint8) if kind == "sat" else np.zeros((H, W), np.float32)
    for x in range(xa, xb + 1):
        for y in range(ya, yb + 1):
            im = cv2.imread(f"tiles_{kind}/{z}_{x}_{y}.{'jpg' if kind == 'sat' else 'png'}")
            if im is None: continue
            if kind == "sat": m[(y - ya) * 256:(y - ya + 1) * 256, (x - xa) * 256:(x - xa + 1) * 256] = im
            else:
                h = im[..., 2].astype(np.float32) * 256 + im[..., 1] + im[..., 0] / 256 - 32768
                m[(y - ya) * 256:(y - ya + 1) * 256, (x - xa) * 256:(x - xa + 1) * 256] = h
    oh = int(H * out_w / W); m = cv2.resize(m, (out_w, oh), interpolation=cv2.INTER_AREA)
    ext = list(to_det(xa, ya, z)) + list(to_det(xb + 1, yb + 1, z))
    return m, ext
# fond large : de la Libye à l'Iran
bg, bge = mosaic(7, 8, 72, 10, 54, "sat", 4096); cv2.imwrite("bg.jpg", bg, [cv2.IMWRITE_JPEG_QUALITY, 90])
bgh, bghe = mosaic(5, 8, 72, 10, 54, "h", 1024)
# relief de la carte détaillée : même emprise que sat.jpg (z9) -> terrarium z8
det_lon0 = X0 / 2**z9 * 360 - 180; det_lon1 = (X1 + 1) / 2**z9 * 360 - 180
lat = lambda gy, z: math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * gy / 2**z))))
dh, dhe = mosaic(8, det_lon0 + .01, det_lon1 - .01, lat(Y1 + 1, z9) + .01, lat(Y0, z9) - .01, "h", 2048)
# recadre le relief exactement sur l'emprise de sat.jpg
SW, SH = 4096, int((Y1 - Y0 + 1) * 256 * S9)
sx = dh.shape[1] / (dhe[2] - dhe[0]); sy = dh.shape[0] / (dhe[3] - dhe[1])
M = np.float32([[sx, 0, -dhe[0] * sx], [0, sy, -dhe[1] * sy]])
dh2 = cv2.warpAffine(dh, np.float32([[1 / sx * sx, 0, 0], [0, 1, 0]]), (1, 1))  # (non utilisé)
mx, my = np.meshgrid(np.linspace(0, SW, 2048), np.linspace(0, SH, int(2048 * SH / SW)))
dhc = cv2.remap(dh, ((mx - dhe[0]) * sx).astype(np.float32), ((my - dhe[1]) * sy).astype(np.float32), cv2.INTER_LINEAR)
def enc(h): return np.clip(h, 0, 4000) / 4000 * 255
dhc = cv2.GaussianBlur(dhc, (0, 0), 1.2); bgh = cv2.GaussianBlur(bgh, (0, 0), 1.0)
cv2.imwrite("height.png", enc(dhc).astype(np.uint8)); cv2.imwrite("bg_height.png", enc(bgh).astype(np.uint8))
g = json.load(open("geo.json")); g["bg"] = bge; g["bgh"] = bghe; g["hmax"] = 4000
json.dump(g, open("geo.json", "w")); print("bg", bge, "bgh", bghe, dhc.shape, float(dhc.max()))
