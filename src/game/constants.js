// Constantes partagées par l'application du jeu et son interface.
import { K, MAX_LEVEL } from './engine/defs.js';
import { mix } from './render/parts.js';

// Outils spéciaux.
export const TOOL_NONE = -1;
export const TOOL_CLEAR = 1000;
// Durée d'un mois de jeu selon la vitesse (secondes).
export const MONTH_SECONDS = [0, 3, 1.5, 0.66, 0.25];
// Raccourcis clavier (touche produite, donc indépendante du clavier AZERTY/QWERTY).
export const HOTKEYS = { r: K.Road, x: TOOL_CLEAR, i: K.House, p: K.Well, f: K.Farm, c: K.Market, t: K.Temple, j: K.Garden };
// Outils posés en rectangle.
export const areaTool = (t) => t === K.House || t === K.Garden || t === K.Cypress;

// Calques d'information : nom et couleur d'une maison (null = bâtiment grisé).
const good = 0x3cc85a; const bad = 0xdc3c32; const mid = 0xe6be3c;
const yes = (v) => (v ? good : bad);
const houseOnly = (fn) => (b) => (b.Kind === K.House ? fn(b) : null);
export const OVERLAYS = [
  { name: 'Normal' },
  { name: 'Eau', fn: houseOnly((b) => [bad, 0x5aa0dc, 0x286ee6][b.WaterLvl]) },
  { name: 'Marchés', fn: houseOnly((b) => yes(b.Food)) },
  { name: 'Religion', fn: houseOnly((b) => yes(b.Religion)) },
  { name: 'Divertissement', fn: houseOnly((b) => (b.Amphi ? 0x28a0dc : yes(b.Entertain))) },
  { name: 'Éducation', fn: houseOnly((b) => (b.Library ? 0x28a0dc : yes(b.Educ))) },
  { name: 'Santé / hygiène', fn: houseOnly((b) => (b.Health && b.Hygiene ? good : b.Health || b.Hygiene ? mid : bad)) },
  { name: 'Risque incendie', fn: (b) => (b.Kind === K.Rubble ? null : mix(0xf0f0c8, 0xe61e14, Math.min(1, b.Fire / 100))) },
  { name: 'Risque effondrement', fn: (b) => (b.Kind === K.Rubble ? null : mix(0xf0f0c8, 0xe61e14, Math.min(1, b.Damage / 100))) },
  { name: 'Disésrelie', desir: true },
  { name: 'Impôts', fn: houseOnly((b) => yes(b.Taxed)) },
  { name: 'Bonheur', fn: houseOnly((b) => mix(bad, good, b.Happy / 100)) },
  { name: 'Niveau des maisons', fn: houseOnly((b) => mix(0xc8aa78, 0x783cc8, (b.Level - 1) / (MAX_LEVEL - 1))) },
];

