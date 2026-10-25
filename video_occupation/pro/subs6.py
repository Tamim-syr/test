# Sous-titres propres (ASS, Inter) synchronisés au mot, mots-clés en rouge
import json, re
W = json.load(open("words.json"))
toks = []
for w in W:
    t = w["w"].strip()
    if toks and (t.startswith("'") or t.startswith("-") or toks[-1]["t"].endswith("'")):
        toks[-1]["t"] += t; toks[-1]["e"] = w["e"]
    else: toks.append({"t": t, "s": w["s"], "e": w["e"]})
FIX = {"l'Ouest": "l'ouest", "Que": "Qu'Allah", "ordonnés": "ordonné", "Bi": "Fi", "amana": "amanillah.", "toutes": "toutes"}
out = []
i = 0
while i < len(toks):
    t = toks[i]
    if t["t"] == "son" and i + 1 < len(toks) and toks[i + 1]["t"].startswith("froid"):
        out.append({"t": "sang-froid,", "s": t["s"], "e": toks[i + 1]["e"]}); i += 2; continue
    if t["t"] == "Que" and toks[i + 1]["t"] == "Allah":
        out.append({"t": "Qu'Allah", "s": t["s"], "e": toks[i + 1]["e"]}); i += 2; continue
    if t["t"] == "Allah." and out and out[-1]["t"] == "amanillah.": i += 1; continue
    t = dict(t); t["t"] = FIX.get(t["t"], t["t"]); out.append(t); i += 1
out = [o for o in out if o["t"] not in ("?",)]
for o in out:
    if o["t"] == "nouveau": o["t"] = "nouveau ?"
    if o["t"] == "bon": o["t"] = "bon ?"
# découpe en blocs courts
blocks, cur = [], []
for o in out:
    cur.append(o)
    txt = " ".join(c["t"] for c in cur)
    if re.search(r"[.,?!]$", o["t"]) or len(txt) > 40:
        blocks.append(cur); cur = []
if cur: blocks.append(cur)
KEY = re.compile(r"(?i)^(tué|terroriste|handicapé|sang-froid|invasion|bombarde|tue|rien|limites|injustice|morts|vivant|condamner)")
def ts(x): h = int(x // 3600); m = int(x % 3600 // 60); s = x % 60; return f"{h}:{m:02d}:{s:05.2f}"
hdr = """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,Inter SemiBold,52,&H00EEF2F4,&H00EEF2F4,&H00000000,&H64000000,0,0,0,0,100,100,0,0,1,0,2.2,2,200,200,92,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
lines = []
for k, b in enumerate(blocks):
    s = b[0]["s"]; e = max(b[-1]["e"] + .25, s + .8)
    if k + 1 < len(blocks): e = min(e, blocks[k + 1][0]["s"] - .02)
    txt = " ".join(("{\\c&H004F4DFF&}" + c["t"] + "{\\c&H00EEF2F4&}") if KEY.match(c["t"]) else c["t"] for c in b)
    lines.append(f"Dialogue: 0,{ts(s)},{ts(e)},Sub,,0,0,0,,{{\\fad(110,90)\\blur0.6}}{txt}")
open("subs6.ass", "w").write(hdr + "\n".join(lines) + "\n")
print(len(blocks)); print("\n".join(" ".join(c["t"] for c in b) for b in blocks))
