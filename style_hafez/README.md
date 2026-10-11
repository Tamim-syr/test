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
