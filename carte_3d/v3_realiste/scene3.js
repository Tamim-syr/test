// Carte 3D animée façon GEOlayers : offensive du 27 nov. au 8 déc. 2024 (rendu image par image, piloté par setT(t))
import * as THREE from "three";
import { EffectComposer, RenderPass, EffectPass, ClearPass, BloomEffect, ToneMappingEffect, ToneMappingMode, VignetteEffect, NoiseEffect, BlendFunction,
  SMAAEffect, HueSaturationEffect, BrightnessContrastEffect } from "postprocessing";
import { AerialPerspectiveEffect, PrecomputedTexturesLoader, getSunDirectionECEF } from "@takram/three-atmosphere";
import { Ellipsoid, Geodetic, radians } from "@takram/three-geospatial";

await document.fonts.load("64px Anton"); await document.fonts.load("700 40px Rubik");
const G = await (await fetch("geo.json")).json();
const SC = 100 / G.W;
const W3 = (p, y = 0) => new THREE.Vector3((p[0] - G.W / 2) * SC, y, (p[1] - G.H / 2) * SC);
const CITY = Object.fromEntries(Object.entries(G.cities).map(([k, v]) => [k, W3(v)]));

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const easeOut = x => 1 - Math.pow(1 - clamp(x), 3);
const backOut = x => { x = clamp(x); const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const lerp = (a, b, u) => a + (b - a) * u;
function rnd(s) { s = Math.sin(s * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

// ---------- rendu
const canvas = document.getElementById("c");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(1920, 1080, false);
renderer.toneMapping = THREE.NoToneMapping;
const scene = new THREE.Scene();
const HAZE = new THREE.Color("#b9c9d9");
scene.background = null; scene.fog = null;
const camera = new THREE.PerspectiveCamera(30, 1920 / 1080, 0.3, 5000);
// ---------- atmosphère physique (Bruneton / takram) + chaîne de post-production cinéma
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
// la Terre passe dans l'atmosphère ; les graphismes (drapeaux, flèches, textes, explosions) restent nets par-dessus
const overlay = new THREE.Scene();
composer.addPass(new EffectPass(camera, aerial));
composer.addPass(new EffectPass(camera, tone, grade, bc));
composer.addPass(new ClearPass(false, true, false));
const ovPass = new RenderPass(overlay, camera); ovPass.clear = false; composer.addPass(ovPass);
composer.addPass(new EffectPass(camera, bloomFx, vign, grain));
composer.addPass(new EffectPass(camera, new SMAAEffect()));
window.EXPO = 3.4;

const loader = new THREE.TextureLoader();
const load = (u, nearest) => new Promise(r => loader.load(u, t => {
  if (nearest) { t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; }
  else { t.anisotropy = 8; }
  r(t);
}));
const [sat, ctrlN, ctrlL, border, bgT, hmap, bghmap] = await Promise.all([load("sat.jpg"), load("ctrl.png", true), load("ctrl.png"), load("border.png"), load("bg.jpg"), load("height.png"), load("bg_height.png")]);
sat.colorSpace = bgT.colorSpace = THREE.SRGBColorSpace;
// relief : hauteur (unités monde) = valeur * HS ; 1 unité ≈ 13,5 km, relief exagéré x5
const EXAG = 5, HS = 4000 * EXAG / 13500;
const himg = await new Promise(r => { const im = new Image(); im.onload = () => r(im); im.src = "height.png"; });
const hc = document.createElement("canvas"); hc.width = himg.width; hc.height = himg.height; hc.getContext("2d").drawImage(himg, 0, 0);
const hd = hc.getContext("2d").getImageData(0, 0, hc.width, hc.height).data;
const DEPTH = 100 * G.H / G.W;
function elev(x, z) {
  const u = x / 100 + .5, v = z / DEPTH + .5; if (u < 0 || u > 1 || v < 0 || v > 1) return 0;
  const px = Math.min(hc.width - 1, Math.floor(u * hc.width)), py = Math.min(hc.height - 1, Math.floor(v * hc.height));
  return hd[(py * hc.width + px) * 4] / 255 * HS;
}
// courbure de la Terre (rayon ≈ 472 unités) au-delà de 45 unités du centre
const CURV = `float curv(vec3 w, vec3 c){ float d = length(w.xz - c.xz); return pow(max(0., d - 45.), 2.) / 944.; }`;

// ---------- sol : satellite + zones de contrôle animées
const groundU = { sat: { value: sat }, ctrlN: { value: ctrlN }, ctrlL: { value: ctrlL }, border: { value: border },
  day: { value: 0 }, ovA: { value: 0 }, time: { value: 0 }, dim: { value: 0.5 }, slabGlow: { value: 0 } };
Object.assign(groundU, { hmap: { value: hmap }, hs: { value: HS }, cc: { value: new THREE.Vector3() }, haze: { value: HAZE }, fogR: { value: new THREE.Vector2(1e6, 2e6) }, expo: { value: 9 } });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100 * G.H / G.W, 640, 580), new THREE.ShaderMaterial({
  uniforms: groundU, transparent: true,
  vertexShader: `uniform sampler2D hmap; uniform float hs; uniform vec3 cc; varying vec2 vUv; varying vec3 vW; ${CURV}
    void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.); w.y += texture2D(hmap, uv).r * hs; w.y -= curv(w.xyz, cc); vW = w.xyz;
      gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `
  uniform sampler2D sat, ctrlN, ctrlL, border, hmap; uniform float expo; uniform float day, ovA, time, dim, slabGlow, hs; uniform vec3 haze; uniform vec2 fogR; varying vec2 vUv; varying vec3 vW;
  float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
  float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
  void main(){
    vec3 c = texture2D(sat, vUv).rgb;
    c = pow(c, vec3(1.25)) * .86; float l = dot(c, vec3(.299,.587,.114)); c = mix(vec3(l), c, .92);
    vec2 e = vec2(1. / 2048., 0.);
    float dx = texture2D(hmap, vUv + e.xy).r - texture2D(hmap, vUv - e.xy).r, dz = texture2D(hmap, vUv - e.yx * 1.1).r - texture2D(hmap, vUv + e.yx * 1.1).r;
    vec3 nrm = normalize(vec3(-dx * hs * 60., 1., -dz * hs * 60.)); float sh = clamp(dot(nrm, normalize(vec3(-.6, .75, -.45))), 0., 1.);
    c *= .55 + .62 * sh;
    vec2 uv = vec2(vUv.x, 1. - vUv.y);
    vec4 kN = texture2D(ctrlN, vec2(vUv.x, vUv.y)); vec4 kL = texture2D(ctrlL, vec2(vUv.x, vUv.y));
    float zone = floor(kN.r * 255. / 50. + .5); float t = kL.g * 255. / 18.;
    vec3 RED = vec3(.85,.02,.03), GREEN = vec3(.0,.55,.12), YEL = vec3(.95,.62,.0);
    vec3 col = c; float a = 0.;
    float tex = .45 + 1.1 * l;
    if (zone > .5 && zone < 1.5) {
      float lib = smoothstep(t - .04, t + .04, day);
      col = mix(RED, GREEN, lib) * tex; a = ovA;
      float fr = exp(-pow((day - t) / .07, 2.)) * step(.05, day) * step(t, 13.4);
      float fl = n2(vUv * 900. + vec2(0., -time * 6.)) * .6 + n2(vUv * 2400. - time * 3.) * .5;
      col += vec3(1., .5, .1) * fr * (.35 + .9 * fl);
    } else if (zone > 1.5 && zone < 2.5) { col = GREEN * tex; a = ovA; }
    else if (zone > 2.5 && zone < 3.5) { col = YEL * tex; a = ovA; }
    else if (zone > 3.5) { float s = step(.5, fract((vUv.x + vUv.y * 1.1) * 420.)); col = mix(vec3(.25), vec3(.95), s); a = ovA * .95; }
    vec3 o = mix(c, col, a);
    if (zone < .5) o *= dim;
    float fogF = smoothstep(fogR.x, fogR.y, distance(cameraPosition, vW)) * .9;
    vec4 b = texture2D(border, vUv);
    o = mix(o, vec3(.92), b.r * .9);
    o = mix(o, vec3(.85), b.g * .55);
    o += vec3(.6, 1., .7) * b.b * .10 * ovA;
    o *= 1. - b.b * slabGlow * 1.4;
    o = mix(o, haze, fogF) * expo;
    float edge = smoothstep(0., .035, min(min(vUv.x, 1. - vUv.x), min(vUv.y, 1. - vUv.y)));
    gl_FragColor = vec4(o, edge);
    #include <colorspace_fragment>
  }`
}));
ground.rotation.x = -Math.PI / 2; ground.renderOrder = 1; scene.add(ground);
// fond : tout le Moyen-Orient, avec relief, courbure de la Terre et brume à l'horizon
const BX0 = (G.bg[0] - G.W / 2) * SC, BZ0 = (G.bg[1] - G.H / 2) * SC, BX1 = (G.bg[2] - G.W / 2) * SC, BZ1 = (G.bg[3] - G.H / 2) * SC;
const HX0 = (G.bgh[0] - G.W / 2) * SC, HZ0 = (G.bgh[1] - G.H / 2) * SC, HX1 = (G.bgh[2] - G.W / 2) * SC, HZ1 = (G.bgh[3] - G.H / 2) * SC;
const bgU = { expo: groundU.expo, map: { value: bgT }, hmap: { value: bghmap }, hs: { value: HS }, cc: groundU.cc, haze: { value: HAZE }, fogR: groundU.fogR, dim: groundU.dim, ovA: groundU.ovA,
  hb: { value: new THREE.Vector4(HX0, HZ0, HX1 - HX0, HZ1 - HZ0) }, det: { value: new THREE.Vector4(-50, -DEPTH / 2, 50, DEPTH / 2) } };
const bgPlane = new THREE.Mesh(new THREE.PlaneGeometry(BX1 - BX0, BZ1 - BZ0, 360, 300), new THREE.ShaderMaterial({
  uniforms: bgU,
  vertexShader: `uniform sampler2D hmap; uniform float hs; uniform vec3 cc; uniform vec4 hb, det; varying vec2 vUv; varying vec3 vW; ${CURV}
    void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.);
      vec2 hu = vec2((w.x - hb.x) / hb.z, 1. - (w.z - hb.y) / hb.w);
      w.y += texture2D(hmap, hu).r * hs - .06;
      if (w.x > det.x + 1. && w.x < det.z - 1. && w.z > det.y + 1. && w.z < det.w - 1.) w.y -= .5;
      w.y -= curv(w.xyz, cc); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform sampler2D map; uniform vec3 haze; uniform vec2 fogR; uniform float dim, ovA, expo; varying vec2 vUv; varying vec3 vW;
    void main(){ vec3 c = texture2D(map, vUv).rgb; c = pow(c, vec3(1.25)) * .86; float l = dot(c, vec3(.299,.587,.114)); c = mix(vec3(l), c, .92);
      c *= dim; float f = smoothstep(fogR.x, fogR.y, distance(cameraPosition, vW)) * .92; gl_FragColor = vec4(mix(c, haze, f) * expo, 1.);
      #include <colorspace_fragment>
    }`
}));
bgPlane.rotation.x = -Math.PI / 2; bgPlane.position.set((BX0 + BX1) / 2, 0, (BZ0 + BZ1) / 2); scene.add(bgPlane);
// ciel : dégradé brume -> bleu profond
const sky = new THREE.Object3D();   // le ciel vient de l'atmosphère physique

// ---------- drapeaux (canvas)
function star(g, cx, cy, r, col) {
  g.fillStyle = col; g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .4 : r; g.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a)); }
  g.closePath(); g.fill();
}
const syr = G.countries.SYR[0];
let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
for (const p of syr) { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); miny = Math.min(miny, p[1]); maxy = Math.max(maxy, p[1]); }
const CENTER = W3([(minx + maxx) / 2, (miny + maxy) / 2]);
function flagTex(kind) {
  const cv = document.createElement("canvas"); cv.width = 1600; cv.height = 1200; const g = cv.getContext("2d");
  const cols = kind === "rev" ? ["#1F8A44", "#D8D8D2", "#111111"] : ["#CE1126", "#D8D8D2", "#111111"];
  // bandes calées sur la forme de la Syrie (bbox)
  for (let i = 0; i < 3; i++) { g.fillStyle = cols[i]; g.fillRect(0, i * 400, 1600, 400); }
  const sc = kind === "rev" ? "#CE1126" : "#007A3D";
  const xs = kind === "rev" ? [520, 820, 1120] : [610, 1010];
  for (const x of xs) star(g, x, 600, 130, sc);
  // Golan occupé : hachuré
  g.save(); g.beginPath();
  for (const p of G.golan) g.lineTo((p[0] - minx) / (maxx - minx) * 1600, (p[1] - miny) / (maxy - miny) * 1200);
  g.closePath(); g.clip(); g.fillStyle = "#666"; g.fillRect(0, 0, 1600, 1200); g.strokeStyle = "#eee"; g.lineWidth = 4;
  for (let k = -1600; k < 1600; k += 12) { g.beginPath(); g.moveTo(k, 1200); g.lineTo(k + 1200, 0); g.stroke(); }
  g.restore();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
// dalle extrudée de la Syrie
const shape = new THREE.Shape(syr.map(p => new THREE.Vector2((p[0] - G.W / 2) * SC, -(p[1] - G.H / 2) * SC)));
const slabGeo = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 1 });
function slab(tex) {
  const m = new THREE.Mesh(slabGeo, new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { map: { value: tex }, bb: { value: new THREE.Vector4((minx - G.W / 2) * SC, -(maxy - G.H / 2) * SC, (maxx - minx) * SC, (maxy - miny) * SC) }, op: { value: 1 }, shine: { value: 0 } },
    vertexShader: `varying vec3 vP; varying vec3 vN; void main(){ vP = position; vN = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `uniform sampler2D map; uniform vec4 bb; uniform float op, shine; varying vec3 vP; varying vec3 vN;
      void main(){
        vec2 uv = vec2((vP.x - bb.x) / bb.z, (vP.y - bb.y) / bb.w);
        vec3 c = texture2D(map, uv).rgb;
        if (vN.z < .5) { float s = .35 + .45 * max(dot(normalize(vN), normalize(vec3(-.4,.7,.3))), 0.); c *= s; }
        else { float sw = smoothstep(.0, .06, abs(fract(uv.x * .6 - shine) - .5) - .38); c += (1. - sw) * .18; }
        gl_FragColor = vec4(c, op);
        #include <colorspace_fragment>
      }`
  }));
  m.rotation.x = -Math.PI / 2; m.scale.z = 0.001; scene.add(m); return m;
}
const slabOld = slab(flagTex("old")), slabNew = slab(flagTex("rev"));

