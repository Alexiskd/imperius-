// Tests du moteur (node tests/engine.test.mjs) : croissance d'une ville, sauvegarde, compatibilité exe.
import { readFileSync, existsSync } from 'node:fs';
import { Game } from '../src/game/engine/sim.js';
import { K } from '../src/game/engine/defs.js';

import { buildDemoCity } from './demoCity.mjs';

let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.error('ÉCHEC :', msg); } else console.log('ok :', msg); };


const g = buildDemoCity(new Game(-1, 42));
ok(g.count(K.House) > 80, `ville construite (${g.count(K.House)} logements)`);
for (let m = 0; m < 180; m++) { g.tick(); if (g.Req.Active) g.sendRequest(); }
const lv = {};
for (const h of g.Buildings.values()) if (h.Kind === K.House) lv[h.Level] = (lv[h.Level] || 0) + 1;
console.log(`an ${g.year()} pop=${g.population()} $=${g.Money} cult=${g.Culture.toFixed(0)} pros=${g.Prosper.toFixed(0)} sec=${g.Security.toFixed(0)} fav=${g.Favor.toFixed(0)}`, lv);
ok(g.population() > 800, `la ville grandit (${g.population()} hab.)`);
ok(g.Money > 0, 'trésor positif');

// aller-retour de sauvegarde
const json = JSON.stringify(g);
const g2 = Game.fromJSON(JSON.parse(json));
ok(g2.population() === g.population() && g2.Buildings.size === g.Buildings.size && g2.Month === g.Month, 'sauvegarde rechargée à l’identique');
g2.tick();
ok(g2.Month === g.Month + 1, 'la partie rechargée continue');

// verrous de la campagne
const t = new Game(0, 3);
ok(t.maxReachable() === 4, 'Tarraco : logement max Grande insula');
ok(t.canPlace(K.Barracks, 20, t.EntryY + 2)[1] !== '', 'Tarraco : caserne verrouillée');

// sauvegarde produite par l'exe (Go v2)
const exeSave = process.env.EXE_SAVE;
if (exeSave && existsSync(exeSave)) {
  const ge = Game.fromJSON(JSON.parse(readFileSync(exeSave, 'utf8')));
  ok(ge.Buildings.size > 10 && ge.at(ge.EntryX, ge.EntryY)?.Kind === K.Road, `sauvegarde de l'exe chargée (${ge.Buildings.size} bâtiments, an ${ge.year()}, ${ge.scen().name})`);
  for (let i = 0; i < 12; i++) ge.tick();
  ok(true, `sauvegarde de l'exe jouable (pop ${ge.population()})`);
}
if (fails) { console.error(`${fails} échec(s)`); process.exit(1); }
console.log('Tous les tests passent.');
