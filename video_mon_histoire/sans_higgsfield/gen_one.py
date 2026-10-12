import sys, torch
from diffusers import AutoPipelineForText2Image
torch.set_num_threads(4)
pipe = AutoPipelineForText2Image.from_pretrained("stabilityai/sd-turbo", torch_dtype=torch.float32); pipe.set_progress_bar_config(disable=True)
STY = "white ink scratchboard engraving on pure black background, hand-drawn crosshatching, high contrast black and white illustration, "
name, prompt, n = sys.argv[1], sys.argv[2], int(sys.argv[3])
for s in range(n):
    im = pipe(STY + prompt, num_inference_steps=3, guidance_scale=0.0, width=512, height=896, generator=torch.Generator().manual_seed(200 + s)).images[0]
    im.save(f"raw/{name}_x{s}.png"); print(s, flush=True)
