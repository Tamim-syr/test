# « Mon histoire » — version 100 % locale (sans Higgsfield)
Vidéo : `../../mon_histoire_sans_higgsfield.mp4`

1. Dessins : `gen_all.py` (SD-Turbo, Stability AI, local sur CPU, ~30 s/image, 3 variantes par scène) puis `prep.py` (inversion, netteté, noirs de carte à gratter).
2. Découpes + épingles de marionnette automatiques : `cutouts.py` (Grounding DINO + SAM) → `pins.json`.
3. EffectCraft : `ec/v4.jsx` + `ec/mega.jsx` (compositions), `ec/setfx.py` (effets), `ec/puppets.py` (marionnettes), puis `effectcraft-cli render`.
4. Montage style Hafez : `../render4.py`, son `../sfx4.py`.
