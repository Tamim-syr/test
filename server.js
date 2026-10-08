'use strict';
/* =====================================================================
   TERRES VIVES — serveur multijoueur local (réseau de la classe)
   Aucune dépendance : il suffit de Node.js 18 ou plus.
   Lancer :  node server.js      puis ouvrir http://<IP-du-PC>:3000
   ===================================================================== */
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), os = require('os');
const PORT = +(process.env.PORT || 3000);
const SAVE = path.join(__dirname, 'sauvegarde.json');
// Durées réelles (en minutes) : modifiez-les librement
const DUREE_JOUR_MIN = 8;   // de 5 h à 21 h
const DUREE_NUIT_MIN = 3;   // de 21 h à 5 h
const VERSION = '2026-10-08-arme2'; // doit être identique dans client.html
const PREPARATION_MIN = 10; // au lancement : personne ne peut sortir de sa ferme pendant ce temps
const DAY_REAL = DUREE_JOUR_MIN * 60, NIGHT_REAL = DUREE_NUIT_MIN * 60;
const DAY = 180;            // référence de pousse des cultures (s réelles par « jour » de croissance)
const DT = 0.05;          // 20 mises à jour par seconde

/* ---------------------------------------------------------------- données */
const CROPS = {
  ble: { n: 'Blé', days: 1.3, y: 25, seed: 1.2, p: .90 },
  mais: { n: 'Maïs', days: 1.8, y: 34, seed: 2.2, p: .85 },
  colza: { n: 'Colza', days: 1.5, y: 18, seed: 1.8, p: 1.65 },
  tournesol: { n: 'Tournesol', days: 1.6, y: 15, seed: 1.8, p: 1.85 },
  pdt: { n: 'Pomme de terre', days: 1.2, y: 40, seed: 3.2, p: .80 },
  fraise: { n: 'Fraise', days: .9, y: 10, seed: 7, p: 5.5 },
};
const CK = Object.keys(CROPS);
const PRICES = {
  semoir: 900, pulve: 700, moiss: 4500, tracteur: 3500, gps: 1200, agent: 250, irrig: 1200,
  bag: [250, 500, 900], boots: [300, 700], silo: [1500, 3500, 7000],
  tower: 2000, towerUp: [2500, 4000], sniper: 3500, police: 1500, dog: 900,
  lamp: [1000, 2000, 3500], elec: [2500, 5000], gun: [1500, 3500], camera: 2000, armor: [1500, 3500], jam: 3000,
  gunBuy: 1500, ammo: { 30: 120, 100: 350 }, bountyMin: 200,
};
const WAGE = { agent: 45, police: 80, sniper: 120, dog: 25 };
const AMMO_MAX = 400, TRUCE_S = 300; // trêve après un K.O. : 5 min
const LIMIT = { agents: 6, towers: 6, sniper: 3, police: 4, dog: 2 };
const TOWER = { 1: { r: 6, cd: 1.0, dmg: 1 }, 2: { r: 7.5, cd: .7, dmg: 1 }, 3: { r: 9, cd: .45, dmg: 2 } };
const GHP = { police: 6, dog: 4, sniper: 5 };
const towerMax = t => 6 + t.lvl * 6;
const GUN = [{ r: 8, cd: .3, dmg: 1 }, { r: 10, cd: .22, dmg: 1 }, { r: 12, cd: .16, dmg: 2 }];
const TT = {
  normal: { hp: 3, sp: 2.3, bounty: 40, n: 'Voleur' },
  rapide: { hp: 2, sp: 3.4, bounty: 50, n: 'Voleur rapide' },
  costaud: { hp: 7, sp: 1.8, bounty: 90, n: 'Costaud' },
  saboteur: { hp: 4, sp: 2.5, bounty: 70, n: 'Saboteur' },
  chef: { hp: 18, sp: 2.2, bounty: 350, n: 'Chef de bande' },
};
const NAMES = ['Lucas', 'Inès', 'Karim', 'Léa', 'Yanis', 'Chloé', 'Malik', 'Jeanne', 'Hugo', 'Nour', 'Théo', 'Sarah', 'Adam', 'Lina', 'Rayan', 'Emma'];
const OUCH = ['Aïe ! J’y vais patron !', 'Ok ok, je cours !', 'Je vais appeler le syndicat…', 'Promis j’accélère !', 'C’est pas dans mon contrat ça !', 'Ouille ! Au boulot !', 'Ma mère va entendre parler de vous'];
const FARM_COLORS = ['#E2672E', '#2E8FD6', '#C23B7A', '#8B5CF6', '#16A085', '#D4A017', '#E74C3C', '#5D6D7E'];
const FIELD_PRICE = [0, 3000, 5000, 8000];
const FIELD_NAMES = ['Champ A', 'Champ B', 'Champ C', 'Champ D'];

/* ---------------------------------------------------------------- carte */
const W = 159, H = 78;
const idx = (x, y) => y * W + x;
const G = new Uint8Array(W * H);          // 0 herbe, 1 chemin, 2 eau, 3 bâtiment, 4 arbre, 5 haie
const BLOCK = [0, 0, 1, 1, 1, 1];
const fieldOf = new Int16Array(W * H).fill(-1);
const slotOf = new Int8Array(W * H).fill(-1);
const SLOTS = [], FIELDS = [], BUILD = [];
function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
(function buildMap() {
  const R = mulberry(7);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) G[idx(x, y)] = 4;
  for (let c = 0; c < 5; c++) { const rx = 1 + c * 39; for (let y = 1; y < H - 1; y++) G[idx(rx, y)] = 1; }
  for (let x = 1; x < W - 1; x++) { G[idx(x, 1)] = 1; G[idx(x, 38)] = 1; G[idx(x, H - 2)] = 1; }
  for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) {
    const x0 = 3 + c * 39, y0 = r === 0 ? 3 : 45, s = SLOTS.length;
    const sl = { x: x0, y: y0, w: 36, h: 31, row: r };
    sl.door = { x: x0 + 5, y: y0 + 6 };
    sl.homes = [[x0 + 12.5, y0 + 5.5], [x0 + 15.5, y0 + 5.5], [x0 + 12.5, y0 + 3.5], [x0 + 15.5, y0 + 3.5]];
    sl.entr = [[x0 - 1, y0 + 7], [x0 + 36, y0 + 7], [x0 + 17, y0 - 1], [x0 + 17, y0 + 31]];
    SLOTS.push(sl);
    for (let y = y0; y <= y0 + 30; y++) for (let x = x0; x <= x0 + 35; x++) {
      slotOf[idx(x, y)] = s;
      const edge = x === x0 || x === x0 + 35 || y === y0 || y === y0 + 30;
      G[idx(x, y)] = edge ? 5 : 0;
    }
    for (let x = x0; x <= x0 + 35; x++) G[idx(x, y0 + 7)] = 1;
    for (let y = y0; y <= y0 + 30; y++) G[idx(x0 + 17, y)] = 1;
    for (const [ex, ey] of sl.entr) G[idx(ex, ey)] = 1;
    if (r === 0) for (let y = y0 + 31; y <= 38; y++) G[idx(x0 + 17, y)] = 1;
    else for (let y = 38; y < y0; y++) G[idx(x0 + 17, y)] = 1;
    BUILD.push({ kind: 'ferme', farm: s, n: 'FERME', x: x0 + 2, y: y0 + 1, w: 8, h: 5 });
    for (let y = y0 + 1; y <= y0 + 5; y++) for (let x = x0 + 2; x <= x0 + 9; x++) G[idx(x, y)] = 3;
    G[idx(x0 + 5, y0 + 6)] = 1;
    for (let y = y0 + 2; y <= y0 + 6; y++) for (let x = x0 + 11; x <= x0 + 16; x++) G[idx(x, y)] = 1;
    [[2, 9], [20, 9], [2, 20], [20, 20]].forEach(([fx, fy], k) => {
      const f = { id: s * 4 + k, farm: s, k, n: FIELD_NAMES[k], x: x0 + fx, y: y0 + fy, w: 14, h: 9, price: FIELD_PRICE[k] };
      FIELDS.push(f);
      for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) { G[idx(x, y)] = 0; fieldOf[idx(x, y)] = f.id; }
    });
  }
  const town = [
    { kind: 'marche', n: 'MARCHÉ', x: 61, y: 34, w: 10, h: 3 },
    { kind: 'police', n: 'COMMISSARIAT', x: 84, y: 34, w: 10, h: 3 },
    { kind: 'mairie', n: 'MAIRIE', x: 70, y: 40, w: 9, h: 3 },
    { kind: 'armurerie', n: 'ARMURERIE', x: 104, y: 40, w: 9, h: 3 },
  ];
  for (const b of town) { BUILD.push(b); for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) G[idx(x, y)] = 3; }
  for (let y = 40; y <= 42; y++) for (let x = 46; x <= 52; x++) G[idx(x, y)] = 2;
  for (let y = 34; y <= 44; y++) for (let x = 2; x < W - 2; x++) if (G[idx(x, y)] === 0 && y !== 37 && y !== 39 && R() < .06) G[idx(x, y)] = 4;
})();
const G0 = G.slice(); // carte complète (8 fermes)
const SLOT_ORDER = [1, 2, 5, 6, 0, 3, 4, 7]; // fermes proches du village d'abord
let mapVer = 0;
// fermes inutilisées : transformées en forêt (seules les fermes de la partie existent)
function forestSlot(s) {
  const sl = SLOTS[s], x0 = sl.x, y0 = sl.y, R = mulberry(100 + s);
  for (let y = y0; y <= y0 + 30; y++) for (let x = x0; x <= x0 + 35; x++) { const edge = x <= x0 + 1 || x >= x0 + 34 || y <= y0 + 1 || y >= y0 + 29; G[idx(x, y)] = edge || R() < .5 ? 4 : 0; }
  for (const [ex, ey] of sl.entr) G[idx(ex, ey)] = 0;
  if (sl.row === 0) for (let y = y0 + 31; y < 38; y++) G[idx(x0 + 17, y)] = 0; else for (let y = 39; y < y0; y++) G[idx(x0 + 17, y)] = 0;
}
const isActive = s => !WD.active || !!WD.active[s];
function applyActive() { G.set(G0); for (let s = 0; s < SLOTS.length; s++) if (!isActive(s)) forestSlot(s); mapVer++; }
const FIELD_TILES = []; for (let i = 0; i < W * H; i++) if (fieldOf[i] >= 0) FIELD_TILES.push(i);

function walk(x, y, veh) { if (x < 0 || y < 0 || x >= W || y >= H) return false; return !BLOCK[G[idx(x, y)]]; }
function free(x, y, r, veh) { for (let ty = Math.floor(y - r); ty <= Math.floor(y + r); ty++) for (let tx = Math.floor(x - r); tx <= Math.floor(x + r); tx++) if (!walk(tx, ty, veh)) return false; return true; }
const PREV = new Int32Array(W * H), SEEN = new Int32Array(W * H), Q = new Int32Array(W * H); let STAMP = 0;
function bfs(sx, sy, tx, ty, veh) {
  if (!walk(tx, ty, veh)) return null; if (sx === tx && sy === ty) return [];
  STAMP++; let h = 0, t = 0; const s = idx(sx, sy), g = idx(tx, ty); SEEN[s] = STAMP; PREV[s] = s; Q[t++] = s;
  while (h < t) {
    const c = Q[h++]; if (c === g) break; const cx = c % W, cy = (c / W) | 0;
    for (let d = 0; d < 4; d++) {
      const nx = cx + (d === 0 ? 1 : d === 1 ? -1 : 0), ny = cy + (d === 2 ? 1 : d === 3 ? -1 : 0);
      if (!walk(nx, ny, veh)) continue; const n = idx(nx, ny); if (SEEN[n] !== STAMP) { SEEN[n] = STAMP; PREV[n] = c; Q[t++] = n; }
    }
  }
  if (SEEN[g] !== STAMP) return null; const out = []; let c = g; while (c !== s) { out.push({ x: c % W + .5, y: ((c / W) | 0) + .5 }); c = PREV[c]; } return out.reverse();
}
const thin = p => (p || []).filter((q, i, a) => i % 2 === 1 || i === a.length - 1);

/* ---------------------------------------------------------------- état */
const till = new Uint8Array(W * H), wet = new Float32Array(W * H), crop = new Int8Array(W * H).fill(-1), grow = new Float32Array(W * H), fert = new Uint8Array(W * H), claim = new Int32Array(W * H).fill(-1);
let WD;                                   // monde sauvegardé
let thieves = [], bullets = [], fx = [], players = new Map(), tid = 1, pidSeq = 1;
const rnd = Math.random, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wt = () => 1;
const load_ = b => Object.values(b.items).reduce((a, q) => a + q, 0);
const storeCap = f => 3000 + 3000 * f.up.silo + 1000 * (f.lvl || 0);
const farmUpCost = l => Math.round(5000 * Math.pow(1.55, l || 0));
const yieldMult = f => 1 + .06 * (f.lvl || 0);
function lim(f, k) { const l = f.lvl || 0; return { agents: 6 + Math.floor(l / 2), towers: 6 + l, sniper: 3 + Math.floor(l / 3), police: 4 + Math.floor(l / 2), dog: 2 + Math.floor(l / 3) }[k]; }
const INFINITE_UP = { bag: [250, 500, 900], silo: [1500, 3500, 7000], armor: [1500, 3500] };
function upPrice(k, l) { const list = PRICES[k]; if (INFINITE_UP[k]) { if (l < list.length) return list[l]; return Math.round(list[list.length - 1] * Math.pow(1.8, l - list.length + 1)); } return list[l]; }
const storeLoad = f => Object.values(f.store).reduce((a, q) => a + q, 0);
const nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const eur = x => nf0.format(Math.round(x)) + ' €';

function newFarm(s) {
  const sl = SLOTS[s];
  return {
    slot: s, owner: null, color: FARM_COLORS[s], money: 3000,
    seeds: Object.fromEntries(CK.map(k => [k, k === 'ble' ? 60 : k === 'mais' ? 20 : 0])),
    store: Object.fromEntries(CK.map(k => [k, 0])),
    fields: [0, 1, 2, 3].map(k => ({ owned: k === 0, plan: k === 0 ? 'ble' : null, irrig: false })),
    impl: { charrue: true, semoir: false, pulve: false },
    up: { bag: 0, boots: 0, silo: 0, gun: 0, lamp: 0, elec: 0, camera: 0, armor: 0 },
    stats: { harv: 0, sold: 0, caught: 0, stolen: 0, nights: 0, kills: 0, deaths: 0, pillaged: 0 }, recent: 0,
    px: sl.x + 5.5, py: sl.y + 8.5, pbag: {}, tool: 0, seed: 'ble', gun: false, ammo: 0,
  };
}
function newWorld() {
  const w = { v: 3, time: 7 * 60, day: 1, night: 0, weather: 'soleil', prices: {}, ph: {}, contract: null, farms: [], agents: [], veh: [], towers: [], guards: [], nid: 1, chat: [], pacts: [], offers: [] };
  for (const k of CK) { w.prices[k] = CROPS[k].p; w.ph[k] = [CROPS[k].p]; }
  for (let s = 0; s < SLOTS.length; s++) w.farms.push(newFarm(s));
  return w;
}
function mkAgent(farm, n) { const sl = SLOTS[farm]; return { id: WD.nid++, farm, name: NAMES[n % NAMES.length], x: sl.door.x + .5 + (n % 3), y: sl.door.y + 1.5, bag: { items: {}, cap: 150 }, task: null, path: [], pi: 0, wait: 0, think: 0, msg: 'Arrive à la ferme', dx: 0, dy: 1, walk: 0, morale: 100, strike: 0, boost: 0, hop: 0, say: '', sayT: 0 }; }
function mkVeh(farm, type) {
  const sl = SLOTS[farm], n = WD.veh.filter(v => v.farm === farm).length, h = sl.homes[n % 4];
  const k = WD.veh.filter(v => v.farm === farm && v.type === type).length + 1;
  return { id: WD.nid++, farm, type, name: (type === 'moiss' ? 'Moissonneuse ' : 'Tracteur ') + k, x: h[0], y: h[1], a: Math.PI / 2, v: 0, impl: 'charrue', lower: false, gps: false, fullAuto: false, bag: type === 'moiss' ? { items: {}, cap: 4000 } : null, auto: null, home: { x: h[0], y: h[1] }, status: '', stuck: 0, think: 0, driver: null };
}
/* ---------------------------------------------------------------- comptes : mot de passe + jeton */
const PW_N = 1024; // coût du hachage (rapide : ne bloque pas le serveur)
const hashPw = (pw, salt, n) => crypto.scryptSync(String(pw), salt, 32, { N: n || 16384 }).toString('hex');
const sha = t => crypto.createHash('sha256').update(String(t)).digest('hex');
function setPw(fm, pw) { const salt = crypto.randomBytes(16).toString('hex'); fm.pass = { s: salt, h: hashPw(pw, salt, PW_N), n: PW_N }; fm.toks = []; }
function checkPw(fm, pw) { if (!fm.pass || !pw) return false; const ok = checkPw0(fm, pw); if (ok && fm.pass.n !== PW_N) { const t = fm.toks; setPw(fm, pw); fm.toks = t; } return ok; }
function checkPw0(fm, pw) { const a = Buffer.from(hashPw(pw, fm.pass.s, fm.pass.n), 'hex'), b = Buffer.from(fm.pass.h, 'hex'); return a.length === b.length && crypto.timingSafeEqual(a, b); }
function newTok(fm) { const t = crypto.randomBytes(24).toString('hex'); fm.toks = (fm.toks || []).concat(sha(t)).slice(-8); return t; }
const checkTok = (fm, t) => !!t && (fm.toks || []).includes(sha(t));
const fails = new Map(); // ip -> { n, until }
function claimFarm(fi, name) {
  const f = WD.farms[fi]; f.owner = name;
  const F = FIELDS[fi * 4];
  for (let y = F.y; y < F.y + F.h; y++) for (let x = F.x; x < F.x + F.w; x++) {
    const i = idx(x, y);
    if (y < F.y + 3 && x < F.x + 10) { till[i] = 1; crop[i] = 0; grow[i] = 1; }
    else if (y < F.y + 6 && x < F.x + 10) { till[i] = 1; crop[i] = 1; grow[i] = .45; wet[i] = .8; }
  }
  WD.veh.push(mkVeh(fi, 'tracteur'));
  WD.agents.push(mkAgent(fi, fi));
  sys(`${name} s’installe sur la ferme n°${fi + 1}.`);
}

