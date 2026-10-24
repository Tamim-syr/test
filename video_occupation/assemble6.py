# Montage : visage (zooms alternés) + séquences de carte 3D, calés à l'image près, son mixé
import subprocess, math
V = "/root/.claude/uploads/478ae8c0-2492-55cb-9e31-616ef7cceb66/63d9e9ba-copy_8D0B5AAF-58E2-43FC-B8F5-7144FD6FFE0E.mov"
G = "../geo3/"; FPS = 30; TOTAL = 1294          # 43,14 s
f = lambda x: math.floor(x * FPS + .5)
MAPS = [(1.15, 3.8, "m_1.15.mp4"), (8.9, 14.55, "m_8.9.mp4"), (17.2, 21.1, "m_17.2.mp4"), (21.1, 25.0, "m_21.1.mp4"), (30.15, 33.05, "m_30.15.mp4"), (41.6, 43.14, "m_41.6.mp4")]
FACE = [(0, f(1.15), 1.0), (f(3.8), f(8.9), 1.12), (f(14.55), f(17.2), 1.0), (f(25.0), f(30.15), 1.12), (f(33.05), f(36.16), 1.0), (f(36.16), f(41.6), 1.12)]
segs = sorted([(a, b, "face", z) for a, b, z in FACE] + [(f(a), f(b), G + n, None) for a, b, n in MAPS])
inputs = ["-i", V]; fl = []; k = 0
for i, (a, b, src, z) in enumerate(segs):
    if src == "face":
        w = int(1920 * z) // 2 * 2; h = int(1080 * z) // 2 * 2
        fl.append(f"[0:v]trim=start_frame={a}:end_frame={b},setpts=PTS-STARTPTS,fps={FPS},scale={w}:{h},crop=1920:1080,setsar=1,eq=contrast=1.05:saturation=1.05[s{i}]")
    else:
        inputs += ["-i", src]; k += 1
        fl.append(f"[{k}:v]trim=end_frame={b - a},setpts=PTS-STARTPTS,fps={FPS},setsar=1[s{i}]")
fl.append("".join(f"[s{i}]" for i in range(len(segs))) + f"concat=n={len(segs)}:v=1:a=0[v]")
inputs += ["-i", "mix6.wav"]
cmd = ["ffmpeg", "-v", "error", "-y"] + inputs + ["-filter_complex", ";".join(fl), "-map", "[v]", "-map", f"{k + 1}:a", "-c:v", "libx264", "-preset", "slow",
       "-b:v", "10000k", "-maxrate", "12000k", "-bufsize", "18000k", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "256k", "-t", "43.14", "-movflags", "+faststart",
       "/home/user/test/occupation_israelienne_carte3d.mp4"]
print([(a, b, (src if src == "face" else src.split("/")[-1])) for a, b, src, z in segs])
subprocess.run(cmd, check=True); print("ok")