// ---------- textures de particules
function sprTex(kind) {
  const cv = document.createElement("canvas"); cv.width = cv.height = 128; const g = cv.getContext("2d");
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  if (kind === "fire") { gr.addColorStop(0, "rgba(255,255,230,1)"); gr.addColorStop(.25, "rgba(255,200,80,.9)"); gr.addColorStop(.6, "rgba(255,90,20,.35)"); gr.addColorStop(1, "rgba(255,40,0,0)"); }
  else if (kind === "smoke") { gr.addColorStop(0, "rgba(40,36,34,.85)"); gr.addColorStop(.6, "rgba(30,28,26,.4)"); gr.addColorStop(1, "rgba(20,20,20,0)"); }
  else { gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(.4, "rgba(255,255,255,.5)"); gr.addColorStop(1, "rgba(255,255,255,0)"); }
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(cv);
}
function cloudTex() {
  const cv = document.createElement("canvas"); cv.width = cv.height = 256; const g = cv.getContext("2d");
  for (let i = 0; i < 26; i++) {
    const x = 128 + (rnd(i) - .5) * 120, y = 128 + (rnd(i + 50) - .5) * 70, r = 30 + rnd(i + 99) * 45;
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, "rgba(255,255,255,.35)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  }
  return new THREE.CanvasTexture(cv);
}
// système de points : additif (feu, éclats, feux d'artifice) et normal (fumée)
function pointsLayer(tex, additive, N = 6000) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  geo.setAttribute("col", new THREE.BufferAttribute(new Float32Array(N * 4), 4));
  geo.setAttribute("sz", new THREE.BufferAttribute(new Float32Array(N), 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: tex } }, transparent: true, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    vertexShader: `attribute vec4 col; attribute float sz; varying vec4 vC;
      void main(){ vC = col; vec4 mv = modelViewMatrix * vec4(position,1.); gl_PointSize = sz * 620. / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D map; varying vec4 vC; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC.rgb * t.rgb, vC.a * t.a); }`
  });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts);
  let n = 0;
  return {
    reset() { n = 0; },
    add(p, r, g, b, a, s) { if (n >= N) return; geo.attributes.position.array.set([p.x, p.y, p.z], n * 3); geo.attributes.col.array.set([r, g, b, a], n * 4); geo.attributes.sz.array[n] = s; n++; },
    flush() { geo.setDrawRange(0, n); for (const k of ["position", "col", "sz"]) geo.attributes[k].needsUpdate = true; }
  };
}
function flipLayer(url, grid, N = 2000) {
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
const FIRE = pointsLayer(sprTex("fire"), true), SMOKE = pointsLayer(sprTex("smoke"), false, 3000), GLOW = pointsLayer(sprTex("dot"), true, 4000);

// nuages (intro)
const clouds = [];
const ct = cloudTex();
for (let i = 0; i < 46; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ct, transparent: true, depthWrite: false, opacity: .6 }));
  s.position.set(CENTER.x + (rnd(i * 3) - .5) * 170, 40 + rnd(i * 7) * 110, CENTER.z + (rnd(i * 11) - .5) * 160);
  const sz = 30 + rnd(i * 13) * 50; s.scale.set(sz, sz * .6, 1); s.userData.base = s.position.clone(); scene.add(s); clouds.push(s);
}

