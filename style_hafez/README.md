# Style « Hafez » — dessin blanc sur noir (version validée)

Vidéo de référence : `../hafez_dessin_syrien_libre_tiktok.mp4`

## Ce qui fait le style
- Illustrations blanc sur noir façon carte à gratter (Higgsfield, modèle `z_image`, gratuit).
- Vrais visages : photo de la vidéo source détourée puis gravée (`engrave.py`), ex. Hafez qui tombe et se fissure sur « tombé ».
- Gros titres Anton texturés qui apparaissent mot par mot, sous-titres manuscrits (Gochi Hand) en bas.
- Léger tremblement « dessin animé », grain, zoom lent sur chaque dessin.
- Enchaînements guidés : un élément quitte la scène et la caméra le suit (avion → Moscou, page du calendrier, braises, pigeons, flèche…), glissement + flou de mouvement + trait qui relie les deux images.
- Un whoosh synchronisé à chaque enchaînement (`whoosh.py`).

## Rendu
```
python3 whoosh.py sfx.wav
python3 render.py part_0.mp4 0 12.1   # (4 morceaux en parallèle)
# puis concat + voix (loudnorm) + sfx avec ffmpeg
```
Dépendances : Python 3, Pillow, numpy, opencv-python-headless, ffmpeg.

## Version 2 — outils open source ajoutés (`render_v2.py`)
| Outil | Licence | Rôle |
|---|---|---|
| Depth Anything V2 Small (`depth.py`) | Apache-2.0 | carte de profondeur -> parallaxe 3D sur chaque dessin |
| Grounding DINO tiny + SAM ViT-B (`segment.py`, `segment_all.py`) | Apache-2.0 | trouve un élément par son nom (« an airplane. ») et le découpe : drapeaux qui flottent, feu qui ondule, pigeons, fenêtre où tombe la neige, avion et pigeons retirés proprement (inpainting) |
| VTracer + svgpathtools (`vector_draw.py`) | MIT | le premier dessin se trace trait par trait puis se remplit |
| Pillow + Raqm, police Reem Kufi (OFL) | — | titres en arabe (« الجحش », « أبو لهب وفرعون ») |
| Sons Kenney (`sons_kenney/`, `sfx_v2.py`) | CC0 | impacts, verre brisé, griffures sur les mots forts |

Ordre : `python3 depth.py img/*.png` · `python3 segment_all.py` · `python3 whoosh.py sfx.wav && python3 sfx_v2.py` · `python3 render_v2.py ...`
Dépendances en plus : torch (CPU), transformers, vtracer, svgpathtools, fonttools.
