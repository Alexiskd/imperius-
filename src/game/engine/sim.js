// Moteur de simulation d'Imperium Urbis (port JavaScript de game/sim.go, version exe).
// Aucune dépendance graphique : testable seul. Les noms de champs reprennent ceux de l'exe,
// ce qui rend les sauvegardes JSON compatibles dans les deux sens.

import {
  G, NUM_GOODS, GOODS, K, DEFS, RULE, isProducer, isProcessor, MAX_LEVEL, HOUSE_NAMES, HOUSE_CAP,
  GOOD_NEED_LEVEL, SCENARIOS, FREE_PLAY, MONTHS, RAID_SIDES,
} from './defs.js';

// Dimensions de la carte (cases).
export const MAP_W = 120;
export const MAP_H = 90;
// Version du format de sauvegarde (identique à l'exe).
export const SAVE_VERSION = 2;

// Types de terrain.
export const T = { Grass: 0, Water: 1, Fertile: 2, Forest: 3, Rock: 4 };

// Priorités d'embauche : 0 sécurité, 1 vivres et eau, 2 services, 3 industrie et commerce.
export function prio(k) {
  switch (k) {
    case K.Prefecture: case K.Engineer: case K.Barracks: case K.Tower: return 0;
    case K.Farm: case K.VegFarm: case K.Fishery: case K.Market: case K.Granary: case K.Fountain: case K.Reservoir: case K.Well: return 1;
    case K.Temple: case K.GrandTemple: case K.Theater: case K.Amphitheater: case K.School: case K.Library: case K.Doctor: case K.Baths: case K.Forum: return 2;
    default: return 3;
  }
}

// Vrai si la case est dans la carte.
export const inMap = (x, y) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
// Borne une note entre 0 et 100.
const clamp = (v) => Math.max(0, Math.min(100, v));

// Générateur pseudo-aléatoire mulberry32 (état sur 32 bits, sauvegardé avec la partie).
function rng(state) {
  let s = state >>> 0;
  return {
    next() {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(n) { return Math.floor(this.next() * n); },
    get state() { return s; },
  };
}

// Bruit déterministe pour la génération de la carte et le rendu.
export function noise(x, y, seed) {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed | 0, 982451653);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967295;
}
// Bruit lissé (interpolation bilinéaire en S).
function smooth(x, y, scale, seed) {
  const fx = x / scale; const fy = y / scale;
  const x0 = Math.floor(fx); const y0 = Math.floor(fy);
  let tx = fx - x0; let ty = fy - y0;
  tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
  const a = noise(x0, y0, seed); const b = noise(x0 + 1, y0, seed);
  const c = noise(x0, y0 + 1, seed); const e = noise(x0 + 1, y0 + 1, seed);
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + e * tx) * ty;
}
// Bruit de rendu (même graine que l'exe pour les décors).
export const noise01 = (x, y) => noise(x, y, 1234);

// Nouveau bâtiment (champs identiques à l'exe).
function newBuilding(id, kind, x, y) {
  return {
    ID: id, Kind: kind, X: x, Y: y, Level: 0, Pop: 0, Fire: 0, Damage: 0, Eff: 0, HasRoad: false,
    WaterLvl: 0, Food: false, Goods: false, Religion: false, Entertain: false, Amphi: false, Educ: false,
    Library: false, Health: false, Hygiene: false, Fireproof: false, Sturdy: false, Taxed: false,
    Desir: 0, Happy: 0, Needs: '', FedThisM: false, Variety: 0, Down: 0, Prod: 0, Status: '',
  };
}
// Centre d'un bâtiment (en cases).
export function center(b) {
  const df = DEFS[b.Kind];
  return [b.X + df.W / 2, b.Y + df.H / 2];
}

export class Game {
  // Crée une partie : idx = province (0 à 3) ou -1 pour la partie libre.
  constructor(idx = -1, seed = (Date.now() & 0x7fffffff)) {
    this.T = new Uint8Array(MAP_W * MAP_H);
    this.BID = new Int32Array(MAP_W * MAP_H);
    this.Connected = new Uint8Array(MAP_W * MAP_H);
    this.Buildings = new Map();
    this.NextID = 1; this.EntryX = 0; this.EntryY = 0;
    this.Version = SAVE_VERSION;
    this.ScenarioIdx = idx >= 0 && idx < SCENARIOS.length ? idx : -1;
    const sc = this.scen();
    this.Goal = { Pop: sc.goals.pop, Culture: sc.goals.culture, Prosper: sc.goals.prosper, Security: sc.goals.security, Favor: sc.goals.favor };
    this.Money = sc.money; this.Month = 0;
    this.Stock = new Array(NUM_GOODS).fill(0);
    this.LastProd = new Array(NUM_GOODS).fill(0);
    this.LastCons = new Array(NUM_GOODS).fill(0);
    this.AutoExport = new Array(NUM_GOODS).fill(false);
    this.TaxRate = 8; this.Wage = 30; this.Favor = 50;
    this.Culture = 0; this.Prosper = 0; this.Security = 0; this.Crime = 0; this.Unemploy = 0;
    this.Labor = 0; this.JobsNeeded = 0; this.Employed = 0; this.LastIncome = 0; this.LastExpend = 0;
    this.IncTax = 0; this.IncSales = 0; this.IncTrade = 0; this.ExpWages = 0; this.ExpUpkeep = 0; this.ExpTrade = 0;
    this.Req = { Active: false, What: '', Good: 0, Money: false, Amount: 0, Deadline: 0 };
    this.NextReqIn = 20; this.GiftCount = 0; this.Won = false; this.Lost = false;
    this.Messages = []; this.Seed = seed; this.TerrainVer = 0;
    this.RaidIn = 0; this.RaidStr = 0; this.RaidSide = 0; this.RaidCount = 0; this.NextRaid = 40;
    this.FestCool = 0; this.FestBoost = 0; this.HarvestMod = 1; this.HarvestM = 0;
    this.Alert = ''; this.AlertMonth = 0; this.TradeUsed = 0;
    this.Defense = 0; this.FoodCap = 400; this.GoodCap = 120; this.TradeCap = 0; this.PrioRatio = [1, 1, 1, 1];
    this.rand = rng(seed);
    this.version = 0; // compteur de changements, pour le rendu
    this.genMap(sc);
    this.Stock[G.Wheat] = 120;
    this.log(`Ave, Gouverneur ! Rome vous confie ${sc.name} (${sc.region}).`);
    this.log(`Objectifs : ${sc.goals.pop} hab., Culture ${sc.goals.culture}, Prospérité ${sc.goals.prosper}, Sécurité ${sc.goals.security}, Faveur ${sc.goals.favor}.`);
    if (this.ScenarioIdx === 0) {
      this.log('Conseil : tracez des routes depuis le drapeau rouge, puis logements, puits, ferme et marché.');
      this.log('Conseil : une préfecture et des ingénieurs protègent du feu et des effondrements. Un forum collecte les impôts.');
    }
    this.recompute();
  }

  scen() { return this.ScenarioIdx >= 0 && this.ScenarioIdx < SCENARIOS.length ? SCENARIOS[this.ScenarioIdx] : FREE_PLAY; }
  locked(k) { return this.ScenarioIdx >= 0 && this.ScenarioIdx < SCENARIOS.length && SCENARIOS[this.ScenarioIdx].locked.includes(k); }

