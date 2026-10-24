# Bande-son synthétisée : musique épique (drone + percussions + accord final) et bruitages calés sur l'animation
import numpy as np, wave, glob, subprocess
SR = 44100; D = 38.0; N = int(D * SR); rng = np.random.default_rng(7)
t = np.arange(N) / SR
def lp(x, a):            # passe-bas 1 pôle
    y = np.empty_like(x); acc = 0.0
    for i in range(len(x)): acc += a * (x[i] - acc); y[i] = acc
    return y
def lpf(x, fc):           # passe-bas rapide par FFT
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); X *= 1 / (1 + (f / fc) ** 4); return np.fft.irfft(X, len(x))
def env(n, a, d): e = np.ones(n); na = int(a * SR); e[:na] = np.linspace(0, 1, na); e[na:] = np.exp(-np.arange(n - na) / (d * SR)); return e
mus = np.zeros((N, 2)); sfx = np.zeros((N, 2))
def put(buf, x, at, g=1.0, pan=0.0):
    i = int(at * SR); x = x[: max(0, N - i)]
    if x.ndim == 1: x = np.stack([x * (1 - pan) ** .5, x * (1 + pan) ** .5], 1) / 2 ** .5 * 2 ** .5 / 1.0
    buf[i:i + len(x)] += x * g
# --- musique : ré mineur, drone grave + nappe, percussions à 90 bpm, montée puis accord majeur final
def note(f, dur, a=.4, d=2.0):
    n = int(dur * SR); tt = np.arange(n) / SR
    s = sum(np.sin(2 * np.pi * f * k * tt * (1 + .0015 * np.sin(2 * np.pi * .3 * tt + k))) / k ** 1.3 for k in range(1, 7))
    return s * np.minimum(1, tt / a) * np.minimum(1, (dur - tt) / d)
D1 = 73.42
for (st, dur, fs, g) in [(0, 31, [D1 / 2, D1, D1 * 1.5], .10), (0.0, 31, [D1 * 2, D1 * 2 * 1.189, D1 * 3], .045),
                          (14, 17, [D1 * 2 * 1.335, D1 * 4], .035), (30.8, 7.2, [D1, D1 * 1.5, D1 * 2, D1 * 2.52, D1 * 3], .09)]:
    for f in fs: put(mus, note(f, dur, a=3.0 if st < 30 else .4, d=2.5), st, g)
beat = 60 / 90
def taiko(g=1.0):
    n = int(.9 * SR); tt = np.arange(n) / SR
    body = np.sin(2 * np.pi * (55 + 90 * np.exp(-tt * 30)) * tt) * np.exp(-tt * 7)
    hit = lpf(rng.standard_normal(n), 1800) * np.exp(-tt * 40) * .5
    return (body + hit) * g
b = 6.6
while b < 30.6:
    k = round((b - 6.6) / beat); intensity = min(1, .45 + (b - 6.6) / 24)
    put(mus, taiko(.55 * intensity), b)
    if k % 2 == 1: put(mus, taiko(.3 * intensity), b + beat / 2)
    if k % 4 == 3: put(mus, lpf(rng.standard_normal(int(.15 * SR)), 6000) * np.exp(-np.arange(int(.15 * SR)) / SR * 30) * .25 * intensity, b)
    b += beat
for k in range(8): put(mus, taiko(.9), 28.8 + k * .25 * (1 - k * .06))   # roulement avant le final
# --- bruitages
def whoosh(d=.8, f0=300, f1=2400):
    n = int(d * SR); x = rng.standard_normal(n); tt = np.arange(n) / n
    fc = f0 + (f1 - f0) * np.sin(np.pi * tt) ** 2; y = np.zeros(n); acc = 0.0
    a = 1 - np.exp(-2 * np.pi * fc / SR)
    for i in range(n): acc += a[i] * (x[i] - acc); y[i] = acc
    return y * np.sin(np.pi * tt) ** 1.5 * 1.6
