// Définitions du jeu : marchandises, bâtiments, logements, catégories de construction et campagne.
// Port fidèle de game/defs.go (version exe) : mêmes valeurs, mêmes indices, pour des sauvegardes compatibles.

// ---------- marchandises ----------

// Indices des marchandises (identiques à l'exe).
export const G = {
  Wheat: 0, Veg: 1, Fish: 2, Olives: 3, Grapes: 4, Clay: 5, Wood: 6, Marble: 7,
  Pottery: 8, Oil: 9, Furniture: 10, Wine: 11,
};
// Nombre de marchandises.
export const NUM_GOODS = 12;

// Fiche de chaque marchandise : nom, nourriture, prix d'export et d'import, produit fini, couleur d'affichage.
export const GOODS = [
  { name: 'Blé', food: true, sell: 2, buy: 4, color: '#dcbe5a' },
  { name: 'Légumes', food: true, sell: 2, buy: 4, color: '#6eaa46' },
  { name: 'Poisson', food: true, sell: 3, buy: 5, color: '#aabec8' },
  { name: 'Olives', sell: 3, buy: 5, color: '#788246' },
  { name: 'Raisin', sell: 3, buy: 5, color: '#783264' },
  { name: 'Argile', sell: 2, buy: 4, color: '#b4643c' },
  { name: 'Bois', sell: 3, buy: 5, color: '#825a32' },
  { name: 'Marbre', sell: 12, buy: 20, color: '#ebe8e1' },
  { name: 'Poterie', sell: 7, buy: 12, finish: true, color: '#c86e3c' },
  { name: 'Huile', sell: 9, buy: 15, finish: true, color: '#d2be50' },
  { name: 'Meubles', sell: 10, buy: 17, finish: true, color: '#96643c' },
  { name: 'Vin', sell: 11, buy: 18, finish: true, color: '#8c2846' },
];

// ---------- bâtiments ----------

// Indices des bâtiments : l'ordre est celui de l'exe (compatibilité des sauvegardes).
export const K = {
  None: 0, Road: 1, House: 2, Well: 3, Fountain: 4, Farm: 5, Workshop: 6, Market: 7, Prefecture: 8, Engineer: 9,
  Temple: 10, Theater: 11, School: 12, Baths: 13, Forum: 14, Garden: 15, Statue: 16, Rubble: 17, VegFarm: 18,
  Fishery: 19, OliveFarm: 20, Vineyard: 21, ClayPit: 22, Lumber: 23, Quarry: 24, Carpenter: 25, OilPress: 26,
  Winery: 27, Granary: 28, Warehouse: 29, TradePost: 30, Doctor: 31, Library: 32, Amphitheater: 33,
  GrandTemple: 34, Arch: 35, Barracks: 36, Tower: 37, Cypress: 38, Reservoir: 39,
};
// Nombre de types de bâtiments.
export const NUM_KINDS = 40;

// Règles de placement.
export const RULE = {
  None: 0, Fertile: 1, Shore: 2, Forest: 3, Rock: 4, River: 5, NearFountain: 6, WaterNear: 7, Reservoir: 8,
};

// d : fabrique une fiche de bâtiment avec des valeurs par défaut.
const d = (o) => ({
  W: 1, H: 1, cost: 0, marble: 0, workers: 0, radius: 0, appeal: 0, appealR: 0, upkeep: 0,
  fire: 0, collapse: 0, rule: RULE.None, out: 0, outN: 0, inp: 0, inN: 0, seasonal: false, defense: 0, ...o,
});