  // Accès au terrain et aux bâtiments par case.
  tile(x, y) { return this.T[x * MAP_H + y]; }
  setTile(x, y, t) { this.T[x * MAP_H + y] = t; }
  bidAt(x, y) { return this.BID[x * MAP_H + y]; }
  connected(x, y) { return inMap(x, y) && this.Connected[x * MAP_H + y] === 1; }
  at(x, y) {
    if (!inMap(x, y)) return null;
    const id = this.BID[x * MAP_H + y];
    return id ? this.Buildings.get(id) || null : null;
  }

  // ---------- carte ----------
  genMap(sc) {
    const s = this.Seed;
    const rc = MAP_W * sc.river;
    for (let y = 0; y < MAP_H; y++) {
      const cx = rc + 8 * Math.sin(y / 11 + (s % 7)) + 4 * Math.sin(y / 4.7);
      const w = 2.4 + smooth(0, y, 6, s + 3) * 1.8;
      for (let x = 0; x < MAP_W; x++) {
        const dd = Math.abs(x - cx);
        let t = T.Grass;
        if (dd < w) t = T.Water;
        else if (dd < w + 8 && smooth(x, y, 5, s + 11) > 0.35) t = T.Fertile;
        this.setTile(x, y, t);
      }
    }
    for (let i = 0; i < 2; i++) {
      const lx = 14 + Math.floor(noise(1 + i, 2, s) * MAP_W * 0.35);
      const ly = i === 0 ? 6 + Math.floor(noise(3, 4, s) * 10) : 6 + Math.floor(noise(3, 4 + i, s) * (MAP_H - 12));
      const r = 3.5 + noise(i, 9, s) * 2;
      for (let x = 0; x < MAP_W; x++) {
        for (let y = 0; y < MAP_H; y++) {
          const dx = x - lx; const dy = (y - ly) * 1.3;
          if (Math.sqrt(dx * dx + dy * dy) < r + smooth(x, y, 3, s + 5 + i) * 2) this.setTile(x, y, T.Water);
        }
      }
    }
    for (let x = 0; x < MAP_W; x++) {
      for (let y = 0; y < MAP_H; y++) {
        if (this.tile(x, y) !== T.Grass) continue;
        const f = smooth(x, y, 7, s + 21); const r = smooth(x, y, 4, s + 31); const fe = smooth(x, y, 6, s + 41);
        if (f > sc.forest && noise(x, y, s + 1) > 0.25) this.setTile(x, y, T.Forest);
        else if (r > sc.rocks) this.setTile(x, y, T.Rock);
        else if (fe > sc.fertile) this.setTile(x, y, T.Fertile);
      }
    }
    this.EntryX = 0; this.EntryY = Math.floor(MAP_H / 2);
    const ey = this.EntryY;
    for (let x = 0; x < 34; x++) {
      for (let dy = -8; dy <= 8; dy++) {
        const t = this.tile(x, ey + dy);
        if (t === T.Rock || t === T.Water || (t === T.Forest && x < 30 && dy * dy < 40)) this.setTile(x, ey + dy, T.Grass);
      }
      if (x < 14) this.place(K.Road, x, ey);
    }
    for (let x = 16; x < 24; x++) for (let y = ey + 3; y < ey + 9; y++) this.setTile(x, y, T.Fertile);
    for (let x = 26; x < 32; x++) for (let y = ey - 14; y < ey - 10; y++) if (noise(x, y, s + 77) > 0.2) this.setTile(x, y, T.Forest);
    for (let x = 36; x < 40; x++) for (let y = ey + 12; y < ey + 15; y++) this.setTile(x, y, T.Rock);
    for (let x = 8; x < 12; x++) for (let y = ey - 9; y < ey - 6; y++) this.setTile(x, y, T.Water);
  }