/* ---------------------------------------------------------------- effets envoyés aux clients */
function toast(farm, m, c = '') { fx.push({ k: 'toast', f: farm, m, c }); }
function puff(x, y, c, n = 4) { fx.push({ k: 'puff', x: +x.toFixed(2), y: +y.toFixed(2), c, n }); }
function floatTxt(x, y, t, c = '#fff') { fx.push({ k: 'float', x: +x.toFixed(2), y: +y.toFixed(2), t, c }); }
function sys(m) { const msg = { n: 'Ferme', c: '#F0B43C', m, sys: true }; WD.chat.push(msg); if (WD.chat.length > 40) WD.chat.shift(); fx.push({ k: 'chat', ...msg }); }

/* ---------------------------------------------------------------- sol */
function fieldFarm(i) { const f = fieldOf[i]; return f >= 0 ? (f >> 2) : -1; }
function ownedField(i, fm) { const f = fieldOf[i]; return f >= 0 && (f >> 2) === fm && WD.farms[fm].fields[f & 3].owned; }
function opTill(i, fm) { if (!ownedField(i, fm) || till[i] || crop[i] >= 0) return 0; till[i] = 1; fert[i] = 0; return 1; }
function opSow(i, c, fm) { const f = WD.farms[fm]; if (!c || !ownedField(i, fm) || !till[i] || crop[i] >= 0) return 0; if (f.seeds[c] <= 0) return -1; f.seeds[c]--; crop[i] = CK.indexOf(c); grow[i] = 0; wet[i] = 1; return 1; }
function opWater(i, fm) { if (!ownedField(i, fm) || !till[i] || wet[i] > .95) return 0; wet[i] = 1; return 1; }
function opFert(i, fm) { const f = WD.farms[fm]; if (!ownedField(i, fm) || !till[i] || fert[i]) return 0; if (f.money < 1.5) return -1; f.money -= 1.5; fert[i] = 1; return 1; }
function opHarvest(i, bag, fm) {
  if (!ownedField(i, fm) || crop[i] < 0 || grow[i] < 1) return 0;
  const c = CK[crop[i]], q = Math.round(CROPS[c].y * (fert[i] ? 1.3 : 1) * yieldMult(WD.farms[fm]));
  if (bag.cap - load_(bag) < q) return -1;
  bag.items[c] = (bag.items[c] || 0) + q; crop[i] = -1; grow[i] = 0; till[i] = 0; fert[i] = 0; wet[i] = 0; WD.farms[fm].stats.harv += q; return q;
}
function deposit(bag, fm) {
  const f = WD.farms[fm]; let left = false;
  for (const k in bag.items) { const q = bag.items[k]; if (!q) { delete bag.items[k]; continue; } const room = Math.floor(storeCap(f) - storeLoad(f)); const t = Math.max(0, Math.min(q, room)); f.store[k] = (f.store[k] || 0) + t; bag.items[k] -= t; if (bag.items[k] > 0) left = true; else delete bag.items[k]; }
  if (left) toast(fm, 'Entrepôt plein : agrandissez-le ou vendez au Marché', 'b');
  return !left;
}

/* ---------------------------------------------------------------- joueurs */
function playerOf(fm) { for (const p of players.values()) if (p.farm === fm && p.joined) return p; return null; }
const nearDoor = (p) => { const d = SLOTS[p.farm].door; return Math.hypot(p.x - d.x - .5, p.y - d.y - .5) < 2.2; };
function vehById(id) { return WD.veh.find(v => v.id === id); }
function hint(p, m) { if (p.hintCd > 0) return; p.hintCd = 1.5; fx.push({ k: 'toast', f: p.farm, m, c: 'b', only: p.id }); }
/* ---------------------------------------------------------------- brouilleur */
const isJammed = f => { const fm = WD.farms[f]; return !!fm.jamAt && tickTime >= fm.jamAt && tickTime < fm.jamUntil; };
const SHOP = () => { const b = BUILD.find(b => b.kind === 'armurerie'); return { x: b.x + b.w / 2, y: b.y + b.h + .5 }; };
function jamTick() {
  for (const fm of WD.farms) {
    if (fm.jamAt && !fm.jamStarted && tickTime >= fm.jamAt) { fm.jamStarted = true; toast(fm.slot, 'Brouillage : vos tours, caméras et lampadaires sont coupés pendant 60 s !', 'b'); }
    if (fm.jamStarted && tickTime >= fm.jamUntil) { fm.jamStarted = false; fm.jamAt = 0; toast(fm.slot, 'Fin du brouillage : vos défenses fonctionnent à nouveau', 'g'); }
  }
}
/* ---------------------------------------------------------------- combat entre joueurs */
const pkey = (a, b) => a < b ? a + '-' + b : b + '-' + a;
const allied = (a, b) => a === b || WD.pacts.includes(pkey(a, b));
const inTown = (x, y) => y >= 34 && y <= 44;
const maxHp = fm => 10 + 5 * (fm.up.armor || 0) + 2 * (fm.lvl || 0);
const truces = new Map(); // 'a-b' -> fin (tickTime)
const truceLeft = (a, b) => { if (a === b || a < 0 || b < 0) return 0; const t = truces.get(pkey(a, b)); return t && t > tickTime ? t - tickTime : 0; };
function canHurt(by, v) { return !inPrep() && !(v && truceLeft(by, v.farm) > 0) && v && v.joined && !(v.ko > 0) && !(v.inv > 0) && !allied(by, v.farm) && !inTown(v.x, v.y); }
function pickTarget(by, x, y, r, opt) {
  let best = null, bd = r;
  const consider = (k, o, ox, oy) => { const d = Math.hypot(ox - x, oy - y); if (d < bd) { bd = d; best = { k, o }; } };
  for (const t of thieves) if (!t.gone) consider('thief', t, t.x, t.y);
  for (const v of players.values()) { if (!canHurt(by, v)) continue; if (opt.slot !== undefined && !inSlot(v.x, v.y, opt.slot)) continue; consider('player', v, v.x, v.y); }
  if (opt.all && !inPrep()) {
    for (const g of WD.guards) { if (g.ko > 0 || allied(by, g.farm) || truceLeft(by, g.farm) > 0 || !playerOf(g.farm) || inTown(g.x, g.y)) continue; consider('guard', g, g.x, g.y); }
    for (const tw of WD.towers) { if (allied(by, tw.farm) || truceLeft(by, tw.farm) > 0 || !playerOf(tw.farm)) continue; consider('tower', tw, tw.x, tw.y - .5); }
  }
  return best;
}
function hurtPlayer(v, dmg, by, how) {
  if (!canHurt(by, v)) return; v.hp -= dmg; v.hitT = .3; v.calm = 0; floatTxt(v.x, v.y - 1.1, '-' + dmg, '#FF8A7A');
  if (v.hp <= 0) koPlayer(v, by, how);
}
function koPlayer(v, by, how) {
  v.ko = 6; v.hp = 0; v.tp++;
  if (v.veh) { const ve = vehById(v.veh); if (ve) { ve.driver = null; ve.lower = false; ve.v = 0; } v.veh = 0; }
  const vf = WD.farms[v.farm], af = WD.farms[by], ap = playerOf(by);
  let loot = 0;
  for (const k in v.bag.items) { const q = Math.floor(v.bag.items[k] / 2); if (!q) continue; v.bag.items[k] -= q; loot += q; let rest = q; if (ap) { const t = Math.max(0, Math.min(q, ap.bag.cap - load_(ap.bag))); ap.bag.items[k] = (ap.bag.items[k] || 0) + t; rest -= t; } if (rest > 0) af.store[k] = (af.store[k] || 0) + rest; }
  const ransom = Math.max(0, Math.min(500, Math.floor(vf.money * .05))); vf.money -= ransom; af.money += ransom;
  vf.stats.deaths = (vf.stats.deaths || 0) + 1; af.stats.kills = (af.stats.kills || 0) + 1; af.recent = (af.recent || 0) + 1;
  let bonus = 0, wantedB = 0; if ((vf.recent || 0) >= 3) { bonus = wantedB = 300; af.money += 300; vf.recent = 0; }
  WD.bounty = WD.bounty || {}; const prime = Math.floor(WD.bounty[v.farm] || 0);
  if (prime > 0 && by !== v.farm) { af.money += prime; bonus += prime; delete WD.bounty[v.farm]; sys(`${af.owner} encaisse la prime de ${eur(prime)} sur la tête de ${vf.owner} !`); }
  if (by !== v.farm && by >= 0) {
    truces.set(pkey(by, v.farm), tickTime + TRUCE_S);
    const msg = o => `Trêve de 5 min avec ${o} : ni combat, ni entrée dans sa ferme`;
    fx.push({ k: 'toast', f: v.farm, only: v.id, m: msg(af.owner), c: 'b' }); toast(by, msg(vf.owner), 'g');
    if (ap && !ap.veh && slotOf[idx(Math.floor(ap.x), Math.floor(ap.y))] === v.farm) sendHome(ap);
  }
  puff(v.x, v.y, '#9AA0A6', 10);
  fx.push({ k: 'toast', f: v.farm, only: v.id, m: `${af.owner} vous a mis K.O. (${how}) : −${eur(ransom)}${loot ? `, ${loot} kg perdus` : ''}. Retour à votre ferme dans 6 s.`, c: 'b' });
  toast(by, `${vf.owner} est K.O. ! +${eur(ransom + bonus)}${loot ? `, +${loot} kg de butin` : ''}`, 'g');
  sys(`${af.owner} a mis K.O. ${vf.owner} (${how})${wantedB ? ' et touche 300 € : il était recherché !' : ''}`);
  if (af.recent === 3) sys(`${af.owner} est RECHERCHÉ : 300 € de prime pour qui le met K.O. !`);
}
function hurtGuard(g, dmg, by) {
  if (g.ko > 0) return; g.hp = (g.hp ?? GHP[g.type]) - dmg; g.hitT = .25; floatTxt(g.x, g.y - 1.1, '-' + dmg, '#FF8A7A');
  if (g.hp <= 0) {
    g.ko = 120; g.hp = 0; g.path = []; WD.farms[by].money += 30;
    const n = { police: 'policier', dog: 'chien', sniper: 'sniper' }[g.type];
    toast(g.farm, `Votre ${n} a été mis K.O. par ${WD.farms[by].owner} (de retour dans 2 min)`, 'b');
    toast(by, `${n[0].toUpperCase() + n.slice(1)} de ${WD.farms[g.farm].owner} mis K.O. (+30 €)`, 'g');
  }
}
function hurtTower(tw, dmg, by) {
  tw.hp = (tw.hp ?? towerMax(tw)) - dmg; floatTxt(tw.x, tw.y - 1.6, '-' + dmg, '#FF8A7A');
  if (tw.hp <= 0) {
    const k = WD.towers.indexOf(tw); if (k >= 0) WD.towers.splice(k, 1); puff(tw.x, tw.y, '#555', 14); WD.farms[by].money += 100;
    toast(tw.farm, `${WD.farms[by].owner} a détruit une de vos tours !`, 'b'); toast(by, 'Tour ennemie détruite (+100 €)', 'g');
    sys(`${WD.farms[by].owner} a détruit une tour de ${WD.farms[tw.farm].owner} !`);
  }
}
function pillage(p, s) {
  const vf = WD.farms[s], me_ = WD.farms[p.farm];
  if (!vf.owner || !playerOf(s)) { hint(p, 'Ferme protégée : son propriétaire est hors ligne'); return; }
  if (allied(s, p.farm)) { hint(p, `Vous avez un pacte avec ${vf.owner}`); return; }
  p.stealCd = p.stealCd || {}; if ((p.stealCd[s] || 0) > tickTime) { hint(p, `Encore ${Math.ceil(p.stealCd[s] - tickTime)} s avant de pouvoir repiller cette ferme`); return; }
  const room = Math.floor(p.bag.cap - load_(p.bag)); if (room < 20) { hint(p, 'Sac plein : allez d’abord vider votre sac'); return; }
  let bk = null; for (const k in vf.store) if (!bk || vf.store[k] > vf.store[bk]) bk = k;
  if (!bk || vf.store[bk] <= 0) { hint(p, 'Son entrepôt est vide'); return; }
  const q = Math.min(room, 250, vf.store[bk]); vf.store[bk] -= q; p.bag.items[bk] = (p.bag.items[bk] || 0) + q;
  vf.stats.stolen += q; me_.stats.pillaged = (me_.stats.pillaged || 0) + q; p.stealCd[s] = tickTime + 45;
  floatTxt(p.x, p.y - 1.2, `+${q} kg pillés`, '#FF8A7A');
  toast(s, `${me_.owner} pille votre entrepôt : ${q} kg de ${CROPS[bk].n.toLowerCase()} !`, 'b');
  sys(`${me_.owner} a pillé l’entrepôt de ${vf.owner} !`);
}
function interact(p) {
  if (p.ko > 0) return;
  const f = WD.farms[p.farm];
  if (p.veh) {
    const v = vehById(p.veh);
    if (v && v.bag && load_(v.bag) > 0 && Math.hypot(v.x - SLOTS[p.farm].door.x - .5, v.y - SLOTS[p.farm].door.y - .5) < 3.2) { deposit(v.bag, p.farm); toast(p.farm, 'Trémie vidée à l’entrepôt', 'g'); return; }
    if (v) { for (const [dx, dy] of [[0, 1.3], [0, -1.3], [1.3, 0], [-1.3, 0], [1.6, 1.6], [-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6]]) { if (free(v.x + dx, v.y + dy, .28)) { p.x = v.x + dx; p.y = v.y + dy; break; } } v.v = 0; v.lower = false; v.driver = null; }
    p.veh = 0; p.tp++; return;
  }
  let best = null, bd = 1.7;
  for (const v of WD.veh) { if (v.farm !== p.farm) continue; const d = Math.hypot(v.x - p.x, v.y - p.y); if (d < bd) { bd = d; best = v; } }
  if (best && !(nearDoor(p) && Math.hypot(SLOTS[p.farm].door.x + .5 - p.x, SLOTS[p.farm].door.y + .5 - p.y) < bd)) {
    if (best.driver && best.driver !== p.id) return;
    if (best.auto) { best.auto = null; toast(p.farm, `${best.name} : pilote automatique en pause`); }
    best.driver = p.id; p.veh = best.id; p.tp++; return;
  }
  if (nearDoor(p) && load_(p.bag) > 0) { deposit(p.bag, p.farm); toast(p.farm, 'Récolte déposée à l’entrepôt', 'g'); return; }
  for (let s = 0; s < SLOTS.length; s++) { if (s === p.farm || !WD.farms[s].owner) continue; const d = SLOTS[s].door; if (Math.hypot(p.x - d.x - .5, p.y - d.y - .5) < 2.2) { pillage(p, s); return; } }
  { const sh = SHOP(); fx.push({ k: 'open', only: p.id, t: Math.hypot(p.x - sh.x, p.y - sh.y) < 4.5 ? 'defense' : 'boutique' }); }
}
function useTool(p) {
  const fx_ = Math.floor(p.x + p.dx * .8), fy = Math.floor(p.y + p.dy * .8);
  if (fx_ < 0 || fy < 0 || fx_ >= W || fy >= H) return; const i = idx(fx_, fy);
  if (fieldOf[i] < 0) { hint(p, 'Utilisez vos outils dans un de vos champs'); return; }
  const ff = fieldFarm(i);
  if (ff !== p.farm) {
    const vf = WD.farms[ff];
    if (!vf.owner || !playerOf(ff)) { hint(p, 'Ferme protégée : son propriétaire est hors ligne'); return; }
    if (allied(ff, p.farm)) { hint(p, `Vous avez un pacte avec ${vf.owner} : pas de vol`); return; }
    if (p.tool !== 3) { hint(p, 'Chez un autre, seule la faucille (4) sert… à voler !'); return; }
    if (!vf.fields[fieldOf[i] & 3].owned || crop[i] < 0 || grow[i] < 1) { hint(p, 'Rien de mûr à voler ici'); return; }
    const c = CK[crop[i]], q = Math.round(CROPS[c].y * (fert[i] ? 1.3 : 1));
    if (p.bag.cap - load_(p.bag) < q) { hint(p, 'Sac plein'); return; }
    p.bag.items[c] = (p.bag.items[c] || 0) + q; crop[i] = -1; grow[i] = 0; till[i] = 0; fert[i] = 0; wet[i] = 0; vf.stats.stolen += q;
    floatTxt(fx_ + .5, fy + .1, `+${q} kg volés`, '#FF8A7A'); puff(fx_ + .5, fy + .5, '#e2bf4f', 4);
    p.alertCd = p.alertCd || {}; if (!(p.alertCd['v' + ff] > 0)) { p.alertCd['v' + ff] = 15; toast(ff, `${WD.farms[p.farm].owner} vole les récoltes de votre ${FIELD_NAMES[fieldOf[i] & 3]} !`, 'b'); }
    return;
  }
  if (!ownedField(i, p.farm)) { hint(p, 'Champ non acheté : Boutique › Terres'); return; }
  const cx = fx_ + .5, cy = fy + .5; let r;
  switch (p.tool) {
    case 0: r = opTill(i, p.farm); if (r) puff(cx, cy, '#6b4a2e'); else if (crop[i] >= 0) hint(p, 'Il y a déjà une culture ici'); break;
    case 1: if (!till[i]) { hint(p, 'Labourez d’abord avec la bêche (1)'); break; } r = opSow(i, p.seed, p.farm); if (r > 0) puff(cx, cy, '#9bd36a', 3); if (r < 0) hint(p, `Plus de semences de ${CROPS[p.seed].n.toLowerCase()} (R pour changer, B pour acheter)`); break;
    case 2: r = opWater(i, p.farm); if (r) puff(cx, cy, '#6fb3e6', 6); else if (!till[i]) hint(p, 'Arrosez un sol labouré'); break;
    case 3: { const c = crop[i] >= 0 ? CROPS[CK[crop[i]]].n : ''; r = opHarvest(i, p.bag, p.farm); if (r > 0) { floatTxt(cx, cy - .4, `+${r} kg ${c}`, '#f0d77a'); puff(cx, cy, '#e2bf4f', 5); } if (r < 0) hint(p, 'Sac plein : déchargez à votre ferme (E)'); if (!r && crop[i] >= 0) hint(p, 'Pas encore mûr'); break; }
    case 4: r = opFert(i, p.farm); if (r > 0) puff(cx, cy, '#ffffff', 4); if (r < 0) hint(p, 'Pas assez d’argent'); break;
  }
}
function nearestThief(x, y, r) { let b = null, bd = r; for (const t of thieves) { const d = Math.hypot(t.x - x, t.y - y); if (d < bd) { bd = d; b = t; } } return b; }
function shoot(p) {
  if (p.veh) { hint(p, 'Descendez du véhicule pour tirer'); return; }
  if (p.ko > 0) return;
  if (inTown(p.x, p.y)) { hint(p, 'Le village est une zone neutre : pas de combat ici'); return; }
  const fmS = WD.farms[p.farm];
  if (!fmS.gun || !(fmS.ammo > 0)) { punch(p, fmS.gun ? 'Plus de balles : coup de poing !' : ''); return; }
  const g = GUN[fmS.up.gun];
  const T = pickTarget(p.farm, p.x, p.y, g.r, { all: true }); if (!T) { hint(p, 'Aucune cible à portée'); return; }
  fmS.ammo--; if (fmS.ammo === 5) hint(p, 'Attention : plus que 5 balles');
  bullets.push({ x: p.x, y: p.y - .25, tk: T.k, ref: T.o, dmg: g.dmg, sp: 16, by: p.farm, how: 'au fusil' }); p.fireCd = g.cd; puff(p.x, p.y - .25, '#FFD27A', 2);
}
function punch(p, why) {
  p.fireCd = .55;
  const T = pickTarget(p.farm, p.x, p.y, 1.6, { all: true });
  if (!T) { hint(p, why || 'Sans arme : approchez-vous pour frapper (F). Fusil en vente dans l’onglet Défense.'); return; }
  const o = T.o, ox = T.k === 'tower' ? o.x : o.x, oy = T.k === 'tower' ? o.y - .5 : o.y;
  fx.push({ k: 'whip', x1: p.x, y1: p.y - .3, x2: ox, y2: oy - .3 }); floatTxt(ox, oy - 1.4, 'POW !', '#FFD27A'); puff(ox, oy - .3, '#FFFFFF', 3);
  if (T.k === 'thief') damage(o, 1, p.farm, 'assommé');
  else if (T.k === 'player') hurtPlayer(o, 1, p.farm, 'à mains nues');
  else if (T.k === 'guard') hurtGuard(o, 1, p.farm);
  else hurtTower(o, 1, p.farm);
}
function nearAgent(p) { let b = null, bd = 1.7; for (const a of WD.agents) { if (a.farm !== p.farm) continue; const d = Math.hypot(a.x - p.x, a.y - p.y); if (d < bd) { bd = d; b = a; } } return b; }
function whip(p) {
  if (p.veh) return; const a = nearAgent(p); if (!a) { hint(p, 'Approchez-vous d’un de vos ouvriers (T)'); return; }
  a.morale = Math.max(0, a.morale - 15); a.hop = .45; a.boost = 20;
  fx.push({ k: 'whip', x1: p.x, y1: p.y - .3, x2: a.x, y2: a.y - .3 }); floatTxt(a.x, a.y - 1.4, 'CLAC !', '#FFD27A');
  if (a.morale < 30 && !(a.strike > 0)) { a.strike = 30; releaseTask(a); a.say = 'Ça suffit, je fais grève !'; a.sayT = 4; toast(p.farm, `${a.name} se met en grève 30 s. Une prime le calmera (Équipe).`, 'b'); }
  else { a.say = OUCH[Math.floor(rnd() * OUCH.length)]; a.sayT = 2.5; }
}
function updatePlayer(p, dt) {
  p.hintCd -= dt; p.fireCd -= dt; p.useCd -= dt; if (p.inv > 0) p.inv -= dt; if (p.hitT > 0) p.hitT -= dt;
  const f = WD.farms[p.farm];
  if (p.ko > 0) { p.ko -= dt; p.moving = false; if (p.ko <= 0) { const d = SLOTS[p.farm].door; p.x = d.x + .5; p.y = d.y + 1.5; p.hp = maxHp(f); p.inv = 4; p.tp++; } f.px = p.x; f.py = p.y; return; }
  p.calm = (p.calm || 0) + dt; if (p.calm > 6) p.hp = Math.min(maxHp(f), p.hp + dt * .25);
  p.alertCd = p.alertCd || {}; for (const k in p.alertCd) p.alertCd[k] -= dt;
  { const so = slotOf[idx(Math.floor(p.x), Math.floor(p.y))]; if (so >= 0 && so !== p.farm && WD.farms[so].owner && !allied(so, p.farm) && playerOf(so) && !isJammed(so) && !(p.alertCd[so] > 0)) { p.alertCd[so] = 30; toast(so, `Intrus : ${f.owner} est entré sur votre ferme !`, 'b'); } }
  if (p.veh) { const v = vehById(p.veh); if (v) { p.x = v.x; p.y = v.y; } else p.veh = 0; }
  else {
    let ix = clamp(+p.in.ix || 0, -1, 1), iy = clamp(+p.in.iy || 0, -1, 1); const len = Math.hypot(ix, iy); if (len > 1) { ix /= len; iy /= len; }
    if (!p.clientMove) p.moving = len > .15;
    if (!p.clientMove && p.moving) {
      const sp = 3.4 + .7 * f.up.boots, nx = p.x + ix * sp * dt, ny = p.y + iy * sp * dt;
      if (free(nx, p.y, .28) && prepOk(p, nx, p.y)) p.x = nx; if (free(p.x, ny, .28) && prepOk(p, p.x, ny)) p.y = ny;
      if (Math.abs(ix) > Math.abs(iy)) { p.dx = Math.sign(ix); p.dy = 0; } else { p.dx = 0; p.dy = Math.sign(iy); }
      p.walk += dt;
    }
    if (p.in.use && p.useCd <= 0) { p.useCd = .17; useTool(p); }
  }
  if (p.in.fire && p.fireCd <= 0) shoot(p);
  f.px = p.x; f.py = p.y;
}

