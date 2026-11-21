// Retour de la page de paiement Stripe : `achat.html?achat=merci&session_id=cs_…` (payé)
// ou `index.html?achat=annule` (abandon). L'adresse est lue une seule fois puis nettoyée.
// L'achat lui-même est vérifié par le serveur auprès de Stripe, qui pose un cookie signé (HttpOnly).

// Clé de stockage de session : identifiant de la commande en cours (passage chez Stripe).
const STORAGE_KEY = 'imperium.achat.session';
// Forme d'un identifiant de session Stripe : « cs_test_ » ou « cs_live_ », puis 8 à 250 lettres ou chiffres.
export const SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]{8,250}$/;

/** Garde l'identifiant de la commande pendant le passage chez Stripe. */
export function rememberPurchase(id) {
  try { sessionStorage.setItem(STORAGE_KEY, id); } catch { /* stockage indisponible : sans conséquence */ }
}

function takeStored() {
  try {
    const id = sessionStorage.getItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    return id && SESSION_ID.test(id) ? id : null;
  } catch { return null; }
}

/** Lit l'adresse : { kind: 'paid', id } | { kind: 'cancelled', id } | { kind: 'invalid' } | null. */
export function parsePurchaseReturn(search, stored = null) {
  const qs = new URLSearchParams(search);
  const achat = qs.get('achat');
  if (achat === 'merci') {
    const id = qs.get('session_id');
    return id && SESSION_ID.test(id) ? { kind: 'paid', id } : { kind: 'invalid' };
  }
  if (achat === 'annule') return { kind: 'cancelled', id: stored };
  return null;
}

/** Lit le retour une seule fois, puis retire `achat` et `session_id` de l'adresse affichée. */
export function takePurchaseReturn() {
  if (typeof window === 'undefined') return null;
  const qs = new URLSearchParams(window.location.search);
  if (!qs.has('achat')) return null;
  const r = parsePurchaseReturn(window.location.search, takeStored());
  qs.delete('achat'); qs.delete('session_id');
  const rest = qs.toString();
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`);
  return r;
}