// ---------- étiquettes de villes (sprites)
function label(text, color = "#fff", size = 64) {
  const cv = document.createElement("canvas"); const g = cv.getContext("2d"); g.font = `${size}px Anton`;
  const w = Math.ceil(g.measureText(text).width) + 40; cv.width = w; cv.height = size + 40;
  g.font = `${size}px Anton`; g.textBaseline = "middle"; g.lineJoin = "round";
  g.lineWidth = 12; g.strokeStyle = "rgba(0,0,0,.9)"; g.strokeText(text, 20, cv.height / 2);
  g.fillStyle = color; g.fillText(text, 20, cv.height / 2);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
  s.userData.aspect = cv.width / cv.height; s.renderOrder = 10; scene.add(s); return s;
}
const CAPTURE = { Alep: 2.3, Hama: 8.3, Homs: 10.6, Deraa: 9.2, Damas: 11.2, Idlib: -1 };
const cityLab = {}, rings = {};
for (const n of ["Idlib", "Alep", "Hama", "Homs", "Damas", "Deraa"]) {
  cityLab[n] = label(n.toUpperCase());
  const r = new THREE.Mesh(new THREE.RingGeometry(.55, .8, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false }));
  r.rotation.x = -Math.PI / 2; r.position.copy(CITY[n]).setY(elev(CITY[n].x, CITY[n].z) + .1); scene.add(r); rings[n] = r;
}
const labNeighbors = [["TURQUIE", [36.2 * 0 + 0, 0], 37.5, 38.2], ["IRAK", 0, 42.2, 34.2], ["JORDANIE", 0, 37.3, 31.6], ["LIBAN", 0, 35.85, 34.05], ["MÉDITERRANÉE", 0, 33.6, 34.6], ["GOLAN OCCUPÉ", 0, 35.6, 33.08]];
// conversions lon/lat -> monde, via deux villes connues (Mercator)
const lonK = (CITY.Alep.x - CITY.Deraa.x) / (37.16 - 36.10), lon0 = CITY.Alep.x - lonK * 37.16;
const merc = lat => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
const latK = (CITY.Alep.z - CITY.Deraa.z) / (merc(36.20) - merc(32.62)), lat0 = CITY.Alep.z - latK * merc(36.20);
const LL = (lon, lat, y = 0) => new THREE.Vector3(lon0 + lonK * lon, y, lat0 + latK * merc(lat));
CITY.Hmeimim = LL(35.95, 35.41);   // base russe de Hmeimim
const nLabs = labNeighbors.map(([t, , lon, lat]) => { const s = label(t, t.startsWith("GOLAN") ? "#ddd" : "rgba(255,255,255,.75)", t.startsWith("GOLAN") ? 54 : 70); s.userData.pos = LL(lon, lat, 1.2); return s; });

