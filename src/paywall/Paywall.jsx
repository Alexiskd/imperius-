// Fenêtre d'achat du jeu, sur le modèle de la fenêtre de dons de GobaiWebService :
// sur-titre, titre, pastille « Mode test », texte, bouton « par carte bancaire », mention Stripe,
// et message « pas encore ouvertes » tant que le lien de paiement n'est pas configuré.
import { useEffect, useRef, useState } from 'react';
import { PAYMENT_LINK, PRICE, TEST_MODE, money } from '../config.js';
import { hasPurchase, startCheckout } from './purchase.js';
import './paywall.css';

export function Paywall({ open, onClose, notice: initialNotice = '' }) {
  // État : paiement en cours d'ouverture.
  const [busy, setBusy] = useState(false);
  // État : message d'information (par exemple « paiement annulé »).
  const [notice, setNotice] = useState(initialNotice);
  // État : message d'erreur.
  const [error, setError] = useState('');
  // Référence : bouton principal, pour lui donner le focus à l'ouverture.
  const mainBtn = useRef(null);
  // Le jeu est-il déjà acheté sur ce navigateur ?
  const owned = hasPurchase();

  // À l'ouverture : remet les messages à zéro et place le focus ; Échap ferme.
  useEffect(() => {
    if (!open) return undefined;
    setBusy(false); setError(''); setNotice(initialNotice);
    const t = setTimeout(() => mainBtn.current && mainBtn.current.focus(), 30);
    const key = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    // Au retour arrière depuis Stripe (cache de page), libère le bouton.
    const show = (e) => { if (e.persisted) setBusy(false); };
    window.addEventListener('pageshow', show);
    return () => { clearTimeout(t); window.removeEventListener('keydown', key); window.removeEventListener('pageshow', show); };
  }, [open, onClose, initialNotice]);

  if (!open) return null;

  // buy : ouvre la page de paiement sécurisée de Stripe.
  const buy = () => {
    setError(''); setNotice('');
    setBusy(true);
    if (!startCheckout()) { setBusy(false); setError('Le paiement n’est pas configuré.'); }
  };

  return (
    <div className="pw-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pw-dialog" role="dialog" aria-modal="true" aria-labelledby="pw-title">
        {/* En-tête : sur-titre, titre, pastille « Mode test », fermeture. */}
        <header className="pw-head">
          <div className="pw-titles">
            <span className="pw-kicker">Acheter le jeu</span>
            <div className="pw-titleline">
              <h2 id="pw-title">Imperium Urbis — version complète</h2>
              {TEST_MODE && <span className="pw-chip">Mode test</span>}
            </div>
          </div>
          <button type="button" className="pw-close" onClick={onClose} aria-label="Fermer">×</button>
        </header>

        <div className="pw-content">
          {/* Texte de présentation. */}
          <p className="pw-text">
            Un seul paiement, sans abonnement ni publicité : la campagne des 4 provinces, la partie libre,
            les sauvegardes et l’import des parties de la version Windows. Le jeu tourne dans votre navigateur.
          </p>

          {/* Déjà acheté sur ce navigateur. */}
          {owned && <div className="pw-alert success">Le jeu est déjà débloqué sur ce navigateur.</div>}
          {/* Information refermable. */}
          {notice && <div className="pw-alert info">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Fermer le message">×</button></div>}
          {/* Erreur refermable. */}
          {error && <div className="pw-alert error">{error}<button type="button" onClick={() => setError('')} aria-label="Fermer le message">×</button></div>}

          {owned ? (
            <a ref={mainBtn} className="pw-btn" href="./jeu.html">Jouer maintenant</a>
          ) : !PAYMENT_LINK ? (
            /* Lien de paiement non configuré : ventes pas encore ouvertes. */
            <div className="pw-alert info">Les ventes ne sont pas encore ouvertes.</div>
          ) : (
            <>
              {/* Prix. */}
              <div className="pw-price"><strong>{money(PRICE)}</strong><span>paiement unique · TVA incluse</span></div>
              {/* Bouton d'achat. */}
              <button ref={mainBtn} type="button" className="pw-btn" disabled={busy} onClick={buy}>
                {busy && <span className="pw-spin" aria-hidden="true" />}
                {busy ? 'Ouverture du paiement…' : `Acheter ${money(PRICE)} par carte bancaire`}
              </button>
              {/* Mention sur le paiement. */}
              <p className="pw-caption">
                Paiement par carte bancaire sur la page sécurisée de Stripe, puis retour ici et ouverture du jeu.
                Imperium Urbis ne voit jamais vos coordonnées bancaires. L’achat est mémorisé par un cookie sur ce navigateur.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
