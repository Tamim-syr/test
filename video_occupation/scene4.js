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
const [sat, ctrlN, ctrlL, border, bgT, hmap, bghmap] = await Promise.all([load("sat.jpg"), load("ctrl5.png", true), load("ctrl5.png"), load("border.png"), load("bg.jpg"), load("height.png"), load("bg_height.png")]);
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
Object.assign(groundU, { hmap: { value: hmap }, hs: { value: HS }, cc: { value: new THREE.Vector3() }, haze: { value: HAZE }, fogR: { value: new THREE.Vector2(1e6, 2e6) }, expo: { value: 9 }, flash: { value: 0 }, tint: { value: new THREE.Color(1, 1, 1) } });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100 * G.H / G.W, 640, 580), new THREE.ShaderMaterial({
  uniforms: groundU, transparent: true,
  vertexShader: `uniform sampler2D hmap; uniform float hs; uniform vec3 cc; varying vec2 vUv; varying vec3 vW; ${CURV}
    void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.); w.y += texture2D(hmap, uv).r * hs; w.y -= curv(w.xyz, cc); vW = w.xyz;
      gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `
  uniform sampler2D sat, ctrlN, ctrlL, border, hmap; uniform float expo, flash; uniform vec3 tint; uniform float day, ovA, time, dim, slabGlow, hs; uniform vec3 haze; uniform vec2 fogR; varying vec2 vUv; varying vec3 vW;
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
    else if (zone > 3.5 && zone < 4.5) { float s = step(.5, fract((vUv.x + vUv.y * 1.1) * 420.)); col = mix(vec3(.25), vec3(.95), s); a = ovA * .95; }
    else if (zone > 4.5) { float pu = .55 + .45 * sin(time * 6.); col = mix(vec3(.0,.18,1.), vec3(.95,.05,.05), flash) * (.45 + .8 * l) + vec3(.1,.25,1.) * pu * .25; a = ovA; }
    vec3 o = mix(c, col, a);
    if (zone < .5) o *= dim;
    float fogF = smoothstep(fogR.x, fogR.y, distance(cameraPosition, vW)) * .9;
    vec4 b = texture2D(border, vUv);
    o = mix(o, vec3(.92), b.r * .9);
    o = mix(o, vec3(.85), b.g * .55);
    o += vec3(.6, 1., .7) * b.b * .10 * ovA;
    o *= 1. - b.b * slabGlow * 1.4;
    o = mix(o, vec3(1., .12, .1), b.r * flash * .9);
    o = mix(o, haze, fogF) * expo * tint;
    float edge = smoothstep(0., .035, min(min(vUv.x, 1. - vUv.x), min(vUv.y, 1. - vUv.y)));
    gl_FragColor = vec4(o, edge);
    #include <colorspace_fragment>
  }`
}));
ground.rotation.x = -Math.PI / 2; ground.renderOrder = 1; scene.add(ground);
// fond : tout le Moyen-Orient, avec relief, courbure de la Terre et brume à l'horizon
const BX0 = (G.bg[0] - G.W / 2) * SC, BZ0 = (G.bg[1] - G.H / 2) * SC, BX1 = (G.bg[2] - G.W / 2) * SC, BZ1 = (G.bg[3] - G.H / 2) * SC;
const HX0 = (G.bgh[0] - G.W / 2) * SC, HZ0 = (G.bgh[1] - G.H / 2) * SC, HX1 = (G.bgh[2] - G.W / 2) * SC, HZ1 = (G.bgh[3] - G.H / 2) * SC;
const bgU = { expo: groundU.expo, tint: groundU.tint, map: { value: bgT }, hmap: { value: bghmap }, hs: { value: HS }, cc: groundU.cc, haze: { value: HAZE }, fogR: groundU.fogR, dim: groundU.dim, ovA: groundU.ovA,
  hb: { value: new THREE.Vector4(HX0, HZ0, HX1 - HX0, HZ1 - HZ0) }, det: { value: new THREE.Vector4(-50, -DEPTH / 2, 50, DEPTH / 2) } };
const bgPlane = new THREE.Mesh(new THREE.PlaneGeometry(BX1 - BX0, BZ1 - BZ0, 360, 300), new THREE.ShaderMaterial({
  uniforms: bgU,
  vertexShader: `uniform sampler2D hmap; uniform float hs; uniform vec3 cc; uniform vec4 hb, det; varying vec2 vUv; varying vec3 vW; ${CURV}
    void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.);
      vec2 hu = vec2((w.x - hb.x) / hb.z, 1. - (w.z - hb.y) / hb.w);
      w.y += texture2D(hmap, hu).r * hs - .06;
      if (w.x > det.x + 1. && w.x < det.z - 1. && w.z > det.y + 1. && w.z < det.w - 1.) w.y -= .5;
      w.y -= curv(w.xyz, cc); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform sampler2D map; uniform vec3 haze; uniform vec2 fogR; uniform float dim, ovA, expo; uniform vec3 tint; varying vec2 vUv; varying vec3 vW;
    void main(){ vec3 c = texture2D(map, vUv).rgb; c = pow(c, vec3(1.25)) * .86; float l = dot(c, vec3(.299,.587,.114)); c = mix(vec3(l), c, .92);
      c *= dim; float f = smoothstep(fogR.x, fogR.y, distance(cameraPosition, vW)) * .92; gl_FragColor = vec4(mix(c, haze, f) * expo * tint, 1.);
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
  const tex = loader.load(url); tex.colorSpace = THREE.SRGBColorSpace; tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter;   // pas de mipmaps : sur des sprites, SwiftShader prend le plus petit niveau (noir)
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
const EXPL = flipLayer("expl.png", 5), WISP = flipLayer("smoke8.png", 8); window.__fl = () => overlay.children.filter(o => o.isPoints)[0].material;
const FIRE = pointsLayer(sprTex("fire"), true), SMOKE = pointsLayer(sprTex("smoke"), false, 3000), GLOW = pointsLayer(sprTex("dot"), true, 4000);

// nuages (intro)
const clouds = [];
const ct = cloudTex();
for (let i = 0; i < 46; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ct, transparent: true, depthWrite: false, opacity: .6 }));
  s.position.set(CENTER.x + (rnd(i * 3) - .5) * 170, 40 + rnd(i * 7) * 110, CENTER.z + (rnd(i * 11) - .5) * 160);
  const sz = 30 + rnd(i * 13) * 50; s.scale.set(sz, sz * .6, 1); s.userData.base = s.position.clone(); scene.add(s); clouds.push(s);
}


