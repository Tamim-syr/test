# Carte de profondeur (Depth Anything V2 Small, Apache-2.0) pour une parallaxe 3D réelle
import sys, numpy as np
from PIL import Image
from transformers import pipeline
pipe = pipeline("depth-estimation", model="depth-anything/Depth-Anything-V2-Small-hf", device="cpu")
for src in sys.argv[1:]:
    im = Image.open(src).convert("RGB")
    d = np.asarray(pipe(im)["predicted_depth"].squeeze().numpy(), np.float32)
    d = (d - d.min()) / (d.max() - d.min() + 1e-6)
    Image.fromarray((d * 255).astype(np.uint8)).resize(im.size, Image.BICUBIC).save(src.replace(".png", "_depth.png"))
    print("ok", src)
