// Sauvegardes du jeu dans le navigateur (localStorage) et export/import de fichiers.
// Le format JSON est celui de l'exe : une sauvegarde exportée s'ouvre dans ImperiumUrbis.exe et inversement.
import { Game } from './engine/sim.js';

// Enregistre la partie sous une clé (navigateur), et envoie une copie .txt dans la base BP ; renvoie vrai si c'est réussi.
export function saveGame(key, game) {
  const contenu = JSON.stringify(game);
  envoyerSauvegarde(key, contenu);
  try { localStorage.setItem(key, contenu); return true; } catch { return false; }
}

// Envoie la sauvegarde au serveur, qui l'enregistre en fichier texte dans BP (sans bloquer le jeu ;
// un échec — hors ligne, base non configurée — n'empêche pas la sauvegarde dans le navigateur).
export function envoyerSauvegarde(emplacement, contenu) {
  if (typeof fetch !== 'function') return Promise.resolve(null);
  return fetch('./api/sauvegardes', {
    method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emplacement, contenu }),
  }).then((r) => (r.ok ? r.json() : null), () => null);
}

// Liste des sauvegardes du joueur dans BP : [{ id, nom, emplacement, taille, cree_le }] (vide si indisponible).
export async function listerSauvegardesBP() {
  try {
    const r = await fetch('./api/sauvegardes', { credentials: 'same-origin' });
    return r.ok ? (await r.json()).sauvegardes : [];
  } catch { return []; }
}

// Recharge une sauvegarde de BP (fichier .txt), ou null.
export async function chargerSauvegardeBP(id) {
  try {
    const r = await fetch(`./api/sauvegardes/${id}.txt`, { credentials: 'same-origin' });
    return r.ok ? Game.fromJSON(JSON.parse(await r.text())) : null;
  } catch { return null; }
}

// Vrai si une sauvegarde existe sous cette clé.
export function hasSave(key) {
  try { return Boolean(localStorage.getItem(key)); } catch { return false; }
}

// Recharge une partie, ou null.
export function loadGame(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? Game.fromJSON(JSON.parse(raw)) : null;
  } catch { return null; }
}

// Progression de la campagne : province la plus avancée débloquée et meilleures années.
export function loadProgress() {
  try {
    const p = JSON.parse(localStorage.getItem('imperium.campagne') || '{}');
    return { Unlocked: p.Unlocked || 0, Best: p.Best || {} };
  } catch { return { Unlocked: 0, Best: {} }; }
}
export function saveProgress(p) {
  try { localStorage.setItem('imperium.campagne', JSON.stringify(p)); } catch { /* stockage indisponible */ }
}

// Télécharge la partie en fichier imperium_save.json.
export function exportSave(game) {
  const contenu = JSON.stringify(game);
  envoyerSauvegarde('export', contenu);
  const blob = new Blob([contenu], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'imperium_save.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
