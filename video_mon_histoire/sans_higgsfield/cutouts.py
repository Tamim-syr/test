# Découpes automatiques pour EffectCraft + position des épingles de marionnette (à partir des masques)
import json, numpy as np, cv2
from PIL import Image
from segment import find, cut

def best(img, text, thr=0.25, pick=None):
    boxes, scores = find(img, text, thr)
    if not boxes: return None
    c = list(zip(boxes, scores))
    if pick: c = [x for x in c if pick(x[0])] or c
    return max(c, key=lambda x: x[1])[0]

def figure(name, text):
    img = Image.open(f"img/{name}.png").convert("RGB"); im = cv2.imread(f"img/{name}.png"); g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
    b = best(img, text, pick=lambda b: (b[3] - b[1]) > 400 and (b[2] - b[0]) < 800)
    m = cut(img, [b]); m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((11, 11), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    if n > 1: m = np.where(lab == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA]), 255, 0).astype(np.uint8)
    cv2.imwrite(f"masks/{name}_fig.png", m)
    cv2.imwrite(f"ec/{name}_fig.png", np.dstack([g, g, g, cv2.GaussianBlur(m, (0, 0), 1.2)]))
    cv2.imwrite(f"ec/{name}_bg.png", cv2.inpaint(im, cv2.dilate(m, np.ones((45, 45), np.uint8)), 15, cv2.INPAINT_TELEA))
    ys, xs = np.where(m > 0); y0, y1 = ys.min(), ys.max(); H = y1 - y0
    def row(f): r = xs[ys == int(y0 + H * f)]; return r if len(r) else xs
    cx = int(np.median(row(0.40)))
    up = ys < y0 + H * 0.45
    k = np.argmax(np.abs(xs[up] - cx) + (y0 + H * 0.45 - ys[up]) * 0.6)                  # main levée : point extrême en haut
    hand = (int(xs[up][k]), int(ys[up][k]))
    near = np.abs(xs - cx) < H * 0.06; head = (cx, int(ys[near].min() + H * 0.05))
    sh = (int((hand[0] + cx) / 2 * 0.3 + cx * 0.7), int(y0 + H * 0.22))
    elbow = (int((hand[0] + sh[0]) / 2), int((hand[1] + sh[1]) / 2))
    hip = (int(row(0.55).mean()), int(y0 + H * 0.55))
    bot = ys > y1 - 25; f1 = (int(xs[bot].min() + 15), int(y1 - 10)); f2 = (int(xs[bot].max() - 15), int(y1 - 10))
    return dict(hand=hand, elbow=elbow, head=head, shoulder=sh, hip=hip, foot1=f1, foot2=f2, bbox=[int(xs.min()), int(y0), int(xs.max()), int(y1)])

pins = {"a5": figure("a5", "a man."), "a12": figure("a12", "a man.")}
# a4 : explosion (couche qui se tord + glow) et fumées
img = Image.open("img/a4.png").convert("RGB"); im = cv2.imread("img/a4.png"); g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY); h, w = g.shape
yy, xx = np.mgrid[0:h, 0:w]
b = [130, 0, 1070, 1390]   # colonne de l'explosion
x0, y0, x1, y1 = b
def layer(nm, zone, thr):
    mm = (zone & (g > thr)).astype(np.uint8) * 255
    mm = cv2.GaussianBlur(cv2.dilate(mm, np.ones((7, 7), np.uint8)), (0, 0), 4)
    cv2.imwrite(f"ec/{nm}.png", np.dstack([g, g, g, mm]))
layer("a4_burst", (xx > x0) & (xx < x1) & (yy > y0) & (yy < y1), 120)
layer("a4_smoke", (yy < y0 + (y1 - y0) * 0.3) & ((xx < x0 + 40) | (xx > x1 - 40) | (yy < y0)), 90)
cv2.imwrite("ec/a4.png", im)
pins["a4"] = [int((x0 + x1) / 2), int((y0 + y1) / 2)]
# a8 : nuage toxique
img = Image.open("img/a8.png").convert("RGB"); im8 = cv2.imread("img/a8.png"); g8 = cv2.cvtColor(im8, cv2.COLOR_BGR2GRAY)
b = best(img, "smoke cloud. fog.")
c = cut(img, [b]) if b else (np.mgrid[0:h, 0:w][0] > h * .45).astype(np.uint8) * 255
cv2.imwrite("ec/a8.png", im8); cv2.imwrite("ec/a8_cloud.png", np.dstack([g8, g8, g8, cv2.GaussianBlur(c, (0, 0), 4)]))
cv2.imwrite("ec/a10.png", cv2.imread("img/a10.png"))
json.dump(pins, open("pins.json", "w"), indent=1); print(json.dumps(pins))