// ---------- drapeaux de victoire (épinglés sur les villes)
const revTex = (() => { const cv = document.createElement("canvas"); cv.width = 300; cv.height = 200; const g = cv.getContext("2d");
  ["#1F8A44", "#D8D8D2", "#111111"].forEach((c, i) => { g.fillStyle = c; g.fillRect(0, i * 66.67, 300, 66.67); });
  [75, 150, 225].forEach(x => star(g, x, 100, 24, "#CE1126")); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const pins = {};
for (const n of ["Alep", "Hama", "Homs", "Deraa", "Damas"]) {
  const grp = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 3.2, 8), new THREE.MeshBasicMaterial({ color: 0xdddddd }));
  pole.position.y = 1.6; grp.add(pole);
  const fg = new THREE.PlaneGeometry(1.8, 1.2, 12, 1); fg.translate(.9, 0, 0);
  const fm = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ map: revTex, side: THREE.DoubleSide }));
  fm.position.y = 2.6; fm.userData.base = fg.attributes.position.array.slice(); grp.add(fm); grp.userData.flag = fm;
  grp.position.copy(CITY[n]).setY(elev(CITY[n].x, CITY[n].z)); grp.scale.setScalar(.001); scene.add(grp); pins[n] = grp;
}

// ---------- flèches d'offensive
function arrowPath(pts) { return new THREE.CatmullRomCurve3(pts.map(p => p.clone().setY(.25)), false, "centripetal"); }
const ARROWS = [
  { c: arrowPath([LL(36.75, 35.98), LL(36.95, 36.12), CITY.Alep]), d0: 0, d1: 2.3 },
  { c: arrowPath([LL(36.68, 35.72), LL(36.75, 35.45), CITY.Hama]), d0: 2.5, d1: 8.3 },
  { c: arrowPath([LL(36.75, 35.05), LL(36.76, 34.9), CITY.Homs]), d0: 8.3, d1: 10.6 },
  { c: arrowPath([LL(36.70, 34.62), LL(36.55, 34.05), CITY.Damas]), d0: 10.6, d1: 11.2 },
  { c: arrowPath([LL(36.10, 32.72), LL(36.15, 33.1), LL(36.25, 33.38)]), d0: 9.0, d1: 11.2 },
];
for (const a of ARROWS) {
  a.len = a.c.getLength();
  a.meshes = [[0x000000, .45, 1.55, -.02], [0xffffff, 1, 1.32, .0], [0x1f9a4d, 1, 1.0, .02]].map(([col, op, wk, dy]) => {
    const m = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide }));
    m.userData = { wk, dy, shadow: col === 0 }; m.renderOrder = 5 + (col === 0 ? 0 : col === 0xffffff ? 1 : 2); scene.add(m); return m;
  });
}
function buildArrow(a, g) {
  for (const m of a.meshes) {
    const { wk, dy, shadow } = m.userData; const w = .42 * wk, hw = 1.0 * wk, hl = Math.min(1.6, a.len * .3) * (wk > 1 ? 1.1 : 1);
    const L = g * a.len; const pos = [];
    if (L < .05) { m.visible = false; continue; } m.visible = true;
    const body = Math.max(0, L - hl), M = 40;
    const at = s => { const q = a.c.getPointAt(clamp(s / a.len, 0, 1)); q.y = elev(q.x, q.z) + .3; return q; };
    const tan = s => a.c.getTangentAt(clamp(s / a.len, 0, 1));
    const off = shadow ? new THREE.Vector3(.35, -.2, .35) : new THREE.Vector3(0, dy + .25, 0);
    for (let i = 0; i < M; i++) {
      const s0 = body * i / M, s1 = body * (i + 1) / M;
      const p0 = at(s0).add(off), p1 = at(s1).add(off), t0 = tan(s0), t1 = tan(s1);
      const w0 = w * (.55 + .45 * (s0 / Math.max(body, 1e-3))), w1 = w * (.55 + .45 * (s1 / Math.max(body, 1e-3)));
      const n0 = new THREE.Vector3(-t0.z, 0, t0.x).multiplyScalar(w0), n1 = new THREE.Vector3(-t1.z, 0, t1.x).multiplyScalar(w1);
      const a0 = p0.clone().add(n0), b0 = p0.clone().sub(n0), a1 = p1.clone().add(n1), b1 = p1.clone().sub(n1);
      pos.push(...a0.toArray(), ...b0.toArray(), ...a1.toArray(), ...b0.toArray(), ...b1.toArray(), ...a1.toArray());
    }
    const pb = at(body).add(off), pt = at(L).add(off), tb = tan(body); const nb = new THREE.Vector3(-tb.z, 0, tb.x).multiplyScalar(hw);
    pos.push(...pb.clone().add(nb).toArray(), ...pb.clone().sub(nb).toArray(), ...pt.toArray());
    m.geometry.dispose(); m.geometry = new THREE.BufferGeometry(); m.geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  }
}