// ---------- étiquettes
function label(text, color = "#fff", size = 64) {
  const cv = document.createElement("canvas"); const g = cv.getContext("2d"); g.font = `${size}px Anton`;
  const w = Math.ceil(g.measureText(text).width) + 40; cv.width = w; cv.height = size + 40;
  g.font = `${size}px Anton`; g.textBaseline = "middle"; g.lineJoin = "round";
  g.lineWidth = 12; g.strokeStyle = "rgba(0,0,0,.9)"; g.strokeText(text, 20, cv.height / 2);
  g.fillStyle = color; g.fillText(text, 20, cv.height / 2);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false }));
  s.userData.aspect = cv.width / cv.height; s.renderOrder = 10; scene.add(s); return s;
}
const lonK = (CITY.Alep.x - CITY.Deraa.x) / (37.16 - 36.10), lon0 = CITY.Alep.x - lonK * 37.16;
const merc = lat => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
const latK = (CITY.Alep.z - CITY.Deraa.z) / (merc(36.20) - merc(32.62)), lat0 = CITY.Alep.z - latK * merc(36.20);
const LL = (lon, lat, y = 0) => new THREE.Vector3(lon0 + lonK * lon, y, lat0 + latK * merc(lat));
// étiquettes : [texte, lon, lat, couleur, taille, visible de, à]
const LABS = [
  ["DERAA", 36.10, 32.62, "#fff", 64, 1, 15], ["QUNEITRA", 35.82, 33.12, "#fff", 56, 1, 15], ["DAMAS", 36.29, 33.51, "#fff", 64, 1, 26],
  ["GOLAN OCCUPÉ", 35.70, 33.0, "#ddd", 50, 2, 15], ["ZONE ENVAHIE", 36.06, 33.32, "#8fb4ff", 50, 2.2, 15],
  ["LIBAN", 35.75, 33.75, "rgba(255,255,255,.75)", 64, 1, 26], ["JORDANIE", 36.4, 32.25, "rgba(255,255,255,.75)", 64, 1, 15],
  ["HOMS", 36.72, 34.73, "#fff", 64, 17, 26], ["HAMA", 36.75, 35.13, "#fff", 64, 17, 26], ["LATTAQUIÉ", 35.79, 35.52, "#fff", 64, 17, 26],
  ["TARTOUS", 35.89, 34.89, "#fff", 64, 17, 26], ["ALEP", 37.16, 36.2, "#fff", 64, 17, 26], ["SYRIE", 38.6, 35.0, "rgba(255,255,255,.85)", 110, 17, 26],
];
const labs = LABS.map(([txt, lon, lat, col, sz, a, b]) => { const s = label(txt, col, sz); s.userData = { ...s.userData, pos: LL(lon, lat), a, b }; return s; });
// repère « ouest de Deraa »
const PIN = LL(35.93, 32.73);
const pinLab = label("OUEST DE DERAA", "#ff5050", 70);
const pinMesh = new THREE.Group();
{ const head = new THREE.Mesh(new THREE.SphereGeometry(.28, 24, 16), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
  head.position.y = 2.1; pinMesh.add(head);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, 2.1, 8), new THREE.MeshBasicMaterial({ color: 0xffffff })); stem.position.y = 1.05; pinMesh.add(stem); }
