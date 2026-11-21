// Modèles 3D des bâtiments, décrits comme une liste de pièces simples (boîtes, toits, colonnes…).
// Chaque pièce : { g: type de géométrie, x, z (centre, en cases, relatif au coin du bâtiment),
// y (bas), w, h, d (tailles), c (couleur 0xRRGGBB), r (rotation Y en radians) }.
// Le moteur de rendu les dessine toutes en « instancing » : une seule géométrie par type.

import { K, DEFS } from '../engine/defs.js';
import { noise01 } from '../engine/sim.js';

// Palette romaine.
export const C = {
  wall: 0xe8d6b2, wallDark: 0xc9b48e, terra: 0xb2523a, thatch: 0xb09456, marble: 0xeee9df, stone: 0xaaa294,
  stoneDark: 0x7d766a, wood: 0x7a553a, darkWood: 0x563c26, red: 0xaa2824, gold: 0xdab048, slate: 0x62697a,
  cloth: 0xd8caa8, leaf: 0x4b7d3a, leafDark: 0x2f5c30, soil: 0x7c5f3c, sand: 0xdcc48c, water: 0x3f86b8,
  road: 0xc8b48a, roadDark: 0xa8946c, olive: 0x75864a, purple: 0x6e325a, plaster: 0xf2e6cc,
};

// Couleur entre deux couleurs (t de 0 à 1).
export function mix(a, b, t) {
  const ar = (a >> 16) & 255; const ag = (a >> 8) & 255; const ab = a & 255;
  const br = (b >> 16) & 255; const bg = (b >> 8) & 255; const bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}

// Fabrique de pièces : chaque méthode ajoute une pièce à la liste.
function maker() {
  const p = [];
  const add = (g, x, z, y, w, h, d, c, r = 0) => p.push({ g, x, z, y, w, h, d, c, r });
  const api = {
    p,
    box: (x, z, w, d, y, h, c, r) => add('box', x, z, y, w, h, d, c, r),
    // toit à deux pans ; faîtage le long de X (ou de Z si alongZ)
    gable: (x, z, w, d, y, h, c, alongZ = false) => add('gable', x, z, y, alongZ ? d : w, h, alongZ ? w : d, c, alongZ ? Math.PI / 2 : 0),
    cyl: (x, z, rad, y, h, c) => add('cyl', x, z, y, rad * 2, h, rad * 2, c),
    cone: (x, z, rad, y, h, c) => add('cone', x, z, y, rad * 2, h, rad * 2, c),
    sphere: (x, z, rad, y, c) => add('sphere', x, z, y, rad * 2, rad * 2, rad * 2, c),
    dome: (x, z, rad, y, c) => add('dome', x, z, y, rad * 2, rad, rad * 2, c),
    pyr: (x, z, w, y, h, c) => add('pyr', x, z, y, w, h, w, c),
    half: (x, z, rad, y, h, c, r = 0) => add('half', x, z, y, rad * 2, h, rad * 2, c, r),
    // maison simple : murs + toit à deux pans
    house(x, z, w, d, wallH, wallC, roofC, roofH = 0.32, alongZ = false) {
      api.box(x, z, w, d, 0, wallH, wallC);
      api.gable(x, z, w + 0.08, d + 0.08, wallH, roofH, roofC, alongZ);
    },
    // rangée de colonnes de x0 à x1, à la profondeur z
    columns(x0, x1, z, n, y, h, rad, c) {
      for (let i = 0; i < n; i++) api.cyl(x0 + (x1 - x0) * (n === 1 ? 0.5 : i / (n - 1)), z, rad, y, h, c);
    },
    tree(x, z, s, c = C.leaf) {
      api.cyl(x, z, 0.04 * s, 0, 0.25 * s, C.darkWood);
      api.sphere(x, z, 0.22 * s, 0.18 * s, c);
    },
  };
  return api;
}

// Couleur des cultures selon la saison (mois de jeu).
function ripeness(month) { return 0.5 + 0.5 * Math.sin((month % 12) / 12 * 2 * Math.PI - 1.2); }

