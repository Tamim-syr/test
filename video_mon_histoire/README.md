# « Mon histoire » — style Hafez + EffectCraft
Vidéo : `../mon_histoire_syrie.mp4` (45 s, 1080×1920)

- Dessins : Higgsfield z_image (a2…a12) ; photos réelles gravées (e_child, e_bashar, e_family) ; carte de Deraa redessinée (e_map).
- Plans EffectCraft (`ec/v4.ecproj`, créés par `v4.jsx` + `mega.jsx`, réglés par `setfx.py`, marionnettes via `puppet.addPin/movePin`) :
  BOMB (Turbulent Displace + Glow + CC Particle World + tremblement), SURV (marionnette : il filme), GAS (nuage déformé + brume Fractal Noise),
  CAMP (CC Snowfall), MEGA (marionnette : il scande au mégaphone).
  Rendu : `effectcraft-cli render --comp BOMB --out ec/plate_BOMB.mp4 ec/v4.ecproj` (idem SURV, GAS, CAMP, MEGA).
- Montage : `python3 render4.py out.mp4` (s'appuie sur `../style_hafez/render.py`), son : `python3 sfx4.py` (whooshes + Kenney CC0).
