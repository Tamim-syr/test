# EffectCraft (After Effects open source, MIT/Apache-2.0) — https://github.com/storytold/effectcraft

Compilation (Rust 1.95+, ~14 min sur 4 cœurs) :
    git clone https://github.com/storytold/effectcraft && cd effectcraft
    cargo build --release -p effectcraft-cli

## Personnage animé à la marionnette (`s05.ecproj`)
1. Découpe des personnes (Grounding DINO + SAM) -> `person0.png`, `person4.png` (transparence) + fond sans eux `s05_bg.png` (inpainting).
2. `effectcraft-cli script s05.jsx --empty` : composition 1152×2048 avec fond + 2 calques personnages.
3. Épingles Puppet : `run puppet.addPin {"layer":ID,"position":[x,y],"time":0}` sur poing, tête, hanches, pieds.
4. Animation : `puppet.movePin {"layer":ID,"pin":"Puppet Pin 1","position":[x,y],"time":t}` toutes les 0,15 s (poing qui se lève).
5. `effectcraft-cli render --comp Main --out s05_puppet.mp4 s05.ecproj`

## Feu « After Effects » (`fx.ecproj`)
- Calque FEU (`s04_fire.png`, flammes isolées) : Turbulent Displace (amount 38, size 42, complexity 3, evolution = `time*420`, offset = `[576, 1024 + time*380]`) + Glow (threshold 45, radius 34).
- Calque BRAISES : solide + CC Particle World (gravité négative, particules blanches), mode de fusion Screen.
- `effectcraft-cli render --comp Fx --out fx_mausolee.mp4 fx.ecproj`

Note : chemins absolus dans les .jsx/.ecproj à adapter.
