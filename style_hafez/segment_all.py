from PIL import Image
import numpy as np
from segment import find, cut
JOBS = [("img/s10.png", "a flag.", "s10_flag"), ("img/s10.png", "raised hand.", "s10_hands"),
        ("img/s04.png", "fire.", "s04_fire"), ("img/s04.png", "smoke.", "s04_smoke"),
        ("img/s03.png", "fire.", "s03_fire"), ("img/s09.png", "pigeon.", "s09_pigeons"),
        ("img/s01.png", "paper sheet.", "s01_pages"), ("img/s05.png", "raised fist.", "s05_fists"),
        ("img/s08.png", "window.", "s08_window")]
for src, text, name in JOBS:
    img = Image.open(src).convert("RGB")
    boxes, scores = find(img, text, thr=0.28)
    m = cut(img, boxes)
    Image.fromarray(m).save(f"masks/{name}.png")
    print(name, len(boxes), [round(s, 2) for s in scores], round(float((m > 0).mean()), 3))