/* ---------------------------------------------------------------- véhicules */
function vehUpdate(v, dt) {
  const p = v.driver ? players.get(v.driver) : null;
  if (v.driver && !p) v.driver = null;
  const max = v.type === 'moiss' ? 3.2 : 4.6;
  if (p) {
    let ix = clamp(+p.in.ix || 0, -1, 1), iy = clamp(+p.in.iy || 0, -1, 1);
    const mag = Math.min(1, Math.hypot(ix, iy));
    if (p.in.rev) v.v += (-1.6 - v.v) * Math.min(1, dt * 3);
    else if (mag > .15) {
      const want = Math.atan2(iy, ix), dF = wrapA(want - v.a), dB = wrapA(want - v.a - Math.PI), tr = 2.6 * dt;
      const rev = v.v < -.1 ? Math.abs(dB) < 2.0 : Math.abs(dF) > 1.9;
      if (rev) { v.a += clamp(dB, -tr, tr); const tgt = -2.4 * mag * Math.max(.25, 1 - Math.abs(dB) / 1.6); v.v += (tgt - v.v) * Math.min(1, dt * 3); }
      else { v.a += clamp(dF, -tr, tr); const tgt = max * mag * Math.max(.2, 1 - Math.abs(dF) / 1.6); v.v += (tgt - v.v) * Math.min(1, dt * 3); }
    } else v.v *= Math.pow(.08, dt);
  } else { fullAutoTick(v, dt); if (v.auto) autoDrive(v, dt); else v.v *= Math.pow(.05, dt); }
  if (Math.abs(v.v) > .01) {
    const nx = v.x + Math.cos(v.a) * v.v * dt, ny = v.y + Math.sin(v.a) * v.v * dt;
    if (free(nx, ny, .45, true) && !(p && inPrep() && !inOwnFarm(v.farm, nx, ny) && inOwnFarm(v.farm, v.x, v.y)) && !(p && closedAt(v.farm, nx, ny) >= 0 && closedAt(v.farm, v.x, v.y) < 0) && !(p && truceAt(v.farm, nx, ny) >= 0 && truceAt(v.farm, v.x, v.y) < 0)) { v.x = nx; v.y = ny; v.stuck = 0; } else { v.v *= -.15; v.stuck = (v.stuck || 0) + dt; }
  }
  if (v.lower && Math.abs(v.v) > .15) work(v, p);
}
function work(v, p) {
  const c = Math.cos(v.a), s = Math.sin(v.a), back = v.type === 'moiss' ? 1.05 : -1.0, bx = v.x + c * back, by = v.y + s * back;
  for (const o of [-1, 0, 1]) {
    const tx = Math.floor(bx - s * o), ty = Math.floor(by + c * o); if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue; const i = idx(tx, ty);
    if (!ownedField(i, v.farm)) continue;
    if (v.type === 'moiss') { const r = opHarvest(i, v.bag, v.farm); if (r > 0 && rnd() < .4) puff(tx + .5, ty + .5, '#e8cf74', 2); if (r < 0 && p) hint(p, 'Trémie pleine : videz-la à votre ferme (E)'); }
    else if (v.impl === 'charrue') { if (opTill(i, v.farm) && rnd() < .3) puff(tx + .5, ty + .5, '#6b4a2e', 1); }
    else if (v.impl === 'semoir') { const f = WD.farms[v.farm]; const sd = v.auto ? f.fields[FIELDS[v.auto.fid].k].plan : (p ? p.seed : null); const r = opSow(i, sd, v.farm); if (r < 0 && p) hint(p, `Plus de semences de ${CROPS[sd].n.toLowerCase()}`); }
    else if (v.impl === 'pulve') { opWater(i, v.farm); const f = WD.farms[v.farm]; if (!fert[i] && till[i] && f.money >= .8) { f.money -= .8; fert[i] = 1; } }
  }
}
function wrapA(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
function lanes(f, fromRight) { const pts = []; let d = fromRight ? -1 : 1; for (let r = f.y + 1; r < f.y + f.h + 1; r += 3) { const ry = Math.min(r, f.y + f.h - 2) + .5; let a = f.x - 1 + .5, b = f.x + f.w + .5; if (d < 0) [a, b] = [b, a]; pts.push({ x: a, y: ry, work: false }, { x: b, y: ry, work: true }); d = -d; } return pts; }
const JOBS = { labour: { n: 'Labour', impl: 'charrue' }, semis: { n: 'Semis', impl: 'semoir' }, arrosage: { n: 'Arrosage + engrais', impl: 'pulve' }, recolte: { n: 'Récolte', impl: null }, park: { n: 'Retour au garage' } };
function startAuto(v, fid, job) {
  const f = FIELDS[fid]; if (v.type === 'tracteur') v.impl = JOBS[job].impl;
  const L = lanes(f, v.x > f.x + f.w / 2), p = bfs(Math.floor(v.x), Math.floor(v.y), Math.floor(L[0].x), Math.floor(L[0].y), true);
  v.auto = { fid, job, wps: [...thin(p), ...L], i: 0, phase: 'work', tmp: [], ti: 0, resume: 0 };
  v.status = `${JOBS[job].n} · ${f.n}`;
}
function chooseJob(v) {
  const fm = WD.farms[v.farm], rain = WD.weather === 'pluie' || WD.weather === 'orage';
  const busy = (fid, job) => WD.veh.some(o => o !== v && o.auto && o.auto.fid === fid && o.auto.job === job);
  let best = null, bs = 0;
  for (let k = 0; k < 4; k++) {
    const F = fm.fields[k]; if (!F.owned) continue; const f = FIELDS[v.farm * 4 + k];
    let untill = 0, empty = 0, dry = 0, mature = 0;
    for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) { const i = idx(x, y); if (crop[i] >= 0) { if (grow[i] >= 1) mature++; else if (wet[i] < .25) dry++; } else if (till[i]) empty++; else untill++; }
    const cand = [];
    if (v.type === 'moiss') { if (mature >= 8 && storeCap(fm) - storeLoad(fm) > 800) cand.push(['recolte', mature * 2]); }
    else {
      if (F.plan && untill >= 6) cand.push(['labour', untill]);
      if (F.plan && fm.impl.semoir && fm.seeds[F.plan] >= 10 && empty >= 6) cand.push(['semis', empty * 1.5]);
      if (fm.impl.pulve && !F.irrig && !rain && dry >= 10) cand.push(['arrosage', dry * 1.2]);
    }
    for (const [job, sc] of cand) if (!busy(f.id, job) && sc > bs) { bs = sc; best = { fid: f.id, job }; }
  }
  return best;
}
function fullAutoTick(v, dt) {
  if (!v.gps || !v.fullAuto || v.auto) return;
  v.think -= dt; if (v.think > 0) return; v.think = 2;
  const fm = WD.farms[v.farm], door = SLOTS[v.farm].door;
  const j = chooseJob(v); if (j) { startAuto(v, j.fid, j.job); return; }
  if (v.bag && load_(v.bag) > 0 && storeLoad(fm) < storeCap(fm) - 50) { v.auto = { fid: -1, job: 'park', wps: [], i: 0, phase: 'unload', final: true, tmp: thin(bfs(Math.floor(v.x), Math.floor(v.y), door.x, door.y, true)), ti: 0, resume: 0 }; v.status = 'Vide la trémie'; return; }
  if (Math.hypot(v.x - v.home.x, v.y - v.home.y) > 2.5) { const p = bfs(Math.floor(v.x), Math.floor(v.y), Math.floor(v.home.x), Math.floor(v.home.y), true); if (p && p.length) { v.auto = { fid: -1, job: 'park', wps: thin(p), i: 0, phase: 'work', tmp: [], ti: 0, resume: 0 }; v.status = 'Retour au garage'; return; } }
  v.status = storeCap(fm) - storeLoad(fm) < 800 ? 'Entrepôt plein : vendez' : v.type === 'moiss' ? 'Attend des cultures mûres' : (!fm.impl.semoir ? 'Attend (achetez un semoir)' : 'En attente de travail');
}
function autoDrive(v, dt) {
  const A = v.auto, list = A.phase === 'work' ? A.wps : A.tmp, k = A.phase === 'work' ? A.i : A.ti, door = SLOTS[v.farm].door;
  if (k >= list.length) {
    if (A.phase === 'work') { if (A.job === 'recolte' && v.bag && load_(v.bag) > 0) { A.final = true; A.phase = 'unload'; v.lower = false; A.tmp = thin(bfs(Math.floor(v.x), Math.floor(v.y), door.x, door.y, true)); A.ti = 0; return; } v.auto = null; v.lower = false; v.v = 0; return; }
    if (A.phase === 'unload') { deposit(v.bag, v.farm); if (A.final) { v.auto = null; v.v = 0; return; } if (load_(v.bag) >= v.bag.cap * .9) { v.auto = null; v.v = 0; return; } const t = A.wps[A.resume]; A.phase = 'return'; A.tmp = thin(bfs(Math.floor(v.x), Math.floor(v.y), Math.floor(t.x), Math.floor(t.y), true)); A.ti = 0; return; }
    if (A.phase === 'return') { A.phase = 'work'; A.i = A.resume; return; }
  }
  const wp = list[k], dx = wp.x - v.x, dy = wp.y - v.y, d = Math.hypot(dx, dy);
  if (d < (wp.work ? .6 : .45) || (v.stuck || 0) > 1.2) { v.stuck = 0; if (A.phase === 'work') A.i++; else A.ti++; return; }
  v.lower = A.phase === 'work' && !!wp.work;
  if (v.type === 'moiss' && A.phase === 'work' && A.job === 'recolte' && load_(v.bag) >= v.bag.cap * .94) { A.resume = wp.work ? Math.max(0, A.i - 1) : A.i; A.phase = 'unload'; v.lower = false; A.tmp = thin(bfs(Math.floor(v.x), Math.floor(v.y), door.x, door.y, true)); A.ti = 0; v.status = 'Trémie pleine : livraison'; return; }
  if (A.job === 'semis') { const pl = WD.farms[v.farm].fields[FIELDS[A.fid].k].plan; if (!pl || WD.farms[v.farm].seeds[pl] <= 0) { v.auto = null; v.lower = false; return; } }
  let ax = dx, ay = dy; if (wp.work && A.phase === 'work') { const sx = Math.sign(dx); ax = Math.abs(dx) > 1.4 ? sx * 1.4 : dx; ay = wp.y - v.y; }
  const diff = wrapA(Math.atan2(ay, ax) - v.a);
  v.a += clamp(diff * 3, -1, 1) * 2.4 * dt;
  const tgt = Math.abs(diff) > 1.1 ? .7 : (v.type === 'moiss' ? 2.6 : 3.6) * (1 - Math.abs(diff) / 1.8);
  v.v += (Math.max(.7, tgt) - v.v) * Math.min(1, dt * 3);
}

