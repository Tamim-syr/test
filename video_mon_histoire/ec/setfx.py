import subprocess, json
EC = "/tmp/claude-0/-home-user-test/478ae8c0-2492-55cb-9e31-616ef7cceb66/scratchpad/ext/effectcraft/target/release/effectcraft-cli"
S = [  # (comp, layer, path, value, expression)
 ("BOMB", "BURST", "effects/#1/amount", 55, None), ("BOMB", "BURST", "effects/#1/size", 48, None), ("BOMB", "BURST", "effects/#1/complexity", 3, None),
 ("BOMB", "BURST", "effects/#1/evolution", 0, "time*620"), ("BOMB", "BURST", "effects/#1/offset", [576, 1024], "[576, 1024 + time*420]"),
 ("BOMB", "BURST", "effects/#2/threshold", 45, None), ("BOMB", "BURST", "effects/#2/radius", 45, None), ("BOMB", "BURST", "effects/#2/intensity", 1.5, None),
 ("BOMB", "SMOKE", "effects/#1/amount", 30, None), ("BOMB", "SMOKE", "effects/#1/size", 90, None), ("BOMB", "SMOKE", "effects/#1/evolution", 0, "time*120"),
 ("BOMB", "DEBRIS", "effects/#1/birthRate", 3.0, "time < 0.6 ? 3 : 0.4"), ("BOMB", "DEBRIS", "effects/#1/longevity", 1.6, None),
 ("BOMB", "DEBRIS", "effects/#1/producer/producerX", 0.0, None), ("BOMB", "DEBRIS", "effects/#1/producer/producerY", -0.12, None),
 ("BOMB", "DEBRIS", "effects/#1/producer/radiusX", 0.08, None), ("BOMB", "DEBRIS", "effects/#1/producer/radiusY", 0.08, None),
 ("BOMB", "DEBRIS", "effects/#1/physics/velocity", 1.4, None), ("BOMB", "DEBRIS", "effects/#1/physics/gravity", 0.9, None),
 ("BOMB", "DEBRIS", "effects/#1/particle/birthSize", 0.04, None), ("BOMB", "DEBRIS", "effects/#1/particle/deathSize", 0.01, None),
 ("BOMB", "DEBRIS", "effects/#1/particle/sizeVariation", 70, None), ("BOMB", "DEBRIS", "effects/#1/particle/birthColor", [1, 1, 1, 1], None),
 ("BOMB", "DEBRIS", "effects/#1/particle/deathColor", [0.6, 0.6, 0.6, 1], None), ("BOMB", "DEBRIS", "effects/#1/particle/maxOpacity", 95, None),
 ("GAS", "CLOUD", "effects/#1/amount", 35, None), ("GAS", "CLOUD", "effects/#1/size", 80, None), ("GAS", "CLOUD", "effects/#1/complexity", 2, None),
 ("GAS", "CLOUD", "effects/#1/evolution", 0, "time*150"), ("GAS", "CLOUD", "effects/#1/offset", [576, 1024], "[576 + time*60, 1024 - time*40]"),
 ("GAS", "FOG", "effects/#1/contrast", 160, None), ("GAS", "FOG", "effects/#1/brightness", -25, None), ("GAS", "FOG", "effects/#1/transform/scale", 260, None),
 ("GAS", "FOG", "effects/#1/complexity", 5, None), ("GAS", "FOG", "effects/#1/evolution", 0, "time*80"),
 ("GAS", "FOG", "effects/#1/transform/offset", [576, 1024], "[576 + time*140, 1024]"),
 ("CAMP", "SNOW", "effects/#1/flakes", 6000, None), ("CAMP", "SNOW", "effects/#1/size", 5, None), ("CAMP", "SNOW", "effects/#1/speed", 70, None),
 ("CAMP", "SNOW", "effects/#1/wind", 40, None),
]
for comp, layer, path, val, ex in S:
    args = [EC, "set", comp, layer, path, json.dumps(val)] + (["--expression", ex] if ex else []) + ["v4.ecproj", "--save", "--json"]
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode: print("ERR", comp, layer, path, r.stdout[-200:], r.stderr[-200:])
print("ok", len(S))
