# Version pro — « L'occupation israélienne… »
Vidéo : `../../occupation_israelienne_pro.mp4` (43 s, 1920×1080, sans musique)
- **Son** : voix traitée dans **FilmCraft** (storytold, MIT/Apache) piloté par MCP (`fcmcp.py`, `fc_voice2.py`) : Essential Sound type Dialogue,
  préréglage « Podcast Voice » + DeNoise + DeReverb, Auto-Match. Bruitages réels Sonniss GDC / Red Library (`audio7.py`), loudness −14 LUFS.
- **Image caméra** : étalonnage **Lumetri dans FilmCraft** (`fc_grade.py`), sous-titres incrustés d'origine effacés par retouche (`clean_subs.py`).
- **Carte** : `scene5.js` / `index5.html` (généré par `mk6.py`) : graphisme documentaire (Inter, IBM Plex Mono), cartouches, réticule,
  flèches et trajectoires vectorielles projetées, contours lumineux des zones, étalonnage froid désaturé, atmosphère physique.
- **Sous-titres** : `subs6.py` → `subs6.ass` (Inter SemiBold, mots-clés en rouge). Montage : `assemble7.py`.

## Ajouts : arrière-plan flou, transitions, photos 3D, version TikTok
- `bokeh.py` : détourage MODNet (ONNX) + flou d'arrière-plan à deux échelles, fond légèrement assombri.
- `photo3d.py` : photo en 3D (Depth Anything V2 + travelling parallaxe, cadre sur fond flou si le format diffère).
- `assemble8.py H|V` : montage YouTube 1920×1080 ou TikTok 1080×1920, transitions « whip zoom » (douces sur les photos),
  sous-titres `subs6.ass` / `subs6v.ass` avec cartouches des photos. Carte verticale : `index5v.html?v=1`.