// Fiches des bâtiments (mêmes valeurs que l'exe).
export const DEFS = [];
DEFS[K.None] = d({ name: 'Rien' });
DEFS[K.Road] = d({ name: 'Route', cost: 4, desc: "Relie les bâtiments à l'entrée. Pont sur l'eau : 40 dn." });
DEFS[K.House] = d({ name: 'Logement', W: 2, H: 2, cost: 30, fire: 1.2, collapse: 1, desc: "Les familles s'y installent et l'améliorent selon les services et biens reçus." });
DEFS[K.Well] = d({ name: 'Puits', cost: 15, radius: 5, appeal: 0.5, appealR: 1, desc: 'Eau simple (rayon 5).' });
DEFS[K.Reservoir] = d({ name: 'Réservoir', W: 3, H: 3, cost: 220, workers: 3, appeal: 1, appealR: 2, upkeep: 2, collapse: 1, rule: RULE.Reservoir, desc: "Aqueduc : se pose à 3 cases de l'eau ou à 14 cases d'un autre réservoir. Alimente les fontaines à 12 cases." });
DEFS[K.Fountain] = d({ name: 'Fontaine', cost: 60, workers: 2, radius: 6, appeal: 2, appealR: 3, upkeep: 1, rule: RULE.River, desc: "Eau pure (rayon 6). À 10 cases d'un fleuve/lac ou 12 cases d'un réservoir." });
DEFS[K.Farm] = d({ name: 'Ferme de blé', W: 3, H: 3, cost: 70, workers: 8, appeal: -1.5, appealR: 2, upkeep: 1, fire: 1, collapse: 1, rule: RULE.Fertile, out: G.Wheat, outN: 20, seasonal: true, desc: 'Produit du blé. Terre fertile.' });
DEFS[K.VegFarm] = d({ name: 'Potager', W: 3, H: 3, cost: 70, workers: 8, appeal: -1, appealR: 2, upkeep: 1, fire: 1, collapse: 1, rule: RULE.Fertile, out: G.Veg, outN: 17, seasonal: true, desc: 'Produit des légumes. Terre fertile.' });
DEFS[K.Fishery] = d({ name: 'Pêcherie', W: 2, H: 2, cost: 90, workers: 6, appeal: -2, appealR: 2, upkeep: 1, fire: 1, collapse: 1.5, rule: RULE.Shore, out: G.Fish, outN: 13, desc: "Produit du poisson. Doit toucher l'eau." });
DEFS[K.OliveFarm] = d({ name: 'Oliveraie', W: 3, H: 3, cost: 80, workers: 7, appeal: -0.5, appealR: 2, upkeep: 1, fire: 1, collapse: 1, rule: RULE.Fertile, out: G.Olives, outN: 11, desc: 'Produit des olives. Terre fertile.' });
DEFS[K.Vineyard] = d({ name: 'Vignoble', W: 3, H: 3, cost: 90, workers: 7, upkeep: 1, fire: 1, collapse: 1, rule: RULE.Fertile, out: G.Grapes, outN: 10, seasonal: true, desc: 'Produit du raisin. Terre fertile.' });
DEFS[K.ClayPit] = d({ name: 'Argilière', W: 2, H: 2, cost: 60, workers: 6, appeal: -3, appealR: 3, upkeep: 1, collapse: 1, rule: RULE.WaterNear, out: G.Clay, outN: 11, desc: "Extrait de l'argile. Eau à 3 cases." });
DEFS[K.Lumber] = d({ name: 'Bûcherons', W: 2, H: 2, cost: 60, workers: 6, appeal: -2, appealR: 2, upkeep: 1, fire: 2, collapse: 1, rule: RULE.Forest, out: G.Wood, outN: 10, desc: 'Coupe du bois. Forêt à 2 cases.' });
DEFS[K.Quarry] = d({ name: 'Carrière de marbre', W: 2, H: 2, cost: 120, workers: 10, appeal: -5, appealR: 4, upkeep: 2, collapse: 2.5, rule: RULE.Rock, out: G.Marble, outN: 6, desc: 'Extrait du marbre pour les monuments. Rochers à 2 cases.' });
DEFS[K.Workshop] = d({ name: 'Poterie', W: 2, H: 2, cost: 90, workers: 7, appeal: -4, appealR: 3, upkeep: 1, fire: 2.5, collapse: 1.5, out: G.Pottery, outN: 10, inp: G.Clay, inN: 1, desc: "Transforme l'argile en poteries." });
DEFS[K.Carpenter] = d({ name: 'Menuiserie', W: 2, H: 2, cost: 110, workers: 8, appeal: -4, appealR: 3, upkeep: 1, fire: 3, collapse: 1.5, out: G.Furniture, outN: 7, inp: G.Wood, inN: 1, desc: 'Transforme le bois en meubles.' });
DEFS[K.OilPress] = d({ name: 'Pressoir à huile', W: 2, H: 2, cost: 110, workers: 8, appeal: -3, appealR: 3, upkeep: 1, fire: 2, collapse: 1.5, out: G.Oil, outN: 7, inp: G.Olives, inN: 1, desc: 'Transforme les olives en huile.' });
DEFS[K.Winery] = d({ name: 'Cave à vin', W: 2, H: 2, cost: 130, workers: 8, appeal: -2, appealR: 3, upkeep: 1, fire: 1.5, collapse: 1.5, out: G.Wine, outN: 7, inp: G.Grapes, inN: 1, desc: 'Transforme le raisin en vin.' });
DEFS[K.Granary] = d({ name: 'Grenier', W: 3, H: 3, cost: 140, workers: 6, appeal: -2, appealR: 2, upkeep: 1, fire: 1.5, collapse: 1.5, desc: "Stocke +1500 de nourriture. Sans grenier, la ville n'en garde que 400." });
DEFS[K.Warehouse] = d({ name: 'Entrepôt', W: 3, H: 3, cost: 120, workers: 5, appeal: -2, appealR: 2, upkeep: 1, fire: 2, collapse: 1.5, desc: 'Stocke +500 de chaque marchandise (hors nourriture). Base : 120.' });
DEFS[K.TradePost] = d({ name: 'Comptoir', W: 3, H: 3, cost: 250, workers: 8, upkeep: 2, fire: 1.5, collapse: 1, desc: "Ouvre le commerce avec l'Empire (écran Commerce). Chaque comptoir : 80 unités/mois." });
DEFS[K.Market] = d({ name: 'Marché', W: 2, H: 2, cost: 60, workers: 5, radius: 10, appeal: 1, appealR: 2, upkeep: 1, fire: 2, collapse: 1, desc: 'Distribue nourriture et marchandises aux maisons (rayon 10).' });
DEFS[K.Prefecture] = d({ name: 'Préfecture', cost: 40, workers: 4, radius: 9, upkeep: 1, desc: 'Prévient incendies et crime (rayon 9).' });
DEFS[K.Engineer] = d({ name: 'Ingénieurs', cost: 40, workers: 4, radius: 9, upkeep: 1, desc: 'Prévient les effondrements (rayon 9).' });
DEFS[K.Barracks] = d({ name: 'Caserne', W: 3, H: 3, cost: 300, workers: 12, appeal: -3, appealR: 3, upkeep: 4, fire: 1, collapse: 1, defense: 30, desc: 'Légionnaires : +30 de défense contre les raids.' });
DEFS[K.Tower] = d({ name: 'Tour de guet', cost: 80, workers: 2, appeal: -1, appealR: 1, upkeep: 1, collapse: 1, defense: 8, desc: '+8 de défense contre les raids.' });
DEFS[K.Temple] = d({ name: 'Temple', W: 2, H: 2, cost: 120, workers: 4, radius: 11, appeal: 4, appealR: 4, upkeep: 2, collapse: 1, desc: 'Religion (rayon 11).' });
DEFS[K.GrandTemple] = d({ name: 'Grand temple', W: 4, H: 4, cost: 700, marble: 40, workers: 10, radius: 22, appeal: 10, appealR: 6, upkeep: 5, collapse: 0.5, desc: 'Religion (rayon 22). +0,5 faveur/mois. Coûte du marbre.' });
DEFS[K.Theater] = d({ name: 'Théâtre', W: 3, H: 2, cost: 150, workers: 6, radius: 10, appeal: 3, appealR: 3, upkeep: 2, fire: 2, collapse: 1, desc: 'Divertissement (rayon 10).' });
DEFS[K.Amphitheater] = d({ name: 'Amphithéâtre', W: 4, H: 3, cost: 450, marble: 15, workers: 12, radius: 14, appeal: 2, appealR: 4, upkeep: 4, fire: 1, collapse: 1.5, desc: 'Jeux de gladiateurs (rayon 14). Requis pour les grandes domus.' });
DEFS[K.School] = d({ name: 'École', W: 2, H: 2, cost: 110, workers: 4, radius: 10, appeal: 1, appealR: 2, upkeep: 2, fire: 1, collapse: 1, desc: 'Éducation (rayon 10). Réduit le crime.' });
DEFS[K.Library] = d({ name: 'Bibliothèque', W: 2, H: 2, cost: 260, marble: 10, workers: 5, radius: 12, appeal: 4, appealR: 3, upkeep: 3, fire: 2, collapse: 1, desc: 'Haute éducation (rayon 12). Requise pour les villas.' });
DEFS[K.Doctor] = d({ name: 'Médecin', cost: 70, workers: 3, radius: 9, appeal: 1, appealR: 1, upkeep: 1, desc: 'Santé (rayon 9). Protège des épidémies.' });
DEFS[K.Baths] = d({ name: 'Thermes', W: 2, H: 2, cost: 140, workers: 5, radius: 10, appeal: 2, appealR: 3, upkeep: 2, collapse: 2, rule: RULE.NearFountain, desc: "Hygiène (rayon 10). À 6 cases d'une fontaine." });
DEFS[K.Forum] = d({ name: 'Forum', W: 3, H: 3, cost: 200, workers: 6, radius: 15, appeal: 3, appealR: 3, upkeep: 2, collapse: 1, desc: 'Collecte les impôts (rayon 15).' });
DEFS[K.Garden] = d({ name: 'Jardin', cost: 12, appeal: 3, appealR: 3, desc: 'Embellit le quartier.' });
DEFS[K.Cypress] = d({ name: 'Cyprès', cost: 8, appeal: 1.5, appealR: 2, desc: 'Petit embellissement.' });
DEFS[K.Statue] = d({ name: 'Statue', cost: 50, appeal: 6, appealR: 4, desc: 'Embellit fortement le quartier.' });
DEFS[K.Arch] = d({ name: 'Arc de triomphe', W: 2, H: 2, cost: 400, marble: 20, appeal: 14, appealR: 6, upkeep: 1, desc: 'Monument prestigieux : forte disésrelie, +3 faveur à la construction.' });
DEFS[K.Rubble] = d({ name: 'Ruines', appeal: -3, appealR: 2, desc: 'À déblayer.' });

