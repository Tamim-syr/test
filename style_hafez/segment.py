# Trouve un élément par son nom (Grounding DINO tiny, Apache-2.0) et le découpe au pixel (SAM ViT-B, Apache-2.0).
# Usage : python3 segment.py img/s06.png "an airplane." masks/s06_plane.png
import sys, numpy as np, torch
from PIL import Image
from transformers import AutoProcessor, AutoModelForZeroShotObjectDetection, SamModel, SamProcessor

_m = {}
def models():
    if not _m:
        _m["dp"] = AutoProcessor.from_pretrained("IDEA-Research/grounding-dino-tiny")
        _m["dm"] = AutoModelForZeroShotObjectDetection.from_pretrained("IDEA-Research/grounding-dino-tiny")
        _m["sp"] = SamProcessor.from_pretrained("facebook/sam-vit-base")
        _m["sm"] = SamModel.from_pretrained("facebook/sam-vit-base")
    return _m

def find(img, text, thr=0.30):
    m = models()
    inp = m["dp"](images=img, text=text, return_tensors="pt")
    with torch.no_grad():
        out = m["dm"](**inp)
    res = m["dp"].post_process_grounded_object_detection(out, inp.input_ids, threshold=thr, text_threshold=0.25, target_sizes=[img.size[::-1]])[0]
    return [b.tolist() for b in res["boxes"]], [float(s) for s in res["scores"]]

def cut(img, boxes):
    m = models()
    if not boxes:
        return np.zeros(img.size[::-1], np.uint8)
    inp = m["sp"](img, input_boxes=[boxes], return_tensors="pt")
    with torch.no_grad():
        out = m["sm"](**inp, multimask_output=False)
    masks = m["sp"].image_processor.post_process_masks(out.pred_masks, inp["original_sizes"], inp["reshaped_input_sizes"])[0]
    return (masks.any(dim=0)[0].numpy() * 255).astype(np.uint8)

if __name__ == "__main__":
    img = Image.open(sys.argv[1]).convert("RGB")
    boxes, scores = find(img, sys.argv[2])
    print(sys.argv[2], [[round(v) for v in b] for b in boxes], [round(s, 2) for s in scores])
    Image.fromarray(cut(img, boxes)).save(sys.argv[3])