def boom(big=True):
    n = int((3.5 if big else 1.4) * SR); tt = np.arange(n) / SR
    sub = np.sin(2 * np.pi * (38 + 60 * np.exp(-tt * 9)) * tt) * np.exp(-tt * (2.2 if big else 5))
    rum = lpf(rng.standard_normal(n), 300) * np.exp(-tt * (1.4 if big else 3.5)) * 2.5
    crack = lpf(rng.standard_normal(n), 4500) * np.exp(-tt * 14) * .9
    deb = lpf(rng.standard_normal(n) * (rng.random(n) > .996) * 6, 3000) * np.exp(-tt * 2) * np.minimum(1, tt * 4)
    return (sub * 1.3 + rum + crack + deb) * (1 if big else .45)
def tick():
    n = int(.08 * SR); tt = np.arange(n) / SR; return (np.sin(2 * np.pi * 2400 * tt) + .5 * lpf(rng.standard_normal(n), 7000)) * np.exp(-tt * 70) * .35
def pop():
    n = int(.25 * SR); tt = np.arange(n) / SR; return (np.sin(2 * np.pi * (180 + 400 * np.exp(-tt * 30)) * tt) * np.exp(-tt * 18) + lpf(rng.standard_normal(n), 3000) * np.exp(-tt * 50) * .4) * .6
for at in [3.4, 8.2, 10.6, 13.8, 15.9, 18.1, 20.9, 22.9, 28.9]: put(sfx, whoosh(.9), at - .45, .55, rng.uniform(-.5, .5))
put(sfx, boom(True) * .5, 0.35); put(sfx, whoosh(1.4, 120, 900), 0.1, .5)                     # dalle du régime qui monte
for at in [9.96, 14.07, 15.8, 18.0, 20.68]: put(sfx, boom(True), at, .9, rng.uniform(-.3, .3))  # chute des villes
# combats sur le front : petites explosions lointaines
for at in np.sort(rng.uniform(6.8, 21, 46)): put(sfx, lpf(boom(False), 900), at, .35, rng.uniform(-.8, .8))
# dates qui défilent
DK = [[0, 0], [6.6, 0], [10.4, 2.6], [14.2, 8.5], [15.8, 9.2], [18.0, 10.6], [20.9, 11.25], [28.8, 11.3], [30.8, 13.6]]
def day(x):
    for (a, da), (b2, db) in zip(DK, DK[1:]):
        if x <= b2: return da + (db - da) * min(1, max(0, (x - a) / (b2 - a)))
    return 13.6
prev = 0
for i in range(int(6.6 * 100), int(21 * 100)):
    x = i / 100; d = int(min(day(x), 11.9))
    if d != prev: put(sfx, tick(), x, .8); prev = d
for at in [0.3, 3.6, 6.6, 9.9, 12.4, 14.0, 15.4, 17.8, 20.7, 23.1, 28.8, 31.1]: put(sfx, pop(), at, .5)
# avion : réacteurs qui passent
n = int(6.2 * SR); tt = np.arange(n) / SR
jet = lpf(rng.standard_normal(n), 900) * 1.4 + lpf(rng.standard_normal(n), 5000) * .25 + np.sin(2 * np.pi * (420 - 140 * tt / 6.2) * tt) * .08
put(sfx, jet * np.minimum(1, tt / .8) * np.minimum(1, (6.2 - tt) / 1.5), 22.8, .55)
# drapeau final + feux d'artifice
put(sfx, boom(True) * .8, 30.9); put(sfx, whoosh(1.2, 100, 700), 30.5, .6)
for j in range(14):
    t0 = 31.2 + j * .3; put(sfx, whoosh(.3, 1500, 5000) * .3, t0 - .3, .5, rng.uniform(-.7, .7))
    put(sfx, lpf(boom(False), 2500), t0, .45, rng.uniform(-.7, .7))
    for k in range(25): put(sfx, tick() * .5, t0 + .2 + rng.uniform(0, 1.2), .25, rng.uniform(-.9, .9))
put(sfx, boom(True) * .4, 35.5)
mix = mus * .7 + sfx * .8
fade = np.minimum(1, (D - t) / 1.5)[:, None]; mix *= fade
mix = np.tanh(mix / (np.abs(mix).max() * .7)) * .9
w = wave.open("geo_audio.wav", "wb"); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype(np.int16).tobytes()); w.close()
print("ok")