// Vrai si le bâtiment produit une marchandise.
export const isProducer = (k) => DEFS[k].outN > 0;
// Vrai si le bâtiment transforme une matière première.
export const isProcessor = (k) => DEFS[k].inN > 0;

// ---------- logements ----------

// Niveau maximal d'un logement.
export const MAX_LEVEL = 7;
// Noms des niveaux de logement.
export const HOUSE_NAMES = ['', 'Tente', 'Hutte', 'Insula', 'Grande insula', 'Domus', 'Grande domus', 'Villa'];
// Capacité d'accueil par niveau.
export const HOUSE_CAP = [0, 6, 12, 20, 30, 38, 46, 54];
// Niveau à partir duquel chaque bien fini est consommé.
export const GOOD_NEED_LEVEL = { [G.Pottery]: 3, [G.Oil]: 4, [G.Furniture]: 5, [G.Wine]: 6 };

// ---------- catégories de construction ----------

// K.None dans une liste = outil « Déblayer ».
export const CATEGORIES = [
  { name: 'Base', kinds: [K.Road, K.None, K.House, K.Well, K.Fountain, K.Reservoir, K.Prefecture, K.Engineer, K.Barracks, K.Tower] },
  { name: 'Vivres', kinds: [K.Farm, K.VegFarm, K.Fishery, K.Granary, K.Market] },
  { name: 'Industrie', kinds: [K.ClayPit, K.Lumber, K.Quarry, K.OliveFarm, K.Vineyard, K.Workshop, K.Carpenter, K.OilPress, K.Winery, K.Warehouse, K.TradePost] },
  { name: 'Services', kinds: [K.Temple, K.GrandTemple, K.Theater, K.Amphitheater, K.School, K.Library, K.Doctor, K.Baths, K.Forum] },
  { name: 'Décor', kinds: [K.Garden, K.Cypress, K.Statue, K.Arch] },
];