/* ---------------------------------------------------------------- ouvriers */
function releaseTask(a) { if (a.task && a.task.i !== undefined && claim[a.task.i] === a.id) claim[a.task.i] = -1; a.task = null; a.wait = 0; }
function nearestTile(a, kind) {
  const fm = WD.farms[a.farm], rain = WD.weather === 'pluie' || WD.weather === 'orage'; let best = -1, bd = 1e9;
  for (let k = 0; k < 4; k++) {
    const F = fm.fields[k]; if (!F.owned) continue; const f = FIELDS[a.farm * 4 + k];
    if (kind === 'sow' && (!F.plan || fm.seeds[F.plan] <= 0)) continue;
    if (kind === 'water' && (F.irrig || rain)) continue;
    if (kind === 'till' && !F.plan) continue;
    for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) {
      const i = idx(x, y); if (claim[i] >= 0 && claim[i] !== a.id) continue; let ok = false;
      if (kind === 'harvest') ok = crop[i] >= 0 && grow[i] >= 1 && a.bag.cap - load_(a.bag) >= CROPS[CK[crop[i]]].y * 1.3;
      else if (kind === 'water') ok = crop[i] >= 0 && grow[i] < 1 && wet[i] < .2;
      else if (kind === 'sow') ok = till[i] && crop[i] < 0;
      else if (kind === 'till') ok = !till[i] && crop[i] < 0;
      if (!ok) continue; const d = Math.abs(x + .5 - a.x) + Math.abs(y + .5 - a.y); if (d < bd) { bd = d; best = i; }
    }
  }
  return best;
}
const TASK_N = { till: 'Laboure', sow: 'Sème', water: 'Arrose', harvest: 'Récolte', unload: 'Livre à la ferme' };
function goA(a, task, tx, ty) { const p = bfs(Math.floor(a.x), Math.floor(a.y), tx, ty, false); if (!p) { if (task.i !== undefined) claim[task.i] = -1; return false; } a.task = task; a.path = p; a.pi = 0; a.msg = TASK_N[task.t]; return true; }
function pickTask(a) {
  const L = load_(a.bag), door = SLOTS[a.farm].door, fm = WD.farms[a.farm];
  if (L >= a.bag.cap - 25) { goA(a, { t: 'unload' }, door.x, door.y); return; }
  for (const kind of ['harvest', 'water', 'sow', 'till']) { const i = nearestTile(a, kind); if (i >= 0) { claim[i] = a.id; if (goA(a, { t: kind, i }, i % W, (i / W) | 0)) return; } }
  if (L > 0) { goA(a, { t: 'unload' }, door.x, door.y); return; }
  a.msg = fm.fields.every(F => !F.owned || !F.plan) ? 'Choisissez une culture au champ' : fm.fields.some(F => F.owned && F.plan && fm.seeds[F.plan] <= 0) ? 'Plus de semences' : 'Rien à faire'; a.think = 2;
}
function execTask(a) {
  const t = a.task; a.task = null;
  switch (t.t) {
    case 'till': opTill(t.i, a.farm); break;
    case 'sow': { const F = WD.farms[a.farm].fields[FIELDS[fieldOf[t.i]].k]; opSow(t.i, F.plan, a.farm); break; }
    case 'water': if (opWater(t.i, a.farm)) puff(t.i % W + .5, ((t.i / W) | 0) + .5, '#6fb3e6', 3); break;
    case 'harvest': { const r = opHarvest(t.i, a.bag, a.farm); if (r > 0) floatTxt(t.i % W + .5, ((t.i / W) | 0), `+${r} kg`, '#f0d77a'); break; }
    case 'unload': deposit(a.bag, a.farm); break;
  }
  if (t.i !== undefined && claim[t.i] === a.id) claim[t.i] = -1;
}
function agentUpdate(a, dt) {
  if (a.hop > 0) a.hop -= dt; if (a.sayT > 0) a.sayT -= dt; if (a.boost > 0) a.boost -= dt;
  a.morale = Math.min(100, a.morale + dt * .15);
  if (a.strike > 0) { a.strike -= dt; a.msg = 'En grève !'; return; }
  if (a.wait > 0) { a.wait -= dt; if (a.wait <= 0 && a.task) execTask(a); return; }
  if (!a.task) { a.think -= dt; if (a.think <= 0) { a.think = .4; pickTask(a); } return; }
  const T = a.task.t;
  if (T !== 'unload') { const i = a.task.i, ok = T === 'harvest' ? crop[i] >= 0 && grow[i] >= 1 : T === 'sow' ? till[i] && crop[i] < 0 : T === 'till' ? !till[i] && crop[i] < 0 : crop[i] >= 0 && wet[i] < .5; if (!ok || !ownedField(i, a.farm)) { releaseTask(a); return; } }
  if (a.pi < a.path.length) {
    const p = a.path[a.pi], dx = p.x - a.x, dy = p.y - a.y, d = Math.hypot(dx, dy), st = 2.7 * dt * (a.boost > 0 ? 1.8 : 1);
    if (d <= st) { a.x = p.x; a.y = p.y; a.pi++; } else { a.x += dx / d * st; a.y += dy / d * st; }
    if (Math.abs(dx) > Math.abs(dy)) { a.dx = Math.sign(dx); a.dy = 0; } else { a.dx = 0; a.dy = Math.sign(dy); } a.walk += dt; a.moving = true;
  } else { a.moving = false; a.wait = (T === 'unload' ? .8 : .45) * (a.boost > 0 ? .5 : 1); }
}

/* ---------------------------------------------------------------- voleurs et défense */
const isNight = () => { const h = WD.time / 60; return h >= 21 || h < 5; };
const inSlot = (x, y, s) => { const sl = SLOTS[s]; return x >= sl.x && x <= sl.x + 35 && y >= sl.y && y <= sl.y + 30; };
function pickType(n, fm) {
  const w = [['normal', 5], ['rapide', n >= 2 ? 3 : 0], ['costaud', n >= 3 ? 2 : 0], ['saboteur', n >= 4 && WD.towers.some(t => t.farm === fm) ? 2 : 0]];
  let tot = w.reduce((a, b) => a + b[1], 0), r = rnd() * tot; for (const [k, v] of w) { if (r < v) return k; r -= v; } return 'normal';
}
function spawnThief(fm, type) {
  const sl = SLOTS[fm], e = sl.entr[Math.floor(rnd() * 4)], T = TT[type];
  const hp = Math.round(T.hp * (1 + Math.floor(WD.night / 6) * .25));
  const t = { id: tid++, farm: fm, type, x: e[0] + .5, y: e[1] + .5, hp, maxhp: hp, sp: T.sp, state: 'go', path: [], pi: 0, wait: 0, loot: { items: {}, cap: 1e9 }, steals: 0, dx: 0, dy: 1, walk: 0, target: null, zap: 0, hit: 0 };
  thieves.push(t); thiefTarget(t);
  if (WD.farms[fm].up.camera && !isJammed(fm)) toast(fm, `Caméra : ${T.n.toLowerCase()} repéré à l’entrée ${['ouest', 'est', 'nord', 'sud'][sl.entr.indexOf(e)]} !`, 'b');
}
function thiefGo(t, tx, ty) { t.path = bfs(Math.floor(t.x), Math.floor(t.y), tx, ty, false) || []; t.pi = 0; }
function thiefTarget(t) {
  t.state = 'go'; const fm = WD.farms[t.farm], door = SLOTS[t.farm].door;
  if (t.type === 'saboteur') { let b = null, bd = 1e9; for (const tw of WD.towers) { if (tw.farm !== t.farm) continue; const d = Math.hypot(tw.x - t.x, tw.y - t.y); if (d < bd) { bd = d; b = tw; } } if (b) { t.target = { k: 'tower', id: b.id }; thiefGo(t, Math.floor(b.x), Math.floor(b.y)); return; } }
  if (t.type === 'chef' && storeLoad(fm) > 50) { t.target = { k: 'store' }; thiefGo(t, door.x, door.y); return; }
  let best = -1, bd = 1e9; const any = [];
  for (let k = 0; k < 4; k++) { if (!fm.fields[k].owned) continue; const f = FIELDS[t.farm * 4 + k]; for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) { const i = idx(x, y); if (crop[i] < 0) continue; any.push(i); if (grow[i] >= 1) { const d = Math.abs(x - t.x) + Math.abs(y - t.y) + rnd() * 8; if (d < bd) { bd = d; best = i; } } } }
  if (best >= 0) { t.target = { k: 'crop', i: best }; thiefGo(t, best % W, (best / W) | 0); return; }
  if (storeLoad(fm) > 20 && rnd() < .7) { t.target = { k: 'store' }; thiefGo(t, door.x, door.y); return; }
  if (any.length) { const i = any[Math.floor(rnd() * any.length)]; t.target = { k: 'trample', i }; thiefGo(t, i % W, (i / W) | 0); return; }
  thiefFlee(t);
}
function thiefFlee(t) { t.state = 'flee'; t.target = null; let best = SLOTS[t.farm].entr[0], bd = 1e9; for (const e of SLOTS[t.farm].entr) { const d = Math.abs(e[0] - t.x) + Math.abs(e[1] - t.y); if (d < bd) { bd = d; best = e; } } thiefGo(t, best[0], best[1]); }
function thiefAct(t) {
  const T = t.target, fm = WD.farms[t.farm]; if (!T) { thiefFlee(t); return; }
  if (T.k === 'crop' || T.k === 'trample') {
    const i = T.i; if (crop[i] >= 0 && (T.k === 'trample' || grow[i] >= 1)) { if (grow[i] >= 1) { const c = CK[crop[i]]; t.loot.items[c] = (t.loot.items[c] || 0) + CROPS[c].y; } crop[i] = -1; grow[i] = 0; till[i] = 0; fert[i] = 0; puff(i % W + .5, ((i / W) | 0) + .5, '#6b4a2e', 4); }
    t.steals++; if (t.steals >= (t.type === 'costaud' ? 6 : 3)) thiefFlee(t); else thiefTarget(t); return;
  }
  if (T.k === 'store') {
    const mult = t.type === 'chef' ? 3 : 1; let bk = null; for (const k in fm.store) if (!bk || fm.store[k] > fm.store[bk]) bk = k;
    if (bk && fm.store[bk] > 0) { const q = Math.min(fm.store[bk], Math.round((150 + rnd() * 150) * mult)); fm.store[bk] -= q; t.loot.items[bk] = (t.loot.items[bk] || 0) + q; toast(t.farm, `${TT[t.type].n} pille l’entrepôt : ${nf0.format(q)} kg de ${CROPS[bk].n.toLowerCase()} !`, 'b'); }
    thiefFlee(t); return;
  }
  if (T.k === 'tower') { const k = WD.towers.findIndex(x => x.id === T.id); if (k >= 0) { const tw = WD.towers[k]; WD.towers.splice(k, 1); puff(tw.x, tw.y, '#555', 14); toast(t.farm, 'Un saboteur a détruit une de vos tours !', 'b'); } thiefFlee(t); }
}
function killThief(t, by, how) {
  t.gone = true; const q = load_(t.loot); deposit(t.loot, t.farm);
  const b = TT[t.type].bounty, fm = WD.farms[by];
  fm.money += b; fm.stats.caught++;
  puff(t.x, t.y, '#9AA0A6', 12); floatTxt(t.x, t.y - .8, `+${b} € de prime`, '#7CC66B');
  const who = fm.owner || 'La ferme';
  if (t.type === 'chef') sys(`${who} a neutralisé un chef de bande ! (+${b} €)`);
  toast(by, `${TT[t.type].n} ${how} : prime ${b} €${q > 0 ? `, ${nf0.format(q)} kg récupérés` : ''}`, 'g');
  if (by !== t.farm && q > 0) toast(t.farm, `${who} a récupéré ${nf0.format(q)} kg qu’on vous avait volés`, 'g');
}
function damage(t, dmg, by, how) { if (t.gone) return; t.hp -= dmg; t.hit = .25; if (t.hp <= 0) killThief(t, by, how); else if (t.state !== 'flee' && t.type !== 'chef' && t.type !== 'costaud') thiefFlee(t); }
function thievesUpdate(dt) {
  const night = isNight();
  for (const fm of WD.farms) {
    const fi = fm.slot;
    if (!night || !fm.raid) continue;
    fm.raid.next -= dt;
    if (fm.raid.next <= 0 && fm.raid.list.length) { spawnThief(fi, fm.raid.list.shift()); fm.raid.next = fm.raid.gap * (.6 + rnd() * .8); }
  }
  for (const t of thieves) {
    if (!night && t.state !== 'flee') thiefFlee(t);
    t.hit = Math.max(0, t.hit - dt);
    const fm = WD.farms[t.farm]; let sp = t.state === 'flee' ? t.sp * 1.3 : t.sp;
    if (fm.up.elec && inSlot(t.x, t.y, t.farm)) { sp *= fm.up.elec === 1 ? .75 : .55; if (fm.up.elec >= 2) { t.zap += dt; if (t.zap > 3) { t.zap = 0; puff(t.x, t.y - .3, '#9FE6FF', 4); damage(t, 1, t.farm, 'électrocuté'); } } }
    if (t.gone) continue;
    if (t.wait > 0) { t.wait -= dt; if (t.wait <= 0) thiefAct(t); continue; }
    if (t.pi < t.path.length) { const p = t.path[t.pi], dx = p.x - t.x, dy = p.y - t.y, d = Math.hypot(dx, dy), st = sp * dt; if (d <= st) { t.x = p.x; t.y = p.y; t.pi++; } else { t.x += dx / d * st; t.y += dy / d * st; } if (Math.abs(dx) > Math.abs(dy)) { t.dx = Math.sign(dx); t.dy = 0; } else { t.dx = 0; t.dy = Math.sign(dy); } t.walk += dt; }
    else if (t.state === 'flee') { t.gone = true; const q = load_(t.loot); fm.stats.stolen += q; toast(t.farm, q > 0 ? `${TT[t.type].n} s’est enfui avec ${nf0.format(q)} kg` : `${TT[t.type].n} a pris la fuite`, q > 0 ? 'b' : ''); }
    else t.wait = t.type === 'saboteur' ? 3 : 1.2;
  }
  // tours
  for (const tw of WD.towers) { tw.cd -= dt; if (tw.cd > 0 || isJammed(tw.farm)) continue; const S = TOWER[tw.lvl], T = pickTarget(tw.farm, tw.x, tw.y, S.r, { slot: tw.farm }); if (T) { tw.cd = S.cd; bullets.push({ x: tw.x, y: tw.y - .8, tk: T.k, ref: T.o, dmg: S.dmg, sp: 18, by: tw.farm, how: 'abattu par une tour' }); } }
  // gardes
  for (const g of WD.guards) if (isActive(g.farm)) guardUpdate(g, dt);
  // balles
  for (let k = bullets.length - 1; k >= 0; k--) {
    const b = bullets[k], o = b.ref; let alive, tx, ty;
    if (b.tk === 'thief') { alive = !o.gone; tx = o.x; ty = o.y - .2; }
    else if (b.tk === 'player') { alive = players.get(o.id) === o && !(o.ko > 0); tx = o.x; ty = o.y - .2; }
    else if (b.tk === 'guard') { alive = WD.guards.includes(o) && !(o.ko > 0); tx = o.x; ty = o.y - .2; }
    else { alive = WD.towers.includes(o); tx = o.x; ty = o.y - .6; }
    if (!alive) { bullets.splice(k, 1); continue; }
    const dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy), st = b.sp * dt;
    if (d <= st + .2) {
      bullets.splice(k, 1);
      if (b.tk === 'thief') damage(o, b.dmg, b.by, b.how === 'au fusil' ? 'neutralisé' : b.how);
      else if (b.tk === 'player') hurtPlayer(o, b.dmg, b.by, b.how);
      else if (b.tk === 'guard') hurtGuard(o, b.dmg, b.by);
      else hurtTower(o, b.dmg, b.by);
    } else { b.x += dx / d * st; b.y += dy / d * st; }
  }
  thieves = thieves.filter(t => !t.gone);
}
function guardUpdate(g, dt) {
  g.cd -= dt; if (g.hitT > 0) g.hitT -= dt; if (g.hp === undefined) g.hp = GHP[g.type];
  if (g.ko > 0) { g.ko -= dt; if (g.ko <= 0) { g.hp = GHP[g.type]; const d = SLOTS[g.farm].door; if (g.type !== 'sniper') { g.x = d.x + .5; g.y = d.y + 1.5; } g.path = []; toast(g.farm, `Votre ${{ police: 'policier', dog: 'chien', sniper: 'sniper' }[g.type]} est de retour`, 'g'); } return; }
  const sl = SLOTS[g.farm];
  if (g.type === 'sniper') { if (g.cd > 0) return; const T = pickTarget(g.farm, g.x, g.y, 14, { slot: g.farm }); if (T) { g.cd = 2.6; bullets.push({ x: g.x, y: g.y - .3, tk: T.k, ref: T.o, dmg: 4, sp: 30, by: g.farm, how: 'touché par un sniper' }); fx.push({ k: 'shot', x1: g.x, y1: g.y - .3, x2: T.o.x, y2: T.o.y - .2 }); } return; }
  // police et chiens : voleurs et joueurs ennemis présents sur la ferme
  let tgt = null, tk = null, bd = g.type === 'dog' ? 9 : 12;
  for (const t of thieves) { if (!inSlot(t.x, t.y, g.farm) && t.farm !== g.farm) continue; const d = Math.hypot(t.x - g.x, t.y - g.y); if (d < bd) { bd = d; tgt = t; tk = 'thief'; } }
  for (const v of players.values()) { if (!canHurt(g.farm, v) || !inSlot(v.x, v.y, g.farm)) continue; const d = Math.hypot(v.x - g.x, v.y - g.y); if (d < bd) { bd = d; tgt = v; tk = 'player'; } }
  const sp = g.type === 'dog' ? 4.6 : 3.6;
  if (tgt) {
    if (bd < .9) {
      if (g.type === 'police') { if (g.cd <= 0) { g.cd = 1; fx.push({ k: 'float', x: g.x, y: g.y - 1.3, t: 'Police ! Halte !', c: '#8FDCFF' }); if (tk === 'thief') killThief(tgt, g.farm, 'arrêté par la police'); else koPlayer(tgt, g.farm, 'arrêté par la police'); } }
      else if (g.cd <= 0) { g.cd = .7; floatTxt(g.x, g.y - 1, 'Ouaf !', '#FFE08A'); if (tk === 'thief') damage(tgt, 1, g.farm, 'mis en fuite par le chien'); else hurtPlayer(tgt, 1, g.farm, 'mordu par un chien'); }
      g.path = []; return;
    }
    g.think -= dt; if (g.think <= 0 || g.pi >= g.path.length) { g.think = .5; g.path = bfs(Math.floor(g.x), Math.floor(g.y), Math.floor(tgt.x), Math.floor(tgt.y), false) || []; g.pi = 0; }
  } else if (g.pi >= g.path.length) {
    g.think -= dt; if (g.think <= 0) { g.think = 3 + rnd() * 3; for (let n = 0; n < 8; n++) { const x = sl.x + 1 + Math.floor(rnd() * 34), y = sl.y + 1 + Math.floor(rnd() * 29); if (walk(x, y) && fieldOf[idx(x, y)] < 0) { g.path = bfs(Math.floor(g.x), Math.floor(g.y), x, y, false) || []; g.pi = 0; break; } } }
  }
  if (g.pi < g.path.length) { const p = g.path[g.pi], dx = p.x - g.x, dy = p.y - g.y, d = Math.hypot(dx, dy), st = (tgt ? sp : sp * .45) * dt; if (d <= st) { g.x = p.x; g.y = p.y; g.pi++; } else { g.x += dx / d * st; g.y += dy / d * st; } if (Math.abs(dx) > Math.abs(dy)) { g.dx = Math.sign(dx); g.dy = 0; } else { g.dx = 0; g.dy = Math.sign(dy); } g.walk += dt; g.moving = true; } else g.moving = false;
}
function startNight() {
  WD.night++; const N = WD.night;
  for (const fm of WD.farms) {
    fm.raid = null; if (!fm.owner || !playerOf(fm.slot)) continue;
    fm.stats.nights++;
    let n = Math.min(30, 2 + Math.floor(N * .8) - fm.up.lamp); n = Math.max(1, n);
    const list = []; for (let k = 0; k < n; k++) list.push(pickType(N, fm.slot));
    if (N % 5 === 0) list.push('chef');
    fm.raid = { list, gap: (NIGHT_REAL * .85) / list.length, next: 2 + rnd() * 4 };
    toast(fm.slot, `Nuit ${N} : ${list.length} intrus attendus${N % 5 === 0 ? ', dont un CHEF DE BANDE' : ''}. Défendez votre ferme !`, 'b');
  }
  if (N % 5 === 0) sys(`Nuit ${N} : une bande organisée attaque toutes les fermes !`);
}