// Pièces du logement selon son niveau.
function housePieces(m, b) {
  const lvl = b.Level || 1;
  switch (lvl) {
    case 1: // tente
      m.box(1, 1, 1.7, 1.7, 0, 0.02, 0x8c8258);
      m.pyr(1, 1, 1.1, 0, 0.75, C.cloth);
      m.box(1, 1.55, 0.25, 0.05, 0, 0.35, 0x46321f);
      break;
    case 2: // hutte
      m.box(1, 1, 1.8, 1.8, 0, 0.02, 0x8c8258);
      m.house(1, 1, 1.2, 1.1, 0.42, C.wallDark, C.thatch, 0.42);
      break;
    case 3: // insula
      m.house(1, 1, 1.75, 1.7, 0.65, C.wall, C.terra, 0.35);
      break;
    case 4: // grande insula
      m.house(1, 1, 1.82, 1.8, 1.05, C.wall, C.terra, 0.38);
      m.box(1, 1.92, 1.6, 0.06, 0.45, 0.06, C.wood); // balcon
      break;
    default: { // domus, grande domus, villa : maison à atrium
      const villa = lvl === 7;
      const wall = lvl >= 6 ? C.plaster : C.wall;
      if (villa) {
        m.box(1, 1, 2, 2, 0, 0.03, 0x5f9446);
        m.tree(0.2, 0.2, 0.7, C.leafDark); m.tree(1.8, 0.2, 0.7, C.leafDark); m.tree(0.2, 1.8, 0.7, C.leafDark);
      }
      const s = villa ? 1.5 : 1.86; const h = villa ? 0.75 : 0.62 + (lvl - 5) * 0.12;
      const cx = villa ? 1.1 : 1; const cz = villa ? 1.1 : 1;
      const t = 0.42 * s; // épaisseur des ailes
      m.box(cx, cz - s / 2 + t / 2, s, t, 0, h, wall);
      m.box(cx, cz + s / 2 - t / 2, s, t, 0, h, wall);
      m.box(cx - s / 2 + t / 4, cz, t / 2, s - 2 * t, 0, h, wall);
      m.box(cx + s / 2 - t / 4, cz, t / 2, s - 2 * t, 0, h, wall);
      m.gable(cx, cz - s / 2 + t / 2, s + 0.06, t + 0.08, h, 0.22, C.terra);
      m.gable(cx, cz + s / 2 - t / 2, s + 0.06, t + 0.08, h, 0.22, C.terra);
      m.box(cx, cz, s - t, s - 2 * t, 0, 0.04, 0xcfc29e); // cour
      m.box(cx, cz, (s - t) * 0.45, (s - 2 * t) * 0.45, 0.02, 0.04, C.water); // bassin
      if (villa) m.cyl(cx, cz, 0.05, 0, 0.3, C.marble);
    }
  }
}

