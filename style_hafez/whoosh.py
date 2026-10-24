# Piste de « whoosh » synchronisée sur les glissements de caméra. python3 whoosh.py out.wav
import sys, wave, numpy as np
from render import BOUNDS, DIRS, DUR
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

total = np.zeros((int((DUR + 1) * SR), 2))
for i, b in enumerate(BOUNDS):
    dx, dy = DIRS[i % len(DIRS)]
    d = 0.75
    w = whoosh(d, i, f0=220 + 40 * (i % 3), f1=2200 + 300 * (i % 4))
    st = int((b - d * 0.55) * SR)
    # panoramique : la page part vers la gauche -> le son traverse de droite à gauche
    pan = np.linspace(0.5 - 0.4 * (-dx), 0.5 + 0.4 * (-dx), len(w)) if dx else np.full(len(w), 0.5)
    pan = 1 - pan if dx else pan
    total[st:st + len(w), 0] += w * np.sqrt(1 - pan) * 0.55
    total[st:st + len(w), 1] += w * np.sqrt(pan) * 0.55
pcm = (np.clip(total, -1, 1) * 32767).astype(np.int16)
with wave.open(sys.argv[1], "wb") as f:
    f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR); f.writeframes(pcm.tobytes())
print("ok", len(BOUNDS), "whooshes")