/* ---------------------------------------------------------------- temps, météo, marché */
function newDay() {
  WD.day++;
  { const on = WD.farms.filter(f => f.owner && playerOf(f.slot) && isActive(f.slot)); if (on.length >= 2) { const top = on.sort((a, b) => worth(b) - worth(a))[0]; WD.bounty = WD.bounty || {}; WD.bounty[top.slot] = (WD.bounty[top.slot] || 0) + 400; sys(`Prime du jour : la coopérative offre 400 € à qui mettra K.O. ${top.owner}, la ferme la plus riche !`); toast(top.slot, 'Vous êtes la ferme la plus riche : 400 € de prime sur votre tête aujourd’hui !', 'b'); } }
  const r = rnd(); WD.weather = r < .48 ? 'soleil' : r < .72 ? 'nuages' : r < .93 ? 'pluie' : 'orage';
  for (const k of CK) { const b = CROPS[k].p; let p = WD.prices[k]; p = p * (1 + (rnd() - .5) * .14) + (b - p) * .15; p = clamp(p, b * .6, b * 1.6); WD.prices[k] = p; WD.ph[k].push(p); if (WD.ph[k].length > 14) WD.ph[k].shift(); }
  for (const fm of WD.farms) {
    fm.recent = 0;
    if (!fm.owner) continue; fm.raid = null;
    const ag = WD.agents.filter(a => a.farm === fm.slot).length, gs = WD.guards.filter(g => g.farm === fm.slot);
    const wages = ag * WAGE.agent + gs.reduce((a, g) => a + WAGE[g.type], 0);
    if (wages) { fm.money -= wages; toast(fm.slot, `Jour ${WD.day} · salaires versés : ${eur(wages)}`); }
  }
  if (!WD.contract || WD.contract.until < WD.day) { const k = CK[Math.floor(rnd() * CK.length)]; WD.contract = { k, q: Math.round((300 + rnd() * 900) * (k === 'fraise' ? .3 : 1) / 10) * 10, p: +(WD.prices[k] * (1.4 + rnd() * .3)).toFixed(2), until: WD.day + 2 }; sys(`Nouvelle commande de la coopérative : ${nf0.format(WD.contract.q)} kg de ${CROPS[k].n.toLowerCase()} à ${WD.contract.p.toFixed(2)} €/kg. Le premier qui livre gagne !`); }
  if (WD.weather === 'pluie' || WD.weather === 'orage') toast(-1, 'Pluie aujourd’hui : toutes les cultures sont arrosées', 'g');
  save();
}
let tickTime = 0;
function timeUpdate(dt) {
  tickTime += dt; if (WD.offers.length) WD.offers = WD.offers.filter(o => tickTime - o.t < 180);
  const before = WD.time; WD.time += dt * (isNight() ? 480 / NIGHT_REAL : 960 / DAY_REAL);
  if (before < 21 * 60 && WD.time >= 21 * 60) startNight();
  if (WD.time >= 1440) { WD.time -= 1440; newDay(); }
}
function tilesUpdate(dt) {
  const rain = WD.weather === 'pluie' || WD.weather === 'orage', dd = dt / DAY;
  for (const i of FIELD_TILES) {
    if (!till[i]) continue;
    if (rain) wet[i] = 1; else if (wet[i] > 0) wet[i] = Math.max(0, wet[i] - dd / 1.5);
    if (crop[i] >= 0 && grow[i] < 1) { const f = fieldOf[i]; if (WD.farms[f >> 2].fields[f & 3].irrig && wet[i] < .3) wet[i] = 1; if (wet[i] > 0) grow[i] = Math.min(1, grow[i] + dd / CROPS[CK[crop[i]]].days * (fert[i] ? 1.4 : 1)); }
  }
}
function worth(fm) {
  let w = fm.money; for (const k of CK) w += (fm.store[k] || 0) * WD.prices[k];
  fm.fields.forEach((F, k) => { if (F.owned) w += FIELD_PRICE[k] + (F.irrig ? 600 : 0); });
  w += WD.veh.filter(v => v.farm === fm.slot).reduce((a, v) => a + (v.type === 'moiss' ? 2500 : 2000) + (v.gps ? 600 : 0), 0);
  w += WD.towers.filter(t => t.farm === fm.slot).reduce((a, t) => a + 500 * t.lvl, 0);
  return Math.round(w);
}

/* ---------------------------------------------------------------- actions des joueurs */
function act(p, m) {
  const fm = WD.farms[p.farm], cost = v => { if (fm.money < v) { hint(p, 'Pas assez d’argent'); return false; } fm.money -= v; return true; };
  const sl = SLOTS[p.farm];
  switch (m.a) {
    case 'interact': interact(p); break;
    case 'slot': { const n = +m.n; if (p.veh) { const v = vehById(p.veh); if (!v || v.type !== 'tracteur') return; const im = ['charrue', 'semoir', 'pulve'][n]; if (!im) return; if (!fm.impl[im]) { hint(p, 'Outil non possédé : voir Boutique'); return; } v.impl = im; } else if (n >= 0 && n < 5) p.tool = n; fm.tool = p.tool; break; }
    case 'seed': { if (m.c && CROPS[m.c]) { p.seed = m.c; fm.seed = p.seed; break; } const have = CK.filter(k => fm.seeds[k] > 0), list = have.length ? have : CK, d = m.dir === -1 ? -1 : 1; p.seed = list[(list.indexOf(p.seed) + d + list.length) % list.length]; fm.seed = p.seed; break; }
    case 'lower': { const v = vehById(p.veh); if (v) v.lower = !v.lower; break; }
    case 'whip': whip(p); break;
    case 'buySeed': { const k = m.k, q = +m.q; if (!CROPS[k] || ![20, 100, 500].includes(q)) return; if (cost(q * CROPS[k].seed)) fm.seeds[k] += q; break; }
    case 'buy': {
      const k = m.k;
      if (k === 'semoir' || k === 'pulve') { if (fm.impl[k]) return; if (cost(PRICES[k])) { fm.impl[k] = true; toast(p.farm, 'Outil acheté', 'g'); } }
      if (k === 'moiss' || k === 'tracteur') { if (WD.veh.filter(v => v.farm === p.farm).length >= 4) { hint(p, 'Garage plein (4 véhicules)'); return; } if (cost(PRICES[k])) { WD.veh.push(mkVeh(p.farm, k)); toast(p.farm, 'Véhicule livré au garage', 'g'); } }
      break;
    }
    case 'gps': { const v = vehById(+m.id); if (!v || v.farm !== p.farm || v.gps) return; if (cost(PRICES.gps)) { v.gps = true; v.fullAuto = true; v.think = 0; toast(p.farm, `GPS installé : ${v.name} travaille maintenant tout seul`, 'g'); } break; }
    case 'fullauto': { const v = vehById(+m.id); if (!v || v.farm !== p.farm || !v.gps) return; v.fullAuto = !v.fullAuto; if (!v.fullAuto) { v.auto = null; v.lower = false; v.v = 0; v.status = ''; } else v.think = 0; break; }
    case 'jam': {
      const to = +m.to, tf = WD.farms[to], sh = SHOP();
      if (Math.hypot(p.x - sh.x, p.y - sh.y) > 4.5) { hint(p, 'Le brouilleur s’achète à l’armurerie du village'); return; }
      if (!tf || to === p.farm || !tf.owner || !playerOf(to)) { hint(p, 'Cible hors ligne : impossible'); return; }
      if (allied(to, p.farm)) { hint(p, 'Vous avez un pacte avec ce joueur'); return; }
      if (fm.lastJamDay === WD.day) { hint(p, 'Un seul brouilleur par jour de jeu'); return; }
      if ((tf.jamProt || 0) > tickTime) { hint(p, `Cette ferme vient d’être brouillée : encore ${Math.ceil(tf.jamProt - tickTime)} s`); return; }
      if (!cost(PRICES.jam)) return;
      fm.lastJamDay = WD.day; tf.jamAt = tickTime + 10; tf.jamUntil = tickTime + 70; tf.jamProt = tickTime + 300; tf.jamStarted = false;
      toast(to, 'Alerte : un brouilleur va couper vos défenses dans 10 secondes !', 'b');
      toast(p.farm, `Brouilleur lancé sur la ferme de ${tf.owner} : effet dans 10 s, pendant 60 s`, 'g');
      sys(`Quelqu’un a lancé un brouilleur sur la ferme de ${tf.owner} !`);
      break;
    }
    case 'setPw': {
      if (!checkPw(fm, m.old)) { hint(p, 'Ancien mot de passe incorrect'); return; }
      const nw = String(m.pw || '').slice(0, 64); if (nw.length < 4) { hint(p, 'Nouveau mot de passe : 4 caractères minimum'); return; }
      setPw(fm, nw); p.tok = newTok(fm); p.ws.send(JSON.stringify({ t: 'tok', tok: p.tok }));
      toast(p.farm, 'Mot de passe changé : les autres ordinateurs mémorisés sont déconnectés', 'g');
      for (const q of players.values()) if (q !== p && q.farm === p.farm && q.joined) q.ws.close && q.ws.close();
      break;
    }
    case 'logout': { fm.toks = (fm.toks || []).filter(h => h !== sha(p.tok)); if (m.all) fm.toks = []; break; }
    case 'buyGun': { if (fm.gun) return; if (cost(PRICES.gunBuy)) { fm.gun = true; fm.ammo = Math.max(fm.ammo || 0, 30); toast(p.farm, 'Fusil acheté avec 30 balles. Touche F pour tirer.', 'g'); } break; }
    case 'ammo': { const n = +m.n, pr = PRICES.ammo[n]; if (!pr) return; if (!fm.gun) { hint(p, 'Achetez d’abord un fusil'); return; } if ((fm.ammo || 0) + n > AMMO_MAX) { hint(p, `Maximum ${AMMO_MAX} balles`); return; } if (cost(pr)) { fm.ammo = (fm.ammo || 0) + n; toast(p.farm, `+${n} balles (${fm.ammo} au total)`, 'g'); } break; }
    case 'bounty': {
      const to = +m.to, tf = WD.farms[to], amt = Math.round(+m.amt || 0);
      if (!tf || !tf.owner || to === p.farm || !isActive(to)) return;
      if (allied(to, p.farm)) { hint(p, 'Impossible : vous avez un pacte avec ce joueur'); return; }
      if (!(amt >= PRICES.bountyMin) || amt > 100000) { hint(p, `Prime minimum : ${eur(PRICES.bountyMin)}`); return; }
      if (!cost(amt)) return;
      WD.bounty = WD.bounty || {}; WD.bounty[to] = (WD.bounty[to] || 0) + amt;
      sys(`Nouvelle prime : ${eur(amt)} sur la tête de ${tf.owner} (total ${eur(WD.bounty[to])}) !`); toast(to, `Quelqu’un a mis ${eur(amt)} de prime sur votre tête !`, 'b'); break;
    }
    case 'farmUp': { const c = farmUpCost(fm.lvl); if (cost(c)) { fm.lvl = (fm.lvl || 0) + 1; p.hp = maxHp(fm); toast(p.farm, `Ferme niveau ${fm.lvl} : récoltes +${Math.round((yieldMult(fm) - 1) * 100)} %, limites de défense augmentées`, 'g'); sys(`${fm.owner} agrandit sa ferme au niveau ${fm.lvl} !`); } break; }
    case 'up': { const k = m.k; if (!['bag', 'boots', 'silo', 'lamp', 'elec', 'gun', 'armor'].includes(k)) return; if (k === 'gun' && !fm.gun) { hint(p, 'Achetez d’abord un fusil'); return; } const pr = upPrice(k, fm.up[k]); if (!pr) return; if (cost(pr)) { fm.up[k]++; if (k === 'bag') p.bag.cap = 300 + 200 * fm.up.bag; if (k === 'armor') p.hp = maxHp(fm); toast(p.farm, 'Amélioration effectuée', 'g'); } break; }
    case 'camera': { if (fm.up.camera) return; if (cost(PRICES.camera)) { fm.up.camera = 1; toast(p.farm, 'Caméras installées : vous serez prévenu de chaque intrusion', 'g'); } break; }
    case 'irrig': { const k = +m.k; const F = fm.fields[k]; if (!F || !F.owned || F.irrig) return; if (cost(PRICES.irrig)) F.irrig = true; break; }
    case 'land': { const k = +m.k; const F = fm.fields[k]; if (!F || F.owned) return; if (cost(FIELD_PRICE[k])) { F.owned = true; if (!F.plan) F.plan = 'ble'; toast(p.farm, `${FIELD_NAMES[k]} acheté (culture prévue : blé)`, 'g'); } break; }
    case 'plan': { const k = +m.k; const F = fm.fields[k]; if (!F) return; F.plan = CROPS[m.c] ? m.c : null; break; }
    case 'hire': { if (WD.agents.filter(a => a.farm === p.farm).length >= lim(fm, 'agents')) { hint(p, 'Maximum atteint : agrandissez la ferme'); return; } if (cost(PRICES.agent)) { const a = mkAgent(p.farm, Math.floor(rnd() * 100)); WD.agents.push(a); toast(p.farm, `${a.name} rejoint la ferme`, 'g'); } break; }
    case 'fireAgent': { const a = WD.agents.find(x => x.id === +m.id && x.farm === p.farm); if (!a) return; releaseTask(a); deposit(a.bag, p.farm); WD.agents = WD.agents.filter(x => x !== a); break; }
    case 'prime': { const a = WD.agents.find(x => x.id === +m.id && x.farm === p.farm); if (!a) return; if (cost(50)) { a.morale = Math.min(100, a.morale + 40); a.strike = 0; a.say = 'Merci patron !'; a.sayT = 2.5; } break; }
    case 'sell': { const k = m.k; if (!CROPS[k]) return; const q = m.q === 'all' ? fm.store[k] : Math.floor(fm.store[k] / 2); if (!q) return; const v = q * WD.prices[k]; fm.store[k] -= q; fm.money += v; fm.stats.sold += v; WD.prices[k] *= 1 - Math.min(.12, q / 30000); toast(p.farm, `Vente : ${eur(v)}`, 'g'); break; }
    case 'sellall': { let v = 0; for (const k of CK) { const q = fm.store[k]; if (!q) continue; v += q * WD.prices[k]; WD.prices[k] *= 1 - Math.min(.12, q / 30000); fm.store[k] = 0; } fm.money += v; fm.stats.sold += v; toast(p.farm, `Tout vendu : ${eur(v)}`, 'g'); break; }
    case 'contract': { const C = WD.contract; if (!C || C.done || fm.store[C.k] < C.q) return; fm.store[C.k] -= C.q; fm.money += C.q * C.p; C.done = true; sys(`${fm.owner} a remporté la commande de la coopérative (${eur(C.q * C.p)}) !`); break; }
    case 'give': { const to = WD.farms[+m.to], amt = Math.floor(+m.amt); if (!to || !to.owner || to === fm || !(amt > 0)) return; if (cost(amt)) { to.money += amt; toast(to.slot, `${fm.owner} vous a envoyé ${eur(amt)}`, 'g'); toast(p.farm, `${eur(amt)} envoyés à ${to.owner}`, 'g'); } break; }
    case 'tower': {
      if (WD.towers.filter(t => t.farm === p.farm).length >= lim(fm, 'towers')) { hint(p, 'Maximum de tours atteint : agrandissez la ferme'); return; }
      const tx = Math.floor(p.x), ty = Math.floor(p.y);
      if (!inSlot(tx, ty, p.farm) || fieldOf[idx(tx, ty)] >= 0) { hint(p, 'Placez-vous sur votre ferme, hors des champs'); return; }
      if (WD.towers.some(t => Math.hypot(t.x - tx - .5, t.y - ty - .5) < 2)) { hint(p, 'Trop près d’une autre tour'); return; }
      if (cost(PRICES.tower)) { WD.towers.push({ id: WD.nid++, farm: p.farm, x: tx + .5, y: ty + .5, lvl: 1, cd: 0, hp: 12 }); toast(p.farm, 'Tour de guet construite ici', 'g'); }
      break;
    }
    case 'towerUp': { const t = WD.towers.find(x => x.id === +m.id && x.farm === p.farm); if (!t || t.lvl >= 3) return; if (cost(PRICES.towerUp[t.lvl - 1])) { t.lvl++; t.hp = towerMax(t); } break; }
    case 'towerSell': { const k = WD.towers.findIndex(x => x.id === +m.id && x.farm === p.farm); if (k < 0) return; fm.money += 400; WD.towers.splice(k, 1); break; }
    case 'guard': {
      const ty = m.k; if (!['police', 'sniper', 'dog'].includes(ty)) return;
      if (WD.guards.filter(g => g.farm === p.farm && g.type === ty).length >= lim(fm, ty)) { hint(p, 'Maximum atteint : agrandissez la ferme'); return; }
      let x = p.x, y = p.y;
      if (ty === 'sniper') { if (!inSlot(Math.floor(x), Math.floor(y), p.farm) || fieldOf[idx(Math.floor(x), Math.floor(y))] >= 0) { hint(p, 'Placez-vous sur votre ferme, hors des champs, pour poster le sniper'); return; } }
      else { x = sl.door.x + .5; y = sl.door.y + 1.5; }
      if (cost(PRICES[ty])) { WD.guards.push({ id: WD.nid++, farm: p.farm, type: ty, x, y, dx: 0, dy: 1, walk: 0, path: [], pi: 0, cd: 0, think: 0, hp: GHP[ty], ko: 0 }); toast(p.farm, ty === 'police' ? 'Un policier patrouille sur votre ferme' : ty === 'sniper' ? 'Sniper posté ici' : 'Chien de garde adopté', 'g'); }
      break;
    }
    case 'guardFire': { const k = WD.guards.findIndex(x => x.id === +m.id && x.farm === p.farm); if (k >= 0) WD.guards.splice(k, 1); break; }
    case 'pactOffer': {
      const to = +m.to, tf = WD.farms[to]; if (!tf || !tf.owner || to === p.farm || allied(to, p.farm)) return;
      if (WD.offers.some(o => o.from === p.farm && o.to === to)) { hint(p, 'Proposition déjà envoyée'); return; }
      const back = WD.offers.findIndex(o => o.from === to && o.to === p.farm);
      if (back >= 0) { WD.offers.splice(back, 1); WD.pacts.push(pkey(p.farm, to)); sys(`${fm.owner} et ${tf.owner} ont signé un pacte d’amitié !`); return; }
      WD.offers.push({ from: p.farm, to, t: tickTime }); toast(to, `${fm.owner} vous propose un pacte d’amitié. Répondez dans Classement (touche L).`, 'g'); toast(p.farm, `Pacte proposé à ${tf.owner}`); break;
    }
    case 'pactAccept': { const from = +m.from, k = WD.offers.findIndex(o => o.from === from && o.to === p.farm); if (k < 0) return; WD.offers.splice(k, 1); if (!allied(from, p.farm)) WD.pacts.push(pkey(from, p.farm)); sys(`${fm.owner} et ${WD.farms[from].owner} ont signé un pacte d’amitié !`); break; }
    case 'pactRefuse': { const from = +m.from, k = WD.offers.findIndex(o => o.from === from && o.to === p.farm); if (k < 0) return; WD.offers.splice(k, 1); toast(from, `${fm.owner} a refusé votre pacte`, 'b'); break; }
    case 'pactBreak': { const to = +m.to, k = WD.pacts.indexOf(pkey(to, p.farm)); if (k < 0) return; WD.pacts.splice(k, 1); sys(`${fm.owner} a rompu son pacte avec ${WD.farms[to].owner} : c’est la guerre !`); for (const q of players.values()) if (q.farm === to || q.farm === p.farm) q.inv = Math.max(q.inv || 0, 5); break; }
    case 'chat': { const t = String(m.m || '').slice(0, 160).trim(); if (!t) return; const msg = { n: fm.owner, c: fm.color, m: t }; WD.chat.push(msg); if (WD.chat.length > 40) WD.chat.shift(); fx.push({ k: 'chat', ...msg }); break; }
  }
}