// Pièces d'un bâtiment (sans les indicateurs).
export function buildingPieces(b, game) {
  const m = maker();
  const df = DEFS[b.Kind];
  const W = df.W; const H = df.H;
  const month = game ? game.Month : 0;
  const ripe = ripeness(month);
  switch (b.Kind) {
    case K.Road: {
      const onWater = game && game.tile(b.X, b.Y) === 1;
      if (onWater) { m.box(0.5, 0.5, 1.02, 0.9, 0.05, 0.08, C.wood); m.box(0.5, 0.06, 1.02, 0.06, 0.13, 0.12, C.darkWood); m.box(0.5, 0.94, 1.02, 0.06, 0.13, 0.12, C.darkWood); }
      else m.box(0.5, 0.5, 1.0, 1.0, 0, 0.04, b.HasRoad ? C.road : C.roadDark);
      break;
    }
    case K.House: housePieces(m, b); break;
    case K.Well:
      m.cyl(0.5, 0.5, 0.3, 0, 0.22, C.stone); m.cyl(0.5, 0.5, 0.2, 0.2, 0.03, C.water);
      m.box(0.25, 0.5, 0.05, 0.05, 0.2, 0.35, C.wood); m.box(0.75, 0.5, 0.05, 0.05, 0.2, 0.35, C.wood);
      m.box(0.5, 0.5, 0.6, 0.05, 0.55, 0.05, C.wood);
      break;
    case K.Fountain:
      m.cyl(0.5, 0.5, 0.45, 0, 0.16, C.marble); m.cyl(0.5, 0.5, 0.37, 0.14, 0.03, C.water);
      m.cyl(0.5, 0.5, 0.06, 0.15, 0.35, C.marble); m.sphere(0.5, 0.5, 0.1, 0.48, 0xbfe3f5);
      break;
    case K.Reservoir:
      m.box(1.5, 0.15, 3, 0.3, 0, 0.7, C.stone); m.box(1.5, 2.85, 3, 0.3, 0, 0.7, C.stone);
      m.box(0.15, 1.5, 0.3, 2.4, 0, 0.7, C.stone); m.box(2.85, 1.5, 0.3, 2.4, 0, 0.7, C.stone);
      m.box(1.5, 1.5, 2.4, 2.4, 0, 0.6, C.water);
      for (let i = 0; i < 3; i++) m.box(0.5 + i, 3.0, 0.5, 0.04, 0.05, 0.45, C.stoneDark);
      break;
    case K.Farm: case K.VegFarm: case K.Vineyard: case K.OliveFarm: {
      m.box(1.5, 1.5, 2.96, 2.96, 0, 0.03, b.Kind === K.OliveFarm ? 0x968a60 : C.soil);
      if (b.Kind === K.Farm) {
        const crop = mix(0x78a03c, 0xd6b450, ripe);
        for (let i = 0; i < 5; i++) m.box(1.9, 0.45 + i * 0.5, 2.0, 0.3, 0.03, 0.12 + ripe * 0.1, crop);
      } else if (b.Kind === K.VegFarm) {
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) m.sphere(1.25 + i * 0.5, 0.5 + j * 0.65, 0.13, 0.03, mix(0x4e963c, 0x78aa46, ripe));
      } else if (b.Kind === K.Vineyard) {
        for (let i = 0; i < 5; i++) { m.box(1.9, 0.45 + i * 0.5, 2.0, 0.1, 0.03, 0.28, 0x46703a); for (let j = 0; j < 4; j++) m.sphere(1.15 + j * 0.5, 0.45 + i * 0.5, 0.06, 0.15, mix(0x5a8a3c, C.purple, ripe)); }
      } else {
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (i + j > 0) m.tree(0.55 + i * 0.95, 0.55 + j * 0.95, 1.2, C.olive);
      }
      if (b.Kind !== K.OliveFarm) m.house(0.5, 0.55, 0.75, 0.65, 0.35, C.wall, C.thatch, 0.3);
      else m.house(0.45, 0.45, 0.65, 0.6, 0.35, C.wall, C.terra, 0.3);
      break;
    }
    case K.Fishery:
      m.box(1, 1, 1.95, 1.95, 0, 0.08, C.wood);
      m.house(0.65, 0.6, 0.95, 0.8, 0.4, C.wall, C.thatch, 0.3);
      m.box(1.5, 1.5, 0.35, 0.8, 0.08, 0.14, C.darkWood, 0.4);
      m.cyl(1.5, 1.5, 0.02, 0.2, 0.6, C.darkWood);
      m.box(1.45, 1.6, 0.03, 0.3, 0.3, 0.35, C.cloth);
      break;
    case K.ClayPit:
      m.box(1, 1, 1.95, 1.95, 0, 0.03, 0xa66240);
      m.cyl(0.85, 1.0, 0.55, 0.02, 0.03, 0x6e3c28);
      m.cone(1.6, 0.45, 0.25, 0, 0.3, 0xbe744c); m.cone(1.6, 1.0, 0.22, 0, 0.25, 0xbe744c); m.cone(1.55, 1.55, 0.2, 0, 0.22, 0xbe744c);
      break;
    case K.Lumber:
      m.box(1, 1, 1.95, 1.95, 0, 0.02, 0x827850);
      m.house(0.6, 0.6, 0.95, 0.8, 0.4, C.wall, C.darkWood, 0.3);
      for (let i = 0; i < 3; i++) m.box(1.45, 1.35 + i * 0.18, 0.8, 0.14, 0.02 + (i % 2) * 0.13, 0.13, C.wood);
      m.tree(1.6, 0.45, 1.2, C.leafDark);
      break;
    case K.Quarry:
      m.box(1, 1, 1.95, 1.95, 0, 0.03, 0x948e82);
      m.box(1.25, 0.75, 1.4, 1.2, 0, 0.45, 0xd2cec4); m.box(1.45, 0.55, 0.9, 0.8, 0.45, 0.3, 0xdedad0);
      for (let i = 0; i < 3; i++) m.box(0.35 + i * 0.4, 1.65, 0.3, 0.25, 0.03, 0.2, C.marble);
      break;
    case K.Workshop:
      m.house(0.75, 0.9, 1.3, 1.4, 0.5, C.wall, 0x8c4630, 0.32);
      m.cyl(1.6, 0.5, 0.25, 0, 0.55, 0x9a5a3c); m.cone(1.6, 0.5, 0.25, 0.55, 0.2, 0x7a4430);
      for (let i = 0; i < 3; i++) m.sphere(1.65, 1.1 + i * 0.28, 0.1, 0, 0xc4703e);
      break;
    case K.Carpenter:
      m.house(0.75, 0.9, 1.3, 1.4, 0.55, C.wall, C.darkWood, 0.32);
      for (let i = 0; i < 4; i++) m.box(1.65, 0.4 + i * 0.35, 0.5, 0.12, 0.02 + (i % 2) * 0.12, 0.08, C.wood);
      break;
    case K.OilPress:
      m.house(0.75, 0.9, 1.3, 1.4, 0.55, C.wall, C.terra, 0.32);
      for (let i = 0; i < 3; i++) { m.cyl(1.65, 0.5 + i * 0.4, 0.11, 0, 0.3, 0xc4a64a); m.sphere(1.65, 0.5 + i * 0.4, 0.12, 0.18, 0xc4a64a); }
      break;
    case K.Winery:
      m.house(0.75, 0.9, 1.3, 1.4, 0.55, C.wall, 0x783240, 0.32);
      for (let i = 0; i < 3; i++) m.cyl(1.65, 0.5 + i * 0.4, 0.15, 0, 0.3, C.wood);
      break;
    case K.Granary:
      m.house(1.5, 1.2, 2.8, 1.9, 0.85, 0xdecca0, C.terra, 0.45);
      for (let i = 0; i < 4; i++) m.sphere(0.4 + i * 0.7, 2.55, 0.17, 0, 0xd6ba6e);
      break;
    case K.Warehouse:
      m.house(1.5, 1.25, 2.8, 2.0, 0.85, 0xcec0a0, C.slate, 0.42);
      for (let i = 0; i < 3; i++) m.box(0.5 + i * 1.0, 2.6, 0.45, 0.45, 0, 0.35, C.wood);
      break;
    case K.TradePost:
      m.box(1.5, 1.5, 2.96, 2.96, 0, 0.04, 0xd6c8a8);
      m.house(1.5, 0.7, 2.8, 1.2, 0.7, C.wall, C.terra, 0.38);
      [0xba342c, 0x345ca0, 0xc89628].forEach((c, i) => { m.box(0.55 + i * 0.95, 2.1, 0.75, 0.7, 0.45, 0.05, c); m.cyl(0.55 + i * 0.95, 2.4, 0.03, 0, 0.45, C.wood); });
      m.cyl(2.8, 0.1, 0.03, 0, 1.5, C.darkWood); m.box(2.95, 0.1, 0.3, 0.03, 1.2, 0.25, C.red);
      break;
    case K.Market:
      m.box(1, 1, 1.96, 1.96, 0, 0.03, 0xcec0a0);
      [0xba342c, 0x345ca0, 0xc89628, 0x468246].forEach((c, i) => {
        const x = 0.5 + (i % 2); const z = 0.5 + Math.floor(i / 2);
        m.box(x, z, 0.75, 0.6, 0.4, 0.05, c);
        m.box(x, z, 0.6, 0.4, 0, 0.2, C.wood);
        m.sphere(x - 0.15, z, 0.07, 0.2, 0xc8a050);
      });
      break;
    case K.Prefecture:
      m.house(0.5, 0.5, 0.85, 0.8, 0.45, C.wall, C.red, 0.28);
      m.cyl(0.85, 0.2, 0.02, 0.45, 0.6, C.darkWood); m.box(0.97, 0.2, 0.22, 0.02, 0.88, 0.15, C.red);
      break;
    case K.Engineer:
      m.house(0.5, 0.5, 0.85, 0.8, 0.45, C.wall, C.slate, 0.28);
      m.box(0.75, 0.2, 0.05, 0.05, 0.4, 0.75, C.wood); m.box(0.55, 0.2, 0.45, 0.05, 1.12, 0.05, C.wood, 0);
      break;
    case K.Barracks:
      m.box(1.5, 0.08, 3, 0.16, 0, 0.5, C.stone); m.box(1.5, 2.92, 3, 0.16, 0, 0.5, C.stone);
      m.box(0.08, 1.5, 0.16, 2.7, 0, 0.5, C.stone); m.box(2.92, 1.5, 0.16, 2.7, 0, 0.5, C.stone);
      m.box(1.5, 1.5, 2.7, 2.7, 0, 0.03, 0xa48c6c);
      for (let i = 0; i < 3; i++) m.pyr(0.65 + i * 0.85, 0.7, 0.55, 0, 0.45, C.cloth);
      m.house(1.5, 2.15, 2.3, 0.9, 0.55, C.wall, C.red, 0.3);
      m.cyl(2.7, 0.3, 0.025, 0.5, 0.9, C.darkWood); m.box(2.85, 0.3, 0.28, 0.03, 1.15, 0.22, C.red);
      break;
    case K.Tower:
      m.cyl(0.5, 0.5, 0.38, 0, 1.4, C.stone);
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; m.box(0.5 + Math.cos(a) * 0.33, 0.5 + Math.sin(a) * 0.33, 0.12, 0.12, 1.4, 0.14, C.stoneDark); }
      m.cyl(0.5, 0.5, 0.015, 1.4, 0.5, C.darkWood); m.box(0.6, 0.5, 0.2, 0.02, 1.72, 0.14, C.red);
      break;
    case K.Temple: {
      m.box(1, 1, 1.9, 1.9, 0, 0.18, C.stone);
      m.box(1, 1.15, 1.2, 1.1, 0.18, 0.7, C.marble);
      m.columns(0.35, 1.65, 0.38, 5, 0.18, 0.7, 0.06, C.marble);
      m.columns(0.35, 1.65, 1.75, 5, 0.18, 0.7, 0.06, C.marble);
      m.box(1, 1, 1.6, 1.6, 0.88, 0.08, C.marble);
      m.gable(1, 1, 1.75, 1.75, 0.96, 0.36, C.terra, true);
      break;
    }
    case K.GrandTemple: {
      m.box(2, 2, 3.95, 3.95, 0, 0.15, C.stoneDark); m.box(2, 2, 3.5, 3.5, 0.15, 0.15, C.stone); m.box(2, 2, 3.1, 3.1, 0.3, 0.15, 0xc2bcae);
      m.box(2, 2.2, 1.9, 2.2, 0.45, 1.15, C.marble);
      m.columns(0.75, 3.25, 0.75, 8, 0.45, 1.15, 0.08, C.marble);
      m.columns(0.75, 3.25, 3.25, 8, 0.45, 1.15, 0.08, C.marble);
      m.box(2, 2, 2.75, 2.75, 1.6, 0.12, C.gold);
      m.gable(2, 2, 2.9, 2.9, 1.72, 0.55, C.marble, true);
      m.sphere(2, 0.6, 0.12, 2.0, C.gold);
      break;
    }
    case K.Theater:
      m.box(1.5, 1, 2.96, 1.96, 0, 0.03, 0xcfc4a8);
      m.half(1.5, 1.7, 1.4, 0, 0.25, C.stone, Math.PI); m.half(1.5, 1.7, 1.15, 0.25, 0.25, 0xbcb4a4, Math.PI); m.half(1.5, 1.7, 0.9, 0.5, 0.25, C.stone, Math.PI);
      m.box(1.5, 1.8, 1.4, 0.35, 0, 0.45, 0x9a6a46);
      break;
    case K.Amphitheater:
      m.cyl(2, 1.5, 1.95, 0, 0.85, C.stone);
      m.cyl(2, 1.5, 1.6, 0.85, 0.02, 0xbcb4a4);
      m.cyl(2, 1.5, 1.15, 0, 0.88, 0xdcc48c);
      for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; m.box(2 + Math.cos(a) * 1.93, 1.5 + Math.sin(a) * 1.43, 0.12, 0.12, 0.15, 0.4, C.stoneDark, -a); }
      m.sphere(1.8, 1.5, 0.06, 0.88, C.red); m.sphere(2.25, 1.4, 0.06, 0.88, 0x3c5aa0);
      break;
    case K.School:
      m.house(1, 0.85, 1.8, 1.4, 0.6, C.wall, 0xc4963c, 0.32);
      m.columns(0.3, 1.7, 1.75, 4, 0, 0.55, 0.05, C.marble); m.box(1, 1.75, 1.6, 0.2, 0.55, 0.06, C.marble);
      break;
    case K.Library:
      m.box(1, 1, 1.9, 1.9, 0, 0.12, C.stone);
      m.house(1, 0.9, 1.6, 1.3, 0.85, C.marble, 0x46609a, 0.3);
      m.columns(0.3, 1.7, 1.75, 5, 0.12, 0.75, 0.05, C.marble);
      break;
    case K.Doctor:
      m.house(0.5, 0.5, 0.85, 0.85, 0.42, C.marble, 0x46825a, 0.26);
      m.box(0.5, 0.94, 0.08, 0.02, 0.15, 0.25, C.red); m.box(0.5, 0.94, 0.25, 0.02, 0.24, 0.08, C.red);
      break;
    case K.Baths:
      m.box(1, 1, 1.9, 1.9, 0, 0.35, C.marble);
      m.box(1, 1.45, 1.5, 0.7, 0.3, 0.07, C.water);
      m.dome(1, 0.65, 0.55, 0.35, 0x9aa4ae);
      break;
    case K.Forum:
      m.box(1.5, 1.5, 2.96, 2.96, 0, 0.04, 0xd8ccb0);
      m.house(1.5, 0.6, 2.6, 0.95, 0.7, C.marble, C.terra, 0.35);
      m.columns(0.35, 2.65, 2.75, 8, 0, 0.45, 0.05, C.marble);
      m.box(1.5, 1.8, 0.35, 0.35, 0, 0.25, C.stone); m.cyl(1.5, 1.8, 0.07, 0.25, 0.35, C.marble); m.sphere(1.5, 1.8, 0.08, 0.6, C.marble);
      break;
    case K.Garden:
      m.box(0.5, 0.5, 0.96, 0.96, 0, 0.05, 0x5a8c3c);
      [0xe65058, 0xf0dc50, 0xf0f0f0, 0xc864dc].forEach((c, i) => m.sphere(0.2 + (noise01(b.X * 7 + i, b.Y) * 0.6), 0.2 + noise01(b.X, b.Y * 7 + i) * 0.6, 0.05, 0.05, c));
      m.tree(0.5, 0.45, 1.1);
      break;
    case K.Cypress:
      m.cone(0.3, 0.5, 0.13, 0, 0.95, C.leafDark); m.cone(0.7, 0.5, 0.13, 0, 0.8, 0x386a3a);
      break;
    case K.Statue:
      m.box(0.5, 0.5, 0.5, 0.5, 0, 0.3, C.stone); m.cyl(0.5, 0.5, 0.09, 0.3, 0.45, C.marble); m.sphere(0.5, 0.5, 0.08, 0.75, C.marble);
      break;
    case K.Arch:
      m.box(0.35, 1, 0.5, 1.4, 0, 1.3, C.marble); m.box(1.65, 1, 0.5, 1.4, 0, 1.3, C.marble);
      m.box(1, 1, 2, 1.5, 1.3, 0.5, C.marble); m.box(1, 1, 2.04, 1.54, 1.42, 0.08, C.gold);
      m.cyl(1, 1, 0.08, 1.8, 0.2, C.gold); m.sphere(1, 1, 0.1, 1.95, C.gold);
      break;
    case K.Rubble:
      for (let i = 0; i < 4; i++) m.box(0.2 + noise01(b.X * 5 + i, b.Y * 9) * 0.6, 0.2 + noise01(b.X * 9, b.Y * 5 + i) * 0.6, 0.25, 0.2, 0, 0.1 + i * 0.03, 0x786858, i);
      break;
    default: m.box(W / 2, H / 2, W * 0.9, H * 0.9, 0, 0.5, C.wall);
  }
  return m.p;
}
