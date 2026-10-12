# Bruitages : whooshes sur chaque enchaînement (+ grondement pour les plongées) et sons Kenney (CC0) sur les mots forts
import sys, glob, subprocess, wave, numpy as np
sys.path.insert(0, "../proj")
SR = 44100
def whoosh(dur, seed, f0=250, f1=2600, f2=500):
    """Bruit filtré en bande glissante (montée puis descente), enveloppe en cloche."""
    r = np.random.default_rng(seed)
    n = int(dur * SR); x = r.normal(0, 1, n)
    win, hop = 2048, 512
    out = np.zeros(n + win); wsum = np.zeros(n + win)
    hann = np.hanning(win)
    freqs = np.fft.rfftfreq(win, 1 / SR)
    for st in range(0, n, hop):
        seg = np.zeros(win); chunk = x[st:st + win]; seg[:len(chunk)] = chunk
        u = st / n
        fc = f0 + (f1 - f0) * (u / 0.55) if u < 0.55 else f1 + (f2 - f1) * ((u - 0.55) / 0.45)
        bw = 0.35 * fc + 150
        g = np.exp(-0.5 * ((freqs - fc) / bw) ** 2)
        y = np.fft.irfft(np.fft.rfft(seg * hann) * g, win)
        out[st:st + win] += y * hann; wsum[st:st + win] += hann ** 2
    y = out[:n] / np.maximum(wsum[:n], 1e-6)
    t = np.linspace(0, 1, n)
    env = np.where(t < 0.55, (t / 0.55) ** 2.2, ((1 - t) / 0.45) ** 1.6)
    y = y * env
    return y / (np.abs(y).max() + 1e-9)

from render4 import BOUNDS, TRANS, DUR
SR = 44100
def ogg(name):
    f = glob.glob(f"../proj/sfx_dl/**/{name}.ogg", recursive=True)[0]
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-f", "s16le", "-ac", "2", "-ar", str(SR), "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.int16).reshape(-1, 2).astype(np.float32) / 32768
out = np.zeros((int((DUR + 1) * SR), 2), np.float32)
for i, b in enumerate(BOUNDS):
    kind = TRANS[i][0]; d = 0.75
    w = whoosh(d, i, f0=200 + 40 * (i % 3), f1=2000 + 300 * (i % 4)) * 0.5
    dx = kind[0] if kind[0] != "zoom" else 0
    pan = np.linspace(0.5 + 0.4 * dx, 0.5 - 0.4 * dx, len(w))
    st = int((b - d * 0.55) * SR)
    out[st:st + len(w), 0] += w * np.sqrt(1 - pan); out[st:st + len(w), 1] += w * np.sqrt(pan)
HITS = [(1.40, "impactSoft_medium_001", .6), (3.24, "impactSoft_heavy_001", .8), (3.82, "impactSoft_medium_002", .7),
        (5.30, "impactMetal_heavy_001", .6), (6.62, "impactPunch_heavy_000", 1.0), (6.66, "impactGlass_heavy_002", .5),
        (8.68, "impactSoft_medium_003", .7), (12.06, "impactPunch_medium_002", .8), (18.42, "impactSoft_heavy_002", .9),
        (22.52, "impactSoft_heavy_001", .7), (23.78, "impactPunch_heavy_000", .8), (30.56, "impactSoft_medium_000", .6),
        (34.38, "impactSoft_medium_004", .7), (36.60, "impactPunch_medium_002", .9), (41.82, "impactSoft_heavy_002", .8)]
for t, n, v in HITS:
    s = ogg(n) * v; i = int(t * SR); out[i:i + len(s)] += s[: len(out) - i]
pcm = (np.clip(out, -1, 1) * 32767).astype(np.int16)
with wave.open("sfx4.wav", "wb") as f:
    f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR); f.writeframes(pcm.tobytes())
print("ok", len(BOUNDS), "whooshes,", len(HITS), "impacts")