// ---------- avion d'Assad
const plane = new THREE.Group();
{
  const mat = new THREE.MeshBasicMaterial({ color: 0xf2f2f2 }), dark = new THREE.MeshBasicMaterial({ color: 0x8a9099 });
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(.16, .12, 2.4, 12), mat); fus.rotation.x = Math.PI / 2; plane.add(fus);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(.16, .45, 12), mat); nose.rotation.x = Math.PI / 2; nose.position.z = 1.42; plane.add(nose);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(2.6, .04, .5), dark); wing.position.z = .1; plane.add(wing);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.0, .03, .3), dark); tail.position.z = -1.05; plane.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(.04, .5, .35), dark); fin.position.set(0, .25, -1.05); plane.add(fin);
}
plane.scale.setScalar(1.15); scene.add(plane);
const shadowP = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshBasicMaterial({ map: sprTex("dot"), color: 0x000000, transparent: true, opacity: .45, depthWrite: false }));
shadowP.rotation.x = -Math.PI / 2; scene.add(shadowP);
const FLY = new THREE.CatmullRomCurve3([CITY.Damas.clone(), LL(36.0, 34.2), LL(35.75, 34.95), CITY.Hmeimim.clone(), LL(35.6, 36.4), LL(35.9, 37.6), LL(36.4, 39.0)], false, "centripetal");
const flyLen = FLY.getLength();
const T_TAKEOFF = 23.0, T_FLYEND = 28.6;
function planeAt(t) {
  const u = clamp((t - T_TAKEOFF) / (T_FLYEND - T_TAKEOFF));
  const s = u * u * (3 - 2 * u) * .25 + u * .75;
  const p = FLY.getPointAt(clamp(s)); const alt = elev(p.x, p.z) * (1 - easeOut(clamp(s * 6))) + .3 + 4.6 * easeOut(clamp(s * 6));
  return { p: p.setY(alt), tan: FLY.getTangentAt(clamp(s)), s };
}

// ---------- caméra
const V = (p, dx = 0, dz = 0) => p.clone().add(new THREE.Vector3(dx, 0, dz));
const mid = (a, b) => a.clone().add(b).multiplyScalar(.5);
const K = [
  [0.0, V(CENTER, 0, 30), 330, 16, -22], [3.4, CENTER, 84, 50, 0], [6.4, V(CENTER, 0, -2), 78, 48, 0],
  [8.2, mid(CITY.Idlib, CITY.Alep), 30, 40, 10], [10.6, CITY.Alep, 24, 38, 14], [13.8, CITY.Hama, 28, 40, 2],
  [15.9, CITY.Deraa, 27, 40, -10], [18.1, CITY.Homs, 28, 40, -4], [20.9, CITY.Damas, 20, 36, -4], [22.8, CITY.Damas, 16, 32, 2],
];
function camState(t) {
  if (t >= T_TAKEOFF - .2 && t < T_FLYEND + .6) {               // on suit l'avion
    const a = planeAt(Math.min(t, T_FLYEND)); const u = ease((t - (T_TAKEOFF - .2)) / 1.2);
    const tgt = new THREE.Vector3().lerpVectors(CITY.Damas, a.p.clone().setY(a.p.y * .8), u);
    return { tgt, dist: lerp(16, 24, u), pitch: lerp(32, 26, u), yaw: lerp(2, -25, ease((t - T_TAKEOFF) / 5)) };
  }
  if (t >= T_FLYEND + .6) {                                     // vue d'ensemble puis orbite finale
    const a = planeAt(T_FLYEND); const u = ease((t - (T_FLYEND + .6)) / 2.6);
    const tgt = new THREE.Vector3().lerpVectors(a.p.clone().setY(a.p.y * .8), V(CENTER, 0, 3), u);
    return { tgt, dist: lerp(24, 86, u), pitch: lerp(26, 46, u), yaw: lerp(-25, -8, u) + 16 * ease((t - 31) / 5) };
  }
  let i = 0; while (i < K.length - 2 && t > K[i + 1][0]) i++;
  const [t0, p0, d0, pi0, y0] = K[i], [t1, p1, d1, pi1, y1] = K[i + 1];
  const u = ease((t - t0) / (t1 - t0));
  return { tgt: new THREE.Vector3().lerpVectors(p0, p1, u), dist: lerp(d0, d1, u), pitch: lerp(pi0, pi1, u), yaw: lerp(y0, y1, u) };
}
let shake = 0;
function placeCamera(t) {
  const s = camState(t); const pr = s.pitch * Math.PI / 180, yr = s.yaw * Math.PI / 180;
  const off = new THREE.Vector3(Math.sin(yr) * Math.cos(pr), Math.sin(pr), Math.cos(yr) * Math.cos(pr)).multiplyScalar(s.dist);
  const tgt = s.tgt.clone();
  if (shake > 0) { tgt.x += Math.sin(t * 71) * shake * s.dist * .006; tgt.z += Math.cos(t * 59) * shake * s.dist * .006; }
  camera.position.copy(tgt).add(off); camera.lookAt(tgt);
}

