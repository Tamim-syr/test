s = open("scene2.js").read()
def R(a, b, cnt=1):
    global s
    n = s.count(a); assert n == cnt, (n, a[:90]); s = s.replace(a, b)
R('''import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";''',
'''import { EffectComposer, RenderPass, EffectPass, BloomEffect, ToneMappingEffect, ToneMappingMode, VignetteEffect, NoiseEffect, BlendFunction,
  SMAAEffect, HueSaturationEffect, BrightnessContrastEffect } from "postprocessing";
import { AerialPerspectiveEffect, PrecomputedTexturesLoader, getSunDirectionECEF } from "@takram/three-atmosphere";
import { Ellipsoid, Geodetic, radians } from "@takram/three-geospatial";''')
R('''const HAZE = new THREE.Color("#b9c9d9");
scene.background = HAZE.clone();
scene.fog = new THREE.Fog(HAZE, 260, 1300);''', '''const HAZE = new THREE.Color("#b9c9d9");
scene.background = null; scene.fog = null;''')
R('''const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(960, 540), 0.4, 0.35, 0.93);
composer.addPass(bloom); composer.addPass(new OutputPass());''',
'''// ---------- atmosphère physique (Bruneton / takram) + chaîne de post-production cinéma
const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
composer.addPass(new RenderPass(scene, camera));
const aerial = new AerialPerspectiveEffect(camera, { sky: true, sunLight: false, skyLight: false, transmittance: true, inscatter: true });
const atmTex = await new PrecomputedTexturesLoader().setType(renderer).loadAsync("node_modules/@takram/three-atmosphere/assets/");
Object.assign(aerial, atmTex);
// repère local (1 unité ≈ 13,53 km ; x = est, y = haut, z = sud) -> ECEF
const U = 13530, ORIGIN = new Geodetic(radians(38.32), radians(34.59), 0).toECEF();
const ENU = Ellipsoid.WGS84.getEastNorthUpFrame(ORIGIN);
aerial.worldToECEFMatrix.copy(ENU.multiply(new THREE.Matrix4().set(U, 0, 0, 0, 0, 0, -U, 0, 0, U, 0, 0, 0, 0, 0, 1)));
getSunDirectionECEF(new Date("2024-12-08T09:30:00Z"), aerial.sunDirection);
const bloomFx = new BloomEffect({ mipmapBlur: true, luminanceThreshold: .85, luminanceSmoothing: .2, intensity: .9, radius: .7 });
const tone = new ToneMappingEffect({ mode: ToneMappingMode.AGX });
const grade = new HueSaturationEffect({ saturation: .06 }), bc = new BrightnessContrastEffect({ contrast: .08 });
const vign = new VignetteEffect({ offset: .32, darkness: .55 });
const grain = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: false }); grain.blendMode.opacity.value = .07;
composer.addPass(new EffectPass(camera, aerial));
composer.addPass(new EffectPass(camera, bloomFx, tone, grade, bc, vign, grain));
composer.addPass(new EffectPass(camera, new SMAAEffect()));
window.EXPO = 9;''')
R('''Object.assign(groundU, { hmap: { value: hmap }, hs: { value: HS }, cc: { value: new THREE.Vector3() }, haze: { value: HAZE }, fogR: { value: new THREE.Vector2(260, 1300) } });''',
  '''Object.assign(groundU, { hmap: { value: hmap }, hs: { value: HS }, cc: { value: new THREE.Vector3() }, haze: { value: HAZE }, fogR: { value: new THREE.Vector2(1e6, 2e6) }, expo: { value: 9 } });''')
