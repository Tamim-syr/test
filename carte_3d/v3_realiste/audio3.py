# Bande-son v2 : vrais enregistrements (Red Library CC0, fireworks CC0, Kenney CC0) + musique Kevin MacLeod « Five Armies » (CC BY 4.0)
import subprocess, numpy as np, wave, glob
SR = 44100; D = 38.0; N = int(D * SR); rng = np.random.default_rng(3)
SND = "../snd/"; SON = "../snd/sonniss/"; KEN = None
def load(f, ss=0, dur=None):
    a = ["ffmpeg", "-v", "error", "-ss", str(ss)] + (["-t", str(dur)] if dur else []) + ["-i", f, "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"]
    return np.frombuffer(subprocess.run(a, capture_output=True).stdout, np.float32).reshape(-1, 2).copy()
def kenney(name): return load(glob.glob(f"../proj/sfx_dl/**/{name}.ogg", recursive=True)[0])
def son(name, **k): return load(SON + name + ".mp3", **k)
def red(cat, name, **k): return load(glob.glob(f"{SND}red/{cat}/{name}*.mp3")[0], **k)
def onset(x, thr=.12):
    e = np.abs(x).max(1); i = np.argmax(e > thr * e.max()); return x[max(0, i - int(.03 * SR)):]
def norm(x, p=1.0): m = np.abs(x).max(); return x / m * p if m > 0 else x
def fade(x, fi=.02, fo=.3):
    n = len(x); e = np.ones(n); a, b = int(fi * SR), int(fo * SR)
    if a: e[:a] = np.linspace(0, 1, a)
    if b: e[-b:] *= np.linspace(1, 0, b)
    return x * e[:, None]
def peak_window(x, dur, at=.45):      # fenêtre de durée dur centrée sur le passage le plus fort
    c = np.cumsum(np.abs(x).max(1)); k = SR // 4; e = c[k:] - c[:-k]; i = int(np.argmax(e)) + k // 2; s = max(0, i - int(dur * at * SR))
    return x[s:s + int(dur * SR)]
out = np.zeros((N, 2)); mus = np.zeros((N, 2))
def put(buf, x, at, g=1.0, pan=0.0):
    i = int(at * SR)
    if i < 0: x = x[-i:]; i = 0
    x = x[:max(0, N - i)] * g
    if pan: x = x * np.array([min(1, 1 - pan), min(1, 1 + pan)])
    buf[i:i + len(x)] += x
# --- musique (démarre sur le passage calme puis monte)
m = load(SND + "five_armies.mp3", ss=63.5, dur=D + 1)[:N]
env = np.interp(np.arange(len(m)) / SR, [0, 3, 6.6, 20, 28.5, 30.5, 31.5, 36, 38], [.45, .6, .7, .75, .9, 1.0, 1.2, 1.2, 0])
put(mus, m * env[:, None], 0, .75)
# --- intro : vent d'altitude + grondement quand le drapeau du régime sort de terre
put(out, fade(norm(red("Air_Industry", "R18-50", dur=4.5)) , .8, 1.2), 0, .18)
put(out, fade(norm(onset(red("Explosions", "R29-03"))[:int(6 * SR)]), .05, 2.5), .3, .55)
# --- whooshes de caméra : souffle d'air inversé (montée) + attaque
blast = norm(onset(red("Air_Industry", "R28-07"))[:int(1.1 * SR)])
wh = fade(np.concatenate([blast[::-1][-int(.7 * SR):], blast[:int(.25 * SR)] * .5]), .05, .2)
for k, at in enumerate([3.4, 8.2, 10.6, 13.8, 15.9, 18.1, 20.9, 22.9, 28.9]): put(out, wh, at - .7, .32, (-1) ** k * .35)
# --- ambiance de bataille pendant l'offensive (artillerie + armes légères au loin)
amb = red("Guns_Artillery", "R12-19", ss=2, dur=16)
put(out, fade(norm(amb), 1.5, 2.5), 6.4, .13)
amb2 = red("Guns_Artillery", "R30-05", ss=1, dur=13)
put(out, fade(norm(amb2), 1.5, 2.5), 9.5, .1)
put(out, fade(norm(onset(red("Guns_Artillery", "R18-04")))[:int(5 * SR)], .02, 1), 6.9, .4)
# --- chute des villes : vraies explosions
for at, (cat, nm), pan in [(9.96, ("Explosions", "R09-53"), -.2), (14.07, ("Explosions", "R30-06"), .2), (15.8, ("Explosions", "R09-48"), -.3),
                           (18.0, ("Explosions", "R29-33"), .25), (20.68, ("Explosions", "R09-52"), 0)]:
    put(out, fade(norm(onset(red(cat, nm)))[:int(5.5 * SR)], .0, 1.5), at - .02, .8, pan)