// ---------- jour en fonction du temps
const DK = [[0, 0], [6.6, 0], [10.4, 2.6], [14.2, 8.5], [15.8, 9.2], [18.0, 10.6], [20.9, 11.25], [28.8, 11.3], [30.8, 13.6]];
function dayAt(t) { for (let i = 0; i < DK.length - 1; i++) { const [a, da] = DK[i], [b, db] = DK[i + 1]; if (t <= b) return lerp(da, db, clamp((t - a) / (b - a))); } return DK[DK.length - 1][1]; }

// ---------- points de combats sur la ligne de front (lus dans ctrl.png)
const ctrlImg = await new Promise(r => { const im = new Image(); im.onload = () => r(im); im.src = "ctrl.png"; });
const cc = document.createElement("canvas"); cc.width = ctrlImg.width; cc.height = ctrlImg.height;
const cg = cc.getContext("2d"); cg.drawImage(ctrlImg, 0, 0); const cd = cg.getImageData(0, 0, cc.width, cc.height).data;
const frontPts = [];
for (let y = 0; y < cc.height; y += 3) for (let x = 0; x < cc.width; x += 3) {
  const i = (y * cc.width + x) * 4; if (Math.round(cd[i] / 50) === 1) frontPts.push([x, y, cd[i + 1] / 18]);
}
const toW = (x, y) => new THREE.Vector3((x / cc.width - .5) * 100, 0, (y / cc.height - .5) * 100 * G.H / G.W);

// ---------- effets
function burst(p, age, seed, big) {
  p = p.clone(); p.y += elev(p.x, p.z);
  if (big) for (let j = 0; j < 4; j++) {
    const a2 = age - j * .18, D = 1.9; if (a2 < 0 || a2 > D) continue;
    const f = Math.min(24, Math.floor(a2 / D * 25)), off = j ? new THREE.Vector3((rnd(seed + j) - .5) * 2.4, 0, (rnd(seed + j * 2) - .5) * 1.6) : new THREE.Vector3();
    const sz = (j ? 3.2 : 6.5) * (.8 + .4 * easeOut(a2 / D)), hdr = f < 10 ? 3.2 : 1.4;
    EXPL.add(p.clone().add(off).setY(p.y + sz * .32 + a2 * .5), hdr, hdr, hdr, 1, sz, f);
  }
  if (age < 0 || age > 3.2) return;
  const n = big ? 90 : 26, R = big ? 3.2 : 1.1;
  if (age < .18) GLOW.add(p.clone().setY(p.y + 1), 1, .95, .85, (1 - age / .18), big ? 26 : 9);   // flash
  for (let k = 0; k < n; k++) {
    const a = rnd(seed + k) * 6.283, el = rnd(seed + k * 3.1) * 1.3, sp = (.4 + rnd(seed + k * 7.7)) * R;
    const life = .5 + rnd(seed + k * 5.3) * (big ? 1.4 : .7); const u = age / life; if (u > 1) continue;
    const d = sp * easeOut(u);
    const q = p.clone().add(new THREE.Vector3(Math.cos(a) * Math.cos(el) * d, .3 + Math.sin(el) * d * 1.2 - u * u * .8, Math.sin(a) * Math.cos(el) * d));
    FIRE.add(q, 1, .55 + .45 * (1 - u), .2 * (1 - u), (1 - u) * .95, (big ? 1.4 : .7) * (1 - .5 * u));
  }
  for (let k = 0; k < (big ? 30 : 8); k++) {
    const a = rnd(seed * 2 + k) * 6.283, sp = (.3 + rnd(seed + k * 1.7)) * R * .7, life = 1.5 + rnd(seed + k) * 1.6; const u = age / life; if (u > 1 || age < .1) continue;
    const q = p.clone().add(new THREE.Vector3(Math.cos(a) * sp * easeOut(u), .6 + u * (big ? 3.5 : 1.5), Math.sin(a) * sp * easeOut(u)));
    SMOKE.add(q, 1, 1, 1, (1 - u) * .7, (big ? 2.6 : 1.2) * (.6 + u));
  }
}
function fireworks(t) {
  for (let j = 0; j < 14; j++) {
    const t0 = 31.2 + j * .3, age = t - t0; if (age < 0 || age > 2.2) continue;
    const c = CENTER.clone().add(new THREE.Vector3((rnd(j * 9) - .5) * 40, 10 + rnd(j * 4) * 8, (rnd(j * 5) - .5) * 30));
    const pal = [[.2, 1, .45], [1, 1, 1], [1, .2, .25]][j % 3];
    for (let k = 0; k < 70; k++) {
      const a = rnd(j * 100 + k) * 6.283, b = Math.acos(2 * rnd(j * 77 + k) - 1), sp = 4 + rnd(k + j) * 2;
      const d = sp * easeOut(age / 1.4); const dir = new THREE.Vector3(Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a));
      const q = c.clone().addScaledVector(dir, d); q.y -= age * age * 1.2;
      GLOW.add(q, pal[0], pal[1], pal[2], clamp(1 - age / 2.2) * (rnd(k * age * 30) > .2 ? 1 : .3), .5);
    }
  }
}