/* ---------------------------------------------------------------- sérialisation réseau */
const lastPack = new Int32Array(W * H).fill(-1);
function packTile(i) { return till[i] | (fert[i] << 1) | (Math.min(3, Math.ceil(wet[i] * 3)) << 2) | ((crop[i] + 1) << 4) | (Math.min(10, Math.floor(grow[i] * 10)) << 8); }
function tileDiff(all) { const out = []; for (const i of FIELD_TILES) { const v = packTile(i); if (all || v !== lastPack[i]) { out.push(i, v); if (!all) lastPack[i] = v; } } return out; }
const r2 = v => Math.round(v * 100) / 100;
function pubInfo() {
  return WD.farms.map(fm => ({ s: fm.slot, o: fm.owner, c: fm.color, w: fm.owner ? worth(fm) : 0, k: fm.stats.caught, on: !!playerOf(fm.slot), act: isActive(fm.slot) ? 1 : 0, f: fm.fields.map(F => (F.owned ? 1 : 0) | (F.irrig ? 2 : 0)), pl: fm.fields.map(F => F.plan), lamp: fm.up.lamp, nights: fm.stats.nights, kl: fm.stats.kills || 0, dt: fm.stats.deaths || 0, wanted: (fm.recent || 0) >= 3 ? 1 : 0, b: Math.floor((WD.bounty || {})[fm.slot] || 0), pil: fm.stats.pillaged || 0, lvl: fm.lvl || 0, jam: isJammed(fm.slot) ? 1 : 0 }));
}
function meInfo(p) {
  const fm = WD.farms[p.farm];
  return {
    farm: p.farm, money: Math.floor(fm.money), seeds: fm.seeds, store: fm.store, cap: storeCap(fm), fields: fm.fields, impl: fm.impl, up: fm.up, stats: fm.stats,
    bag: p.bag.items, bagCap: p.bag.cap, tool: p.tool, seed: p.seed, veh: p.veh,
    agents: WD.agents.filter(a => a.farm === p.farm).map(a => ({ id: a.id, n: a.name, m: Math.round(a.morale), st: a.strike > 0, msg: a.msg, l: load_(a.bag) })),
    vehs: WD.veh.filter(v => v.farm === p.farm).map(v => ({ id: v.id, n: v.name, t: v.type, gps: v.gps, fa: v.fullAuto, st: v.status, auto: !!v.auto, l: v.bag ? load_(v.bag) : 0 })),
    towers: WD.towers.filter(t => t.farm === p.farm).map(t => ({ id: t.id, lvl: t.lvl, x: t.x, y: t.y })),
    guards: WD.guards.filter(g => g.farm === p.farm).map(g => ({ id: g.id, t: g.type })),
    gun: fm.gun ? 1 : 0, ammo: fm.ammo || 0, ammoMax: AMMO_MAX,
    truces: WD.farms.filter(f => f.owner && truceLeft(p.farm, f.slot) > 0).map(f => ({ f: f.slot, o: f.owner, t: Math.ceil(truceLeft(p.farm, f.slot)) })),
    lvl: fm.lvl || 0, lvlCost: farmUpCost(fm.lvl), yieldB: Math.round((yieldMult(fm) - 1) * 100),
    limits: { agents: lim(fm, 'agents'), towers: lim(fm, 'towers'), sniper: lim(fm, 'sniper'), police: lim(fm, 'police'), dog: lim(fm, 'dog') },
    upPrices: Object.fromEntries(['bag', 'boots', 'silo', 'lamp', 'elec', 'gun', 'armor'].map(k => [k, upPrice(k, fm.up[k]) || 0])),
    jamReady: fm.lastJamDay !== WD.day, jammed: isJammed(p.farm), jamSoon: !!fm.jamAt && tickTime < fm.jamAt,
    raid: fm.raid ? fm.raid.list.length : 0,
    tp: p.tp, hp: Math.ceil(p.hp), maxHp: maxHp(fm), ko: p.ko > 0 ? Math.ceil(p.ko) : 0, inv: p.inv > 0 ? 1 : 0,
    allies: WD.farms.filter(o => o.slot !== p.farm && allied(o.slot, p.farm)).map(o => o.slot),
    offersIn: WD.offers.filter(o => o.to === p.farm).map(o => o.from), offersOut: WD.offers.filter(o => o.from === p.farm).map(o => o.to),
  };
}
function snapshot(tick) {
  const s = {
    t: 's', prep: inPrep() ? Math.ceil(PREP_END - tickTime) : 0, tm: Math.round(WD.time), d: WD.day, n: WD.night, w: WD.weather,
    ti: tileDiff(false),
    pl: [...players.values()].filter(p => p.joined).map(p => [p.id, p.farm, r2(p.x), r2(p.y), p.dx, p.dy, p.moving ? 1 : 0, p.veh, WD.farms[p.farm].owner, load_(p.bag) > 0 ? 1 : 0, Math.ceil(Math.max(0, p.hp)), maxHp(WD.farms[p.farm]), p.ko > 0 ? 1 : 0, p.inv > 0 ? 1 : 0, p.hitT > 0 ? 1 : 0]),
    ag: WD.agents.filter(a => isActive(a.farm)).map(a => [a.id, a.farm, r2(a.x), r2(a.y), a.dx, a.dy, a.moving && a.pi < a.path.length ? 1 : 0, a.name + ' · ' + a.msg, a.sayT > 0 ? a.say : '', a.strike > 0 ? 1 : 0, a.boost > 0 ? 1 : 0, a.hop > 0 ? r2(a.hop) : 0, load_(a.bag) > 0 ? 1 : 0, a.wait > 0 ? 1 : 0]),
    ve: WD.veh.filter(v => isActive(v.farm)).map(v => [v.id, v.farm, v.type, r2(v.x), r2(v.y), r2(v.a), v.impl, v.lower ? 1 : 0, v.auto ? 1 : 0, v.gps && v.fullAuto ? (v.status || 'auto') : (v.auto ? 'auto' : ''), v.bag ? r2(load_(v.bag) / v.bag.cap) : 0, v.name, r2(v.v)]),
    th: thieves.map(t => [t.id, t.type, r2(t.x), r2(t.y), t.hp, t.maxhp, t.state === 'flee' ? 1 : 0, t.dx, t.dy, load_(t.loot) > 0 ? 1 : 0, t.hit > 0 ? 1 : 0, t.farm]),
    to: WD.towers.filter(t => isActive(t.farm)).map(t => [t.id, t.farm, t.x, t.y, t.lvl, Math.ceil(t.hp ?? towerMax(t)), towerMax(t)]),
    gu: WD.guards.filter(g => isActive(g.farm)).map(g => [g.id, g.farm, g.type, r2(g.x), r2(g.y), g.dx, g.dy, g.moving ? 1 : 0, Math.ceil(g.hp ?? GHP[g.type]), GHP[g.type], g.ko > 0 ? 1 : 0, g.hitT > 0 ? 1 : 0]),
    bu: bullets.map(b => [r2(b.x), r2(b.y)]),
    fx,
  };
  if (tick % 20 === 0) { s.pub = pubInfo(); s.pr = WD.prices; s.ph = WD.ph; s.ct = WD.contract; s.pacts = WD.pacts; }
  return s;
}

/* ---------------------------------------------------------------- sauvegarde */
function serialize() {
    return JSON.stringify(Object.assign({}, WD, {
      agents: WD.agents.map(a => Object.assign({}, a, { task: null, path: [], pi: 0, wait: 0 })),
      veh: WD.veh.map(v => Object.assign({}, v, { auto: null, driver: null, v: 0 })),
      guards: WD.guards.map(g => Object.assign({}, g, { path: [], pi: 0 })),
      farms: WD.farms.map(f => Object.assign({}, f, { raid: null })),
      tiles: { till: Array.from(till), wet: Array.from(wet, v => Math.round(v * 100) / 100), crop: Array.from(crop), grow: Array.from(grow, v => Math.round(v * 1000) / 1000), fert: Array.from(fert) },
    }));
}
let saving = false;
function saveAsync() {
  if (saving) return; saving = true;
  let data; try { if (WD.meta) WD.meta.last = Date.now(); data = serialize(); } catch (e) { saving = false; console.error('Sauvegarde impossible :', e.message); return; }
  fs.writeFile(SAVE + '.tmp', data, e => { if (e) { saving = false; console.error('Sauvegarde impossible :', e.message); return; } fs.rename(SAVE + '.tmp', SAVE, () => { saving = false; }); });
}
function save() {
  try { if (WD.meta) WD.meta.last = Date.now(); fs.writeFileSync(SAVE + '.tmp', serialize()); fs.renameSync(SAVE + '.tmp', SAVE); }
  catch (e) { console.error('Sauvegarde impossible :', e.message); }
}
function useWorld(o) {
  WD = o; const t = o.tiles;
  if (t && t.till.length === W * H) { till.set(t.till); wet.set(t.wet); crop.set(t.crop); grow.set(t.grow); fert.set(t.fert); }
  else { till.fill(0); wet.fill(0); crop.fill(-1); grow.fill(0); fert.fill(0); }
  delete WD.tiles;
}
function loadSave() {
  try {
    if (!fs.existsSync(SAVE)) return false; const o = JSON.parse(fs.readFileSync(SAVE, 'utf8')); if (!o || o.v !== 3) return false;
    useWorld(o);
    return true;
  } catch (e) { console.error('Sauvegarde illisible, nouvelle partie :', e.message); return false; }
}

/* ---------------------------------------------------------------- WebSocket minimal */
function wsAccept(req, socket) {
  const key = req.headers['sec-websocket-key']; if (!key) { socket.destroy(); return null; }
  const acc = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + acc + '\r\n\r\n');
  socket.setNoDelay(true);
  const c = { socket, buf: Buffer.alloc(0), frag: [], open: true, onmsg: null, onclose: null };
  c.sendRaw = (op, payload) => {
    if (!c.open) return; const len = payload.length; let head;
    if (len < 126) head = Buffer.from([0x80 | op, len]);
    else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x80 | op; head[1] = 126; head.writeUInt16BE(len, 2); }
    else { head = Buffer.alloc(10); head[0] = 0x80 | op; head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
    try { socket.write(Buffer.concat([head, payload])); } catch (e) { }
  };
  c.send = str => c.sendRaw(1, Buffer.from(str));
  const close = () => { if (!c.open) return; c.open = false; try { socket.destroy(); } catch (e) { } if (c.onclose) c.onclose(); };
  c.close = close;
  socket.on('data', d => {
    c.buf = Buffer.concat([c.buf, d]);
    while (c.buf.length >= 2) {
      const b0 = c.buf[0], b1 = c.buf[1], fin = b0 & 0x80, op = b0 & 0x0f, masked = b1 & 0x80; let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (c.buf.length < 4) return; len = c.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (c.buf.length < 10) return; len = Number(c.buf.readBigUInt64BE(2)); off = 10; }
      if (len > 1e6) { close(); return; }
      let mask = null; if (masked) { if (c.buf.length < off + 4) return; mask = c.buf.slice(off, off + 4); off += 4; }
      if (c.buf.length < off + len) return;
      const pl = Buffer.from(c.buf.slice(off, off + len)); if (mask) for (let i = 0; i < pl.length; i++) pl[i] ^= mask[i & 3];
      c.buf = c.buf.slice(off + len);
      if (op === 8) { c.sendRaw(8, Buffer.alloc(0)); close(); return; }
      if (op === 9) { c.sendRaw(10, pl); continue; }
      if (op === 10) continue;
      if (op === 1 || op === 0) { c.frag.push(pl); if (fin) { const msg = Buffer.concat(c.frag).toString('utf8'); c.frag = []; if (c.onmsg) try { c.onmsg(msg); } catch (e) { console.error(e); } } }
    }
  });
  socket.on('close', close); socket.on('error', close); socket.on('end', close);
  return c;
}

