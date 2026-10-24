# Carte 3D animée façon GEOlayers — « 11 jours qui ont libéré la Syrie »
Vidéo : `../syrie_11_jours_carte3d.mp4` (38 s, 1080×1920, 30 fps)

- Données : imagerie Sentinel-2 cloudless 2016 © EOX (CC BY 4.0, données Copernicus), frontières Natural Earth (npm world-atlas).
  `node topo.mjs` puis `python3 prep_map.py` → sat.jpg, ctrl.png (zones + date de libération par pixel), border.png, geo.json.
- Scène : three.js (`index.html` + `scene.js`) : sol satellite + zones animées par shader, dalles extrudées aux drapeaux,
  flèches d'offensive, explosions, drapeaux plantés, avion d'Assad, feux d'artifice, bloom.
- Rendu : `python3 -m http.server 8765` puis `node render.mjs 8765 out.mp4 0 38` (Chromium headless, ~0,7 s/image).
- Son : `python3 audio.py` → geo_audio.wav (musique + bruitages synthétisés, calés sur l'animation).
- npm : playwright three@0.160.0 world-atlas topojson-client @fontsource/anton @fontsource-variable/rubik