// ---------- HUD
const MOIS = d => { const day = 27 + Math.floor(d); return day <= 30 ? `${day} NOV. 2024` : `${day - 30} DÉC. 2024`; };
const CAPS = [
  [0.3, 3.4, "27 NOVEMBRE 2024", "La Syrie vit sous la dynastie Assad depuis 54 ans"],
  [3.6, 6.4, "AVANT L'OFFENSIVE", "Le régime tient l'essentiel du pays"],
  [6.6, 9.8, "DÉPART D'IDLIB", "L'opposition lance l'offensive"],
  [9.9, 12.3, "ALEP TOMBE", "En 3 jours seulement · 30 novembre"],
  [12.4, 13.9, "CAP SUR HAMA", "Le régime recule"],
  [14.0, 15.3, "HAMA LIBÉRÉE", "5 décembre"],
  [15.4, 17.7, "LE SUD SE SOULÈVE", "Deraa libérée le 6 décembre"],
  [17.8, 20.6, "HOMS TOMBE", "Dans la nuit du 7 au 8 décembre"],
  [20.7, 22.9, "DAMAS LIBÉRÉE", "8 décembre 2024, à l'aube"],
  [23.1, 28.6, "ASSAD S'ENFUIT", "Vers la base russe de Hmeimim, puis Moscou"],
  [28.8, 30.9, "54 ANS DE DICTATURE", "effondrés en 11 jours"],
  [31.1, 35.6, "SYRIE LIBRE", "8 décembre 2024"],
];
const ct_ = document.getElementById("ct"), cs_ = document.getElementById("cs"), cap = document.getElementById("cap");
let lastCap = null;
function hud(t, day) {
  document.getElementById("dd").textContent = MOIS(Math.min(day, 11.9));
  const dEl = document.getElementById("date"); dEl.style.opacity = clamp((t - .2) / .4) * (1 - clamp((t - 35.3) / .3));
  const fl = day - Math.floor(day); document.getElementById("dd").style.transform = `translateY(${(fl < .12 && day > .1 && day < 11.9) ? (1 - fl / .12) * -30 : 0}px)`;
  document.getElementById("dk").textContent = t > 31 ? "LA SYRIE EST LIBRE" : "OFFENSIVE DE L'OPPOSITION";
  const c = CAPS.find(c => t >= c[0] && t < c[1]);
  if (!c) { cap.style.opacity = 0; } else {
    if (lastCap !== c) { ct_.innerHTML = c[2].split(" ").map(w => `<span>${w}</span>`).join(" "); cs_.textContent = c[3]; lastCap = c; }
    const lt = t - c[0], out = clamp((c[1] - t) / .25);
    cap.style.opacity = out;
    [...ct_.children].forEach((s, i) => { const u = clamp((lt - i * .12) / .22); s.style.transform = `scale(${lerp(1.5, 1, backOut(u))})`; s.style.opacity = u; s.style.filter = `blur(${(1 - u) * 8}px)`; });
    const su = clamp((lt - .35) / .3); cs_.style.opacity = su; cs_.style.transform = `translateY(${(1 - easeOut(su)) * 30}px)`;
    const green = /LIBR|TOMBE|SOUL|S'ENFUIT|DICTATURE|IDLIB/.test(c[2]); ct_.style.color = c[2].includes("ASSAD") || c[2].includes("DICTATURE") ? "#ff4b4b" : green ? "#ffffff" : "#ffffff";
  }
  const leg = document.getElementById("leg"); leg.style.opacity = clamp((t - 4.4) / .5) * (1 - clamp((t - 30.4) / .4));
  leg.style.transform = `translateX(${(1 - easeOut(clamp((t - 4.4) / .5))) * -60}px)`;
  const end = document.getElementById("end"); end.style.opacity = clamp((t - 35.5) / .5); end.style.display = t > 35.4 ? "flex" : "none";
}

