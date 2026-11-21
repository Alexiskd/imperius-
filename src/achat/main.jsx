// Page de retour de Stripe : enregistre l'achat dans un cookie puis mène au jeu.
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { takePurchaseReturn, savePurchase, hasPurchase } from '../paywall/purchase.js';
import '../home/site.css';

// Lecture unique du retour, avant le premier rendu (l'adresse est nettoyée aussitôt).
const back = takePurchaseReturn();

function Achat() {
  const [state] = useState(() => {
    if (back && back.kind === 'paid') return savePurchase(back.id) ? 'ok' : 'cookie';
    if (back && back.kind === 'cancelled') return 'cancelled';
    if (back && back.kind === 'invalid') return 'invalid';
    return hasPurchase() ? 'owned' : 'none';
  });

  // Achat enregistré : ouverture du jeu après un court remerciement.
  useEffect(() => {
    if (state !== 'ok' && state !== 'owned') return undefined;
    const t = setTimeout(() => window.location.replace('./jeu.html'), state === 'ok' ? 2200 : 600);
    return () => clearTimeout(t);
  }, [state]);

  const content = {
    ok: ['Merci pour votre achat !', 'Paiement reçu. Le jeu est débloqué sur ce navigateur ; ouverture d’Imperium Urbis…', 'success'],
    owned: ['Jeu déjà débloqué', 'Ouverture d’Imperium Urbis…', 'success'],
    cancelled: ['Paiement annulé', 'Rien n’a été prélevé. Vous pouvez reprendre l’achat quand vous voulez.', 'info'],
    invalid: ['Retour de paiement invalide', 'L’adresse de retour de Stripe est incomplète. Si vous avez payé, contactez-nous avec votre reçu Stripe.', 'error'],
    cookie: ['Cookies bloqués', 'Le paiement est reçu mais votre navigateur refuse les cookies : autorisez-les pour ce site puis rechargez cette page depuis le lien de votre reçu.', 'error'],
    none: ['Aucun achat en cours', 'Cette page reçoit le retour du paiement Stripe.', 'info'],
  }[state];

  return (
    <main className="achat">
      <div className="achat-card">
        <p className="kicker">Imperium Urbis</p>
        <h1>{content[0]}</h1>
        <div className={`pw-alert ${content[2]}`}>{content[1]}</div>
        {(state === 'ok' || state === 'owned') && <div className="achat-bar"><span /></div>}
        <div className="achat-actions">
          {(state === 'ok' || state === 'owned') && <a className="btn primary" href="./jeu.html">Jouer maintenant</a>}
          {(state === 'cancelled' || state === 'none' || state === 'invalid') && <a className="btn primary" href="./index.html#acheter">Retour à l’achat</a>}
          <a className="btn ghost" href="./index.html">Accueil</a>
        </div>
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<StrictMode><Achat /></StrictMode>);