// ---------- campagne ----------

// Les quatre provinces de la campagne.
export const SCENARIOS = [
  {
    name: 'Tarraco', region: 'Hispanie', money: 5000,
    brief: "Une colonie modeste sur la côte d'Hispanie. Bâtissez des logements, nourrissez la population, lancez la poterie et l'huile d'olive. Les barbares sont loin : concentrez-vous sur la croissance.",
    goals: { pop: 500, culture: 25, prosper: 25, security: 40, favor: 50 },
    locked: [K.Lumber, K.Carpenter, K.Vineyard, K.Winery, K.Quarry, K.Library, K.Amphitheater, K.GrandTemple, K.Arch, K.Barracks, K.Tower, K.Doctor],
    river: 0.62, forest: 0.68, rocks: 0.8, fertile: 0.70, raids: false, raidMult: 0,
  },
  {
    name: 'Narbo Martius', region: 'Gaule narbonnaise', money: 6500,
    brief: 'Les forêts de Gaule fournissent le bois des meubles. Des tribus rôdent aux frontières : une caserne et quelques tours ne seront pas de trop. Visez les domus.',
    goals: { pop: 1200, culture: 40, prosper: 40, security: 45, favor: 55 },
    locked: [K.Vineyard, K.Winery, K.Quarry, K.Library, K.Amphitheater, K.GrandTemple, K.Arch],
    raids: true, raidMult: 0.8, river: 0.55, forest: 0.60, rocks: 0.82, fertile: 0.72,
  },
  {
    name: 'Lepcis Magna', region: 'Afrique proconsulaire', money: 8000,
    brief: 'Le grenier de Rome. Vignes, marbre et jeux du cirque : offrez à vos citoyens les grandes domus. Les raids des nomades seront plus durs.',
    goals: { pop: 2000, culture: 50, prosper: 50, security: 50, favor: 60 },
    locked: [K.Library], raids: true, raidMult: 1.0, river: 0.70, forest: 0.74, rocks: 0.74, fertile: 0.66,
  },
  {
    name: 'Capua', region: 'Italie', money: 10000,
    brief: "Au cœur de l'Italie, l'Empereur attend une cité digne de Rome : villas, grand temple et arcs de triomphe. Tout est débloqué. Les ennemis de Rome ne vous laisseront pas en paix.",
    goals: { pop: 3200, culture: 60, prosper: 60, security: 55, favor: 65 },
    locked: [], raids: true, raidMult: 1.25, river: 0.60, forest: 0.66, rocks: 0.76, fertile: 0.68,
  },
];

// Partie libre (index -1).
export const FREE_PLAY = {
  name: 'Province libre', region: 'Partie libre', money: 15000,
  brief: 'Aucune contrainte : tous les bâtiments sont disponibles. Les objectifs sont indicatifs.',
  goals: { pop: 4000, culture: 65, prosper: 65, security: 60, favor: 70 },
  locked: [], raids: true, raidMult: 1.0, river: 0.62, forest: 0.68, rocks: 0.78, fertile: 0.70,
};

// Noms des mois.
export const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
// Côtés d'arrivée des raids.
export const RAID_SIDES = ["l'Est", 'le Nord', 'le Sud'];
// Noms des priorités d'embauche.
export const PRIO_NAMES = ['Sécurité', 'Vivres et eau', 'Services', 'Industrie'];