R("    o = mix(o, haze, fogF);", "    o = mix(o, haze, fogF) * expo;")
R("uniform sampler2D sat, ctrlN, ctrlL, border, hmap; uniform float day,", "uniform sampler2D sat, ctrlN, ctrlL, border, hmap; uniform float expo; uniform float day,")
R("const bgU = { map: { value: bgT },", "const bgU = { expo: groundU.expo, map: { value: bgT },")
R("fragmentShader: `uniform sampler2D map; uniform vec3 haze; uniform vec2 fogR; uniform float dim, ovA;", "fragmentShader: `uniform sampler2D map; uniform vec3 haze; uniform vec2 fogR; uniform float dim, ovA, expo;")
R("gl_FragColor = vec4(mix(c, haze, f), 1.);", "gl_FragColor = vec4(mix(c, haze, f) * expo, 1.);")
# ciel : remplacé par celui de l'atmosphère physique
i0 = s.index("const sky = new THREE.Mesh(new THREE.SphereGeometry(3000"); i1 = s.index("scene.add(sky);", i0) + len("scene.add(sky);")
s = s[:i0] + "const sky = new THREE.Object3D();   // le ciel vient de l'atmosphère physique" + s[i1:]
# couches de sprites animés (flipbooks Unity CC0)
R("const FIRE = pointsLayer(sprTex(\"fire\"), true), SMOKE", '''function flipLayer(url, grid, N = 2000) {
  const tex = loader.load(url); tex.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.BufferGeometry();
  for (const [k, n] of [["position", 3], ["col", 4], ["sz", 1], ["fr", 1]]) geo.setAttribute(k, new THREE.BufferAttribute(new Float32Array(N * n), n));
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, g: { value: grid } }, transparent: true, depthWrite: false,
    vertexShader: `attribute vec4 col; attribute float sz, fr; varying vec4 vC; varying float vF;
      void main(){ vC = col; vF = fr; vec4 mv = modelViewMatrix * vec4(position,1.); gl_PointSize = sz * 620. / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D map; uniform float g; varying vec4 vC; varying float vF;
      void main(){ float c = mod(vF, g), r = floor(vF / g); vec2 uv = vec2((c + gl_PointCoord.x) / g, 1. - (r + gl_PointCoord.y) / g);
        vec4 t = texture2D(map, uv); gl_FragColor = vec4(t.rgb * vC.rgb, t.a * vC.a); }`
  });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 8; scene.add(pts); let n = 0;
  return { reset() { n = 0; }, flush() { geo.setDrawRange(0, n); for (const k of ["position", "col", "sz", "fr"]) geo.attributes[k].needsUpdate = true; },
    add(p, r, g, b, a, s, f) { if (n >= N) return; geo.attributes.position.array.set([p.x, p.y, p.z], n * 3); geo.attributes.col.array.set([r, g, b, a], n * 4); geo.attributes.sz.array[n] = s; geo.attributes.fr.array[n] = f; n++; } };
}
const EXPL = flipLayer("expl.png", 5), WISP = flipLayer("smoke8.png", 8);
const FIRE = pointsLayer(sprTex("fire"), true), SMOKE''')
# explosion principale + secondaires (flipbook), en plus des éclats
R("function burst(p, age, seed, big) {\n  p = p.clone(); p.y += elev(p.x, p.z);", '''function burst(p, age, seed, big) {
  p = p.clone(); p.y += elev(p.x, p.z);
  if (big) for (let j = 0; j < 4; j++) {
    const a2 = age - j * .18, D = 1.9; if (a2 < 0 || a2 > D) continue;
    const f = Math.min(24, Math.floor(a2 / D * 25)), off = j ? new THREE.Vector3((rnd(seed + j) - .5) * 2.4, 0, (rnd(seed + j * 2) - .5) * 1.6) : new THREE.Vector3();
    const sz = (j ? 3.2 : 6.5) * (.8 + .4 * easeOut(a2 / D)), hdr = f < 10 ? 3.2 : 1.4;
    EXPL.add(p.clone().add(off).setY(p.y + sz * .32 + a2 * .5), hdr, hdr, hdr, 1, sz, f);
  }''')
# colonnes de fumée : vraie fumée animée
R("        SMOKE.add(q, 1, 1, 1, .5 * (1 - u) * fade, 1.1 + u * 3.2);", "        if (k % 2 === 0) WISP.add(q, .55, .52, .5, .75 * Math.sin(Math.PI * u) * fade, 1.6 + u * 4.5, Math.floor((u * 63 + k * 7) % 64));")
# combats : petites explosions réelles au loin
R("const ey = elev(p.x, p.z); GLOW.add(p.setY(ey + .3), 1, .75, .4, .55, .35 + rnd(k + fr) * .45);",
  "const ey = elev(p.x, p.z); const ph = (t * 1.4 + rnd(i * .7)) % 1; if (k % 3 === 0) EXPL.add(p.clone().setY(ey + .35), 2.2, 2.2, 2.2, .9, .9, Math.floor(ph * 25)); else GLOW.add(p.setY(ey + .3), 1, .75, .4, .45, .3 + rnd(k + fr) * .35);")
R("FIRE.reset(); SMOKE.reset(); GLOW.reset();", "FIRE.reset(); SMOKE.reset(); GLOW.reset(); EXPL.reset(); WISP.reset();")
R("FIRE.flush(); SMOKE.flush(); GLOW.flush();", "FIRE.flush(); SMOKE.flush(); GLOW.flush(); EXPL.flush(); WISP.flush(); groundU.expo.value = window.EXPO;")
R("  composer.render();", "  composer.render(1 / 30);")
open("scene3.js", "w").write(s); print("ok")
