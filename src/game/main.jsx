// Entrée de jeu.html : n'ouvre le jeu que si l'achat est enregistré dans le cookie, sinon retour à l'accueil.
import { createRoot } from 'react-dom/client';
import { hasPurchase, readPurchase, savePurchase } from '../paywall/purchase.js';
import GameApp from './GameApp.jsx';
import './game.css';

if (!hasPurchase()) {
  window.location.replace('./index.html#acheter');
} else {
  // Prolonge le cookie d'achat à chaque partie (les navigateurs plafonnent sa durée à 400 jours).
  const id = readPurchase();
  if (id) savePurchase(id);
  // Sans StrictMode : un seul contexte WebGL par canvas.
  createRoot(document.getElementById('root')).render(<GameApp />);
}
