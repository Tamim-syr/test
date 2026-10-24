# Son de la vidéo « occupation » : voix + musique sombre (Kevin MacLeod « Lightless Dawn », CC BY 4.0) mise en retrait sous la voix + bruitages réels
import subprocess, numpy as np, wave, glob
SR = 44100; SND = "../snd/"; SON = SND + "sonniss/"; rng = np.random.default_rng(5)
def load(f, ss=0, dur=None):
    a = ["ffmpeg", "-v", "error", "-ss", str(ss)] + (["-t", str(dur)] if dur else []) + ["-i", f, "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"]
    return np.frombuffer(subprocess.run(a, capture_output=True).stdout, np.float32).reshape(-1, 2).copy()
son = lambda n, **k: load(SON + n + ".mp3", **k)
red = lambda c, n, **k: load(glob.glob(f"{SND}red/{c}/{n}*.mp3")[0], **k)
def onset(x, thr=.12):
    e = np.abs(x).max(1); i = np.argmax(e > thr * e.max()); return x[max(0, i - int(.03 * SR)):]
norm = lambda x, p=1.0: x / (np.abs(x).max() + 1e-9) * p
def fade(x, fi=.02, fo=.3):
    n = len(x); e = np.ones(n); a, b = int(fi * SR), int(fo * SR)
    if a: e[:a] = np.linspace(0, 1, a)
    if b: e[-b:] *= np.linspace(1, 0, b)
    return x * e[:, None]
def peak_at(x):
    c = np.cumsum(np.abs(x).max(1)); k = SR // 20; e = c[k:] - c[:-k]; return (int(np.argmax(e)) + k // 2) / SR
voice = load("voice.wav"); N = len(voice); D = N / SR
sfx = np.zeros((N, 2)); mus = np.zeros((N, 2))
def put(buf, x, at, g=1.0, pan=0.0):
    i = int(at * SR)
    if i < 0: x = x[-i:]; i = 0
    x = x[:max(0, N - i)] * g
    if pan: x = x * np.array([min(1, 1 - pan), min(1, 1 + pan)])
    buf[i:i + len(x)] += x
# musique
m = load(SND + "Lightless_Dawn.mp3", ss=6, dur=D)[:N]; put(mus, norm(m), 0, .5)
# transitions visage <-> carte
whv = fade(norm(son("whoosh_heavy"))[:int(2.2 * SR)], .02, .5); wa = fade(norm(son("whoosh_air")), .02, .4)
for k, at in enumerate([1.15, 3.8, 8.9, 14.55, 17.2, 25.0, 30.15, 33.05, 41.6]):
    w = whv if at in (1.15, 8.9, 17.2) else wa; put(sfx, w, at - peak_at(w), .32 if w is whv else .22, (-1) ** k * .3)
# 1) plongée depuis l'espace
put(sfx, fade(norm(son("wind_rumble", ss=40, dur=3)), .3, .6), 1.15, .35)
put(sfx, fade(norm(onset(son("sub_hit")))[:int(2.5 * SR)], 0, 1), 3.55, .35)
# 2) le repère tombe à l'ouest de Deraa, puis l'avancée
put(sfx, fade(norm(onset(son("boom_metal")))[:int(3 * SR)], 0, 1.2), 10.7, .42)
put(sfx, fade(norm(red("Explosions", "R29-03", dur=4)), .3, 1.2), 11.75, .35)
# 3) frappes : sifflement du missile puis explosion réelle
STR = [(18.28, "expl_real"), (18.95, "expl_car"), (19.64, "rpg"), (20.1, "expl_real"), (22.95, "expl_car"), (23.55, "expl_real"), (24.15, "rpg"), (24.5, "expl_real")]
wp = fade(norm(son("whoosh_pass")), .05, .2)
for k, (at, nm) in enumerate(STR):
    put(sfx, wp, at - peak_at(wp) - .05, .22, (-1) ** k * .4)
    put(sfx, fade(norm(onset(son(nm)))[:int(4 * SR)], 0, 1.2), at, .55, rng.uniform(-.3, .3))
    put(sfx, fade(norm(onset(son("sub_hit")))[:int(1.8 * SR)], 0, .8), at, .25)
put(sfx, fade(norm(son("howitzer", ss=60, dur=8)), 1, 2), 17.3, .1, -.5)
put(sfx, fade(norm(onset(son("boom_title")))[:int(3 * SR)], 0, 1.2), 22.16, .45)        # « elle franchit toutes les limites »
# 4) coucher de soleil : vent doux
put(sfx, fade(norm(son("wind_rumble", ss=100, dur=3.2)), .5, .8), 30.15, .22)
# carte de fin
put(sfx, fade(norm(onset(son("boom_hit")))[:int(2 * SR)], 0, .8), 41.65, .35)
# musique qui se tait sur « et personne ne dit rien », puis revient ; mise en retrait sous la voix
env = np.interp(np.arange(N) / SR, [0, 20.3, 20.5, 22.1, 22.4, D - 1.5, D], [1, 1, .08, .08, 1, 1, 0])
ve = np.convolve(np.abs(voice).max(1), np.ones(441) / 441, "same"); ve = np.minimum(1, ve / (np.percentile(ve, 95) + 1e-9))
duck = 1 - .55 * np.convolve(ve, np.ones(8820) / 8820, "same")
mix = voice * 1.0 + mus * (env * duck)[:, None] * .5 + sfx * .8
mix = np.tanh(mix / np.percentile(np.abs(mix), 99.97) * .92) * .97
w = wave.open("mix6.wav", "wb"); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype(np.int16).tobytes()); w.close()
print("ok", round(D, 2))
