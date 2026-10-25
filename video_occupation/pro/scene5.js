// Carte 3D animée façon GEOlayers : offensive du 27 nov. au 8 déc. 2024 (rendu image par image, piloté par setT(t))
import * as THREE from "three";
import { EffectComposer, RenderPass, EffectPass, ClearPass, BloomEffect, ToneMappingEffect, ToneMappingMode, VignetteEffect, NoiseEffect, BlendFunction,
  SMAAEffect, HueSaturationEffect, BrightnessContrastEffect } from "postprocessing";
import { AerialPerspectiveEffect, PrecomputedTexturesLoader, getSunDirectionECEF } from "@takram/three-atmosphere";
import { Ellipsoid, Geodetic, radians } from "@takram/three-geospatial";


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
const grade = new HueSaturationEffect({ saturation: -.08 }), bc = new BrightnessContrastEffect({ contrast: .16, brightness: -.02 });
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
    c = pow(c, vec3(1.25)) * .86; float l = dot(c, vec3(.299,.587,.114)); c = mix(vec3(l), c, .5) * vec3(.8,.9,1.05) * .8;
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
    else if (zone > 3.5 && zone < 4.5) { float s = 1. - smoothstep(.06, .14, abs(fract((vUv.x + vUv.y * 1.1) * 900.) - .5));
      col = mix(c * vec3(1.05,.85,.85), vec3(1.,.42,.42), s * .75); a = ovA; }
    else if (zone > 4.5) { float st = 1. - smoothstep(.04, .1, abs(fract((vUv.x - vUv.y) * 520. + time * .5) - .5));
      col = mix(c, vec3(1.,.2,.22), .38 + .12 * sin(time * 3.)) + vec3(1.,.3,.3) * st * .35; a = ovA; }
    // contour lumineux des zones occupées
    vec2 q = vec2(1.6 / 2048., 0.);
    float zr = floor(texture2D(ctrlN, vUv + q.xy).r * 255. / 50. + .5), zl = floor(texture2D(ctrlN, vUv - q.xy).r * 255. / 50. + .5);
    float zu = floor(texture2D(ctrlN, vUv + q.yx * 1.1).r * 255. / 50. + .5), zd = floor(texture2D(ctrlN, vUv - q.yx * 1.1).r * 255. / 50. + .5);
    float occ = step(3.5, zone), edgeZ = occ * (1. - step(3.5, min(min(zr, zl), min(zu, zd))));
    float edgeO = (1. - occ) * step(3.5, max(max(zr, zl), max(zu, zd)));
    vec3 o = mix(c, col, a);
    o = mix(o, vec3(1.,.45,.45), max(edgeZ, edgeO * .6) * ovA);
    if (zone < .5) o *= dim;
    float fogF = smoothstep(fogR.x, fogR.y, distance(cameraPosition, vW)) * .9;
    vec4 b = texture2D(border, vUv);
    o = mix(o, vec3(.95), b.r * .55);
    o = mix(o, vec3(.8), b.g * .3);
    o += vec3(.9, .95, 1.) * b.b * .05 * ovA;
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
    void main(){ vec3 c = texture2D(map, vUv).rgb; c = pow(c, vec3(1.25)) * .86; float l = dot(c, vec3(.299,.587,.114)); c = mix(vec3(l), c, .5) * vec3(.8,.9,1.05) * .8;
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
const lonK = (CITY.Alep.x - CITY.Deraa.x) / (37.16 - 36.10), lon0 = CITY.Alep.x - lonK * 37.16;
const merc = lat => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
const latK = (CITY.Alep.z - CITY.Deraa.z) / (merc(36.20) - merc(32.62)), lat0 = CITY.Alep.z - latK * merc(36.20);
const LL = (lon, lat, y = 0) => new THREE.Vector3(lon0 + lonK * lon, y, lat0 + latK * merc(lat));
// étiquettes : [texte, lon, lat, classe, taille(inutilisé), visible de, à]
const LABS = [
  ["DERAA", 36.10, 32.62, "#fff", 64, 1, 15], ["QUNEITRA", 35.82, 33.12, "#fff", 56, 1, 15], ["DAMAS", 36.29, 33.51, "#fff", 64, 1, 26],
  ["GOLAN OCCUPÉ", 35.70, 33.0, "zone", 0, 2, 15], ["ZONE ENVAHIE", 36.04, 33.36, "zone", 0, 2.2, 15],
  ["LIBAN", 35.75, 33.75, "rgba(255,255,255,.75)", 64, 1, 26], ["JORDANIE", 36.4, 32.25, "rgba(255,255,255,.75)", 64, 1, 15],
  ["HOMS", 36.72, 34.73, "#fff", 64, 17, 26], ["HAMA", 36.75, 35.13, "#fff", 64, 17, 26], ["LATTAQUIÉ", 35.79, 35.52, "#fff", 64, 17, 26],
  ["TARTOUS", 35.89, 34.89, "#fff", 64, 17, 26], ["ALEP", 37.16, 36.2, "#fff", 64, 17, 26], ["SYRIE", 38.6, 35.0, "rgba(255,255,255,.85)", 110, 17, 26],
];

const labs = LABS.map(([txt, lon, lat, col, sz, a, b]) => {
  const d = document.createElement("div"); d.className = "lab" + (["LIBAN", "JORDANIE", "SYRIE"].includes(txt) ? " country" : col === "zone" ? " zone" : "");
  d.textContent = txt; document.getElementById("labs").appendChild(d);
  return { d, pos: LL(lon, lat), a, b, dot: !["LIBAN", "JORDANIE", "SYRIE", "GOLAN OCCUPÉ", "ZONE ENVAHIE"].includes(txt) };
});
const PIN = LL(35.93, 32.73);
const ARROWS = [
  { c: new THREE.CatmullRomCurve3([LL(35.87, 33.22), LL(35.97, 33.24), LL(36.08, 33.23)]), t0: 11.8 },
  { c: new THREE.CatmullRomCurve3([LL(35.90, 32.98), LL(36.00, 32.96), LL(36.10, 32.92)]), t0: 12.1 },
  { c: new THREE.CatmullRomCurve3([LL(35.84, 32.80), LL(35.90, 32.76), LL(35.97, 32.73)]), t0: 12.4 },
];
const STRIKES = [
  [18.28, 36.29, 33.51, 35.3, 33.4], [18.95, 36.72, 34.73, 35.2, 34.2], [19.64, 36.75, 35.13, 35.1, 34.6], [20.1, 35.79, 35.52, 34.9, 35.3],
  [22.95, 35.89, 34.89, 34.9, 34.8], [23.55, 37.16, 36.2, 35.4, 35.9], [24.15, 36.25, 33.48, 35.3, 33.3], [24.5, 36.10, 32.62, 35.5, 32.9],
].map(([t, lo, la, lo0, la0]) => {
  const B = LL(lo, la), A = LL(lo0, la0); const M = A.clone().lerp(B, .5); M.y = A.distanceTo(B) * .3;
  return { t, B, curve: new THREE.QuadraticBezierCurve3(A.setY(1), M, B.clone().setY(elev(B.x, B.z) + .15)) };
});
const FLIGHT = .8;
// caméra : mouvements lents et continus (temps = temps de la vidéo)
const K = [
  [1.15, LL(36.6, 33.4), 330, 18, -22], [3.8, LL(35.95, 32.98), 26, 44, -8],
  [8.9, LL(35.97, 32.95), 21, 44, -12], [11.0, PIN, 12.5, 40, -4], [14.55, LL(36.0, 32.97), 17, 42, 10],
  [17.2, LL(36.45, 34.05), 70, 52, -6], [21.3, LL(36.4, 34.0), 62, 50, 4], [22.3, LL(35.97, 33.08), 24, 44, -8], [25.0, LL(36.3, 33.75), 44, 47, 8],
  [30.15, LL(36.05, 32.85), 16, 9, 82], [33.05, LL(36.05, 32.85), 13, 7, 92],
  [41.6, LL(37.6, 34.6), 110, 46, -6], [43.2, LL(37.6, 34.6), 98, 44, 2],
];
const CUTS = [1.15, 8.9, 17.2, 30.15, 41.6];
function camState(t) {
  let seg = 0; for (let i = 0; i < CUTS.length; i++) if (t >= CUTS[i] - 1e-6) seg = i;
  const ks = K.filter(k => k[0] >= CUTS[seg] - 1e-6 && (seg + 1 >= CUTS.length || k[0] < CUTS[seg + 1]));
  let i = 0; while (i < ks.length - 2 && t > ks[i + 1][0]) i++;
  const [t0, p0, d0, pi0, y0] = ks[i], [t1, p1, d1, pi1, y1] = ks[Math.min(i + 1, ks.length - 1)];
  const x = clamp((t - t0) / Math.max(1e-6, t1 - t0));
  const u = seg === 0 ? (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2) : x * x * x * (x * (x * 6 - 15) + 10);
  const dist = Math.exp(lerp(Math.log(d0), Math.log(d1), u));
  return { tgt: new THREE.Vector3().lerpVectors(p0, p1, u), dist, pitch: lerp(pi0, pi1, u), yaw: lerp(y0, y1, u) };
}
let shake = 0, FX = 1;
function placeCamera(t) {
  const s = camState(t); const pr = s.pitch * Math.PI / 180, yr = s.yaw * Math.PI / 180;
  const off = new THREE.Vector3(Math.sin(yr) * Math.cos(pr), Math.sin(pr), Math.cos(yr) * Math.cos(pr)).multiplyScalar(s.dist);
  const tgt = s.tgt.clone(); tgt.y += elev(tgt.x, tgt.z);
  if (shake > 0) { tgt.x += Math.sin(t * 47) * shake * s.dist * .0025; tgt.z += Math.cos(t * 41) * shake * s.dist * .0025; }
  camera.position.copy(tgt).add(off); camera.lookAt(tgt); camera.updateMatrixWorld(true);
}
function burst(p, age, seed, big) {
  p = p.clone(); p.y += elev(p.x, p.z);
  if (big) for (let j = 0; j < 4; j++) {
    const a2 = age - j * .18, D = 1.9; if (a2 < 0 || a2 > D) continue;
    const f = Math.min(24, Math.floor(a2 / D * 25)), off = j ? new THREE.Vector3((rnd(seed + j) - .5) * 2.4, 0, (rnd(seed + j * 2) - .5) * 1.6) : new THREE.Vector3();
    const sz = (j ? 3.2 : 6.5) * (.8 + .4 * easeOut(a2 / D)), hdr = f < 10 ? 2.2 : 1.2;
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


// ---------- graphismes vectoriels (SVG projeté) et cartouches
const NS = "http://www.w3.org/2000/svg";
const $ = id => document.getElementById(id);
function el(tag, attrs, parent) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
function proj(v) { const p = v.clone().project(camera); return { x: (p.x + 1) / 2 * 1920, y: (1 - p.y) / 2 * 1080, ok: p.z < 1 && p.z > -1 }; }
const ground3 = (v, dy = .05) => { const w = v.clone(); w.y = elev(w.x, w.z) + dy; return w; };
// frontière syrienne (vectorielle)
const SYRPTS = G.countries.SYR[0].filter((_, i) => i % 6 === 0).map(p => W3(p));
const gB = $("g-border");
const borderPath = el("path", { fill: "none", stroke: "#ff4d4f", "stroke-width": 3, filter: "url(#glow)", opacity: 0 }, gB);
// réticule « ouest de Deraa »
const gR = $("g-ret");
const ret = { g: el("g", {}, gR) };
ret.pulse = [0, 1, 2].map(() => el("circle", { r: 10, fill: "none", stroke: "#ff4d4f", "stroke-width": 1.5 }, ret.g));
ret.outer = el("circle", { r: 44, fill: "none", stroke: "#ff4d4f", "stroke-width": 1.5, "stroke-dasharray": "6 6", filter: "url(#glow)" }, ret.g);
ret.inner = el("circle", { r: 9, fill: "#ff4d4f", filter: "url(#glow)" }, ret.g);
ret.ticks = el("path", { d: "M-62 0H-50M50 0H62M0 -62V-50M0 50V62", stroke: "#fff", "stroke-width": 2 }, ret.g);
ret.lead = el("path", { d: "M0 0", stroke: "#fff", "stroke-width": 1.2, fill: "none" }, ret.g);
ret.box = el("g", {}, ret.g);
ret.t1 = el("text", { x: 0, y: 0, fill: "#fff", "font-family": "InterTight", "font-weight": 700, "font-size": 24, "letter-spacing": "1" }, ret.box); ret.t1.textContent = "Ouest de Deraa";
ret.t2 = el("text", { x: 0, y: 24, fill: "#ff8a8c", "font-family": "Plex", "font-size": 14, "letter-spacing": "2" }, ret.box); ret.t2.textContent = "32°43′N  35°56′E";
// flèches et missiles
const gA = $("g-arrows"), gM = $("g-miss"), gRi = $("g-rings");
const arrowEls = ARROWS.map(() => ({ glow: el("path", { fill: "none", stroke: "#ff4d4f", "stroke-width": 9, opacity: .35, filter: "url(#glow2)", "stroke-linecap": "round" }, gA),
  line: el("path", { fill: "none", stroke: "#ff4d4f", "stroke-width": 3.5, "stroke-linecap": "round" }, gA),
  core: el("path", { fill: "none", stroke: "#ffe2e2", "stroke-width": 1.2, "stroke-linecap": "round" }, gA),
  head: el("path", { fill: "#ff4d4f", filter: "url(#glow)" }, gA) }));
const missEls = STRIKES.map(() => ({ trail: [...Array(12)].map(() => el("path", { fill: "none", stroke: "#ffd9c2", "stroke-linecap": "round" }, gM)),
  head: el("circle", { r: 3.5, fill: "#fff", filter: "url(#glow)" }, gM), ring: el("path", { fill: "none", stroke: "#ffb08a", "stroke-width": 2 }, gRi) }));
function curvePath(pts) { return pts.map((p, i) => (i ? "L" : "M") + p.x.toFixed(1) + " " + p.y.toFixed(1)).join(""); }
const CARDS = [
  [1.2, 3.78, "Sud de la Syrie", "L'occupation israélienne", "a tué un « terroriste »"],
  [8.95, 11.62, "Province de Deraa", "Tué de sang-froid", "Un homme handicapé, à l'ouest de Deraa"],
  [11.66, 14.5, "Depuis décembre 2024", "Invasion du territoire syrien", "L'armée israélienne avance au-delà de la ligne de 1974"],
  [17.25, 22.05, "Syrie", "Tous les jours", "Israël bombarde, Israël tue — et personne ne dit rien"],
  [22.16, 24.95, "Syrie", "Elle franchit toutes les limites", ""],
  [30.2, 33.0, "Sud de la Syrie", "Il est vivant", "auprès de son Seigneur"],
];
const COORDS = [[1.15, "33°04′N  35°57′E"], [8.9, "32°43′N  35°56′E"], [17.2, "34°40′N  36°45′E"], [30.15, "32°51′N  36°03′E"], [41.6, ""]];
let lastCard = null;
function hud(t) {
  const c = CARDS.find(c => t >= c[0] && t < c[1]), card = $("card");
  if (!c) card.style.opacity = 0; else {
    if (lastCard !== c) { $("ck").textContent = c[2]; $("ct").innerHTML = c[3].split(" ").map(w => `<span>${w}</span>`).join(" "); $("cs").textContent = c[4]; lastCard = c; }
    const lt = t - c[0]; card.style.opacity = clamp((c[1] - t) / .25);
    $("cbar").style.height = (easeOut(lt / .45) * 100) + "%";
    $("ck").style.opacity = clamp((lt - .05) / .3); $("ck").style.transform = `translateX(${(1 - easeOut(lt / .4)) * -14}px)`;
    [...$("ct").children].forEach((s, i) => { const u = easeOut((lt - .12 - i * .07) / .45); s.style.opacity = u; s.style.transform = `translateY(${(1 - u) * 26}px)`; s.style.filter = `blur(${(1 - u) * 6}px)`; });
    const su = easeOut((lt - .45) / .5); $("cs").style.opacity = su; $("cs").style.transform = `translateY(${(1 - su) * 12}px)`;
  }
  let co = ""; for (const [a, s] of COORDS) if (t >= a) co = s; $("coord").textContent = co;
  $("leg").style.opacity = (t > 1.8 && t < 25.2) ? clamp((t - 2.0) / .5) : 0;
  const end = $("end"); end.style.display = t > 41.6 ? "flex" : "none"; end.style.opacity = clamp((t - 41.6) / .35); $("eline").style.width = (easeOut((t - 41.8) / .6) * 260) + "px";
  // étiquettes
  labs.forEach(L => {
    const vis = t >= L.a && t < L.b; const p = proj(ground3(L.pos, .3));
    if (!vis || !p.ok) { L.d.style.opacity = 0; return; }
    L.d.style.opacity = clamp((t - L.a) / .4);
    L.d.style.left = (p.x + (L.dot ? 12 : 0)) + "px"; L.d.style.top = (p.y - (L.dot ? 22 : 10)) + "px";
    L.d.style.transform = L.dot ? "none" : "translateX(-50%)";
  });
  const dots = $("g-dots"); dots.innerHTML = "";
  labs.forEach(L => { if (!L.dot || !(t >= L.a && t < L.b)) return; const p = proj(ground3(L.pos, .3)); if (!p.ok) return;
    el("circle", { cx: p.x, cy: p.y, r: 4, fill: "#fff", stroke: "rgba(0,0,0,.6)", "stroke-width": 1.5, opacity: clamp((t - L.a) / .4) }, dots); });
  // frontière : flash rouge sur « toutes les limites »
  const fl = (t > 22.1 && t < 25) ? (.55 + .45 * Math.sin((t - 22.1) * 9)) * clamp((25 - t) / .4) * clamp((t - 22.1) / .2) : 0;
  borderPath.setAttribute("opacity", fl);
  if (fl > 0) borderPath.setAttribute("d", curvePath(SYRPTS.map(v => proj(ground3(v, .1)))) + "Z");
  // réticule
  const pa = t - 10.4, showR = t > 8.9 && t < 14.6 && pa > 0;
  ret.g.setAttribute("opacity", showR ? clamp(pa / .25) : 0);
  if (showR) {
    const p = proj(ground3(PIN, .1)); ret.g.setAttribute("transform", `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
    const s = lerp(2.2, 1, easeOut(pa / .5)); ret.outer.setAttribute("r", 44 * s); ret.outer.setAttribute("transform", `rotate(${(t * 40) % 360})`);
    ret.ticks.setAttribute("transform", `scale(${s})`);
    ret.pulse.forEach((c, i) => { const u = ((pa * .8 + i / 3) % 1); c.setAttribute("r", 10 + u * 90); c.setAttribute("opacity", (1 - u) * .8); });
    const lu = easeOut((pa - .25) / .4); ret.lead.setAttribute("d", `M38 -30L${38 + 60 * lu} ${-30 - 50 * lu}H${38 + 60 * lu + 30 * lu}`);
    ret.box.setAttribute("transform", `translate(${38 + 96} ${-88})`); ret.box.setAttribute("opacity", clamp((pa - .5) / .3));
  }
  // flèches d'avancée
  ARROWS.forEach((a, i) => {
    const g = (t > 8.9 && t < 14.6) ? easeOut((t - a.t0) / 1.4) : (t > 22.1 && t < 25 ? 1 : 0); const E = arrowEls[i];
    if (g < .02) { for (const k in E) E[k].setAttribute("opacity", 0); return; }
    const pts = []; for (let k = 0; k <= 30; k++) pts.push(proj(ground3(a.c.getPoint(k / 30 * g), .2)));
    const d = curvePath(pts); E.glow.setAttribute("d", d); E.line.setAttribute("d", d); E.core.setAttribute("d", d);
    E.glow.setAttribute("opacity", .35); E.line.setAttribute("opacity", 1); E.core.setAttribute("opacity", .9); E.head.setAttribute("opacity", 1);
    const p1 = pts[pts.length - 1], p0 = pts[pts.length - 3]; const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x), L = 16, W = 8;
    const bx = p1.x - Math.cos(ang) * L, by = p1.y - Math.sin(ang) * L;
    E.head.setAttribute("d", `M${p1.x} ${p1.y}L${bx - Math.sin(ang) * W} ${by + Math.cos(ang) * W}L${bx + Math.sin(ang) * W} ${by - Math.cos(ang) * W}Z`);
  });
  // missiles : traînée lumineuse dégradée + onde de choc au sol
  STRIKES.forEach((st, j) => {
    const E = missEls[j], tl = st.t - FLIGHT, u = (t - tl) / FLIGHT;
    if (u > 0 && u < 1) {
      const head = proj(st.curve.getPoint(u)); E.head.setAttribute("cx", head.x); E.head.setAttribute("cy", head.y); E.head.setAttribute("opacity", 1);
      E.trail.forEach((pe, k) => { const a0 = Math.max(0, u - (k + 1) * .035), a1 = Math.max(0, u - k * .035);
        const pts = [a0, (a0 + a1) / 2, a1].map(v => proj(st.curve.getPoint(v))); pe.setAttribute("d", curvePath(pts));
        pe.setAttribute("stroke-width", (3.2 - k * .22).toFixed(2)); pe.setAttribute("opacity", ((1 - k / 12) * .9).toFixed(2)); });
    } else { E.head.setAttribute("opacity", 0); E.trail.forEach(pe => pe.setAttribute("opacity", 0)); }
    const age = t - st.t;
    if (age > 0 && age < 1.4 && t < 25.2) {
      const R = .4 + easeOut(age / 1.4) * 3.2 * FX, pts = [];
      for (let k = 0; k <= 36; k++) { const a = k / 36 * Math.PI * 2; pts.push(proj(ground3(st.B.clone().add(new THREE.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R)), .08))); }
      E.ring.setAttribute("d", curvePath(pts) + "Z"); E.ring.setAttribute("opacity", (1 - age / 1.4) * .9);
    } else E.ring.setAttribute("opacity", 0);
  });
}
// ---------- image t
const SUN_DAY = new THREE.Vector3(), SUN_EVE = new THREE.Vector3();
getSunDirectionECEF(new Date("2025-01-20T09:30:00Z"), SUN_DAY); getSunDirectionECEF(new Date("2025-01-20T14:32:00Z"), SUN_EVE);
clouds.forEach(c => c.visible = false);
window.setT = function (t) {
  placeCamera(t); groundU.cc.value.copy(camState(t).tgt); FX = clamp(camState(t).dist / 26, 1, 2.6);
  groundU.time.value = t; groundU.day.value = 0; groundU.dim.value = 1; groundU.slabGlow.value = 0; groundU.flash.value = 0;
  groundU.ovA.value = t < 1.6 ? 0 : .85 * ease((t - 1.6) / .9);
  const eve = t >= 30.1 && t < 41.5;
  aerial.sunDirection.copy(eve ? SUN_EVE : SUN_DAY);
  window.EXPO = eve ? 1.7 : 2.5; groundU.tint.value.set(eve ? 1.25 : 1, eve ? .82 : 1, eve ? .62 : 1);
  FIRE.reset(); SMOKE.reset(); GLOW.reset(); EXPL.reset(); WISP.reset(); shake = 0;
  STRIKES.forEach((st, j) => {
    const age = t - st.t; burst(st.B, age, j * 17.3 + 5, true);
    if (age > 0 && age < .5) shake = Math.max(shake, (1 - age / .5) * .5);
    if (age > .4 && t < 25.2) for (let k = 0; k < 18; k++) {
      const u = ((age * .22 + k / 18) % 1), e0 = elev(st.B.x, st.B.z);
      const q = st.B.clone().add(new THREE.Vector3(u * u * 2.2 + (rnd(k + j) - .5) * .5, e0 + .4 + u * 4.5, -u * .4));
      WISP.add(q, .42, .41, .4, .65 * Math.sin(Math.PI * u) * clamp((age - .4) / 1.2), (1.4 + u * 4) * FX, Math.floor((u * 63 + k * 9) % 64));
    }
  });
  if (t > 30.1 && t < 33.1) for (let k = 0; k < 14; k++) {
    const u = ((t * .12 + k / 14) % 1), e0 = elev(PIN.x, PIN.z);
    WISP.add(PIN.clone().add(new THREE.Vector3(u * 1.5, e0 + .3 + u * 3.5, -u * .3)), .55, .45, .4, .6 * Math.sin(Math.PI * u), 1.2 + u * 3, Math.floor((u * 63 + k * 9) % 64));
  }
  FIRE.flush(); SMOKE.flush(); GLOW.flush(); EXPL.flush(); WISP.flush(); groundU.expo.value = window.EXPO;
  hud(t);
  composer.render(1 / 30);
};
for (const o of [...scene.children]) if (o !== ground && o !== bgPlane) overlay.add(o);
await document.fonts.load("700 60px InterTight"); await document.fonts.load("600 15px Inter"); await document.fonts.load("500 15px Plex");
await document.fonts.ready;
window.setT(1.2);
window.ready = true;
