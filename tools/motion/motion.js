// Vidéo de présentation en motion design, rendue image par image avec le moteur 3D du jeu.
// window.__frame(t) dessine l'instant t (secondes) : la cité se construit, la caméra se déplace, les titres s'animent.
// Rendu : tools/motion/render.py capture chaque image, puis ffmpeg assemble public/video/presentation.mp4.
import { Game } from '../../src/game/engine/sim.js';
import { K, SCENARIOS, G } from '../../src/game/engine/defs.js';
import { CityRenderer } from '../../src/game/render/CityRenderer.js';
import { buildDemoCity, autoPlace } from '../../tests/demoCity.mjs';

export const DURATION = 24;
export const FPS = 25;

// Hasard reproductible : deux rendus donnent la même vidéo.
let seed = 20260611;
Math.random = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// ---------- la cité ----------
const g = new Game(-1, 42);
buildDemoCity(g);
const Y = g.EntryY;
g.Money = 500000; g.Stock[G.Marble] = 2000;
const place = (k, x, y) => autoPlace(g, k, x, y);
place(K.GrandTemple, 44, Y - 25); place(K.Amphitheater, 30, Y + 24); place(K.Arch, 7, Y + 2);
place(K.Baths, 32, Y - 23); place(K.Baths, 56, Y - 23); place(K.Fountain, 40, Y - 22); place(K.Fountain, 60, Y - 23);
for (const y of [Y - 24, Y + 24]) for (const x of [20, 66]) place(K.Tower, x, y);
place(K.Barracks, 76, Y - 4); place(K.Tower, 78, Y + 10); place(K.Tower, 78, Y - 16);
place(K.TradePost, 76, Y + 16);
for (let x = 2; x < 13; x += 2) { g.build(K.Cypress, x, Y - 2); g.build(K.Cypress, x, Y + 2); }
for (let i = 0; i < 160; i++) { g.tick(); if (g.Req.Active) g.sendRequest(); }

const all = [...g.Buildings.values()];
const hash = (n) => { let h = n * 2654435761; h ^= h >>> 13; return ((h >>> 0) % 1000) / 1000; };
const cx = 44;
const plan = new Map(); // id -> { t0, up1, up2, final }
const lerp = (a, b, f) => a + (b - a) * f;
const PROD = new Set([K.Farm, K.VegFarm, K.Fishery, K.ClayPit, K.Workshop, K.Granary, K.Warehouse, K.Market, K.Well, K.OliveFarm, K.OilPress, K.Fountain, K.Reservoir, K.TradePost, K.Vineyard, K.Winery, K.Lumber, K.Carpenter, K.Quarry]);
const EARLY = new Set([K.Prefecture, K.Engineer, K.Forum]);
const LATE = new Set([K.GrandTemple, K.Amphitheater, K.Arch]);
const DEF = new Set([K.Barracks, K.Tower]);
for (const b of all) {
  const d = Math.min(1, (b.X + Math.abs(b.Y - Y) * 0.6) / 90);
  const j = hash(b.ID) * 0.35;
  let t0;
  if (b.Kind === K.Road) t0 = lerp(3.5, 6.6, d);
  else if (b.Kind === K.House || EARLY.has(b.Kind)) t0 = lerp(4.6, 7.6, d) + j;
  else if (PROD.has(b.Kind)) t0 = lerp(8.3, 11.4, hash(b.ID * 3 + 1)) ;
  else if (LATE.has(b.Kind)) t0 = 14.2 + hash(b.ID) * 1.8;
  else if (DEF.has(b.Kind)) t0 = 17.3 + hash(b.ID) * 1.6;
  else if (b.Kind === K.Cypress) t0 = 12.6 + hash(b.ID) * 1.2;
  else t0 = lerp(12.6, 15.8, hash(b.ID * 7 + 3));
  const near = Math.hypot(b.X - cx, b.Y - Y) < 14;
  const final = b.Kind === K.House ? Math.min(7, Math.max(b.Level, 3 + Math.floor(hash(b.ID * 5) * 3) + (near ? 2 : 0))) : 0;
  plan.set(b.ID, { t0, up1: lerp(8.6, 11.6, hash(b.ID * 11)), up2: lerp(12.8, 16.4, 1 - d * 0.6 - hash(b.ID * 13) * 0.4), final });
}

// Rues visibles à l'instant t (les passants ne marchent que sur elles).
let now = 0;
const conn = g.connected.bind(g);
g.connected = (x, y) => { if (!conn(x, y)) return false; const b = g.at(x, y); return !b || !plan.has(b.ID) || plan.get(b.ID).t0 <= now; };

const easeBack = (x) => { const c = 1.9; const u = x - 1; return 1 + (c + 1) * u * u * u + c * u * u; };
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };

// ---------- rendu ----------
const canvas = document.getElementById('c');
const r = new CityRenderer(canvas, { shadows: true, preserve: true });
r.setGame(g);
r.resize(canvas.clientWidth, canvas.clientHeight);
r.popIn = (b) => {
  const p = plan.get(b.ID); if (!p) return 1;
  if (now < p.t0) return 0;
  if (b.Kind === K.House) {
    const lvl = now < p.up1 ? 1 : now < p.up2 ? Math.min(p.final, 3) : p.final;
    b.Level = lvl;
    const since = now - (now < p.up1 ? p.t0 : now < p.up2 ? p.up1 : p.up2);
    if (now >= p.up1 && since < 0.35) return 0.82 + 0.18 * easeBack(clamp01(since / 0.35));
  }
  const f = clamp01((now - p.t0) / 0.5);
  return f >= 1 ? 1 : Math.max(0.001, easeBack(f));
};