# --- Damas : la foule célèbre
put(out, fade(norm(red("Crowds_Outdoor", "R25-22", ss=2, dur=5)), .6, 1.4), 21.0, .38)
# --- avion d'Assad : passage de jet (pic calé sur la montée)
jet = peak_window(red("Aircraft_Jets", "R02-46"), 6.6, .4)
put(out, fade(norm(jet), 1.0, 1.6), 22.6, .62)
# --- dates qui défilent : clic mécanique
tick = norm(kenney("click_002")) * .5
DK = [[0, 0], [6.6, 0], [10.4, 2.6], [14.2, 8.5], [15.8, 9.2], [18.0, 10.6], [20.9, 11.25], [28.8, 11.3], [30.8, 13.6]]
def day(x):
    for (a, da), (b2, db) in zip(DK, DK[1:]):
        if x <= b2: return da + (db - da) * min(1, max(0, (x - a) / (b2 - a)))
    return 13.6
prev = 0
for i in range(660, 2100):
    d = int(min(day(i / 100), 11.9))
    if d != prev: put(out, tick, i / 100, .5); prev = d
# --- titres : impact sourd
pop = norm(kenney("impactSoft_medium_001")) if glob.glob("../proj/sfx_dl/**/impactSoft_medium_001.ogg", recursive=True) else norm(load("/home/user/test/style_hafez/sons_kenney/impactSoft_medium_001.ogg"))
for at in [0.3, 3.6, 6.6, 9.9, 12.4, 14.0, 15.4, 17.8, 20.7, 23.1, 28.8, 31.1]: put(out, pop, at, .35)
# --- final : coup de tonnerre, feux d'artifice, foule
put(out, fade(norm(onset(red("Explosions", "R11-54")))[:int(4 * SR)], 0, 1.5), 30.9, .95)
for j in range(14):
    t0 = 31.2 + j * .3
    put(out, norm(load(f"{SND}bang/fw_0{j % 6 + 1}.ogg")), t0 - .9, .45, rng.uniform(-.6, .6))
    put(out, norm(load(f"{SND}bang/bang_{j % 10 + 1:02d}.ogg")), t0, .8, rng.uniform(-.7, .7))
put(out, fade(norm(load(f"{SND}bang/fw_loop.ogg")), 1, 2), 31.4, .4)
put(out, fade(norm(red("Crowds_Outdoor", "R25-22", ss=8, dur=7)), 1.0, 2.0), 31.0, .7)
put(out, norm(load("/home/user/test/style_hafez/sons_kenney/impactPunch_heavy_000.ogg")), 35.75, .5)

# ===== couche Sonniss GDC (sons de studio pro, libres de droits) =====
put(out, fade(norm(son("wind_rumble", ss=20, dur=5)), 1.0, 1.5), 0, .3)                 # vent d'altitude
put(out, fade(norm(onset(son("sub_hit"))[:int(4 * SR)]), 0, 1.5), .35, .55)            # le drapeau sort de terre
th = fade(norm(onset(son("boom_title"))[:int(3.5 * SR)]), 0, 1.2)
for at in [0.3, 9.9, 20.7, 31.1]: put(out, th, at, .45)                                 # gros titres
wa = fade(norm(son("whoosh_air")), .02, .4); whv = fade(norm(son("whoosh_heavy"))[:int(2.2 * SR)], .02, .5)
def peak_at(x):
    c = np.cumsum(np.abs(x).max(1)); k = SR // 20; e = c[k:] - c[:-k]; return (int(np.argmax(e)) + k // 2) / SR
for k, at in enumerate([3.4, 8.2, 10.6, 13.8, 15.9, 18.1, 20.9, 22.9, 28.9]):
    w = wa if k % 2 else whv; put(out, w, at - peak_at(w), .35, (-1) ** k * .3)
for at, nm in [(9.96, "expl_real"), (14.07, "expl_car"), (15.8, "expl_real"), (18.0, "rpg"), (20.68, "expl_big")]:
    put(out, fade(norm(onset(son(nm)))[:int(6 * SR)], 0, 1.5), at - .02, .55)
    put(out, fade(norm(onset(son("sub_hit")))[:int(2.5 * SR)], 0, 1.0), at, .35)
put(out, fade(norm(son("howitzer", ss=30, dur=14)), 1.5, 2.5), 7.0, .14, -.4)           # artillerie au loin
put(out, fade(norm(son("mine_distant", ss=0, dur=6)), .02, 2), 12.3, .3, .5)
r = fade(norm(son("riser_strings")), .3, .1); put(out, r, 30.9 - len(r) / SR, .4)      # montée avant le final
jet2 = peak_window(son("jet_airliner"), 6.6, .45); put(out, fade(norm(jet2), 1.0, 1.6), 22.6, .45)
# --- mixage : la musique s'efface sous les grosses explosions
duck = np.ones(N)
for at in [9.96, 14.07, 15.8, 18.0, 20.68, 30.9]:
    i = int(at * SR); n = int(1.6 * SR); duck[i:i + n] = np.minimum(duck[i:i + n], 1 - .45 * np.exp(-np.arange(min(n, N - i)) / SR * 2))
mix = mus * duck[:, None] + out
mix *= np.minimum(1, (D - np.arange(N) / SR) / 1.2)[:, None]
mix = np.tanh(mix / np.percentile(np.abs(mix), 99.95) * .9) * .95
w = wave.open("geo_audio3.wav", "wb"); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype(np.int16).tobytes()); w.close()
print("ok")
