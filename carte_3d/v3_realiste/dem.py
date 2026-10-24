# Relief Copernicus GLO-30 (lecture des aperçus COG à distance) -> height.png à l'emprise exacte de sat.jpg
import os, math, numpy as np, cv2, rasterio, concurrent.futures as cf
from rasterio.enums import Resampling
os.environ.setdefault("CURL_CA_BUNDLE", "/root/.ccr/ca-bundle.crt"); os.environ["GDAL_DISABLE_READDIR_ON_OPEN"] = "EMPTY_DIR"
z9, X0, X1, Y0, Y1 = map(int, open("tiles/extent.txt").read().split())
lon0, lon1 = X0 / 2**z9 * 360 - 180, (X1 + 1) / 2**z9 * 360 - 180
lat = lambda gy: math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * gy / 2**z9))))
latN, latS = lat(Y0), lat(Y1 + 1)
P = 160                                      # pixels par degré dans la mosaïque géographique
LA0, LA1, LO0, LO1 = math.floor(latS), math.ceil(latN), math.floor(lon0), math.ceil(lon1)
geo = np.zeros(((LA1 - LA0) * P, (LO1 - LO0) * P), np.float32)
def tile(la, lo):
    ns, ew = ("N" if la >= 0 else "S"), ("E" if lo >= 0 else "W")
    name = f"Copernicus_DSM_COG_10_{ns}{abs(la):02d}_00_{ew}{abs(lo):03d}_00_DEM"
    try:
        with rasterio.open(f"/vsicurl/https://copernicus-dem-30m.s3.amazonaws.com/{name}/{name}.tif") as ds:
            a = ds.read(1, out_shape=(P, P), resampling=Resampling.average).astype(np.float32)
    except Exception:
        return la, lo, None
    return la, lo, a
jobs = [(la, lo) for la in range(LA0, LA1) for lo in range(LO0, LO1)]
with cf.ThreadPoolExecutor(12) as ex:
    for la, lo, a in ex.map(lambda j: tile(*j), jobs):
        if a is not None:
            r = (LA1 - 1 - la) * P; c = (lo - LO0) * P; geo[r:r + P, c:c + P] = a
print("tuiles", len(jobs), "max", geo.max())
# reprojection en Web Mercator sur la grille de height.png (2048 de large)
W = 2048; SH = int(2048 * (Y1 - Y0 + 1) / (X1 - X0 + 1))
xs = np.linspace(X0, X1 + 1, W, endpoint=False) + (X1 + 1 - X0) / W / 2
ys = np.linspace(Y0, Y1 + 1, SH, endpoint=False) + (Y1 + 1 - Y0) / SH / 2
lons = xs / 2**z9 * 360 - 180; lats = np.degrees(np.arctan(np.sinh(np.pi * (1 - 2 * ys / 2**z9))))
mx = ((lons - LO0) * P).astype(np.float32); my = ((LA1 - lats) * P).astype(np.float32)
mxg, myg = np.meshgrid(mx, my)
h = cv2.remap(geo, mxg, myg, cv2.INTER_LINEAR)
cv2.imwrite("height.png", (np.clip(h, 0, 4000) / 4000 * 255).astype(np.uint8)); print(h.shape, float(h.max()))
