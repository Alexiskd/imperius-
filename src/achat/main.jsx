// Page de retour de Stripe : fait vérifier le paiement par le serveur (qui pose le cookie d'achat) puis mène au jeu.
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { takePurchaseReturn } from '../paywall/purchase.js';
import { capturePurchase } from '../paywall/api.js';
import { money } from '../config.js';
import '../home/site.css';

// Lecture unique du retour, avant le premier rendu (l'adresse est nettoyée aussitôt).
const back = takePurchaseReturn();

function Achat() {
  const [state, setState] = useState(back && back.kind === 'paid' ? 'checking' : back && back.kind === 'invalid' ? 'invalid' : 'none');
  const [detail, setDetail] = useState('');

  // Paiement annoncé : vérification auprès du serveur (et de Stripe), une seule fois.
  useEffect(() => {
    if (state !== 'checking') return;
    capturePurchase(back.id).then(
      (r) => { setDetail(r.amount ? money(r.amount) : ''); setState('ok'); },
      (e) => { setDetail(e.message); setState('error'); },
    );
  }, [state]);

  // Achat confirmé : ouverture du jeu après un court remerciement.
  useEffect(() => {
    if (state !== 'ok') return undefined;
    const t = setTimeout(() => window.location.replace('./jeu.html'), 2200);
    return () => clearTimeout(t);
  }, [state]);

  const content = {
    checking: ['Vérification du paiement…', 'Confirmation auprès de Stripe, un instant.', 'info'],
    ok: ['Merci pour votre achat !', `Paiement${detail ? ` de ${detail}` : ''} confirmé. Le jeu est débloqué sur ce navigateur ; ouverture d’Imperium Urbis…`, 'success'],
    error: ['Paiement non confirmé', `${detail} Si vous avez été débité, contactez-nous avec votre reçu Stripe.`, 'error'],
    invalid: ['Retour de paiement invalide', 'L’adresse de retour de Stripe est incomplète. Si vous avez payé, contactez-nous avec votre reçu Stripe.', 'error'],
    none: ['Aucun achat en cours', 'Cette page reçoit le retour du paiement Stripe.', 'info'],
  }[state];

  return (
    <main className="achat">
      <div className="achat-card">
        <p className="kicker">Imperium Urbis</p>
        <h1>{content[0]}</h1>
        <div className={`pw-alert ${content[2]}`}>{content[1]}</div>
        {state === 'ok' && <div className="achat-bar"><span /></div>}
        <div className="achat-actions">
          {state === 'ok' && <a className="btn primary" href="./jeu.html">Jouer maintenant</a>}
          {state !== 'ok' && state !== 'checking' && <a className="btn primary" href="./index.html#acheter">Retour à l’achat</a>}
          <a className="btn ghost" href="./index.html">Accueil</a>
        </div>
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<StrictMode><Achat /></StrictMode>);
