// Achat du jeu, tout en statique : le paiement se fait sur la page Stripe (Payment Link), qui renvoie vers
// `achat.html?achat=merci&session_id=cs_…` (payé). Le retour est lu une seule fois, l'adresse est nettoyée,
// et l'achat est enregistré dans un cookie ; jeu.html n'ouvre le jeu que si ce cookie est présent.
import { PAYMENT_LINK, FREE_ACCESS } from '../config.js';

// Nom du cookie d'achat.
export const COOKIE = 'imperium_achat';
// Durée du cookie : 400 jours (plafond des navigateurs), prolongée à chaque ouverture du jeu.
const MAX_AGE = 400 * 24 * 3600;
// Clé de stockage de session : achat en cours (passage chez Stripe).
const PENDING_KEY = 'imperium.achat.encours';
// Forme d'un identifiant de session Stripe : « cs_test_ » ou « cs_live_ », puis 8 à 250 lettres ou chiffres.
export const SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]{8,250}$/;

/** Lit le cookie d'achat : l'identifiant de session Stripe, ou null. */
export function readPurchase(cookies = typeof document !== 'undefined' ? document.cookie : '') {
  // Cherche « imperium_achat=… » parmi les cookies.
  const m = cookies.split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`));
  // Valeur décodée, gardée seulement si elle a la forme d'une session Stripe.
  const v = m ? decodeURIComponent(m.slice(COOKIE.length + 1)) : '';
  return SESSION_ID.test(v) ? v : null;
}

/** Vrai si le jeu a été acheté sur ce navigateur (ou si l'accès libre de développement est activé). */
export function hasPurchase() {
  return FREE_ACCESS || Boolean(readPurchase());
}

/** Enregistre l'achat dans le cookie (400 jours, tout le site, Secure en HTTPS). */
export function savePurchase(id) {
  // Refuse un identifiant mal formé.
  if (!SESSION_ID.test(id)) return false;
  // Secure seulement en HTTPS (le navigateur le refuserait en HTTP hors localhost).
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE}=${encodeURIComponent(id)}; Max-Age=${MAX_AGE}; Path=/; SameSite=Lax${secure}`;
  // Vérifie que le cookie a bien été gardé (cookies bloqués sinon).
  return readPurchase() === id;
}

/** Oublie l'achat (bouton « Effacer l'achat de ce navigateur »). */
export function forgetPurchase() {
  document.cookie = `${COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
}

/** Note qu'un paiement est en cours, avant de partir chez Stripe. */
export function rememberCheckout() {
  try { sessionStorage.setItem(PENDING_KEY, String(Date.now())); } catch { /* stockage indisponible : sans conséquence */ }
}

/** Lit l'adresse de retour : { kind: 'paid', id } | { kind: 'cancelled' } | { kind: 'invalid' } | null. */
export function parsePurchaseReturn(search) {
  const qs = new URLSearchParams(search);
  const achat = qs.get('achat');
  // « merci » : paiement réussi, avec l'identifiant de session fourni par Stripe.
  if (achat === 'merci') {
    const id = qs.get('session_id');
    return id && SESSION_ID.test(id) ? { kind: 'paid', id } : { kind: 'invalid' };
  }
  // « annule » : paiement abandonné.
  if (achat === 'annule') return { kind: 'cancelled' };
  return null;
}

/** Lit le retour une seule fois, puis retire `achat` et `session_id` de l'adresse affichée. */
export function takePurchaseReturn() {
  const r = parsePurchaseReturn(window.location.search);
  if (!r) return null;
  const qs = new URLSearchParams(window.location.search);
  qs.delete('achat'); qs.delete('session_id');
  const rest = qs.toString();
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`);
  try { sessionStorage.removeItem(PENDING_KEY); } catch { /* rien */ }
  return r;
}

/** Ouvre la page de paiement Stripe (Payment Link). */
export function startCheckout() {
  if (!PAYMENT_LINK) return false;
  rememberCheckout();
  window.location.assign(PAYMENT_LINK);
  return true;
}
