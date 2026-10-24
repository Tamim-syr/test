---
name: carte-3d-geolayers
description: Crée des vidéos de cartes 3D animées réalistes façon GEOlayers / After Effects (Terre satellite complète avec relief et horizon, pays en relief aux couleurs du drapeau, zones de contrôle qui changent, flèches d'offensive, explosions, avions, feux d'artifice) avec de vrais sons enregistrés, sans After Effects. À utiliser dès que l'utilisateur (notamment @syrien_libre) veut une carte animée, une animation de guerre ou de territoire, une vidéo « map animation », l'avancée d'un front, la chronologie d'une offensive, un pays qui s'élève avec son drapeau, ou envoie une vidéo de référence de type GEOlayers / map war animation — même s'il ne dit pas « skill » ni « GEOlayers ».
---

# Carte 3D animée façon GEOlayers (three.js + Sentinel-2 + vrais sons)

Référence validée : « 11 jours qui ont libéré la Syrie » (27 nov. → 8 déc. 2024), version horizontale 1920×1080, 38 s.
Tout tourne en local sur CPU : Chromium headless (Playwright, WebGL SwiftShader) rend chaque image de la scène three.js.

## Ce que Tamim a validé / demandé (à respecter)

- **Format horizontal 1920×1080** par défaut (il l'a demandé explicitement). Le vertical 1080×1920 seulement s'il le redemande.
- **La carte doit être complète tout autour** : jamais un carré de carte flottant dans le vide. Fond satellite de toute la région, courbure de la Terre, brume et ciel à l'horizon.
- **Réaliste** : relief réel (montagnes, ombrage), fumées qui montent des villes, couleurs satellite pas trop saturées.
- **De vrais sons enregistrés**, jamais de sons synthétisés : explosions, artillerie, réacteurs, foule, feux d'artifice + une vraie musique.
- Style GEOlayers : dalles extrudées aux couleurs du drapeau, zones colorées semi-transparentes sur le satellite, flèches épaisses, gros titres Anton, compteur de date.
- Toujours montrer le **Golan occupé** hachuré sur une carte de la Syrie.

## Pipeline (scripts dans `scripts/`)

Dossier de travail : `npm init -y && npm i playwright@1.56 three@0.160.0 world-atlas@2 topojson-client@3 @fontsource/anton @fontsource-variable/rubik` (Chromium est déjà dans /opt/pw-browsers).

1. **Frontières** : `node topo.mjs` → countries.json (Natural Earth 10m via world-atlas ; adapter la liste `want` aux pays du sujet).
2. **Carte détaillée + zones** : `python3 prep_map.py`
   - télécharger d'abord les tuiles Sentinel-2 cloudless 2016 (EOX, CC BY 4.0) au zoom 9 sur l'emprise du sujet dans `tiles/` + `tiles/extent.txt` (voir le bloc de téléchargement dans prep_map / prep2 : URL `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg`) ;
   - produit sat.jpg (4096 px), ctrl.png (R = zone ×50, G = jour de bascule ×18), border.png, geo.json (villes, polygones en pixels).
   - Les zones de départ sont des polygones lon/lat ; le jour de bascule de chaque pixel vient d'une propagation de fronts (distanceTransform) depuis des « graines » (ville, jour, vitesse). Régler les graines pour que chaque ville tombe à sa vraie date, vérifier avec les valeurs imprimées.
3. **Fond large + relief** : `python3 prep2.py` → bg.jpg (zoom 7, toute la région), height.png / bg_height.png (Mapzen terrarium, `s3.amazonaws.com/elevation-tiles-prod/terrarium`), étendues dans geo.json.
4. **Scène** : `index2.html` + `scene2.js` (servir avec `python3 -m http.server 8765 --bind 127.0.0.1`).
   - `window.setT(t)` rend l'image t de façon déterministe ; tout dépend de t.
   - À adapter pour un nouveau sujet : `CAPTURE` (villes + jour de chute), `ARROWS`, `DK` (temps → jour), `K` (images clés caméra : cible, distance, inclinaison, lacet), `CAPS` (titres), trajectoire `FLY` de l'avion, drapeaux dans `flagTex`, légende et textes HUD dans index2.html.
5. **Test** : `PAGE=index2.html VW=1920 VH=1080 node render.mjs 8765 frames:1,5,10,...` puis planche contact → regarder avant le rendu complet.
6. **Rendu** : 4 morceaux en parallèle `PAGE=index2.html VW=1920 VH=1080 node render.mjs 8765 h_<a>.mp4 <a> <b>` (~1,5 s/image seul, ~5 s/image à 4 en parallèle : compter ~25 min pour 38 s). Vérifier chaque morceau avec ffprobe -count_frames.
7. **Sons** : `python3 fetch_sounds.py snd` puis `python3 audio2.py` (adapter les temps : chaque explosion à l'instant où la ville tombe, calculé depuis DK).
8. **Montage** : concat des morceaux + geo_audio2.wav, libx264 ~9 Mb/s, aac 256k. Contrôle : planche de 12 images + RMS du son seconde par seconde (le final doit être au moins aussi fort que le milieu).

## Pièges déjà rencontrés

- **Attendre la fin d'un rendu** : `pgrep -f "render.mjs"` dans une boucle se détecte lui-même et ne finit jamais ; utiliser `pgrep -x node`. Ne jamais faire `pkill -f <script>` depuis une commande qui contient ce nom (ça tue le shell).
- Placer la caméra (`placeCamera`) **au début** de `setT`, sinon étiquettes et drapeaux sont dimensionnés avec la caméra de l'image précédente (étiquettes géantes après un saut).
- En suivant un avion, viser sa position en altitude, pas le sol en dessous (sinon il sort par le haut de l'écran sous le HUD).
- Bloom : seuil ≥ 0.93, force ~0.4, et blanc des drapeaux à #D8D8D2 — sinon tout est « cramé ».
- Pas de tone mapping ACES (couleurs ternes) : `THREE.NoToneMapping` + OutputPass.
- Sommets du sol et éléments posés dessus : utiliser `elev(x, z)` (relief) et la courbure `curv()` centrée sur la cible caméra.
- `np.convolve` avec un gros noyau sur l'audio est très lent : utiliser des sommes cumulées.
- Les banques Freesound/Pixabay sont bloquées ; archive.org (Red Library CC0), OpenGameArt, incompetech et les tuiles EOX/Mapzen passent.

## Crédits à donner à Tamim (pour la description)

- Imagerie : Sentinel-2 cloudless 2016 © EOX (données Copernicus), CC BY 4.0 — déjà incrusté en bas de l'image.
- Relief : Mapzen / SRTM.
- Musique : « Five Armies » Kevin MacLeod (incompetech.com), CC BY 4.0 — **à mettre dans la description**.
- Sons : Red Library (CC0), « 25 CC0 bang SFX » OpenGameArt (CC0), Kenney (CC0) — pas de crédit obligatoire.

## Livraison

Le mp4, puis en quelques lignes : ce que montre la vidéo, le crédit musique à copier, et 2–3 points à vérifier (zones simplifiées, dates, citations).