/* ---------------------------------------------------------------- serveur HTTP */
const server = http.createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];
  if (url === '/' || url === '/index.html') {
    fs.readFile(path.join(__dirname, 'client.html'), (e, d) => { if (e) { res.writeHead(500); res.end('client.html introuvable'); return; } res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }); res.end(d); });
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Introuvable');
});
server.on('upgrade', (req, socket) => {
  if ((req.url || '').split('?')[0] !== '/ws') { socket.destroy(); return; }
  try { socket.setNoDelay(true); socket.setKeepAlive(true, 10000); } catch (e) { }
  const c = wsAccept(req, socket); if (!c) return;
  const p = { ip: (req.socket && req.socket.remoteAddress) || '?', id: pidSeq++, ws: c, joined: false, farm: -1, x: 0, y: 0, dx: 0, dy: 1, walk: 0, in: {}, veh: 0, bag: { items: {}, cap: 300 }, tool: 0, seed: 'ble', hintCd: 0, fireCd: 0, useCd: 0, moving: false, tp: 1, hp: 10, ko: 0, inv: 3, hitT: 0, calm: 0, stealCd: {}, alertCd: {} };
  players.set(p.id, p);
  c.onmsg = txt => { try { onMessage(txt); } catch (e) { console.error('[erreur message]', e && e.stack || e); } };
  const onMessage = txt => {
    let m; try { m = JSON.parse(txt); } catch (e) { return; }
    if (m.t === 'admin' || m.t === 'adm') { adminMsg(p, m); return; }
    if (m.t === 'join' && !p.joined) {
      if (m.ver !== VERSION) { c.send(JSON.stringify({ t: 'err', m: 'Cette page n’est pas à jour : appuyez sur Ctrl+F5 (Cmd+Maj+R sur Mac) pour la recharger, puis reconnectez-vous.' })); return; }
      const name = String(m.name || '').replace(/[<>"&]/g, '').trim().slice(0, 16);
      if (name.length < 2) { c.send(JSON.stringify({ t: 'err', m: 'Choisissez un nom d’au moins 2 lettres.' })); return; }
      const err = (msg, need) => c.send(JSON.stringify({ t: 'err', m: msg, need }));
      const fl = fails.get(p.ip), nowS = Date.now() / 1000;
      if (fl && fl.until > nowS) { err(`Trop d’essais ratés : réessayez dans ${Math.ceil(fl.until - nowS)} s.`, 'pw'); return; }
      if (isBanned(name, p.ip)) { c.send(JSON.stringify({ t: 'err', m: 'Vous avez été exclu de cette partie par l’administrateur.' })); console.log(`[!] joueur exclu refusé : ${name} (${p.ip})`); return; }
      const pw = String(m.pw || '').slice(0, 64), tok = String(m.tok || '').slice(0, 64);
      let fi = WD.farms.findIndex(f => f.owner && f.owner.toLowerCase() === name.toLowerCase());
      if (fi >= 0) {
        const f = WD.farms[fi];
        if (f.pass) {
          if (!checkTok(f, tok) && !checkPw(f, pw)) {
            const x = fails.get(p.ip) || { n: 0, until: 0 }; x.n++; if (x.n >= 5) { x.until = nowS + 60; x.n = 0; } fails.set(p.ip, x);
            console.log(`[!] mot de passe refusé pour « ${f.owner} » depuis ${p.ip}`);
            err(pw ? 'Mot de passe incorrect pour ce nom. Si ce n’est pas votre ferme, choisissez un autre nom.' : 'Ce nom est protégé : tapez son mot de passe.', 'pw'); return;
          }
        } else {
          if (pw.length < 4) { err('Cette ferme n’a pas encore de mot de passe : choisissez-en un (4 caractères minimum) pour la protéger.', 'pw'); return; }
          setPw(f, pw);
        }
        if (playerOf(fi)) { err('Cette ferme est déjà connectée sur un autre ordinateur.'); return; }
        if (LOBBY.on && joinedList().length >= WD.lobbyN) { err(`La partie est prévue pour ${WD.lobbyN} joueur${WD.lobbyN > 1 ? 's' : ''} et ils sont tous là. Demandez à l’hôte d’augmenter le nombre de joueurs.`); return; }
        if (!LOBBY.on && !isActive(fi)) { err(`La partie en cours est à ${WD.lobbyN} joueurs et votre ferme n’en fait pas partie. Demandez à l’hôte de rouvrir la salle d’attente (commande « salon »).`); return; }
      } else {
        if (pw.length < 4) { err('Nouveau joueur : choisissez un mot de passe (4 caractères minimum). Il protège votre ferme quand vous êtes déconnecté.', 'pw'); return; }
        if (LOBBY.on && joinedList().length >= WD.lobbyN) { err(`La partie est prévue pour ${WD.lobbyN} joueur${WD.lobbyN > 1 ? 's' : ''} et ils sont tous là. Demandez à l’hôte d’augmenter le nombre de joueurs.`); return; }
        fi = SLOT_ORDER.find(k => !WD.farms[k].owner && (LOBBY.on || isActive(k))); if (fi === undefined) { err(LOBBY.on ? 'Le serveur est complet (8 fermes).' : `La partie est complète (${WD.lobbyN} joueurs).`); return; }
        claimFarm(fi, name); setPw(WD.farms[fi], pw);
      }
      fails.delete(p.ip); WD.farms[fi].lastIp = p.ip;
      const fm = WD.farms[fi]; if (tok && checkTok(fm, tok)) fm.toks = fm.toks.filter(h => h !== sha(tok)); p.tok = newTok(fm);
      p.joined = true; p.farm = fi; p.x = fm.px; p.y = fm.py; p.tool = fm.tool || 0; p.seed = fm.seed || 'ble'; p.bag = { items: fm.pbag || {}, cap: 300 + 200 * fm.up.bag }; fm.pbag = p.bag.items; p.hp = maxHp(fm); p.inv = 3;
      p.joinedAt = Date.now(); c.send(JSON.stringify({ t: 'welcome', ver: VERSION, act: SLOTS.map((_, k) => isActive(k) ? 1 : 0), lobby: LOBBY.on ? lobbyState() : null, tok: p.tok, id: p.id, farm: fi, pacts: WD.pacts, ghp: GHP, W, H, G: Array.from(G).join(''), fields: FIELDS, slots: SLOTS, build: BUILD, crops: CROPS, prices: PRICES, wage: WAGE, limit: LIMIT, tower: TOWER, gun: GUN, tt: TT, chat: WD.chat, pub: pubInfo(), pr: WD.prices, ph: WD.ph, ct: WD.contract, ti: tileDiff(true) }));
      sys(`${fm.owner} est connecté.`); if (LOBBY.on) lobbySend(); else if (inPrep() && !inOwnFarm(p.farm, p.x, p.y)) sendHome(p);
      console.log(`[+] ${fm.owner} (ferme ${fi + 1})`);
      return;
    }
    if (!p.joined) return;
    if (LOBBY.on) { if (m.t === 'act') lobbyAct(p, m); return; }
    if (m.t === 'in') {
      p.in = { ix: +m.ix || 0, iy: +m.iy || 0, use: !!m.use, fire: !!m.fire, rev: !!m.rev };
      if (m.px !== undefined && !p.veh && !(p.ko > 0) && (m.tp | 0) === p.tp) {
        const px = +m.px, py = +m.py, now = Date.now() / 1000, el = Math.min(1, Math.max(.05, now - (p.lastAcc || now)));
        const fm = WD.farms[p.farm], maxd = (3.4 + .7 * fm.up.boots) * el * 1.6 + .45;
        if (isFinite(px) && isFinite(py) && Math.hypot(px - p.x, py - p.y) <= maxd && free(px, py, .28) && prepOk(p, px, py)) {
          if (Math.hypot(px - p.x, py - p.y) > .001) p.walk += el;
          p.x = px; p.y = py; p.lastAcc = now; p.clientMove = true;
          p.moving = !!m.mv; if (m.pdx !== undefined) { p.dx = Math.sign(+m.pdx) | 0; p.dy = Math.sign(+m.pdy) | 0; }
        } else { p.tp++; p.lastAcc = now; }
      }
      return;
    }
    if (m.t === 'act') act(p, m);
  };
  c.onclose = () => {
    if (p.joined) {
      const fm = WD.farms[p.farm]; fm.pbag = p.bag.items; fm.px = p.x; fm.py = p.y;
      if (p.veh) { const v = vehById(p.veh); if (v) { v.driver = null; v.lower = false; } }
      sys(`${fm.owner} a quitté la partie : tout est sauvegardé et sa ferme est fermée (personne ne peut y entrer ni l’attaquer).`); console.log(`[-] ${fm.owner}`);
      thieves.filter(t => t.farm === p.farm).forEach(t => thiefFlee(t)); fm.raid = null;
    }
    players.delete(p.id);
    if (p.joined) {
      // sa ferme se ferme : on raccompagne chez eux les visiteurs, on retire les véhicules des autres
      for (const q of players.values()) if (q.joined && slotOf[idx(Math.floor(q.x), Math.floor(q.y))] === p.farm) {
        if (q.veh) { const v = vehById(q.veh); if (v) { v.driver = null; v.lower = false; v.x = v.home.x; v.y = v.home.y; v.v = 0; } q.veh = 0; }
        sendHome(q); fx.push({ k: 'toast', f: q.farm, only: q.id, m: `${WD.farms[p.farm].owner} a quitté la partie : sa ferme est fermée, vous êtes rentré chez vous`, c: 'b' });
      }
      for (const v of WD.veh) if (v.farm !== p.farm && !v.driver && slotOf[idx(Math.floor(v.x), Math.floor(v.y))] === p.farm) { v.x = v.home.x; v.y = v.home.y; v.v = 0; v.auto = null; }
      save(); console.log(`    partie de ${WD.farms[p.farm].owner} sauvegardée, ferme fermée`);
    }
    if (LOBBY.on) lobbySend();
  };
});

/* ---------------------------------------------------------------- préparation (fermes fermées) */
let PREP_END = 0, prepOpenSaid = true;
const inPrep = () => PREP_END > tickTime;
const inOwnFarm = (farm, x, y) => slotOf[idx(Math.floor(x), Math.floor(y))] === farm;
const prepOk0 = (p, x, y) => !inPrep() || inOwnFarm(p.farm, x, y) || !inOwnFarm(p.farm, p.x, p.y);
// ferme d'un joueur déconnecté : personne ne peut y entrer
const closedAt = (farm, x, y) => { const s = slotOf[idx(Math.floor(x), Math.floor(y))]; return s >= 0 && s !== farm && !!WD.farms[s].owner && !playerOf(s) ? s : -1; };
const truceAt = (farm, x, y) => { const s = slotOf[idx(Math.floor(x), Math.floor(y))]; return s >= 0 && s !== farm && truceLeft(farm, s) > 0 ? s : -1; };
const prepOk = (p, x, y) => prepOk0(p, x, y) && !(closedAt(p.farm, x, y) >= 0 && closedAt(p.farm, p.x, p.y) < 0) && !(truceAt(p.farm, x, y) >= 0 && truceAt(p.farm, p.x, p.y) < 0);
function sendHome(p) { const d = SLOTS[p.farm].door; p.x = d.x + .5; p.y = d.y + 1.5; p.tp++; const fm = WD.farms[p.farm]; fm.px = p.x; fm.py = p.y; }
function startPrep() {
  if (PREPARATION_MIN <= 0) return;
  PREP_END = tickTime + PREPARATION_MIN * 60; prepOpenSaid = false;
  for (const p of players.values()) if (p.joined && !p.veh && !inOwnFarm(p.farm, p.x, p.y)) sendHome(p);
  for (const v of WD.veh) if (!v.driver && !inOwnFarm(v.farm, v.x, v.y)) { v.x = v.home.x; v.y = v.home.y; v.v = 0; }
  toast(-1, `Préparation : ${PREPARATION_MIN} minutes pendant lesquelles personne ne peut sortir de sa ferme. Organisez-vous !`, 'g');
}
function prepTick() {
  if (!prepOpenSaid && !inPrep()) { prepOpenSaid = true; sys('Fin de la préparation : les frontières sont ouvertes, tout est permis !'); toast(-1, 'Les frontières sont ouvertes : vous pouvez sortir de votre ferme !', 'b'); console.log('>>> Fin de la préparation'); }
}

/* ---------------------------------------------------------------- parties (plusieurs mondes) + exclusions */
const PDIR = path.join(__dirname, 'parties'), TRASH = path.join(PDIR, 'corbeille'), BANS = path.join(__dirname, 'exclus.json');
try { fs.mkdirSync(TRASH, { recursive: true }); } catch (e) { }
const safeId = id => /^p\d+$/.test(String(id)) ? String(id) : null;
let PARTIES = { list: [], trash: [] };
function readMeta(file) {
  try { const o = JSON.parse(fs.readFileSync(file, 'utf8')); const m = o.meta || {}; return { id: m.id || path.basename(file, '.json'), name: m.name || 'Partie', created: m.created || 0, last: m.last || fs.statSync(file).mtimeMs, day: o.day || 1, players: (o.farms || []).filter(f => f.owner).map(f => f.owner) }; }
  catch (e) { return null; }
}
function refreshParties() {
  const ls = d => { try { return fs.readdirSync(d).filter(f => /^p\d+\.json$/.test(f)).map(f => readMeta(path.join(d, f))).filter(Boolean).sort((a, b) => b.last - a.last); } catch (e) { return []; } };
  PARTIES = { list: ls(PDIR), trash: ls(TRASH) };
}
function archiveCurrent(dir) { for (const p of players.values()) if (p.joined) { const fm = WD.farms[p.farm]; fm.px = p.x; fm.py = p.y; } WD.meta.last = Date.now(); fs.writeFileSync(path.join(dir, WD.meta.id + '.json'), serialize()); }
function switchWorld(o, why) {
  for (const p of players.values()) if (p.joined) {
    const fm = WD.farms[p.farm]; fm.pbag = p.bag.items; fm.px = p.x; fm.py = p.y;
    p.joined = false; try { p.ws.send(JSON.stringify({ t: 'kicked', m: why })); } catch (e) { }
    setTimeout(() => { try { p.ws.close(); } catch (e) { } }, 150);
  }
  thieves = []; bullets = []; fx = [];
  useWorld(o); lastPack.fill(-1); prepareWorld();
  LOBBY.on = true; LOBBY.cd = 0; LOBBY.forced = false; PREP_END = 0; prepOpenSaid = true;
  save(); refreshParties(); console.log(`>>> Partie active : « ${WD.meta.name} »`);
}
function newWorldNamed(name) { const w = newWorld(); w.meta = { id: 'p' + Date.now(), name: String(name || '').trim().slice(0, 40) || `Partie du ${new Date().toLocaleDateString('fr-FR')}`, created: Date.now() }; return w; }
let bans = []; try { bans = JSON.parse(fs.readFileSync(BANS, 'utf8')) || []; } catch (e) { bans = []; }
const saveBans = () => { try { fs.writeFileSync(BANS, JSON.stringify(bans)); } catch (e) { } };
const localIp = ip => !ip || ip === '?' || /^(::1|127\.|::ffff:127\.)/.test(ip);
const isBanned = (name, ip) => bans.some(b => b.n === String(name).toLowerCase() || (!localIp(ip) && b.ip && b.ip === ip));

/* ---------------------------------------------------------------- menu admin */
function sendMap() { const msg = JSON.stringify({ t: 'map', G: Array.from(G).join(''), act: SLOTS.map((_, k) => isActive(k) ? 1 : 0) }); for (const p of players.values()) if (p.joined) p.ws.send(msg); }
function resizeGame(n) {
  n = Math.max(1, Math.min(8, n | 0)); WD.lobbyN = n;
  if (LOBBY.on) { LOBBY.forced = false; if (joinedList().length < n) LOBBY.cd = 0; lobbySend(); return; }
  const act = SLOTS.map((_, k) => isActive(k)); let cnt = act.filter(Boolean).length;
  for (const own of [false, true]) for (const k of [...SLOT_ORDER].reverse()) if (cnt > n && act[k] && !playerOf(k) && !!WD.farms[k].owner === own) { act[k] = false; cnt--; }
  for (const own of [true, false]) for (const k of SLOT_ORDER) if (cnt < n && !act[k] && !!WD.farms[k].owner === own) { act[k] = true; cnt++; }
  WD.lobbyN = cnt; WD.active = act; applyActive();
  for (const p of players.values()) if (p.joined && !p.veh) { const so = slotOf[idx(Math.floor(p.x), Math.floor(p.y))]; if (so >= 0 && !act[so]) sendHome(p); }
  sendMap(); sys(`La partie passe à ${cnt} ferme${cnt > 1 ? 's' : ''}.`); save();
}
function kickFarm(s, why) {
  const p = playerOf(s); if (!p) return false;
  try { p.ws.send(JSON.stringify({ t: 'kicked', m: why })); } catch (e) { }
  setTimeout(() => { try { p.ws.close(); } catch (e) { } }, 150);
  return true;
}
function freeFarm(s) {
  const name = WD.farms[s].owner;
  kickFarm(s, 'L’administrateur a libéré votre ferme.');
  WD.agents = WD.agents.filter(a => a.farm !== s); WD.veh = WD.veh.filter(v => v.farm !== s);
  WD.towers = WD.towers.filter(t => t.farm !== s); WD.guards = WD.guards.filter(g => g.farm !== s);
  WD.pacts = WD.pacts.filter(k => !String(k).split('-').map(Number).includes(s)); WD.offers = (WD.offers || []).filter(o => o.from !== s && o.to !== s);
  for (const f of FIELDS) if (f.farm === s) for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) { const i = idx(x, y); till[i] = 0; crop[i] = -1; grow[i] = 0; wet[i] = 0; fert[i] = 0; }
  if (WD.bounty) delete WD.bounty[s];
  WD.farms[s] = newFarm(s); if (name) sys(`La ferme de ${name} a été libérée par l’administrateur.`); save();
}
function adminState() {
  return { t: 'adm', ok: 1, lobby: LOBBY.on ? 1 : 0, n: WD.lobbyN, prep: inPrep() ? Math.ceil(PREP_END - tickTime) : 0, day: WD.day, tm: Math.round(WD.time),
    farms: WD.farms.map(f => ({ s: f.slot, o: f.owner, c: f.color, on: !!playerOf(f.slot), act: isActive(f.slot) ? 1 : 0, money: Math.floor(f.money), lvl: f.lvl || 0, pw: f.pass ? 1 : 0, w: f.owner ? Math.round(worth(f)) : 0, ip: localIp(f.lastIp) ? '' : (f.lastIp || '').replace('::ffff:', '') })),
    cur: { id: WD.meta.id, name: WD.meta.name, created: WD.meta.created, day: WD.day, players: WD.farms.filter(f => f.owner).map(f => f.owner) }, parties: PARTIES.list, trash: PARTIES.trash,
    bans: bans.map((b, i) => ({ i, name: b.name, ip: localIp(b.ip) ? '' : (b.ip || '').replace('::ffff:', ''), at: b.at })) };
}
function adminPush() { let st = null; for (const p of players.values()) if (p.admin) { st = st || JSON.stringify(adminState()); p.ws.send(st); } }
setInterval(adminPush, 1000);
const ADMIN_HASH = { s: 'terres-vives-admin', h: '1becccfb7b9222e263af0e0d39898ca83617c18458eda072f80d6f7a54c1976a', n: 1024 }; // code admin fixe
function checkAdmin(pw) { if (!pw) return false; const a = Buffer.from(hashPw(pw, ADMIN_HASH.s, ADMIN_HASH.n), 'hex'), b = Buffer.from(ADMIN_HASH.h, 'hex'); return a.length === b.length && crypto.timingSafeEqual(a, b); }
function adminMsg(p, m) {
  const say = (txt, ok = true) => p.ws.send(JSON.stringify({ t: 'admsg', m: txt, ok }));
  if (m.t === 'admin') {
    const fl = fails.get(p.ip), nowS = Date.now() / 1000;
    if (fl && fl.until > nowS) { say(`Trop d’essais ratés : réessayez dans ${Math.ceil(fl.until - nowS)} s.`, false); return; }
    if (!checkAdmin(String(m.pw || '').slice(0, 64))) { const x = fails.get(p.ip) || { n: 0, until: 0 }; x.n++; if (x.n >= 5) { x.until = nowS + 60; x.n = 0; } fails.set(p.ip, x); console.log(`[!] code admin refusé depuis ${p.ip}`); say('Code admin incorrect.', false); return; }
    fails.delete(p.ip); p.admin = true; console.log(`[admin] connecté depuis ${p.ip}`); p.ws.send(JSON.stringify(adminState())); return;
  }
  if (!p.admin) return;
  const s = m.s | 0, f = WD.farms[s];
  switch (m.a) {
    case 'n': resizeGame(m.n); say(`Nombre de joueurs : ${WD.lobbyN}`); break;
    case 'start': if (LOBBY.on) { startGame(); say('Partie lancée'); } break;
    case 'lobby': if (!LOBBY.on) { openLobby(); say('Tout le monde est en salle d’attente (monde en pause)'); } break;
    case 'open': if (inPrep()) { PREP_END = tickTime; say('Préparation terminée'); } break;
    case 'prep': if (!LOBBY.on) { startPrep(); say('Préparation relancée'); } break;
    case 'say': { const t = String(m.m || '').slice(0, 160).trim(); if (t) { sys('Annonce de l’admin : ' + t); toast(-1, 'Admin : ' + t, 'g'); if (LOBBY.on) { const msg = JSON.stringify({ t: 'lchat', n: 'Admin', c: '#F0B43C', m: t }); for (const q of players.values()) if (q.joined) q.ws.send(msg); } say('Annonce envoyée'); } break; }
    case 'kick': if (f && kickFarm(s, 'L’administrateur vous a déconnecté.')) say(`${f.owner} a été déconnecté`); break;
    case 'pwreset': if (f && f.owner) { f.pass = null; f.toks = []; save(); say(`Mot de passe de ${f.owner} effacé : il en choisira un nouveau`); } break;
    case 'money': if (f && f.owner) { const a = Math.max(-1e7, Math.min(1e7, Math.round(+m.amt || 0))); f.money += a; toast(s, `L’administrateur ${a >= 0 ? 'vous a donné' : 'vous a retiré'} ${eur(Math.abs(a))}`, a >= 0 ? 'g' : 'b'); say(`${eur(a)} pour ${f.owner}`); } break;
    case 'free': if (f && f.owner) { const n = f.owner; freeFarm(s); say(`Ferme de ${n} libérée`); } break;
    case 'logout': p.admin = false; break;
    case 'ban': if (f && f.owner) { if (!isBanned(f.owner, '')) bans.push({ n: f.owner.toLowerCase(), name: f.owner, ip: localIp(f.lastIp) ? '' : f.lastIp, at: Date.now() }); saveBans(); kickFarm(s, 'Vous avez été exclu de la partie par l’administrateur.'); sys(`${f.owner} a été exclu par l’administrateur.`); say(`${f.owner} est exclu (nom${localIp(f.lastIp) ? '' : ' et ordinateur'})`); } break;
    case 'unban': { const b = bans[m.i | 0]; if (b) { bans.splice(m.i | 0, 1); saveBans(); say(`${b.name} est réintégré`); } break; }
    case 'pRename': { const n = String(m.name || '').trim().slice(0, 40); if (n) { WD.meta.name = n; save(); say('Partie renommée'); } break; }
    case 'pNew': archiveCurrent(PDIR); switchWorld(newWorldNamed(m.name), 'L’administrateur a lancé une nouvelle partie : reconnectez-vous (nouveau mot de passe à choisir).'); say(`Nouvelle partie « ${WD.meta.name} » : salle d’attente ouverte`); break;
    case 'pLoad': { const id = safeId(m.id), file = id && path.join(PDIR, id + '.json'); if (!file || !fs.existsSync(file) || id === WD.meta.id) { say('Partie introuvable', false); break; }
      let o; try { o = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { say('Fichier de partie illisible', false); break; }
      archiveCurrent(PDIR); fs.unlinkSync(file); switchWorld(o, 'L’administrateur a changé de partie : reconnectez-vous.'); say(`Partie « ${WD.meta.name} » chargée : salle d’attente ouverte`); break; }
    case 'pTrash': { const id = safeId(m.id); if (!id) break;
      if (id === WD.meta.id) { archiveCurrent(TRASH); switchWorld(newWorldNamed(''), 'L’administrateur a supprimé la partie : reconnectez-vous.'); say('Partie mise à la corbeille, nouvelle partie créée'); break; }
      try { fs.renameSync(path.join(PDIR, id + '.json'), path.join(TRASH, id + '.json')); say('Partie mise à la corbeille'); } catch (e) { say('Partie introuvable', false); } refreshParties(); break; }
    case 'pRestore': { const id = safeId(m.id); try { fs.renameSync(path.join(TRASH, id + '.json'), path.join(PDIR, id + '.json')); say('Partie restaurée'); } catch (e) { say('Partie introuvable', false); } refreshParties(); break; }
    case 'pPurge': { const id = safeId(m.id); try { fs.unlinkSync(path.join(TRASH, id + '.json')); say('Partie supprimée définitivement'); } catch (e) { say('Partie introuvable', false); } refreshParties(); break; }
  }
  p.ws.send(JSON.stringify(adminState()));
}

/* ---------------------------------------------------------------- salle d'attente */
const LOBBY = { on: true, cd: 0, forced: false };
let lobbyT = 0;
const joinedList = () => [...players.values()].filter(p => p.joined).sort((a, b) => a.joinedAt - b.joinedAt);
const lobbyHost = () => joinedList()[0] || null;
function lobbyState() {
  const h = lobbyHost();
  return { t: 'lobby', on: LOBBY.on ? 1 : 0, n: WD.lobbyN, hostId: h ? h.id : 0, cd: LOBBY.cd > 0 ? Math.ceil(LOBBY.cd) : 0, day: WD.day,
    pl: joinedList().map(p => ({ id: p.id, n: WD.farms[p.farm].owner, c: WD.farms[p.farm].color })) };
}
function lobbySend() { const s = JSON.stringify(lobbyState()); for (const p of players.values()) if (p.joined) p.ws.send(s); }
function lobbyTick(dt) {
  const n = joinedList().length;
  if (LOBBY.cd > 0) { if (!LOBBY.forced && n < WD.lobbyN) LOBBY.cd = 0; else { LOBBY.cd -= dt; if (LOBBY.cd <= 0) { startGame(); return; } } }
  else if (n > 0 && n >= WD.lobbyN) LOBBY.cd = 5;
  if (++lobbyT % 5 === 0) lobbySend();
}
function startGame() {
  if (!LOBBY.on) return;
  LOBBY.on = false; LOBBY.cd = 0; LOBBY.forced = false;
  fx = []; // messages de la salle déjà affichés
  const list = joinedList(), now = Date.now() / 1000;
  { const act = SLOTS.map(() => false); for (const p of list) act[p.farm] = true; let need = Math.max(0, WD.lobbyN - list.length);
    for (const own of [true, false]) for (const k of SLOT_ORDER) if (need > 0 && !act[k] && !!WD.farms[k].owner === own) { act[k] = true; need--; }
    WD.active = act; applyActive();
    const msg = JSON.stringify({ t: 'map', G: Array.from(G).join(''), act: act.map(a => a ? 1 : 0) }); for (const p of list) p.ws.send(msg); }
  sys(`La partie commence avec ${list.length} joueur${list.length > 1 ? 's' : ''} : ${list.map(p => WD.farms[p.farm].owner).join(', ')}. Bonne chance !`);
  for (const p of list) { p.lastAcc = now; p.tp++; p.in = {}; p.ws.send(JSON.stringify({ t: 'go' })); }
  startPrep();
  console.log(`>>> Partie lancée (${list.length} joueurs)${PREPARATION_MIN > 0 ? ` · ${PREPARATION_MIN} min de préparation` : ''}`); save();
}
function openLobby() {
  if (LOBBY.on) return; LOBBY.on = true; LOBBY.cd = 0; LOBBY.forced = false;
  for (const p of players.values()) p.in = {};
  lobbySend(); console.log('>>> Retour à la salle d’attente : le monde est en pause');
}
function lobbyAct(p, m) {
  const host = lobbyHost() === p, fm = WD.farms[p.farm];
  if (m.a === 'lobbyN' && host) { WD.lobbyN = Math.max(joinedList().length, 1, Math.min(8, m.n | 0)); LOBBY.forced = false; if (joinedList().length < WD.lobbyN) LOBBY.cd = 0; lobbySend(); }
  else if (m.a === 'lobbyGo' && host) { LOBBY.forced = true; LOBBY.cd = 3; lobbySend(); }
  else if (m.a === 'lobbyStop' && host) { LOBBY.forced = false; LOBBY.cd = 0; WD.lobbyN = Math.max(WD.lobbyN, joinedList().length + 1); lobbySend(); }
  else if (m.a === 'chat') {
    const t = String(m.m || '').slice(0, 160).trim(); if (!t) return;
    const msg = { n: fm.owner, c: fm.color, m: t }; WD.chat.push(msg); if (WD.chat.length > 40) WD.chat.shift();
    const s = JSON.stringify({ t: 'lchat', ...msg }); for (const q of players.values()) if (q.joined) q.ws.send(s);
  }
}

/* ---------------------------------------------------------------- boucle */
let tick = 0;
let stepErrors = 0;
function step() { try { stepInner(); } catch (e) { if (stepErrors++ < 20) console.error('[erreur boucle]', e && e.stack || e); } }
function stepInner() {
  const dt = DT;
  if (LOBBY.on) { lobbyTick(dt); return; }
  timeUpdate(dt); tilesUpdate(dt);
  for (const p of players.values()) if (p.joined) updatePlayer(p, dt);
  for (const v of WD.veh) if (isActive(v.farm)) vehUpdate(v, dt);
  for (const a of WD.agents) if (isActive(a.farm)) agentUpdate(a, dt);
  thievesUpdate(dt); jamTick(); prepTick();
  tick++;
  const snap = snapshot(tick); fx = [];
  const common = JSON.stringify(snap).slice(0, -1);
  for (const p of players.values()) {
    if (!p.joined) continue;
    // client trop lent (mauvais Wi-Fi) : on saute des images au lieu d'accumuler du retard
    const buf = p.ws.socket && p.ws.socket.writableLength || 0;
    if (buf > 4 * 1024 * 1024) { console.log(`[!] ${WD.farms[p.farm].owner} : connexion trop lente, déconnexion`); try { p.ws.close(); } catch (e) { } continue; }
    if (buf > 256 * 1024 && tick % 4) continue;
    // « me » (données privées) envoyé seulement quand il change, et au moins une fois par seconde
    const me = JSON.stringify(meInfo(p));
    if (me !== p.lastMe || tick % 20 === 0) { p.lastMe = me; p.ws.send(common + ',"me":' + me + '}'); }
    else p.ws.send(common + '}');
  }
  if (tick % (20 * 30) === 0) saveAsync();
}

/* ---------------------------------------------------------------- démarrage */
const FEATURES = [
  'Monde persistant qui ne s’arrête jamais (sauvegarde automatique toutes les 30 s)',
  'Grande carte avec 8 fermes, un village central (marché, commissariat, mairie, armurerie)',
  'Chaque joueur a sa ferme : 4 champs, entrepôt, garage, retrouvée à chaque reconnexion avec le même nom',
  '6 cultures, arrosage, engrais, météo partagée (pluie, orage), journées de 8 min et nuits de 3 min',
  'Tracteurs et moissonneuses à conduire, module GPS pour tout faire en automatique',
  'Ouvriers autonomes, plan de culture par champ, coup de fouet, moral, grève et primes',
  'Voleurs chaque nuit, de plus en plus nombreux : voleurs, rapides, costauds, saboteurs de tours, chef de bande toutes les 5 nuits',
  'Défenses : tours de guet (3 niveaux), snipers, policiers en patrouille, chiens de garde, lampadaires, clôture électrique, caméras',
  'Fusil à visée automatique améliorable (3 niveaux), primes pour chaque voleur neutralisé',
  'Marché partagé : les ventes de chacun font bouger les prix pour tout le monde',
  'Commandes de la coopérative : le premier qui livre remporte le contrat',
  'Chacun pour soi : combats entre élèves au fusil (visée auto), K.O., rançon et butin',
  'Pillage : volez les récoltes mûres des autres (faucille) et leur entrepôt (E devant leur ferme)',
  'Attaquez les défenses des autres : policiers, chiens et snipers mis K.O., tours détruites',
  'Vos défenses ripostent contre les élèves ennemis qui entrent sur votre ferme',
  'Pactes d’amitié : proposez, acceptez ou rompez un pacte, plus d’attaques entre alliés',
  'Avis de recherche : 3 K.O. dans la journée = prime de 300 € sur votre tête',
  'Gilet pare-balles (points de vie), village = zone neutre sans combat',
  'Brouilleur (armurerie, 3 000 €, 1 par jour) : coupe 60 s les tours, caméras et lampadaires d’un ennemi',
  'Ferme améliorable sans fin : chaque niveau donne +6 % de récolte, plus de stockage, de vie et de défenses',
  'Vidéo explicative animée à l’ouverture du site',
  `Préparation : les ${PREPARATION_MIN} premières minutes, personne ne peut sortir de sa ferme (compte à rebours en haut)`,
  'Carte à la taille de la partie : seules les fermes des joueurs choisis existent, le reste devient forêt',
  'Clic sur la mini-carte : observer les autres fermes (impossible la nuit)',
  'Admin : plusieurs parties (créer, charger, renommer, corbeille avec restauration), exclusion de joueurs (nom + ordinateur) et réintégration',
  'Fusil à acheter (pas d’arme au départ) et balles limitées à racheter ; sans arme, coup de poing (F)',
  'Choix de la semence en un clic dans la barre d’outils (ou molette de la souris)',
  'Après un K.O. : trêve de 5 min entre les deux joueurs (ni combat, ni entrée dans la ferme de l’autre), avec compte à rebours',
  'Primes : mettez à prix la tête d’un rival, prime du jour sur la ferme la plus riche, avis de recherche',
  'Menu admin protégé par un code : lancer, remettre en salle d’attente, changer le nombre de joueurs en pleine partie, expulser, libérer une ferme, donner de l’argent, annonces',
  'Salle d’attente : l’hôte choisit le nombre de joueurs, tout le monde démarre en même temps',
  'Comptes protégés : mot de passe par ferme (personne ne peut prendre votre nom), « se souvenir de moi » facultatif',
  'Classement (patrimoine, K.O., pillage), chat de classe, envoi d’argent',
  'Votre ferme est protégée quand vous êtes déconnecté (ni voleurs, ni pillage), vos machines et ouvriers continuent à travailler',
];
if (!loadSave()) { WD = newWorld(); console.log('Nouvelle partie créée.'); } else console.log('Partie chargée depuis sauvegarde.json');
function prepareWorld() {
WD.meta = WD.meta || { id: 'p' + Date.now(), name: 'Partie 1', created: Date.now() };
WD.nid = Math.max(WD.nid || 1, ...WD.agents.map(a => a.id + 1), ...WD.veh.map(v => v.id + 1), ...WD.towers.map(t => t.id + 1), ...WD.guards.map(g => g.id + 1), 1);
for (const fm of WD.farms) { fm.raid = null; fm.lvl = fm.lvl || 0; fm.jamAt = 0; fm.jamStarted = false; fm.jamProt = 0; fm.up.armor = fm.up.armor || 0; fm.recent = fm.recent || 0; fm.stats.kills = fm.stats.kills || 0; fm.stats.deaths = fm.stats.deaths || 0; fm.stats.pillaged = fm.stats.pillaged || 0; }
for (const fm of WD.farms) if (fm.gun === undefined) { fm.gun = (fm.up.gun || 0) > 0; fm.ammo = fm.gun ? 60 : 0; }
WD.bounty = WD.bounty || {};
WD.pacts = WD.pacts || []; WD.offers = []; WD.lobbyN = WD.lobbyN || 4; applyActive();
delete WD.admin;
for (const g of WD.guards) { if (g.hp === undefined) g.hp = GHP[g.type]; g.ko = 0; }
for (const t of WD.towers) if (t.hp === undefined) t.hp = towerMax(t);
}
prepareWorld(); refreshParties();
setInterval(step, DT * 1000);
if (process.stdin.isTTY || process.stdin.readable) {
  require('readline').createInterface({ input: process.stdin }).on('line', line => {
    const [cmd, ...rest] = line.trim().split(/\s+/), nom = rest.join(' ').toLowerCase();
    if (cmd === 'liste') { for (const f of WD.farms) if (f.owner) console.log(` • ferme ${f.slot + 1} : ${f.owner}${playerOf(f.slot) ? ' (connecté)' : ''}${f.pass ? '' : ' (sans mot de passe)'}`); }
    else if (cmd === 'mdp') { const f = WD.farms.find(f => f.owner && f.owner.toLowerCase() === nom); if (!f) console.log('Nom inconnu. Tapez « liste ».'); else { f.pass = null; f.toks = []; save(); console.log(`Mot de passe de « ${f.owner} » effacé : à sa prochaine connexion, il en choisit un nouveau.`); } }
    else if (cmd === 'lancer') { if (LOBBY.on) startGame(); else console.log('La partie est déjà lancée.'); }
    else if (cmd === 'salon') openLobby();
    else if (cmd === 'ouvrir') { if (inPrep()) { PREP_END = tickTime; console.log('Préparation terminée.'); } else console.log('Les fermes sont déjà ouvertes.'); }
    else if (cmd === 'joueurs') { WD.lobbyN = Math.max(joinedList().length, 1, Math.min(8, +rest[0] || 4)); LOBBY.forced = false; if (LOBBY.on) lobbySend(); console.log(`Nombre de joueurs attendus : ${WD.lobbyN}`); }
    else if (cmd) console.log('Commandes : liste · mdp NOM · lancer · salon (pause + salle d’attente) · joueurs N · ouvrir (fin de la préparation)');
  });
}
server.on('error', e => { if (e.code === 'EADDRINUSE') { console.error(`\nLe port ${PORT} est déjà utilisé : le serveur est sans doute déjà lancé dans une autre fenêtre.\nFermez-la, ou lancez sur un autre port : PORT=3001 node server.js`); process.exit(1); } console.error(e); process.exit(1); });
process.on('uncaughtException', e => { console.error('[erreur inattendue, le serveur continue]', e && e.stack || e); });
process.on('SIGINT', () => { console.log('\nSauvegarde…'); save(); process.exit(0); });
process.on('SIGTERM', () => { save(); process.exit(0); });
server.listen(PORT, '0.0.0.0', () => {
  const ips = []; for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) if (a.family === 'IPv4' && !a.internal) ips.push(a.address);
  console.log('\n=============================================');
  console.log('   TERRES VIVES — serveur de la classe lancé');
  console.log('=============================================');
  console.log(`Sur ce PC        : http://localhost:${PORT}`);
  for (const ip of ips) console.log(`Pour la classe   : http://${ip}:${PORT}`);
  console.log('\nFonctionnalités :'); FEATURES.forEach(f => console.log(' • ' + f));
  console.log('\nMenu admin : bouton « ⚙ Admin » sur le site (code personnel de l’organisateur).');
  console.log(`\nSalle d’attente ouverte : le monde est en pause jusqu’au lancement (${WD.lobbyN} joueurs attendus).`);
  console.log('Commandes ici : liste · mdp NOM (mot de passe oublié) · lancer · salon · joueurs N · ouvrir');
  console.log('Ctrl+C pour arrêter (la partie est sauvegardée).\n');
});
