# Piste bruitages v2 : whooshes synthétisés + vrais sons Kenney (CC0) calés sur l'image
import subprocess, numpy as np, wave, glob
SR = 44100
def ogg(name):
    f = glob.glob(f"sfx_dl/**/{name}.ogg", recursive=True)[0]
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-f", "s16le", "-ac", "2", "-ar", str(SR), "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.int16).reshape(-1, 2).astype(np.float32) / 32768
w = wave.open("sfx.wav"); base = np.frombuffer(w.readframes(w.getnframes()), np.int16).reshape(-1, 2).astype(np.float32) / 32768
out = base.copy()
HITS = [  # (temps, son, volume)
    (1.22, "impactSoft_medium_001", 0.8),    # 26 ANS
    (2.50, "scratch_002", 0.7),              # AL-JAHESH barré
    (3.80, "impactPunch_heavy_000", 1.0),    # Hafez s'écrase
    (3.86, "impactGlass_heavy_002", 0.6),    # le portrait se fissure
    (6.50, "impactSoft_heavy_001", 0.8),     # MORT.
    (7.10, "impactSoft_medium_003", 0.6),    # 2000
    (12.22, "impactSoft_medium_002", 0.8),   # 24 ANS
    (22.58, "impactSoft_medium_004", 0.8),   # 2024
    (33.20, "scratch_004", 0.7),             # INTOUCHABLE barré
    (33.52, "impactPunch_medium_002", 0.9),  # EXILÉ
    (33.95, "impactGlass_light_001", 0.5),   # éclats de verre
    (40.70, "impactSoft_medium_000", 0.6),   # NI DU PÈRE
    (41.50, "impactSoft_medium_001", 0.6),   # NI DU FILS
    (43.24, "impactSoft_heavy_002", 0.8),    # SYRIEN
]
for t, name, v in HITS:
    s = ogg(name) * v; i = int(t * SR)
    out[i:i + len(s)] += s[: len(out) - i]
pcm = (np.clip(out, -1, 1) * 32767).astype(np.int16)
with wave.open("sfx_v2.wav", "wb") as f:
    f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR); f.writeframes(pcm.tobytes())
print("ok", len(HITS), "bruitages")
