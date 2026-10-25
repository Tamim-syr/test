# Montage pro : caméra étalonnée FilmCraft (recadrée sans les sous-titres incrustés) + séquences carte, sous-titres Inter, grain fin
import subprocess, math
G = "../geo3/"; FPS = 30
f = lambda x: math.floor(x * FPS + .5)
MAPS = [(1.15, 3.8, "p_1.15.mp4"), (8.9, 14.55, "p_8.9.mp4"), (17.2, 21.1, "p_17.2.mp4"), (21.1, 25.0, "p_21.1.mp4"), (30.15, 33.05, "p_30.15.mp4"), (41.6, 43.14, "p_41.6.mp4")]
WIDE, TIGHT = (0, 0, 1280, 720), (84, 22, 1112, 626)       # plan large / plan serré (x, y, l, h)
FACE = [(0, f(1.15), WIDE), (f(3.8), f(6.9), TIGHT), (f(6.9), f(8.9), WIDE), (f(14.55), f(17.2), TIGHT), (f(25.0), f(28.0), WIDE), (f(28.0), f(30.15), TIGHT),
        (f(33.05), f(36.16), WIDE), (f(36.16), f(38.9), TIGHT), (f(38.9), f(41.6), WIDE)]
segs = sorted([(a, b, "face", c) for a, b, c in FACE] + [(f(a), f(b), G + n, None) for a, b, n in MAPS])
inputs = ["-i", "face_clean.mp4"]; fl = []; k = 0
for i, (a, b, src, c) in enumerate(segs):
    if src == "face":
        x, y, w, h = c
        fl.append(f"[0:v]trim=start_frame={a}:end_frame={b},setpts=PTS-STARTPTS,fps={FPS},crop={w}:{h}:{x}:{y},scale=1920:1080:flags=lanczos,unsharp=5:5:0.6,setsar=1,format=yuv420p[s{i}]")
    else:
        inputs += ["-i", src]; k += 1
        fl.append(f"[{k}:v]trim=end_frame={b - a},setpts=PTS-STARTPTS,fps={FPS},setsar=1,format=yuv420p[s{i}]")
fl.append("".join(f"[s{i}]" for i in range(len(segs))) + f"concat=n={len(segs)}:v=1:a=0[c]")
fl.append("[c]noise=alls=3:allf=t,subtitles=subs6.ass:fontsdir=fonts[v]")
inputs += ["-i", "mix7.wav"]
cmd = ["ffmpeg", "-v", "error", "-y"] + inputs + ["-filter_complex", ";".join(fl), "-map", "[v]", "-map", f"{k + 1}:a", "-c:v", "libx264", "-preset", "slow",
       "-b:v", "12000k", "-maxrate", "14000k", "-bufsize", "20000k", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "256k", "-t", "43.13", "-movflags", "+faststart",
       "/home/user/test/occupation_israelienne_pro.mp4"]
subprocess.run(cmd, check=True); print("ok", len(segs))
