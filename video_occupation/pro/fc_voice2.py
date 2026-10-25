# Voix via Essential Sound de FilmCraft : type Dialogue, préréglage « Podcast Voice » + débruitage + anti-réverbération, loudness auto
import json, os
from fcmcp import MCP
m = MCP()
def run(id, params=None):
    r = m.req("tools/call", {"name": "command_run", "arguments": {"id": id, "params": params or {}}}); return r["result"]["content"][0]["text"]
def tool(n, a): return m.req("tools/call", {"name": n, "arguments": a})["result"]["content"][0]["text"]
run("file.newProject", {"name": "voix"}); tool("media_import", {"paths": [os.path.abspath("voice_raw.wav")]})
run("file.newSequence", {"name": "voix", "fps": 30, "sampleRate": 48000, "fromItem": 1})
cid = json.loads(tool("sequence_inspect", {}))["audio"][0]["items"][0]["clip"]
print(run("essentialSound.setType", {"clips": [cid], "type": "dialogue"})[:120])
print(run("essentialSound.applyPreset", {"clips": [cid], "preset": "Podcast Voice", "type": "dialogue"})[:120])
print(run("essentialSound.set", {"clips": [cid], "key": "repair.noise.on", "value": True, "values": {"repair.noise.amount": 5.0, "repair.reverb.on": True, "repair.reverb.amount": 4.0}})[:200])
print(run("essentialSound.autoMatch", {"clips": [cid], "target": -16})[:200])
print(run("essentialSound.inspect", {"clips": [cid]})[:900])
print(run("file.exportMedia", {"path": os.path.abspath("voice_fc2.wav"), "format": "wav", "wait": True})[:120])
