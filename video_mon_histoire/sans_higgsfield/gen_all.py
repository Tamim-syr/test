import json, sys, torch
from diffusers import AutoPipelineForText2Image
torch.set_num_threads(4)
pipe = AutoPipelineForText2Image.from_pretrained("stabilityai/sd-turbo", torch_dtype=torch.float32)
pipe.set_progress_bar_config(disable=True)
P = json.load(open("prompts.json"))
STY = "white ink scratchboard engraving on pure black background, hand-drawn crosshatching, high contrast black and white illustration, "
import os; os.makedirs("raw", exist_ok=True)
for k, p in P.items():
    p = p.split(". Lower")[0].split(". Fills")[0].split(". Throne")[0].split(". Explosion")[0].split(". Figure")[0]
    for s in range(3):
        g = torch.Generator().manual_seed(100 + s)
        im = pipe(STY + p, num_inference_steps=3, guidance_scale=0.0, width=512, height=896, generator=g).images[0]
        im.save(f"raw/a{k}_{s}.png"); print(k, s, flush=True)
