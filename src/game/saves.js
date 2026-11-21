// Sauvegardes du jeu dans le navigateur (localStorage) et export/import de fichiers.
// Le format JSON est celui de l'exe : une sauvegarde exportée s'ouvre dans ImperiumUrbis.exe et inversement.
import { Game } from './engine/sim.js';

// Enregistre la partie sous une clé ; renvoie vrai si c'est réussi.
export function saveGame(key, game) {
  try { localStorage.setItem(key, JSON.stringify(game)); return true; } catch { return false; }
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
  const blob = new Blob([JSON.stringify(game)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'imperium_save.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
