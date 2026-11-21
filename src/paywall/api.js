// Appels de l'API d'achat (server/index.mjs), sur le modèle de l'API des dons de GobaiWebService.
import { useCallback, useEffect, useState } from 'react';
import { FREE_ACCESS } from '../config.js';

async function call(path, options = {}) {
  const res = await fetch(`./api/achat/${path}`, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

/** Configuration de la vente : { enabled, environment, price, currency, owned }. */
export const fetchPurchaseConfig = (signal) => call('config', { signal });
/** Crée la session de paiement Stripe : { id, url }. */
export const createPurchaseOrder = () => call('commande', { method: 'POST', body: '{}' });
/** Fait vérifier le paiement par le serveur, qui pose le cookie d'achat : { ok, amount }. */
export const capturePurchase = (id) => call('capture', { method: 'POST', body: JSON.stringify({ id }) });


/** Hook : configuration de la vente (null pendant le chargement), erreur, et rechargement. */
export function usePurchaseConfig(active = true) {
  const [config, setConfig] = useState(null);
  const [loadError, setLoadError] = useState('');
  const reload = useCallback((signal) => {
    setLoadError('');
    return fetchPurchaseConfig(signal).then(
      (c) => setConfig(FREE_ACCESS ? { ...c, owned: true } : c),
      (e) => { if (e.name !== 'AbortError') setLoadError(e.message); },
    );
  }, []);
  useEffect(() => {
    if (!active) return undefined;
    const ctrl = new AbortController();
    reload(ctrl.signal);
    return () => ctrl.abort();
  }, [active, reload]);
  return { config, loadError, reload };
}
