# Télécharge les vrais sons libres : Red Library (CC0, archive.org), feux d'artifice CC0 (OpenGameArt), musique Kevin MacLeod (CC BY 4.0)
# Usage : python3 fetch_sounds.py <dossier_snd>
import json, os, subprocess, sys, urllib.parse, concurrent.futures as cf
D = sys.argv[1] if len(sys.argv) > 1 else "snd"; os.makedirs(D, exist_ok=True)
CATS = ["Explosions", "Guns_Artillery", "Aircraft_Jets", "Crowds_Outdoor", "Crowds_Mixed", "Fire", "Air_Industry", "Sirens", "Impacts"]
jobs = []
for c in CATS:
    meta = json.loads(subprocess.run(["curl", "-s", "--max-time", "60", f"https://archive.org/metadata/Red_Library_{c}"], capture_output=True, text=True).stdout)
    os.makedirs(f"{D}/red/{c}", exist_ok=True)
    jobs += [(f"https://archive.org/download/Red_Library_{c}/" + urllib.parse.quote(f["name"]), f"{D}/red/{c}/{f['name']}") for f in meta["files"] if f["name"].endswith(".mp3")]
jobs += [("https://opengameart.org/sites/default/files/25-CC0-bang-sfx.zip", f"{D}/25-CC0-bang-sfx.zip"),
         ("https://incompetech.com/music/royalty-free/mp3-royaltyfree/Five%20Armies.mp3", f"{D}/five_armies.mp3"),
         ("https://incompetech.com/music/royalty-free/mp3-royaltyfree/Heroic%20Age.mp3", f"{D}/heroic_age.mp3")]
def get(j):
    if not os.path.exists(j[1]) or os.path.getsize(j[1]) < 5000: subprocess.run(["curl", "-sL", "--max-time", "180", "-o", j[1], j[0]])
with cf.ThreadPoolExecutor(6) as ex: list(ex.map(get, jobs))
subprocess.run(["unzip", "-oq", f"{D}/25-CC0-bang-sfx.zip", "-d", f"{D}/bang"])
print(len(jobs), "fichiers")
