s3 = open("scene3.js").read()
base = s3[:s3.index("// ---------- étiquettes de villes (sprites)")]
def R(a, b):
    global base
    assert base.count(a) == 1, a[:80]; base = base.replace(a, b)
R('load("ctrl.png", true), load("ctrl.png")', 'load("ctrl5.png", true), load("ctrl5.png")')
R("const slabOld = slab(flagTex(\"old\")), slabNew = slab(flagTex(\"rev\"));", "")
R("uniform float expo; uniform float day,", "uniform float expo, flash; uniform vec3 tint; uniform float day,")
R("    else if (zone > 3.5) { float s = step(.5, fract((vUv.x + vUv.y * 1.1) * 420.)); col = mix(vec3(.25), vec3(.95), s); a = ovA * .95; }",
  """    else if (zone > 3.5 && zone < 4.5) { float s = step(.5, fract((vUv.x + vUv.y * 1.1) * 420.)); col = mix(vec3(.25), vec3(.95), s); a = ovA * .95; }
    else if (zone > 4.5) { float pu = .55 + .45 * sin(time * 6.); col = mix(vec3(.05,.3,.95), vec3(.9,.1,.1), flash) * (.6 + .9 * l) + vec3(.15,.3,1.) * pu * .35; a = ovA; }""")
R("    o = mix(o, haze, fogF) * expo;", "    o = mix(o, vec3(1., .12, .1), b.r * flash * .9);\n    o = mix(o, haze, fogF) * expo * tint;")
R("expo: { value: 9 } });", "expo: { value: 9 }, flash: { value: 0 }, tint: { value: new THREE.Color(1, 1, 1) } });")
R("const bgU = { expo: groundU.expo,", "const bgU = { expo: groundU.expo, tint: groundU.tint,")
R("uniform float dim, ovA, expo;", "uniform float dim, ovA, expo; uniform vec3 tint;")
R("gl_FragColor = vec4(mix(c, haze, f) * expo, 1.);", "gl_FragColor = vec4(mix(c, haze, f) * expo * tint, 1.);")
story = r'''
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
''' + s3[s3.index("function buildArrow(a, g) {"):s3.index("// ---------- avion d'Assad")].replace("const w = .42 * wk, hw = 1.0 * wk, hl = Math.min(1.6, a.len * .3)", "const w = .2 * wk, hw = .5 * wk, hl = Math.min(.8, a.len * .3)") + r'''
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
  [17.2, LL(36.6, 34.3), 72, 50, -4], [21.3, LL(36.5, 34.25), 64, 48, 6], [22.3, LL(35.97, 33.08), 22, 40, -8], [25.0, LL(36.4, 33.9), 46, 44, 10],
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
let shake = 0;
function placeCamera(t) {
  const s = camState(t); const pr = s.pitch * Math.PI / 180, yr = s.yaw * Math.PI / 180;
  const off = new THREE.Vector3(Math.sin(yr) * Math.cos(pr), Math.sin(pr), Math.cos(yr) * Math.cos(pr)).multiplyScalar(s.dist);
  const tgt = s.tgt.clone(); tgt.y += elev(tgt.x, tgt.z);
  if (shake > 0) { tgt.x += Math.sin(t * 71) * shake * s.dist * .006; tgt.z += Math.cos(t * 59) * shake * s.dist * .006; }
  camera.position.copy(tgt).add(off); camera.lookAt(tgt);
}
''' + s3[s3.index("function burst(p, age, seed, big) {"):s3.index("function fireworks(t) {")] + r'''
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
window.setT = function (t) {
  placeCamera(t); groundU.cc.value.copy(camState(t).tgt);
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
  ripples.forEach((r, i) => { const u = ((pa * .7 + i / 3) % 1); r.visible = show && pa > 0; r.scale.setScalar(.2 + u * 2.6); r.material.opacity = (1 - u) * .9; });
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
      GLOW.add(h, 1, .85, .6, 1, .5); FIRE.add(h, 1, .7, .3, .9, .45);
      for (let k = 1; k < 40; k++) { const v = u - k * .012; if (v < 0) break; SMOKE.add(st.curve.getPoint(v), 1.4, 1.4, 1.4, .45 * (1 - k / 40), .25 + k * .02); }
    }
    const age = t - st.t; burst(st.B, age, j * 17.3 + 5, true);
    if (age > 0 && age < .6) shake = Math.max(shake, (1 - age / .6) * .6);
    if (age > .4 && t < 25.2) for (let k = 0; k < 18; k++) {          // colonne de fumée
      const u = ((age * .25 + k / 18) % 1), e0 = elev(st.B.x, st.B.z);
      const q = st.B.clone().add(new THREE.Vector3(u * u * 2.2 + (rnd(k + j) - .5) * .5, e0 + .4 + u * 4.5, -u * .4));
      WISP.add(q, .5, .48, .46, .7 * Math.sin(Math.PI * u) * clamp((age - .4) / 1.2), 1.4 + u * 4, Math.floor((u * 63 + k * 9) % 64));
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
window.ready = true;
'''
open("scene4.js", "w").write(base + story); print("ok")
