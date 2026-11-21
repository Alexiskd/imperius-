// Fenêtre d'achat du jeu, sur le modèle de la fenêtre de dons de GobaiWebService :
// configuration chargée depuis le serveur, commande Stripe Checkout créée par l'API (clé secrète côté serveur),
// paiement sur la page sécurisée de Stripe, puis retour (achat.html si payé, ici si abandonné).
import { useCallback, useEffect, useRef, useState } from 'react';
import { money } from '../config.js';
import { createPurchaseOrder, usePurchaseConfig } from './api.js';
import { rememberPurchase } from './purchase.js';
import './paywall.css';

export function Paywall({ open, onClose, notice: initialNotice = '' }) {
  // Configuration de la vente (prix, ouverture, mode test, achat déjà fait).
  const { config, loadError } = usePurchaseConfig(open);
  // État : paiement en cours d'ouverture.
  const [busy, setBusy] = useState(false);
  // État : message d'information (par exemple « paiement annulé »).
  const [notice, setNotice] = useState(initialNotice);
  // État : message d'erreur.
  const [error, setError] = useState('');
  // Référence : le composant est-il encore monté.
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  // À l'ouverture : remet les messages à zéro ; Échap ferme ; retour arrière depuis Stripe libère le bouton.
  useEffect(() => {
    if (!open) return undefined;
    setBusy(false); setError(''); setNotice(initialNotice);
    const key = (e) => { if (e.key === 'Escape') onClose(); };
    const show = (e) => { if (e.persisted) setBusy(false); };
    window.addEventListener('keydown', key);
    window.addEventListener('pageshow', show);
    return () => { window.removeEventListener('keydown', key); window.removeEventListener('pageshow', show); };
  }, [open, onClose, initialNotice]);

  // buy : crée la commande auprès du serveur puis ouvre la page de paiement Stripe.
  const buy = useCallback(async () => {
    setError(''); setNotice(''); setBusy(true);
    try {
      const { id, url } = await createPurchaseOrder();
      rememberPurchase(id);
      window.location.assign(url); // page de paiement hébergée par Stripe ; retour ici ensuite
    } catch (e) {
      if (alive.current) { setError(e.message); setBusy(false); }
    }
  }, []);

  if (!open) return null;

  return (
    <div className="pw-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pw-dialog" role="dialog" aria-modal="true" aria-labelledby="pw-title">
        {/* En-tête : sur-titre, titre, pastille « Mode test », fermeture. */}
        <header className="pw-head">
          <div className="pw-titles">
            <span className="pw-kicker">Acheter le jeu</span>
            <div className="pw-titleline">
              <h2 id="pw-title">Imperium Urbis — version complète</h2>
              {config?.environment === 'test' && config.enabled && <span className="pw-chip">Mode test</span>}
            </div>
          </div>
          <button type="button" className="pw-close" onClick={onClose} aria-label="Fermer">×</button>
        </header>

        <div className="pw-content">
          {/* Roue d'attente, tant que la configuration n'est pas arrivée. */}
          {!config && !loadError && <div className="pw-wait"><span className="pw-spin big" aria-label="Chargement" /></div>}
          {/* Erreur de chargement. */}
          {loadError && <div className="pw-alert error">Impossible de charger la boutique : {loadError}</div>}

          {config && (
            <>
              <p className="pw-text">
                Un seul paiement, sans abonnement ni publicité : la campagne des 4 provinces, la partie libre,
                les sauvegardes et l’import des parties de la version Windows. Le jeu tourne dans votre navigateur.
              </p>
              {notice && <div className="pw-alert info">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Fermer le message">×</button></div>}
              {error && <div className="pw-alert error">{error}<button type="button" onClick={() => setError('')} aria-label="Fermer le message">×</button></div>}

              {config.owned ? (
                <>
                  <div className="pw-alert success">Le jeu est déjà débloqué sur ce navigateur.</div>
                  <a className="pw-btn" href="./jeu.html">Jouer maintenant</a>
                </>
              ) : !config.enabled ? (
                <div className="pw-alert info">Les ventes ne sont pas encore ouvertes.</div>
              ) : (
                <>
                  <div className="pw-price"><strong>{money(config.price)}</strong><span>paiement unique · TVA incluse</span></div>
                  <button type="button" className="pw-btn" disabled={busy} onClick={buy}>
                    {busy && <span className="pw-spin" aria-hidden="true" />}
                    {busy ? 'Ouverture du paiement…' : `Acheter ${money(config.price)} par carte bancaire`}
                  </button>
                  <p className="pw-caption">
                    Paiement par carte bancaire sur la page sécurisée de Stripe, puis retour ici et ouverture du jeu.
                    Imperium Urbis ne voit jamais vos coordonnées bancaires.
                  </p>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
