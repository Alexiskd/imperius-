// Ville de démonstration partagée par les tests du moteur et la vidéo de présentation (tools/motion).
import { roadPath, T } from '../src/game/engine/sim.js';
import { K, G, DEFS } from '../src/game/engine/defs.js';

// autoPlace : cherche autour de (cx, cy) un emplacement valide qui touche une route reliée.
export function autoPlace(g, k, cx, cy) {
  const df = DEFS[k];
  for (let r = 0; r < 18; r++) for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const x = cx + dx; const y = cy + dy;
    if (g.canPlace(k, x, y)[1]) continue;
    let near = false;
    for (let ex = -1; ex <= df.W && !near; ex++) for (let ey = -1; ey <= df.H; ey++) {
      const inside = ex >= 0 && ex < df.W && ey >= 0 && ey < df.H;
      const corner = (ex === -1 || ex === df.W) && (ey === -1 || ey === df.H);
      if (!inside && !corner && g.connected(x + ex, y + ey)) { near = true; break; }
    }
    if (near && g.build(k, x, y) === '') return true;
  }
  return false;
}

// Ville de démonstration : îlots de logements avec services, comme le test Go.
export function buildDemoCity(g) {
  const y = g.EntryY;
  g.Money = 200000;
  g.Stock[G.Marble] = 500;
  g.clear(14, y - 26, 80, y + 26);
  for (let x = 13; x < 82; x++) for (let yy = y - 27; yy <= y + 27; yy++) {
    const t = g.tile(x, yy);
    if (t === T.Rock || t === T.Forest || (t === T.Water && x > 20)) g.setTile(x, yy, T.Grass);
    if ((x >= 15 && x <= 25 && yy > y + 2) || (x >= 52 && x <= 74 && yy > y + 21)) g.setTile(x, yy, T.Fertile);
  }
  for (let x = 8; x < 12; x++) for (let yy = y - 9; yy < y - 6; yy++) g.setTile(x, yy, T.Water);
  g.recompute();
  for (let yy = y - 20; yy <= y + 20; yy += 5) g.buildRoad(roadPath(13, yy, 74, yy));
  for (let xx = 14; xx <= 74; xx += 12) g.buildRoad(roadPath(xx, y - 20, xx, y + 20));
  const b = (k, x, yy) => g.build(k, x, yy);
  for (const [fx, fy] of [[27, y - 4], [39, y + 6], [51, y - 14], [51, y + 11]]) b(K.Forum, fx, fy);
  const svc = [K.Temple, K.School, K.Doctor, K.Temple, K.Library, K.School];
  let n = 0;
  for (const bx of [26, 38, 50]) for (let by = y - 20; by < y + 20; by += 5) {
    for (let i = 0; i < 5; i++) {
      const hx = bx + 1 + 2 * i;
      if (i === 2) { b(K.Well, hx, by + 1); b(K.Garden, hx + 1, by + 1); b(K.Statue, hx, by + 2); b(K.Garden, hx + 1, by + 2); b(K.Market, hx, by + 3); continue; }
      if (i === 3 && (by - y) % 10 !== 0) { b(K.House, hx, by + 1); b(K.Theater, hx, by + 3); continue; }
      if (i === 0 && (by - y) % 10 === 0) { b(svc[n++ % svc.length], hx, by + 3); b(K.House, hx, by + 1); continue; }
      b(K.House, hx, by + 1); b(K.House, hx, by + 3);
    }
    b(K.Prefecture, bx + 11, by + 1); b(K.Engineer, bx + 11, by + 2); b(K.Garden, bx + 11, by + 4);
  }
  const p = (k, x, yy) => autoPlace(g, k, x, yy);
  for (const yy of [y - 22, y - 12, y - 2, y + 3, y + 8, y + 13, y + 18, y + 23]) {
    p(K.Prefecture, 62, yy); p(K.Engineer, 62, yy + 2); p(K.Prefecture, 14, yy); p(K.Engineer, 14, yy + 2); p(K.Prefecture, 74, yy); p(K.Engineer, 74, yy + 2);
  }
  for (const yy of [y + 4, y + 8, y + 13, y + 17, y + 22]) { p(K.Farm, 18, yy); p(K.VegFarm, 22, yy); }
  for (const x of [53, 57, 61]) p(K.Farm, x, y + 23);
  p(K.Granary, 17, y - 17); p(K.Granary, 17, y - 12); p(K.Warehouse, 68, y - 7); p(K.Warehouse, 68, y + 7);
  p(K.Fishery, 10, y - 9); p(K.Fishery, 12, y - 11); p(K.ClayPit, 10, y - 11); p(K.ClayPit, 13, y - 6);
  p(K.Workshop, 20, y - 6); p(K.Workshop, 20, y - 2); p(K.OliveFarm, 66, y + 20); p(K.OilPress, 70, y + 11);
  return g;
}
