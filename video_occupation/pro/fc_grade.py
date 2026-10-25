# Étalonnage de la caméra dans FilmCraft (Lumetri) : contraste, peau chaude, ombres denses, légère vignette
import json, os, sys
from fcmcp import MCP
V = "/root/.claude/uploads/478ae8c0-2492-55cb-9e31-616ef7cceb66/63d9e9ba-copy_8D0B5AAF-58E2-43FC-B8F5-7144FD6FFE0E.mov"
m = MCP()
def run(id, params=None):
    r = m.req("tools/call", {"name": "command_run", "arguments": {"id": id, "params": params or {}}}); return r["result"]["content"][0]["text"]
def tool(n, a): return m.req("tools/call", {"name": n, "arguments": a})["result"]["content"][0]["text"]
run("file.newProject", {"name": "cam"}); tool("media_import", {"paths": [V]})
run("file.newSequence", {"name": "cam", "fps": 30, "width": 1280, "height": 720, "fromItem": 1})
seq = json.loads(tool("sequence_inspect", {})); cid = seq["video"][0]["items"][0]["clip"]
print(run("effects.apply", {"clips": [cid], "effect": "lumetri"})[:100])
P = {"temperature": 6, "tint": 2, "exposure": 0.1, "contrast": 22, "highlights": -18, "shadows": -6, "whites": 10, "blacks": -18, "saturation": 104, "vibrance": 14,
     "sharpen": 18, "vignette_on": True, "vignette_amount": -0.9, "vignette_midpoint": 45, "vignette_feather": 60}
for k, v in P.items(): print(k, run("effects.setParam", {"clip": cid, "effect": "lumetri", "param": k, "value": v})[:80].replace("\n", " "))
if len(sys.argv) > 1 and sys.argv[1] == "test":
    for t in [9.0, 27.0]: print(run("file.exportMedia", {"path": os.path.abspath(f"grade_{t}.png"), "format": "png", "range": "custom", "startSeconds": t, "endSeconds": t + 0.04, "wait": True})[:80])
else:
    print(run("file.exportMedia", {"path": os.path.abspath("face_graded.mov"), "format": "prores", "proresProfile": "hq", "audio": False, "wait": True})[:300])