// Images clés de la caméra : [t, x, z, distance, angle, inclinaison].
const KEYS = [
  [0, 44, Y, 96, 0.55, 0.95],
  [3.4, 26, Y, 40, 0.95, 0.86],
  [7.9, 40, Y - 2, 36, 1.35, 0.8],
  [8.4, 20, Y + 10, 26, 1.75, 0.72],
  [12.2, 26, Y - 6, 30, 2.25, 0.75],
  [12.6, 44, Y - 2, 21, 2.65, 0.6],
  [16.9, 50, Y - 10, 27, 3.25, 0.64],
  [17.3, 46, Y, 58, 3.55, 0.86],
  [20.5, 46, Y, 66, 3.95, 0.9],
  [24, 46, Y, 84, 4.4, 0.98],
];
function camAt(t) {
  let i = 0; while (i < KEYS.length - 2 && t > KEYS[i + 1][0]) i++;
  const a = KEYS[i]; const b = KEYS[i + 1];
  const f = smooth((t - a[0]) / (b[0] - a[0]));
  return { x: lerp(a[1], b[1], f), z: lerp(a[2], b[2], f), dist: lerp(a[3], b[3], f), yaw: lerp(a[4], b[4], f), pitch: lerp(a[5], b[5], f) };
}

// ---------- titres ----------
const $ = (id) => document.getElementById(id);
const fade = (t, a, b, inD = 0.45, outD = 0.45) => Math.min(smooth((t - a) / inD), smooth((b - t) / outD));
const CAPS = [
  [3.8, 7.8, 'I', 'Fondez', 'Tracez les routes, installez les premiers colons.'],
  [8.5, 12.2, 'II', 'Produisez', 'Fermes, ateliers, greniers : douze marchandises à faire circuler.'],
  [12.9, 16.8, 'III', 'Embellissez', 'De la tente à la villa : sept niveaux de logement.'],
  [17.4, 20.5, 'IV', 'Défendez', 'Raids, incendies, épidémies… et César qui vous observe.'],
];
const provEl = $('prov');
provEl.innerHTML = SCENARIOS.map((s) => `<span><b>${s.name}</b><i>${s.region}</i></span>`).join('');

function overlays(t) {
  // titre d'ouverture
  const tt = fade(t, 0.2, 3.3, 0.8, 0.5);
  $('veil').style.opacity = String(Math.max(0.15 * fade(t, 20.6, 30), 0.7 * (1 - smooth((t - 2.9) / 0.8)), 0.62 * smooth((t - 20.6) / 0.8)) + smooth((t - 23.5) / 0.5));
  $('title').style.opacity = String(tt);
  $('title').style.transform = `translateY(${(1 - smooth((t - 0.2) / 1.2)) * 18}px) scale(${1 + t * 0.012})`;
  $('rule').style.transform = `scaleX(${smooth((t - 0.8) / 1.1)})`;
  [...$('title').querySelectorAll('.letters span')].forEach((s, i) => { const f = smooth((t - 0.35 - i * 0.07) / 0.5); s.style.opacity = String(f); s.style.transform = `translateY(${(1 - f) * 24}px)`; });
  // légendes
  let cap = null;
  for (const c of CAPS) if (t > c[0] - 0.1 && t < c[1] + 0.1) cap = c;
  const ce = $('cap');
  if (cap) {
    const f = fade(t, cap[0], cap[1]);
    ce.style.opacity = String(f);
    ce.style.transform = `translateX(${(1 - smooth((t - cap[0]) / 0.6)) * -40}px)`;
    $('capn').textContent = cap[2]; $('capt').textContent = cap[3]; $('caps').textContent = cap[4];
    $('capbar').style.transform = `scaleX(${clamp01((t - cap[0]) / (cap[1] - cap[0]))})`;
  } else ce.style.opacity = '0';
  // provinces
  const pf = fade(t, 17.8, 20.4);
  provEl.style.opacity = String(pf);
  [...provEl.children].forEach((s, i) => { const f = smooth((t - 17.8 - i * 0.25) / 0.5); s.style.opacity = String(f); s.style.transform = `translateY(${(1 - f) * 16}px)`; });
  // appel final
  const ef = fade(t, 21, 23.6, 0.6, 0.35);
  $('end').style.opacity = String(ef);
  $('end').style.transform = `scale(${0.96 + 0.04 * smooth((t - 21) / 1.2)})`;
}

let last = 0;
window.__frame = (t) => {
  now = t;
  Object.assign(r.cam, camAt(t));
  r.forceRebuild();
  if (Math.floor(t * 2) !== Math.floor(last * 2) || t < last) r.roadsVersion = -1; // rues visibles mises à jour
  const dt = Math.max(0, Math.min(0.2, t - last)); last = t;
  r.frame(dt, 1);
  overlays(t);
  return true;
};
window.__ready = true;
window.__meta = { DURATION, FPS };

// Aperçu en direct si la page est ouverte normalement (?live).
if (new URLSearchParams(location.search).has('live')) {
  const t0 = performance.now();
  const loop = () => { window.__frame(((performance.now() - t0) / 1000) % DURATION); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
} else window.__frame(0);
