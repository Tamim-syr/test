s4 = open("scene4.js").read()
base = s4[:s4.index("// ---------- étiquettes")]
def R(a, b, n=1):
    global base
    assert base.count(a) == n, (base.count(a), a[:70]); base = base.replace(a, b)
# étalonnage « documentaire » : carte plus sombre, désaturée, légèrement froide
R("c = pow(c, vec3(1.25)) * .86; float l = dot(c, vec3(.299,.587,.114)); c = mix(vec3(l), c, .92);",
  "c = pow(c, vec3(1.25)) * .86; float l = dot(c, vec3(.299,.587,.114)); c = mix(vec3(l), c, .55) * vec3(.88,.94,1.02) * .78;", 2)
R("""    else if (zone > 3.5 && zone < 4.5) { float s = step(.5, fract((vUv.x + vUv.y * 1.1) * 420.)); col = mix(vec3(.25), vec3(.95), s); a = ovA * .95; }
    else if (zone > 4.5) { float pu = .55 + .45 * sin(time * 6.); col = mix(vec3(.0,.18,1.), vec3(.95,.05,.05), flash) * (.45 + .8 * l) + vec3(.1,.25,1.) * pu * .25; a = ovA; }""",
"""    else if (zone > 3.5 && zone < 4.5) { float s = 1. - smoothstep(.06, .14, abs(fract((vUv.x + vUv.y * 1.1) * 900.) - .5));
      col = mix(c * vec3(1.05,.85,.85), vec3(1.,.42,.42), s * .75); a = ovA; }
    else if (zone > 4.5) { float st = 1. - smoothstep(.04, .1, abs(fract((vUv.x - vUv.y) * 520. + time * .5) - .5));
      col = mix(c, vec3(1.,.2,.22), .38 + .12 * sin(time * 3.)) + vec3(1.,.3,.3) * st * .35; a = ovA; }
    // contour lumineux des zones occupées
    vec2 q = vec2(1.6 / 2048., 0.);
    float zr = floor(texture2D(ctrlN, vUv + q.xy).r * 255. / 50. + .5), zl = floor(texture2D(ctrlN, vUv - q.xy).r * 255. / 50. + .5);
    float zu = floor(texture2D(ctrlN, vUv + q.yx * 1.1).r * 255. / 50. + .5), zd = floor(texture2D(ctrlN, vUv - q.yx * 1.1).r * 255. / 50. + .5);
    float occ = step(3.5, zone), edgeZ = occ * (1. - step(3.5, min(min(zr, zl), min(zu, zd))));
    float edgeO = (1. - occ) * step(3.5, max(max(zr, zl), max(zu, zd)));""")
R("    vec3 o = mix(c, col, a);", "    vec3 o = mix(c, col, a);\n    o = mix(o, vec3(1.,.45,.45), max(edgeZ, edgeO * .6) * ovA);")
R("    o = mix(o, vec3(.92), b.r * .9);\n    o = mix(o, vec3(.85), b.g * .55);\n    o += vec3(.6, 1., .7) * b.b * .10 * ovA;",
  "    o = mix(o, vec3(.95), b.r * .55);\n    o = mix(o, vec3(.8), b.g * .3);\n    o += vec3(.9, .95, 1.) * b.b * .05 * ovA;")
story = s4[s4.index("// ---------- étiquettes"):s4.index("const labs = LABS.map")]
story = story[:story.index("function label(")] + story[story.index("const lonK"):]
story = story.replace("""// étiquettes : [texte, lon, lat, couleur, taille, visible de, à]""", "// étiquettes : [texte, lon, lat, classe, taille(inutilisé), visible de, à]")
story = story.replace('["GOLAN OCCUPÉ", 35.70, 33.0, "#ddd", 50, 2, 15], ["ZONE ENVAHIE", 36.06, 33.32, "#8fb4ff", 50, 2.2, 15],',
                      '["GOLAN OCCUPÉ", 35.70, 33.0, "zone", 0, 2, 15], ["ZONE ENVAHIE", 36.04, 33.36, "zone", 0, 2.2, 15],')
for nm in ["LIBAN", "JORDANIE", "SYRIE"]: pass
code = r'''
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
  camera.position.copy(tgt).add(off); camera.lookAt(tgt);
}
''' + s4[s4.index("function burst(p, age, seed, big) {"):s4.index("// ---------- HUD")] + r'''
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
  window.EXPO = eve ? 2.0 : 3.6; groundU.tint.value.set(eve ? 1.25 : 1, eve ? .82 : 1, eve ? .62 : 1);
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
'''
out = base + story + code
out = out.replace('await document.fonts.load("64px Anton"); await document.fonts.load("700 40px Rubik");', "")
open("scene5.js", "w").write(out); print("ok")