  // ---------- utilitaires ----------
  year() { return 1 + Math.floor(this.Month / 12); }
  log(msg) {
    if (this.Month > 0) msg = `[${MONTHS[this.Month % 12].slice(0, 3)} ${this.year()}] ${msg}`;
    this.Messages.push(msg);
    if (this.Messages.length > 60) this.Messages = this.Messages.slice(-60);
  }
  alert(msg) { this.Alert = msg; this.AlertMonth = this.Month; this.log(msg); }
  population() { let p = 0; for (const b of this.Buildings.values()) if (b.Kind === K.House) p += b.Pop; return p; }
  food() { return this.Stock[G.Wheat] + this.Stock[G.Veg] + this.Stock[G.Fish]; }
  count(k) { let n = 0; for (const b of this.Buildings.values()) if (b.Kind === k) n++; return n; }
  byID() { return [...this.Buildings.values()].sort((a, b) => a.ID - b.ID); }
  sorted() { return this.byID().sort((a, b) => a.Y - b.Y || a.ID - b.ID); }
  terrainNear(x, y, w, h, r, t) {
    for (let dx = -r; dx < w + r; dx++) for (let dy = -r; dy < h + r; dy++) if (inMap(x + dx, y + dy) && this.tile(x + dx, y + dy) === t) return true;
    return false;
  }
  nearWater(x, y, r) {
    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) if (inMap(x + dx, y + dy) && this.tile(x + dx, y + dy) === T.Water && dx * dx + dy * dy <= r * r) return true;
    return false;
  }
  nearKind(k, x, y, r) {
    for (const b of this.Buildings.values()) {
      if (b.Kind !== k) continue;
      const [cx, cy] = center(b);
      if (Math.hypot(cx - x, cy - y) <= r) return true;
    }
    return false;
  }
  bname(b) { return b.Kind === K.House ? HOUSE_NAMES[Math.max(1, Math.min(MAX_LEVEL, b.Level))] : DEFS[b.Kind].name; }

  // ---------- construction ----------

  // Renvoie [coût, message d'erreur ('' si possible)].
  canPlace(k, x, y) {
    if (k === K.None || k >= DEFS.length || k === K.Rubble) return [0, 'Invalide'];
    if (this.locked(k)) return [0, 'Non disponible dans cette province'];
    const df = DEFS[k];
    let cost = df.cost;
    for (let dx = 0; dx < df.W; dx++) {
      for (let dy = 0; dy < df.H; dy++) {
        const tx = x + dx; const ty = y + dy;
        if (!inMap(tx, ty)) return [0, 'Hors de la carte'];
        if (this.bidAt(tx, ty)) return [0, 'Emplacement occupé'];
        const t = this.tile(tx, ty);
        if (t === T.Water) { if (k !== K.Road) return [0, "Impossible sur l'eau"]; cost = 40; }
        if (t === T.Forest) return [0, "Forêt : déblayez d'abord"];
        if (t === T.Rock) return [0, 'Terrain rocheux'];
        if (df.rule === RULE.Fertile && t !== T.Fertile) return [0, 'Exige une terre fertile'];
      }
    }
    switch (df.rule) {
      case RULE.River:
        if (!this.nearWater(x, y, 10) && !this.nearKind(K.Reservoir, x + 0.5, y + 0.5, 12)) return [0, "Trop loin de l'eau (fleuve, lac ou réservoir)"];
        break;
      case RULE.Reservoir:
        if (!this.terrainNear(x, y, df.W, df.H, 3, T.Water) && !this.nearKind(K.Reservoir, x + 1.5, y + 1.5, 14)) return [0, "À 3 cases de l'eau ou 14 cases d'un réservoir"];
        break;
      case RULE.Shore: if (!this.terrainNear(x, y, df.W, df.H, 1, T.Water)) return [0, "Doit toucher l'eau"]; break;
      case RULE.WaterNear: if (!this.terrainNear(x, y, df.W, df.H, 3, T.Water)) return [0, "Doit être à 3 cases de l'eau"]; break;
      case RULE.Forest: if (!this.terrainNear(x, y, df.W, df.H, 2, T.Forest)) return [0, "Doit être à 2 cases d'une forêt"]; break;
      case RULE.Rock: if (!this.terrainNear(x, y, df.W, df.H, 2, T.Rock)) return [0, 'Doit être à 2 cases de rochers']; break;
      case RULE.NearFountain:
        if (!this.nearKind(K.Fountain, x + 1, y + 1, 6)) return [0, "Doit être à 6 cases d'une fontaine"];
        break;
      default: break;
    }
    if (k === K.Forum && this.count(K.Forum) > 0) cost += 100;
    return [cost, ''];
  }

  place(k, x, y) {
    const df = DEFS[k];
    const b = newBuilding(this.NextID++, k, x, y);
    if (k === K.House) { b.Level = 1; b.Happy = 60; }
    b.Fire = this.rand.next() * 10;
    b.Damage = this.rand.next() * 10;
    this.Buildings.set(b.ID, b);
    for (let dx = 0; dx < df.W; dx++) for (let dy = 0; dy < df.H; dy++) this.BID[(x + dx) * MAP_H + y + dy] = b.ID;
    this.version++;
    return b;
  }

  // Construit un bâtiment ; renvoie '' ou un message d'erreur.
  build(k, x, y) {
    const [cost, err] = this.canPlace(k, x, y);
    if (err) return err;
    if (this.Money < cost) return 'Trésor insuffisant';
    const df = DEFS[k];
    if (df.marble > 0 && this.Stock[G.Marble] < df.marble) return `Il faut ${df.marble} marbre (stock ${Math.round(this.Stock[G.Marble])})`;
    this.Money -= cost;
    this.Stock[G.Marble] -= df.marble;
    this.place(k, x, y);
    if (k === K.Arch) { this.Favor = clamp(this.Favor + 3); this.log('Un arc de triomphe célèbre la gloire de Rome. Faveur +3.'); }
    this.recompute();
    return '';
  }

  roadCost(path) {
    let c = 0;
    for (const [x, y] of path) { if (!inMap(x, y)) continue; const [cost, e] = this.canPlace(K.Road, x, y); if (!e) c += cost; }
    return c;
  }

  // Construit une route le long du chemin ; s'arrête au premier obstacle. Renvoie le nombre de cases posées.
  buildRoad(path) {
    let n = 0;
    for (const [x, y] of path) {
      if (!inMap(x, y)) continue;
      const ex = this.at(x, y);
      if (ex && ex.Kind === K.Road) continue;
      const [cost, e] = this.canPlace(K.Road, x, y);
      if (e || this.Money < cost) break;
      this.Money -= cost;
      this.place(K.Road, x, y);
      n++;
    }
    this.recompute();
    return n;
  }

  // Détruit tout dans le rectangle ; renvoie le coût.
  clear(x0, y0, x1, y1) {
    if (x1 < x0) [x0, x1] = [x1, x0];
    if (y1 < y0) [y0, y1] = [y1, y0];
    let cost = 0;
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        if (!inMap(x, y)) continue;
        const b = this.at(x, y);
        if (b) {
          if (b.Kind === K.Road && x < 14 && y === this.EntryY) continue; // route d'entrée protégée
          if (b.Kind === K.House && b.Pop > 0) this.log(`${b.Pop} habitants expulsés quittent la ville.`);
          this.remove(b);
          cost += 2;
        } else if (this.tile(x, y) === T.Forest) {
          this.setTile(x, y, T.Grass);
          cost += 5;
          this.TerrainVer++;
        }
      }
    }
    this.Money -= cost;
    this.recompute();
    return cost;
  }

  remove(b) {
    const df = DEFS[b.Kind];
    for (let dx = 0; dx < df.W; dx++) for (let dy = 0; dy < df.H; dy++) if (inMap(b.X + dx, b.Y + dy)) this.BID[(b.X + dx) * MAP_H + b.Y + dy] = 0;
    this.Buildings.delete(b.ID);
    this.version++;
  }

  ruin(b, why, log) {
    const df = DEFS[b.Kind];
    if (log) this.log(`${why} : ${this.bname(b)} détruit(e) !`);
    this.remove(b);
    for (let dx = 0; dx < df.W; dx++) for (let dy = 0; dy < df.H; dy++) this.place(K.Rubble, b.X + dx, b.Y + dy);
  }

  // ---------- calculs d'état ----------

  computeRoads() {
    this.Connected.fill(0);
    const start = this.at(this.EntryX, this.EntryY);
    if (start && start.Kind === K.Road) {
      const q = [[this.EntryX, this.EntryY]];
      this.Connected[this.EntryX * MAP_H + this.EntryY] = 1;
      while (q.length) {
        const [cx, cy] = q.pop();
        for (const [ddx, ddy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + ddx; const ny = cy + ddy;
          if (!inMap(nx, ny) || this.Connected[nx * MAP_H + ny]) continue;
          const b = this.at(nx, ny);
          if (b && b.Kind === K.Road) { this.Connected[nx * MAP_H + ny] = 1; q.push([nx, ny]); }
        }
      }
    }
    for (const b of this.Buildings.values()) {
      if (b.Kind === K.Road) { b.HasRoad = this.connected(b.X, b.Y); continue; }
      b.HasRoad = false;
      const df = DEFS[b.Kind];
      outer: for (let dx = -1; dx <= df.W; dx++) {
        for (let dy = -1; dy <= df.H; dy++) {
          const inside = dx >= 0 && dx < df.W && dy >= 0 && dy < df.H;
          const corner = (dx === -1 || dx === df.W) && (dy === -1 || dy === df.H);
          if (inside || corner) continue;
          if (this.connected(b.X + dx, b.Y + dy)) { b.HasRoad = true; break outer; }
        }
      }
    }
  }

  // Désirabilité d'un point (en cases), sans compter le bâtiment `self`.
  desirAt(x, y, self) {
    let v = 0;
    for (const b of this.Buildings.values()) {
      if (b.ID === self) continue;
      const df = DEFS[b.Kind];
      if (!df.appeal) continue;
      const [cx, cy] = center(b);
      if (Math.abs(cx - x) > df.appealR + 3 || Math.abs(cy - y) > df.appealR + 3) continue;
      const dist = Math.max(0, Math.hypot(cx - x, cy - y) - df.W / 2);
      if (dist <= df.appealR) v += df.appeal * (1 - dist / (df.appealR + 1));
    }
    const ix = Math.floor(x); const iy = Math.floor(y);
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        if (!inMap(ix + dx, iy + dy)) continue;
        const t = this.tile(ix + dx, iy + dy);
        if (t === T.Water) v += 0.15; else if (t === T.Forest) v += 0.1;
      }
    }
    return v;
  }

  workforce() {
    let labor = 0;
    for (const b of this.Buildings.values()) if (b.Kind === K.House) labor += Math.floor(b.Pop * 45 / 100);
    const needP = [0, 0, 0, 0];
    for (const b of this.Buildings.values()) if (b.HasRoad) needP[prio(b.Kind)] += DEFS[b.Kind].workers;
    const need = needP[0] + needP[1] + needP[2] + needP[3];
    this.Labor = labor; this.JobsNeeded = need;
    // 1) part garantie par secteur, 2) le reste selon la priorité
    const share = [0.25, 0.4, 0.2, 0.15];
    const give = [0, 0, 0, 0];
    let rem = labor;
    for (let p = 0; p < 4; p++) { give[p] = Math.min(needP[p], Math.floor(labor * share[p])); rem -= give[p]; }
    for (let p = 0; p < 4; p++) { const extra = Math.min(rem, needP[p] - give[p]); give[p] += extra; rem -= extra; }
    for (let p = 0; p < 4; p++) this.PrioRatio[p] = needP[p] > 0 ? give[p] / needP[p] : 1;
    this.Employed = Math.min(labor, need);
    this.Unemploy = labor > 0 ? (labor - this.Employed) / labor : 0;
    for (const b of this.Buildings.values()) {
      const df = DEFS[b.Kind];
      if (!df.workers) b.Eff = 1;
      else if (!b.HasRoad) b.Eff = 0;
      else b.Eff = this.PrioRatio[prio(b.Kind)];
    }
  }

  coverage() {
    const houses = [];
    for (const b of this.Buildings.values()) {
      b.Fireproof = false; b.Sturdy = false;
      if (b.Kind === K.House) {
        b.WaterLvl = 0; b.Food = false; b.Goods = false; b.Religion = false; b.Entertain = false; b.Amphi = false;
        b.Educ = false; b.Library = false; b.Health = false; b.Hygiene = false; b.Taxed = false;
        houses.push(b);
      }
    }
    for (const s of this.Buildings.values()) {
      const df = DEFS[s.Kind];
      if (!df.radius || s.Eff <= 0) continue;
      if (df.workers > 0 && !s.HasRoad) continue;
      const r = df.radius * (0.5 + 0.5 * s.Eff);
      const [sx, sy] = center(s);
      if (s.Kind === K.Prefecture || s.Kind === K.Engineer) {
        for (const b of this.Buildings.values()) {
          if (b.Kind === K.Road || b.Kind === K.Rubble) continue;
          const [bx, by] = center(b);
          if (Math.abs(bx - sx) <= r && Math.abs(by - sy) <= r && Math.hypot(bx - sx, by - sy) <= r) {
            if (s.Kind === K.Prefecture) b.Fireproof = true; else b.Sturdy = true;
          }
        }
        continue;
      }
      for (const h of houses) {
        const [hx, hy] = center(h);
        if (Math.abs(hx - sx) > r || Math.abs(hy - sy) > r || Math.hypot(hx - sx, hy - sy) > r) continue;
        switch (s.Kind) {
          case K.Well: if (h.WaterLvl < 1) h.WaterLvl = 1; break;
          case K.Fountain: h.WaterLvl = 2; break;
          case K.Market: h.Food = true; h.Goods = true; break;
          case K.Temple: case K.GrandTemple: h.Religion = true; break;
          case K.Theater: h.Entertain = true; break;
          case K.Amphitheater: h.Entertain = true; h.Amphi = true; break;
          case K.School: h.Educ = true; break;
          case K.Library: h.Educ = true; h.Library = true; break;
          case K.Doctor: h.Health = true; break;
          case K.Baths: h.Hygiene = true; break;
          case K.Forum: h.Taxed = true; break;
          default: break;
        }
      }
    }
    for (const h of houses) { const [hx, hy] = center(h); h.Desir = this.desirAt(hx, hy, h.ID); }
  }

  storage() {
    let food = 0; let goods = 0; let trade = 0; let def = 0;
    for (const b of this.Buildings.values()) {
      if (!b.HasRoad) continue;
      const w = 0.5 + 0.5 * b.Eff;
      if (b.Kind === K.Granary) food += w;
      else if (b.Kind === K.Warehouse) goods += w;
      else if (b.Kind === K.TradePost) trade += b.Eff;
      def += DEFS[b.Kind].defense * b.Eff;
    }
    this.FoodCap = 400 + 1500 * food;
    this.GoodCap = 120 + 500 * goods;
    this.TradeCap = Math.floor(80 * trade);
    this.Defense = def;
  }

  // Production mensuelle de nourriture si toutes les fermes reliées étaient pourvues.
  foodPotential() {
    let v = 0;
    for (const b of this.Buildings.values()) {
      const df = DEFS[b.Kind];
      if (df.outN > 0 && GOODS[df.out].food && b.HasRoad) v += df.outN;
    }
    return v;
  }
  cap(gd) { return GOODS[gd].food ? this.FoodCap : this.GoodCap; }
  room(gd) { return GOODS[gd].food ? Math.max(0, this.FoodCap - this.food()) : Math.max(0, this.GoodCap - this.Stock[gd]); }
  hasGood(h, gd) { return h.Food && this.Stock[gd] >= 1; }

  // Niveau que la maison peut atteindre et ce qui lui manque : [niveau, message].
  targetLevel(h) {
    if (!h.HasRoad) return [1, "Pas d'accès à une route reliée"];
    const capMsg = 'Niveau maximal pour cette province';
    const fed = h.Food && h.FedThisM;
    if (h.WaterLvl < 1) return [1, "Manque d'eau (puits)"];
    if (!h.Food) return [1, 'Pas de marché à proximité'];
    if (!fed) return [1, 'Le marché manque de nourriture'];
    if (h.Desir < -4) return [1, 'Quartier trop laid'];
    if (this.locked(K.Workshop) || this.locked(K.Temple)) return [2, capMsg];
    if (!this.hasGood(h, G.Pottery)) return [2, 'Besoin de poteries (argilière + poterie)'];
    if (!h.Religion) return [2, "Besoin d'un temple"];
    if (h.Desir < 0) return [2, 'Quartier pas assez beau (jardins)'];
    if (this.locked(K.Fountain) || this.locked(K.Theater) || this.locked(K.OilPress)) return [3, capMsg];
    if (h.WaterLvl < 2) return [3, "Besoin d'une fontaine"];
    if (!h.Entertain) return [3, "Besoin d'un théâtre"];
    if (!this.hasGood(h, G.Oil)) return [3, "Besoin d'huile (oliveraie + pressoir)"];
    if (h.Desir < 2) return [3, 'Désirabilité insuffisante (jardins, statues)'];
    if (this.locked(K.Carpenter) || this.locked(K.School) || this.locked(K.Doctor)) return [4, capMsg];
    if (h.Variety < 2) return [4, 'Besoin de 2 sortes de nourriture'];
    if (!this.hasGood(h, G.Furniture)) return [4, 'Besoin de meubles (bûcherons + menuiserie)'];
    if (!h.Educ) return [4, "Besoin d'une école"];
    if (!h.Health) return [4, "Besoin d'un médecin"];
    if (h.Desir < 4) return [4, 'Désirabilité insuffisante'];
    if (this.locked(K.Baths) || this.locked(K.Winery) || this.locked(K.Amphitheater)) return [5, capMsg];
    if (!h.Hygiene) return [5, 'Besoin de thermes'];
    if (!this.hasGood(h, G.Wine)) return [5, 'Besoin de vin (vignoble + cave)'];
    if (!h.Amphi) return [5, "Besoin d'un amphithéâtre"];
    if (h.Desir < 7) return [5, 'Désirabilité insuffisante (statues, arcs)'];
    if (this.locked(K.Library)) return [6, capMsg];
    if (h.Variety < 3) return [6, 'Besoin de 3 sortes de nourriture'];
    if (!h.Library) return [6, "Besoin d'une bibliothèque"];
    if (h.Desir < 10) return [6, 'Désirabilité insuffisante (monuments)'];
    return [7, 'Niveau maximal'];
  }

  // Niveau de logement maximal permis par la province.
  maxReachable() {
    const L = (k) => this.locked(k);
    if (L(K.Workshop) || L(K.Temple)) return 2;
    if (L(K.Fountain) || L(K.Theater) || L(K.OilPress)) return 3;
    if (L(K.Carpenter) || L(K.School) || L(K.Doctor)) return 4;
    if (L(K.Baths) || L(K.Winery) || L(K.Amphitheater)) return 5;
    if (L(K.Library)) return 6;
    return 7;
  }

  // Met à jour routes, main d'œuvre, couverture et stockage (après chaque construction).
  recompute() {
    this.computeRoads();
    this.workforce();
    this.coverage();
    this.storage();
    for (const b of this.Buildings.values()) if (b.Kind === K.House) b.Needs = this.targetLevel(b)[1];
    this.version++;
  }

  // ---------- tour mensuel ----------
  tick() {
    if (this.Lost) return;
    this.Month++;
    const r = this.rand;
    this.recompute();
    this.TradeUsed = 0;
    const prod = new Array(NUM_GOODS).fill(0);
    const cons = new Array(NUM_GOODS).fill(0);
    let sales = 0;

    // production : matières premières puis transformation
    const season = 1 + 0.3 * Math.sin((this.Month % 12) / 12 * 2 * Math.PI - 1.2);
    if (this.HarvestM > 0) { this.HarvestM--; if (this.HarvestM === 0) this.HarvestMod = 1; }
    if (!this.HarvestMod) this.HarvestMod = 1;
    const all = this.byID();
    const ordered = [...all.filter((b) => !isProcessor(b.Kind)), ...all.filter((b) => isProcessor(b.Kind))];
    for (const b of ordered) {
      const df = DEFS[b.Kind];
      if (!isProducer(b.Kind)) continue;
      b.Status = ''; b.Prod = 0;
      if (!b.HasRoad) { b.Status = 'Pas de route reliée'; continue; }
      let out = df.outN * b.Eff;
      if (df.seasonal) out *= season * this.HarvestMod;
      if (b.Eff < 0.999) b.Status = "Manque d'employés";
      if (out > this.room(df.out)) { out = this.room(df.out); b.Status = 'Stockage plein (grenier / entrepôt)'; }
      if (isProcessor(b.Kind)) {
        const have = this.Stock[df.inp] / df.inN;
        if (have < out) { out = have; b.Status = `Manque de ${GOODS[df.inp].name}`; }
        this.Stock[df.inp] -= out * df.inN;
        cons[df.inp] += out * df.inN;
      }
      this.Stock[df.out] += out;
      prod[df.out] += out;
      b.Prod = out;
    }

    // consommation des maisons
    const houses = all.filter((b) => b.Kind === K.House);
    const foods = [G.Wheat, G.Veg, G.Fish];
    for (const h of houses) {
      h.FedThisM = false;
      if (!h.Food) { h.Variety = 0; continue; }
      const avail = foods.filter((f) => this.Stock[f] >= 0.5);
      if (h.Pop === 0) { h.FedThisM = avail.length > 0; h.Variety = avail.length; continue; }
      if (!avail.length) { h.Variety = 0; continue; }
      const need = h.Pop / 9;
      let got = 0; let kinds = 0;
      for (const f of avail) {
        const take = Math.min(need / avail.length, this.Stock[f]);
        if (take > 0) kinds++;
        this.Stock[f] -= take; cons[f] += take; got += take;
      }
      for (const f of avail) {
        if (got >= need) break;
        const take = Math.min(need - got, this.Stock[f]);
        this.Stock[f] -= take; cons[f] += take; got += take;
      }
      h.FedThisM = got >= need * 0.98;
      h.Variety = kinds;
      for (const gd of [G.Pottery, G.Oil, G.Furniture, G.Wine]) {
        if (h.Level >= GOOD_NEED_LEVEL[gd] && this.Stock[gd] > 0) {
          const use = Math.min(this.Stock[gd], h.Pop / 50);
          this.Stock[gd] -= use; cons[gd] += use;
          sales += use * GOODS[gd].sell * 0.6;
        }
      }
    }
    // pourriture au-delà des capacités
    const f = this.food();
    if (f > this.FoodCap) { const k = this.FoodCap / f; for (const fd of foods) this.Stock[fd] *= k; }
    for (let gd = G.Olives; gd < NUM_GOODS; gd++) this.Stock[gd] = Math.max(0, Math.min(this.Stock[gd], this.GoodCap));
    this.LastProd = prod; this.LastCons = cons;

    // évolution, bonheur
    if (this.FestBoost > 0) this.FestBoost = Math.max(0, this.FestBoost - 2);
    if (this.FestCool > 0) this.FestCool--;
    for (const h of houses) {
      const [target, needs] = this.targetLevel(h);
      h.Needs = needs;
      if (target > h.Level) {
        h.Level++; h.Down = 0;
        if (h.Level === MAX_LEVEL && h.Pop > 0) this.log("Une villa s'élève dans votre cité !");
      } else if (target < h.Level) {
        h.Down++;
        if (h.Down >= 3 || !h.HasRoad) { h.Level--; h.Down = 0; }
      } else h.Down = 0;
      h.Level = Math.max(1, Math.min(MAX_LEVEL, h.Level));
      if (h.Pop > HOUSE_CAP[h.Level]) h.Pop = HOUSE_CAP[h.Level];
      let hp = 45;
      if (h.FedThisM) hp += 12 + h.Variety * 2; else if (h.Pop > 0) hp -= 8;
      hp += h.WaterLvl * 5;
      for (const ok of [h.Religion, h.Entertain, h.Amphi, h.Health, h.Hygiene]) if (ok) hp += 4;
      if (this.hasGood(h, G.Pottery)) hp += 3;
      hp += Math.max(-5, Math.min(8, h.Desir));
      hp -= this.Unemploy * 25 * Math.min(1, this.Labor / 60);
      hp -= (this.TaxRate - 8) * 3;
      hp += (this.Wage - 30) * 0.9;
      hp += this.FestBoost;
      h.Happy += (Math.max(0, Math.min(100, hp)) - h.Happy) * 0.35;
    }

    // immigration / émigration
    let avgHappy = 0; let pop = 0;
    for (const h of houses) { avgHappy += h.Happy * h.Pop; pop += h.Pop; }
    avgHappy = pop > 0 ? avgHappy / pop : 60;
    let vacant = houses.filter((h) => h.HasRoad && h.Pop < HOUSE_CAP[h.Level] && h.Happy > 30);
    if (avgHappy > 25 && vacant.length) {
      let attract = Math.max(0.3, Math.min(1.5, (avgHappy - 20) / 40));
      if (pop < 150) attract = Math.max(attract, 0.8);
      // les migrants ne viennent que si la ville peut les nourrir
      const need = pop / 9;
      const fprod = Math.max(this.LastProd[G.Wheat] + this.LastProd[G.Veg] + this.LastProd[G.Fish], 0.75 * this.foodPotential());
      if (need > 0 && pop >= 150) {
        const fr = (fprod + this.food() / 6) / need;
        if (fr < 1.15) attract *= Math.max(0, (fr - 0.9) / 0.25);
      }
      let flow = Math.floor((6 + vacant.length * 2 + Math.floor(pop / 15)) * attract);
      while (flow > 0 && vacant.length) {
        const i = r.int(vacant.length);
        const h = vacant[i];
        const n = Math.min(flow, Math.min(4, HOUSE_CAP[h.Level] - h.Pop));
        h.Pop += n; flow -= n;
        if (h.Pop >= HOUSE_CAP[h.Level]) vacant = vacant.filter((_, j) => j !== i);
      }
    }
    let left = 0;
    for (const h of houses) if (h.Pop > 0 && h.Happy < 30) { const n = Math.max(1, Math.floor(h.Pop / 6)); h.Pop -= n; left += n; }
    if (left > 8) this.log(`${left} habitants mécontents quittent la ville.`);

    // incendies, effondrements
    let burnt = 0;
    for (const b of this.sorted()) {
      const df = DEFS[b.Kind];
      if (b.Kind === K.Road || b.Kind === K.Rubble || !this.Buildings.has(b.ID)) continue;
      if (b.Fireproof) b.Fire = Math.max(0, b.Fire - 20); else b.Fire += df.fire * (0.5 + r.next()) * (1 + Math.floor(b.Level / 3));
      if (b.Sturdy) b.Damage = Math.max(0, b.Damage - 20); else b.Damage += df.collapse * (0.5 + r.next());
      if (b.Fire >= 100 && r.next() < 0.3) { this.ruin(b, 'Incendie', burnt < 4); burnt++; }
      else if (b.Damage >= 100 && r.next() < 0.3) { this.ruin(b, 'Effondrement', burnt < 4); burnt++; }
    }

    // finances
    let tax = 0;
    for (const h of houses) {
      if (!this.Buildings.has(h.ID) || !h.Taxed || h.Happy < 25) continue;
      tax += Math.floor(h.Pop * (0.5 + 0.5 * h.Level) * this.TaxRate / 100 * 5);
    }
    const wages = Math.floor(this.Employed * this.Wage / 50);
    let upkeep = 0;
    for (const b of this.Buildings.values()) upkeep += DEFS[b.Kind].upkeep;
    this.IncTax = tax; this.IncSales = Math.floor(sales); this.ExpWages = wages; this.ExpUpkeep = upkeep;
    this.Money += tax + Math.floor(sales) - wages - upkeep;
    this.autoTrade();
    this.LastIncome = this.IncTax + this.IncSales + this.IncTrade;
    this.LastExpend = this.ExpWages + this.ExpUpkeep + this.ExpTrade;
    this.IncTrade = 0; this.ExpTrade = 0;

    this.recompute();
    this.updateRatings(avgHappy);
    this.handleRome();
    this.events();
    this.checkEnd();
  }

  updateRatings(avgHappy) {
    let pop = 0; let cult = 0; let lvl = 0; let safe = 0; let n = 0; let educ = 0;
    const w = [20, 15, 10, 15, 10, 15, 15];
    for (const b of this.Buildings.values()) {
      if (b.Kind === K.House && b.Pop > 0) {
        const p = b.Pop; pop += p;
        let c = 0;
        [b.Religion, b.Entertain, b.Amphi, b.Educ, b.Library, b.Health, b.Hygiene].forEach((ok, i) => { if (ok) c += w[i]; });
        cult += c * p; lvl += b.Level * p;
        if (b.Educ) educ += p;
      }
      if (b.Kind !== K.Road && b.Kind !== K.Rubble) {
        n++;
        if (b.Fireproof) safe += 0.5;
        if (b.Sturdy) safe += 0.5;
      }
    }
    const popF = Math.max(1, pop);
    const mon = Math.min(10, this.count(K.GrandTemple) * 4 + this.count(K.Arch) * 3);
    this.Culture = clamp(cult / popF * Math.min(1, popF / 300) + mon);
    this.Crime = clamp(this.Unemploy * 80 + Math.max(0, 55 - avgHappy) * 1.5 - educ / popF * 20) / 100;
    const cover = n > 0 ? safe / n : 0;
    this.Security = clamp(cover * 70 + (1 - this.Crime) * 30);
    const maxL = this.maxReachable();
    let pr = (lvl / popF - 1) / Math.max(1, maxL - 1) * 70 + Math.min(20, (this.LastIncome - this.LastExpend) / 15);
    if (this.Money < 0) pr = 0;
    pr += Math.min(10, this.Money / 1000);
    this.Prosper += (clamp(pr) - this.Prosper) * 0.3;
    this.Favor -= 0.25;
    if (this.Money < 0) this.Favor -= 3; else if (this.LastIncome > this.LastExpend) this.Favor += 0.8;
    if (this.Prosper > 40) this.Favor += 0.3;
    this.Favor += Math.min(1.5, 0.5 * this.count(K.GrandTemple));
    this.Favor = clamp(this.Favor);
  }

  // ---------- Rome ----------
  reqLabel() { return this.Req.Money ? 'deniers' : GOODS[this.Req.Good].name; }
  producible() {
    const out = []; const seen = new Set();
    for (const b of this.byID()) { const df = DEFS[b.Kind]; if (df.outN > 0 && !seen.has(df.out)) { seen.add(df.out); out.push(df.out); } }
    return out;
  }
  handleRome() {
    const r = this.rand;
    if (this.Req.Active) {
      this.Req.Deadline--;
      if (this.Req.Deadline === 3) this.log(`Rome s'impatiente : plus que 3 mois pour l'envoi de ${this.Req.Amount} ${this.reqLabel()} !`);
      if (this.Req.Deadline <= 0) {
        this.Req.Active = false;
        this.Favor = clamp(this.Favor - 20);
        this.alert("Vous n'avez pas honoré la demande de César. Faveur −20.");
        this.NextReqIn = 10 + r.int(10);
      }
      return;
    }
    this.NextReqIn--;
    const pop = this.population();
    if (this.NextReqIn > 0 || pop < 150) return;
    const opts = this.producible();
    if (!opts.length || r.int(4) === 0) {
      this.Req = { Active: true, What: '', Good: 0, Money: true, Amount: 500 + pop + r.int(300), Deadline: 12 };
    } else {
      const gd = opts[r.int(opts.length)];
      let amt = 25 + Math.floor(pop / 30);
      if (GOODS[gd].food) amt = 80 + Math.floor(pop / 8);
      else if (gd === G.Marble) amt = 15 + Math.floor(pop / 120);
      else if (!GOODS[gd].finish) amt = 40 + Math.floor(pop / 25);
      amt = Math.floor(Math.min(amt, this.cap(gd) * 0.8));
      this.Req = { Active: true, What: '', Good: gd, Money: false, Amount: amt + r.int(10), Deadline: 12 };
    }
    this.Req.What = this.reqLabel();
    this.alert(`Requête de César : envoyez ${this.Req.Amount} ${this.reqLabel()} sous ${this.Req.Deadline} mois.`);
  }
  sendRequest() {
    const q = this.Req;
    if (!q.Active) return 'Aucune requête en cours';
    if (q.Money) {
      if (this.Money < q.Amount) return 'Trésor insuffisant';
      this.Money -= q.Amount;
    } else {
      if (this.Stock[q.Good] < q.Amount) return `Pas assez de ${GOODS[q.Good].name} (${Math.round(this.Stock[q.Good])}/${q.Amount})`;
      this.Stock[q.Good] -= q.Amount;
    }
    q.Active = false;
    this.Favor = clamp(this.Favor + 15);
    this.NextReqIn = 12 + this.rand.int(12);
    this.log('César est satisfait de votre envoi. Faveur +15.');
    this.version++;
    return '';
  }
  giftCost() { return 400 + 200 * this.GiftCount; }
  gift() {
    const c = this.giftCost();
    if (this.Money < c) return 'Trésor insuffisant';
    this.Money -= c;
    const gain = Math.max(3, 12 - this.GiftCount * 2);
    this.GiftCount++;
    this.Favor = clamp(this.Favor + gain);
    this.log(`Cadeau à Rome (${c} dn). Faveur +${gain}.`);
    this.version++;
    return '';
  }
  festivalCost() { return 200 + Math.floor(this.population() / 3); }
  festival() {
    if (this.FestCool > 0) return `Prochaine fête possible dans ${this.FestCool} mois`;
    const c = this.festivalCost();
    if (this.Money < c) return 'Trésor insuffisant';
    this.Money -= c;
    this.FestBoost = 14; this.FestCool = 8;
    this.Favor = clamp(this.Favor + 1);
    for (const b of this.Buildings.values()) if (b.Kind === K.House) b.Happy = Math.min(100, b.Happy + 8);
    this.alert(`Grandes fêtes en l'honneur de Jupiter ! Le peuple exulte (${c} dn).`);
    this.version++;
    return '';
  }

  // ---------- commerce ----------
  tradeLeft() { return Math.max(0, this.TradeCap - this.TradeUsed); }
  sell(gd, n) {
    if (!this.TradeCap) return 'Construisez un comptoir relié à la route';
    n = Math.min(n, Math.min(this.Stock[gd], this.tradeLeft()));
    if (n < 1) return this.tradeLeft() === 0 ? 'Capacité commerciale du mois épuisée' : 'Stock insuffisant';
    const v = Math.floor(n * GOODS[gd].sell);
    this.Stock[gd] -= n; this.Money += v; this.IncTrade += v; this.TradeUsed += Math.floor(n);
    this.version++;
    return '';
  }
  buy(gd, n) {
    if (!this.TradeCap) return 'Construisez un comptoir relié à la route';
    n = Math.min(n, Math.min(this.room(gd), this.tradeLeft()));
    if (n < 1) return this.tradeLeft() === 0 ? 'Capacité commerciale du mois épuisée' : 'Stockage plein';
    const c = Math.floor(n * GOODS[gd].buy);
    if (this.Money < c) return 'Trésor insuffisant';
    this.Stock[gd] += n; this.Money -= c; this.ExpTrade += c; this.TradeUsed += Math.floor(n);
    this.version++;
    return '';
  }
  autoTrade() {
    for (let gd = 0; gd < NUM_GOODS; gd++) {
      if (!this.AutoExport[gd] || this.tradeLeft() === 0) continue;
      let keep = GOODS[gd].food ? this.FoodCap * 0.2 : this.cap(gd) * 0.5;
      if (this.Req.Active && !this.Req.Money && this.Req.Good === gd) keep = Math.max(keep, this.Req.Amount);
      const s = this.Stock[gd] - keep;
      if (s >= 1) this.sell(gd, Math.floor(s));
    }
  }

  // ---------- événements ----------
  events() {
    const r = this.rand;
    const pop = this.population();
    const sc = this.scen();
    if (sc.raids && pop >= 350 && this.Month >= 24) {
      if (this.RaidIn > 0) {
        this.RaidIn--;
        if (this.RaidIn === 3) this.alert(`Les barbares approchent par ${RAID_SIDES[this.RaidSide]} : ${this.RaidStr} guerriers dans 3 mois. Défense : ${Math.round(this.Defense)}.`);
        if (this.RaidIn === 0) this.resolveRaid();
      } else {
        this.NextRaid--;
        if (this.NextRaid <= 0) {
          const mult = sc.raidMult || 1;
          this.RaidStr = Math.floor((25 + pop / 30 + this.RaidCount * 12) * mult);
          this.RaidSide = r.int(3);
          this.RaidIn = 6;
          this.alert(`Éclaireurs : une horde de ${this.RaidStr} guerriers arrivera par ${RAID_SIDES[this.RaidSide]} dans 6 mois ! Défense actuelle : ${Math.round(this.Defense)} (casernes, tours).`);
        }
      }
    }
    if (this.Month % 6 === 0) {
      let fire = 0; let coll = 0; let noRoad = 0;
      for (const b of this.Buildings.values()) {
        if (b.Kind === K.Road || b.Kind === K.Rubble) continue;
        if (b.Fire > 60 && !b.Fireproof) fire++;
        if (b.Damage > 60 && !b.Sturdy) coll++;
        if (DEFS[b.Kind].workers > 0 && !b.HasRoad) noRoad++;
      }
      if (fire) this.log(`Conseiller : ${fire} bâtiment(s) risquent de brûler. Construisez des préfectures (calques).`);
      if (coll) this.log(`Conseiller : ${coll} bâtiment(s) menacent de s'effondrer. Construisez des ingénieurs.`);
      if (noRoad) this.log(`Conseiller : ${noRoad} bâtiment(s) ne sont pas reliés à la route d'entrée.`);
      if (pop > 200 && this.count(K.Forum) === 0) this.log("Conseiller : sans forum, aucun impôt n'est collecté !");
    }
    if (this.Month % 12 === 0) {
      if (pop > 800 && this.Month >= 48) {
        let covered = 0;
        for (const h of this.Buildings.values()) if (h.Kind === K.House && (h.Health || h.Hygiene)) covered += h.Pop;
        if (covered / pop < 0.6 && r.next() < 0.3) {
          let lost = 0;
          for (const h of this.byID()) {
            if (h.Kind === K.House && !h.Health && !h.Hygiene && h.Pop > 0) { const n = Math.floor(h.Pop * 15 / 100); h.Pop -= n; lost += n; }
          }
          if (lost > 0) this.alert(`Épidémie ! ${lost} habitants ont péri. Construisez médecins et thermes.`);
        }
      }
      if (this.Favor >= 75 && r.next() < 0.3) {
        const v = 600 + r.int(600);
        this.Money += v;
        this.alert(`César, satisfait, vous accorde un subside de ${v} deniers.`);
      }
    }
    if (this.Month % 12 === 3 && this.HarvestM === 0 && this.Month > 12) {
      const x = r.next();
      if (x < 0.12) { this.HarvestMod = 0.5; this.HarvestM = 4; this.alert('Sécheresse : les récoltes seront divisées par deux pendant 4 mois.'); }
      else if (x < 0.24) { this.HarvestMod = 1.4; this.HarvestM = 4; this.alert('Pluies généreuses : récoltes abondantes pendant 4 mois !'); }
    }
  }

  resolveRaid() {
    this.RaidCount++;
    this.NextRaid = 30 + this.rand.int(18);
    if (this.Defense >= this.RaidStr) {
      this.Favor = clamp(this.Favor + 4);
      this.alert(`Victoire ! Vos légionnaires ont repoussé ${this.RaidStr} barbares. Faveur +4.`);
      return;
    }
    const loss = this.RaidStr - this.Defense;
    const n = Math.min(16, 2 + Math.floor(loss / 7));
    const edge = (b) => (this.RaidSide === 1 ? b.Y : this.RaidSide === 2 ? MAP_H - b.Y : MAP_W - b.X);
    const cands = this.byID().filter((b) => b.Kind !== K.Road && b.Kind !== K.Rubble).sort((a, b) => edge(a) - edge(b));
    for (let i = 0; i < n && i < cands.length; i++) this.ruin(cands[i], 'Pillage', false);
    let stolen = 0;
    if (this.Money > 0) { stolen = Math.min(this.Money, Math.floor(loss * 15)); this.Money -= stolen; }
    this.Favor = clamp(this.Favor - 5);
    this.alert(`Les barbares ont pillé la ville : ${Math.min(n, cands.length)} bâtiments détruits, ${stolen} deniers volés. Faveur −5.`);
  }

  goals() {
    const o = this.Goal;
    return [this.population() >= o.Pop, this.Culture >= o.Culture, this.Prosper >= o.Prosper, this.Security >= o.Security, this.Favor >= o.Favor];
  }
  checkEnd() {
    if (this.Favor <= 0) { this.Lost = true; this.alert('César vous a relevé de vos fonctions. Partie perdue.'); return; }
    if (!this.Won && this.goals().every(Boolean)) {
      this.Won = true;
      this.alert(`VICTOIRE ! Rome célèbre votre gouvernance de ${this.scen().name}.`);
    }
  }

  // ---------- sauvegarde (format JSON de l'exe) ----------
  toJSON() {
    const tiles = [];
    for (let x = 0; x < MAP_W; x++) {
      const col = [];
      for (let y = 0; y < MAP_H; y++) col.push({ T: this.T[x * MAP_H + y], BID: this.BID[x * MAP_H + y] });
      tiles.push(col);
    }
    const buildings = {};
    for (const b of this.Buildings.values()) buildings[b.ID] = b;
    const out = { Tiles: tiles, Buildings: buildings };
    for (const k of Object.keys(this)) {
      if (['T', 'BID', 'Connected', 'Buildings', 'rand', 'version', 'Defense', 'FoodCap', 'GoodCap', 'TradeCap', 'PrioRatio'].includes(k)) continue;
      out[k] = this[k];
    }
    out.RngState = this.rand.state;
    return out;
  }

  static fromJSON(o) {
    const g = Object.create(Game.prototype);
    const fresh = new Game(-1, 1); // valeurs par défaut pour les champs absents
    Object.assign(g, fresh);
    g.T = new Uint8Array(MAP_W * MAP_H);
    g.BID = new Int32Array(MAP_W * MAP_H);
    g.Connected = new Uint8Array(MAP_W * MAP_H);
    g.Buildings = new Map();
    g.Messages = [];
    for (const k of Object.keys(o)) {
      if (k === 'Tiles' || k === 'Buildings' || k === 'RngState' || k === 'Grain' || k === 'Goods') continue;
      g[k] = o[k];
    }
    const tiles = o.Tiles || [];
    for (let x = 0; x < Math.min(MAP_W, tiles.length); x++) {
      const col = tiles[x] || [];
      for (let y = 0; y < Math.min(MAP_H, col.length); y++) { g.T[x * MAP_H + y] = col[y].T || 0; g.BID[x * MAP_H + y] = col[y].BID || 0; }
    }
    for (const b of Object.values(o.Buildings || {})) {
      const nb = { ...newBuilding(b.ID, b.Kind, b.X, b.Y), ...b };
      g.Buildings.set(nb.ID, nb);
    }
    for (const key of ['Stock', 'LastProd', 'LastCons']) g[key] = Array.from({ length: NUM_GOODS }, (_, i) => (o[key] && o[key][i]) || 0);
    g.AutoExport = Array.from({ length: NUM_GOODS }, (_, i) => Boolean(o.AutoExport && o.AutoExport[i]));
    if (!o.Version || o.Version < 2) {
      // sauvegarde de la première version de l'exe : partie libre avec les anciens objectifs
      g.ScenarioIdx = -1;
      g.Goal = { Pop: 1000, Culture: 50, Prosper: 50, Security: 50, Favor: 60 };
      g.Stock[G.Wheat] += o.Grain || 0;
      g.Stock[G.Pottery] += o.Goods || 0;
      if (g.Req && g.Req.Active) {
        if (g.Req.What === 'ble') g.Req.Good = G.Wheat;
        else if (g.Req.What === 'biens') g.Req.Good = G.Pottery;
        else g.Req.Money = true;
      }
      for (const b of g.Buildings.values()) if (b.Kind === K.House) b.Level = Math.max(1, Math.min(MAX_LEVEL, b.Level));
      g.NextRaid = 40; g.HarvestMod = 1; g.Version = SAVE_VERSION;
    }
    g.Req = { Active: false, What: '', Good: 0, Money: false, Amount: 0, Deadline: 0, ...(g.Req || {}) };
    g.Goal = { ...fresh.Goal, ...(g.Goal || {}) };
    g.rand = rng(o.RngState || ((o.Seed || 1) + (o.Month || 0) * 7919));
    g.version = 1;
    g.PrioRatio = [1, 1, 1, 1];
    g.recompute();
    return g;
  }
}

// Chemin en L entre deux cases (pour les routes).
export function roadPath(x0, y0, x1, y1) {
  const p = [];
  const sx = x1 < x0 ? -1 : 1; const sy = y1 < y0 ? -1 : 1;
  let x = x0; let y = y0;
  if (Math.abs(x1 - x0) >= Math.abs(y1 - y0)) {
    for (; x !== x1; x += sx) p.push([x, y]);
    for (; y !== y1; y += sy) p.push([x, y]);
  } else {
    for (; y !== y1; y += sy) p.push([x, y]);
    for (; x !== x1; x += sx) p.push([x, y]);
  }
  p.push([x1, y1]);
  return p;
}