pinMesh.position.copy(PIN).setY(elev(PIN.x, PIN.z)); scene.add(pinMesh);
const ripples = [0, 1, 2].map(() => { const r = new THREE.Mesh(new THREE.RingGeometry(.8, 1, 64), new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, depthWrite: false }));
  r.rotation.x = -Math.PI / 2; r.position.copy(PIN).setY(elev(PIN.x, PIN.z) + .08); scene.add(r); return r; });
// flèches de l'avancée israélienne
function arrowPath(pts) { return new THREE.CatmullRomCurve3(pts.map(p => p.clone().setY(.25)), false, "centripetal"); }
const ARROWS = [
  { c: arrowPath([LL(35.87, 33.22), LL(35.97, 33.24), LL(36.08, 33.23)]), t0: 11.8 },
  { c: arrowPath([LL(35.90, 32.98), LL(36.00, 32.96), LL(36.10, 32.92)]), t0: 12.1 },
  { c: arrowPath([LL(35.84, 32.80), LL(35.90, 32.76), LL(35.97, 32.73)]), t0: 12.4 },
];
for (const a of ARROWS) {
  a.len = a.c.getLength();
  a.meshes = [[0x000000, .45, 1.55, -.02], [0xffffff, 1, 1.32, .0], [0x2f6fe0, 1, 1.0, .02]].map(([col, op, wk, dy]) => {
    const m = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide }));
    m.userData = { wk, dy, shadow: col === 0 }; m.renderOrder = 5 + (col === 0 ? 0 : col === 0xffffff ? 1 : 2); scene.add(m); return m;
  });
}
function buildArrow(a, g) {
  for (const m of a.meshes) {
    const { wk, dy, shadow } = m.userData; const w = .2 * wk, hw = .5 * wk, hl = Math.min(.8, a.len * .3) * (wk > 1 ? 1.1 : 1);
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


// ---------- frappes : missiles depuis l'ouest (Liban / mer) vers les villes
const STRIKES = [
  [18.28, 36.29, 33.51, 35.3, 33.4], [18.95, 36.72, 34.73, 35.2, 34.2], [19.64, 36.75, 35.13, 35.1, 34.6], [20.1, 35.79, 35.52, 34.9, 35.3],
  [22.95, 35.89, 34.89, 34.9, 34.8], [23.55, 37.16, 36.2, 35.4, 35.9], [24.15, 36.25, 33.48, 35.3, 33.3], [24.5, 36.10, 32.62, 35.5, 32.9],
].map(([t, lo, la, lo0, la0]) => {
  const B = LL(lo, la), A = LL(lo0, la0); const M = A.clone().lerp(B, .5); M.y = A.distanceTo(B) * .35;
  return { t, B, curve: new THREE.QuadraticBezierCurve3(A.setY(1), M, B.clone().setY(elev(B.x, B.z) + .2)) };
});
const FLIGHT = .75;
// ---------- caméra (temps = temps de la vidéo)
const K = [
  [1.15, LL(36.6, 33.4), 330, 18, -22], [3.8, LL(35.95, 32.98), 24, 42, -6],
  [8.9, LL(35.97, 32.92), 22, 42, -10], [11.0, PIN, 10, 34, 0], [14.55, LL(36.0, 32.95), 17, 38, 14],
  [17.2, LL(36.45, 34.05), 68, 50, -4], [21.3, LL(36.4, 34.0), 60, 48, 6], [22.3, LL(35.97, 33.08), 22, 40, -8], [25.0, LL(36.4, 33.9), 46, 44, 10],
  [30.15, LL(36.05, 32.85), 16, 9, 82], [33.05, LL(36.05, 32.85), 12, 7, 96],
  [41.6, LL(37.6, 34.6), 110, 46, -6], [43.2, LL(37.6, 34.6), 95, 44, 4],
];
const CUTS = [1.15, 8.9, 17.2, 30.15, 41.6];   // début de chaque séquence carte (pas d'interpolation entre séquences)
function camState(t) {
  let seg = 0; for (let i = 0; i < CUTS.length; i++) if (t >= CUTS[i] - 1e-6) seg = i;
  const ks = K.filter(k => k[0] >= CUTS[seg] - 1e-6 && (seg + 1 >= CUTS.length || k[0] < CUTS[seg + 1]));
  let i = 0; while (i < ks.length - 2 && t > ks[i + 1][0]) i++;
  const [t0, p0, d0, pi0, y0] = ks[i], [t1, p1, d1, pi1, y1] = ks[Math.min(i + 1, ks.length - 1)];
  const u = t1 > t0 ? (seg === 0 ? (x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)(clamp((t - t0) / (t1 - t0))) : ease((t - t0) / (t1 - t0))) : 0;
  const dist = seg === 0 ? Math.exp(lerp(Math.log(d0), Math.log(d1), u)) : lerp(d0, d1, u);
  return { tgt: new THREE.Vector3().lerpVectors(p0, p1, u), dist, pitch: lerp(pi0, pi1, u), yaw: lerp(y0, y1, u) };
}
let shake = 0, FX = 1;
function placeCamera(t) {
  const s = camState(t); const pr = s.pitch * Math.PI / 180, yr = s.yaw * Math.PI / 180;
  const off = new THREE.Vector3(Math.sin(yr) * Math.cos(pr), Math.sin(pr), Math.cos(yr) * Math.cos(pr)).multiplyScalar(s.dist);
  const tgt = s.tgt.clone(); tgt.y += elev(tgt.x, tgt.z);
  if (shake > 0) { tgt.x += Math.sin(t * 71) * shake * s.dist * .006; tgt.z += Math.cos(t * 59) * shake * s.dist * .006; }
  camera.position.copy(tgt).add(off); camera.lookAt(tgt);
}
function burst(p, age, seed, big) {
  p = p.clone(); p.y += elev(p.x, p.z);
  if (big) for (let j = 0; j < 4; j++) {
    const a2 = age - j * .18, D = 1.9; if (a2 < 0 || a2 > D) continue;
    const f = Math.min(24, Math.floor(a2 / D * 25)), off = j ? new THREE.Vector3((rnd(seed + j) - .5) * 2.4, 0, (rnd(seed + j * 2) - .5) * 1.6) : new THREE.Vector3();
    const sz = (j ? 3.2 : 6.5) * (.8 + .4 * easeOut(a2 / D)), hdr = f < 10 ? 3.2 : 1.4;
    EXPL.add(p.clone().add(off).setY(p.y + sz * FX * .32 + a2 * .5), hdr, hdr, hdr, 1, sz * FX, f);
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

// ---------- HUD
const CAPS = [
  [1.2, 3.78, "L'OCCUPATION ISRAÉLIENNE", "a tué un « terroriste » en Syrie"],
  [8.95, 11.62, "TUÉ DE SANG-FROID", "À l'ouest de Deraa"],
  [11.66, 14.5, "L'INVASION DU TERRITOIRE SYRIEN", "L'armée israélienne avance en Syrie depuis décembre 2024"],
  [17.25, 20.35, "TOUS LES JOURS", "Israël bombarde, Israël tue"],
  [20.4, 22.1, "ET PERSONNE NE DIT RIEN", ""],
  [22.16, 24.95, "ELLE FRANCHIT TOUTES LES LIMITES", ""],
  [30.2, 33.0, "IL EST VIVANT", "auprès de son Seigneur"],
];
const ct_ = document.getElementById("ct"), cs_ = document.getElementById("cs"), cap = document.getElementById("cap");
let lastCap = null;
function hud(t) {
  const c = CAPS.find(c => t >= c[0] && t < c[1]);
  if (!c) { cap.style.opacity = 0; } else {
    if (lastCap !== c) { ct_.innerHTML = c[2].split(" ").map(w => `<span>${w}</span>`).join(" "); cs_.textContent = c[3]; cs_.style.display = c[3] ? "inline-block" : "none"; lastCap = c; }
    const lt = t - c[0], out = clamp((c[1] - t) / .2);
    cap.style.opacity = out;
    [...ct_.children].forEach((s, i) => { const u = clamp((lt - i * .1) / .2); s.style.transform = `scale(${lerp(1.5, 1, backOut(u))})`; s.style.opacity = u; s.style.filter = `blur(${(1 - u) * 8}px)`; });
    const su = clamp((lt - .3) / .3); cs_.style.opacity = su; cs_.style.transform = `translateY(${(1 - easeOut(su)) * 30}px)`;
    ct_.style.color = /TUÉ|LIMITES|PERSONNE|BOMBARDE/.test(c[2]) ? "#ff4b4b" : "#ffffff";
  }
  const leg = document.getElementById("leg"); leg.style.opacity = (t > 1.8 && t < 25.2) ? clamp((t - 2.0) / .4) : 0;
  const end = document.getElementById("end"); end.style.opacity = clamp((t - 41.7) / .4); end.style.display = t > 41.6 ? "flex" : "none";
}
// ---------- image t
const SUN_DAY = new THREE.Vector3(), SUN_EVE = new THREE.Vector3();
getSunDirectionECEF(new Date("2025-01-20T09:30:00Z"), SUN_DAY); getSunDirectionECEF(new Date("2025-01-20T14:32:00Z"), SUN_EVE);
clouds.forEach(c => c.visible = false);
window.setT = function (t) {
  placeCamera(t); groundU.cc.value.copy(camState(t).tgt); FX = clamp(camState(t).dist / 26, 1, 2.6);
  groundU.time.value = t; groundU.day.value = 0; groundU.dim.value = 1; groundU.slabGlow.value = 0;
  groundU.ovA.value = t < 1.6 ? 0 : .8 * ease((t - 1.6) / .9);
  groundU.flash.value = (t > 22.1 && t < 25) ? (.5 + .5 * Math.sin((t - 22.1) * 12)) * clamp((25 - t) / .4) : 0;
  const eve = t >= 30.1 && t < 41.5;
  aerial.sunDirection.copy(eve ? SUN_EVE : SUN_DAY);
  window.EXPO = eve ? 1.9 : 3.4; groundU.tint.value.set(eve ? 1.25 : 1, eve ? .82 : 1, eve ? .62 : 1);
  // étiquettes
  labs.forEach(s => { const u = s.userData, p = u.pos.clone(); p.y = elev(p.x, p.z) + 1.0; const d = camera.position.distanceTo(p), k = d * .028 * (u.aspect > 6 ? 1.4 : 1);
    s.scale.set(k * u.aspect * .9, k * .9, 1); s.position.copy(p).setY(p.y + k * .6); s.material.opacity = clamp((t - u.a) / .4) * (t < u.b ? 1 : 0); });
  // repère + ondes
  const pa = t - 10.7; const show = t > 8.9 && t < 15;
  pinMesh.visible = show && pa > 0; pinMesh.scale.setScalar(Math.max(.001, backOut(pa / .5)) * (camera.position.distanceTo(PIN) * .045));
  ripples.forEach((r, i) => { const u = ((pa * .7 + i / 3) % 1); r.visible = show && pa > 0; r.scale.setScalar(.1 + u * 1.1); r.material.opacity = (1 - u) * .9; });
  { const d = camera.position.distanceTo(PIN), k = d * .03; pinLab.scale.set(k * pinLab.userData.aspect * .9, k * .9, 1); pinLab.position.copy(PIN).setY(elev(PIN.x, PIN.z) + k * 2.2);
    pinLab.material.opacity = show ? clamp((pa - .2) / .3) : 0; }
  // flèches
  ARROWS.forEach(a => { const g = (t > 8.9 && t < 15) ? easeOut((t - a.t0) / 1.3) : (t > 22.1 && t < 25 ? 1 : 0); buildArrow(a, g); });
  // effets
  FIRE.reset(); SMOKE.reset(); GLOW.reset(); EXPL.reset(); WISP.reset(); shake = 0;
  STRIKES.forEach((st, j) => {
    const tl = st.t - FLIGHT;
    if (t >= tl && t < st.t) {                                           // missile en vol + traînée
      const u = (t - tl) / FLIGHT, h = st.curve.getPoint(u);
      GLOW.add(h, 1, .85, .6, 1, .5 * FX); FIRE.add(h, 1, .7, .3, .9, .45 * FX);
      for (let k = 1; k < 40; k++) { const v = u - k * .012; if (v < 0) break; SMOKE.add(st.curve.getPoint(v), 1.4, 1.4, 1.4, .45 * (1 - k / 40), (.25 + k * .02) * FX); }
    }
    const age = t - st.t; burst(st.B, age, j * 17.3 + 5, true);
    if (age > 0 && age < .6) shake = Math.max(shake, (1 - age / .6) * .6);
    if (age > .4 && t < 25.2) for (let k = 0; k < 18; k++) {          // colonne de fumée
      const u = ((age * .25 + k / 18) % 1), e0 = elev(st.B.x, st.B.z);
      const q = st.B.clone().add(new THREE.Vector3(u * u * 2.2 + (rnd(k + j) - .5) * .5, e0 + .4 + u * 4.5, -u * .4));
      WISP.add(q, .5, .48, .46, .7 * Math.sin(Math.PI * u) * clamp((age - .4) / 1.2), (1.4 + u * 4) * FX, Math.floor((u * 63 + k * 9) % 64));
    }
  });
  if (t > 30.1 && t < 33.1) for (let k = 0; k < 14; k++) {             // fumée lointaine au coucher du soleil
    const u = ((t * .12 + k / 14) % 1), e0 = elev(PIN.x, PIN.z);
    WISP.add(PIN.clone().add(new THREE.Vector3(u * 1.5, e0 + .3 + u * 3.5, -u * .3)), .55, .45, .4, .6 * Math.sin(Math.PI * u), 1.2 + u * 3, Math.floor((u * 63 + k * 9) % 64));
  }
  FIRE.flush(); SMOKE.flush(); GLOW.flush(); EXPL.flush(); WISP.flush(); groundU.expo.value = window.EXPO;
  hud(t);
  composer.render(1 / 30);
};
for (const o of [...scene.children]) if (o !== ground && o !== bgPlane) overlay.add(o);
await document.fonts.ready;
window.setT(1.2);
window.dbg = () => overlay.children.filter(o => o.isPoints).slice(0, 1).map(o => { const g = o.geometry; const n = g.drawRange.count; return { n, pos: Array.from(g.attributes.position.array.slice(0, 6)), sz: Array.from(g.attributes.sz.array.slice(0, 2)), fr: Array.from(g.attributes.fr.array.slice(0, 2)), col: Array.from(g.attributes.col.array.slice(0, 8)), cam: camera.position.toArray(), max: renderer.getContext().getParameter(renderer.getContext().ALIASED_POINT_SIZE_RANGE) }; });
window.ready = true;