// ---------- image t
window.setT = function (t) {
  const day = dayAt(t);
  placeCamera(t); groundU.cc.value.copy(camState(t).tgt); sky.position.copy(camera.position);
  groundU.day.value = day; groundU.time.value = t;
  groundU.ovA.value = .8 * ease((t - 3.8) / 1.8) * (1 - .35 * ease((t - 31) / 1.5));
  groundU.dim.value = lerp(.85, .55, ease((t - 3) / 3));
  // dalle du drapeau du régime (intro), puis drapeau de la révolution (final)
  const hOld = 2.2 * backOut((t - .4) / 1.6) * (1 - ease((t - 3.9) / 1.6));
  slabOld.scale.z = Math.max(.001, hOld); slabOld.visible = hOld > .01; slabOld.material.uniforms.op.value = 1 - ease((t - 4.8) / .7);
  const hNew = 2.8 * backOut((t - 30.9) / 1.4);
  slabNew.scale.z = Math.max(.001, hNew); slabNew.visible = hNew > .01; slabNew.material.uniforms.shine.value = (t - 31) * .5;
  slabNew.position.y = .4 * Math.sin(Math.max(0, t - 32.3) * 1.3) * clamp(t - 32.3);
  groundU.slabGlow.value = Math.max(hOld, hNew) / 3;
  // nuages
  clouds.forEach((s, i) => { s.position.x = s.userData.base.x + t * (1.5 + rnd(i) * 2); s.material.opacity = .38 * (1 - ease((t - 2.0) / 1.6)); s.visible = false; });
  // villes
  for (const n in rings) {
    const cap_ = CAPTURE[n], lib = day >= cap_; const r = rings[n];
    const pulse = (t * 1.3 + n.length * .17) % 1;
    r.material.color.set(lib ? 0x29d36a : 0xff3b3b); r.scale.setScalar(1 + pulse * 1.6); r.material.opacity = (1 - pulse) * .9 * clamp((t - 4.5) / .5);
    const L = cityLab[n]; const cam = camera.position.distanceTo(CITY[n]);
    const k = cam * .03; L.scale.set(k * L.userData.aspect * .9, k * .9, 1); L.position.copy(CITY[n]).setY(k * 1.2 + 1.2 + elev(CITY[n].x, CITY[n].z));
    L.material.opacity = clamp((t - 5) / .5) * (t > 30.6 ? 1 - clamp((t - 30.6) / .4) : 1);
  }
  nLabs.forEach(s => { const cam = camera.position.distanceTo(s.userData.pos); const k = cam * .026; s.scale.set(k * s.userData.aspect, k, 1); s.position.copy(s.userData.pos).setY(s.userData.pos.y + elev(s.userData.pos.x, s.userData.pos.z)); s.material.opacity = .9 * clamp((t - 4.6) / .6) * (1 - clamp((t - 30.6) / .4)); });
  // flèches
  ARROWS.forEach(a => { const g = clamp((day - a.d0) / (a.d1 - a.d0)); buildArrow(a, g * clamp((t - 6.6) / .1)); a.meshes.forEach(m => m.material.opacity = (m.userData.shadow ? .45 : 1) * (1 - clamp((t - 30.4) / .5))); });
  // explosions + drapeaux
  FIRE.reset(); SMOKE.reset(); GLOW.reset(); EXPL.reset(); WISP.reset(); shake = 0;
  const tCap = n => { for (let tt = 6.6; tt < 31; tt += 1 / 60) if (dayAt(tt) >= CAPTURE[n]) return tt; return 99; };
  for (const n of ["Alep", "Hama", "Homs", "Deraa", "Damas"]) {
    if (!pins[n].userData.tc) pins[n].userData.tc = tCap(n);
    const tc = pins[n].userData.tc, age = t - tc;
    burst(CITY[n], age, n.length * 13.7, true);
    if (age > .3 && t < 31) {                       // colonne de fumée qui monte et dérive vers l'est
      const e0 = elev(CITY[n].x, CITY[n].z), fade = clamp((age - .3) / 1.5) * (1 - clamp((t - 30.2) / .8));
      for (let k = 0; k < 46; k++) {
        const u = ((age * .22 + k / 46) % 1), sd = rnd(k * 7.3 + n.length);
        const q = CITY[n].clone().add(new THREE.Vector3((sd - .5) * .8 + u * u * 3.2, e0 + .4 + u * 5.5, (rnd(k * 3.1) - .5) * .8 - u * .6));
        if (k % 2 === 0) WISP.add(q, .55, .52, .5, .75 * Math.sin(Math.PI * u) * fade, 1.6 + u * 4.5, Math.floor((u * 63 + k * 7) % 64));
      }
    }
    if (age > 0 && age < .7) shake = Math.max(shake, 1 - age / .7);
    const g = pins[n]; const s = backOut((age - .35) / .6) * (1 - clamp((t - 30.6) / .4)); g.scale.setScalar(Math.max(.001, s * 1.1)); g.visible = s > .01;
    const f = g.userData.flag, pa = f.geometry.attributes.position, b = f.userData.base;
    for (let i = 0; i < pa.count; i++) { const x = b[i * 3]; pa.array[i * 3 + 2] = Math.sin(x * 3.2 - t * 7) * .12 * x; }
    pa.needsUpdate = true; g.lookAt(camera.position.x, g.position.y, camera.position.z); g.rotateY(-Math.PI / 2 + .5);
  }
  // combats sur le front : éclairs aléatoires
  if (day > .05 && day < 13.3) {
    const fr = Math.floor(t * 30);
    for (let k = 0; k < 220; k++) {
      const i = Math.floor(rnd(fr * .37 + k * 1.913) * frontPts.length), q = frontPts[i];
      if (Math.abs(q[2] - day) > .12) continue;
      const p = toW(q[0], q[1]); const life = rnd(i) * 6;
      const ey = elev(p.x, p.z); const ph = (t * 1.4 + rnd(i * .7)) % 1; if (k % 3 === 0) EXPL.add(p.clone().setY(ey + .35), 2.2, 2.2, 2.2, .9, .9, Math.floor(ph * 25)); else GLOW.add(p.setY(ey + .3), 1, .75, .4, .45, .3 + rnd(k + fr) * .35);
      if (rnd(k * 3 + fr) > .7) SMOKE.add(p.clone().setY(ey + .8), 1, 1, 1, .35, 1.1);
    }
  }
  // avion
  const showP = t >= T_TAKEOFF - .5 && t < T_FLYEND + .3;
  plane.visible = shadowP.visible = showP;
  if (showP) {
    const a = planeAt(t); plane.position.copy(a.p); plane.lookAt(a.p.clone().add(a.tan)); plane.rotateZ(-a.tan.x * .5);
    shadowP.position.set(a.p.x + a.p.y * .3, elev(a.p.x, a.p.z) + .06, a.p.z + a.p.y * .3); shadowP.material.opacity = .5 * (1 - a.p.y / 8);
    for (let k = 1; k < 150; k++) {                               // traînée
      const tt = t - k * .014; if (tt < T_TAKEOFF) break; const b = planeAt(tt);
      const side = new THREE.Vector3(-b.tan.z, 0, b.tan.x).normalize().multiplyScalar(.75);
      for (const sg of [1, -1]) SMOKE.add(b.p.clone().addScaledVector(side, sg * .9).setY(b.p.y - .05), 3, 3, 3, .32 * (1 - k / 150) * clamp(b.p.y - .5), .4 + k * .007);
    }
    GLOW.add(a.p.clone(), 1, .3, .3, .8 * (Math.floor(t * 3) % 2), .35);
  }
  fireworks(t);
  FIRE.flush(); SMOKE.flush(); GLOW.flush(); EXPL.flush(); WISP.flush(); groundU.expo.value = window.EXPO;

  hud(t, day);
  composer.render(1 / 30);
};
for (const o of [...scene.children]) if (o !== ground && o !== bgPlane) overlay.add(o);
await document.fonts.ready;
// les étiquettes ont été dessinées avant le chargement de la police : on les redessine
window.setT(0);
window.dbg = () => ({ vis: plane.visible, pos: plane.position.toArray(), cam: camera.position.toArray() });
window.ready = true;
