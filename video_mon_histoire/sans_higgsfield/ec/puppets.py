# Épingles de marionnette (EffectCraft puppet) placées automatiquement depuis pins.json
import json, math, subprocess, sys
EC = "/tmp/claude-0/-home-user-test/478ae8c0-2492-55cb-9e31-616ef7cceb66/scratchpad/ext/effectcraft/target/release/effectcraft-cli"
P = json.load(open("../pins.json"))
def lid(comp, name):
    subprocess.run([EC, "run", "comp.open", json.dumps({"comp": comp}), "v4.ecproj", "--save", "--json"], capture_output=True)
    d = json.loads(subprocess.run([EC, "info", "v4.ecproj", "--json"], capture_output=True, text=True).stdout)
    return [l["id"] for l in d["activeComp"]["layers"] if l["name"] == name][0]
def rig(comp, layer, p, dur, motion, dt):
    L = lid(comp, layer)
    order = ["hand", "elbow", "head", "shoulder", "hip", "foot1", "foot2"]
    args = [EC, "run", "comp.open", json.dumps({"comp": comp})]
    for k in order: args += ["puppet.addPin", json.dumps({"layer": L, "position": list(p[k]), "time": 0})]
    t = 0.0
    while t <= dur:
        for i, (dx, dy) in motion(t).items():
            x, y = p[order[i]]
            args += ["puppet.movePin", json.dumps({"layer": L, "pin": f"Puppet Pin {i + 1}", "position": [round(x + dx, 1), round(y + dy, 1)], "time": round(t, 3)})]
        t += dt
    r = subprocess.run(args + ["v4.ecproj", "--save", "--json"], capture_output=True, text=True); print(comp, r.returncode, r.stderr[-200:])
def surv(t):   # il filme : le téléphone balaie la ville, la tête suit
    a, b = math.sin(t * 1.3), math.sin(t * 2.1 + .5)
    return {0: (55 * a, 18 * b), 1: (28 * a, 9 * b), 2: (10 * a, 3 * b)}
def mega(t):   # il scande : le bras monte à chaque slogan
    beat = abs(math.sin(t * 4.2)); sh = math.sin(t * 23) * 3
    return {0: (sh, -38 * beat), 1: (sh * .5, -20 * beat), 2: (-6 * beat, 8 * beat)}
rig("SURV", "MAN", P["a5"], 4.9, surv, 0.2)
rig("MEGA", "BOY", P["a12"], 5.6, mega, 0.12)
