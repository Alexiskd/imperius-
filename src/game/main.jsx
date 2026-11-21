// Entrée de jeu.html. Le serveur ne sert cette page qu'avec un cookie d'achat valide ;
// la configuration est revérifiée ici (utile en développement), sinon retour à l'accueil.
import { createRoot } from 'react-dom/client';
import { fetchPurchaseConfig } from '../paywall/api.js';
import { FREE_ACCESS, TRANSLATE_EMAIL } from '../config.js';
import { startTranslation } from '../i18n/index.js';
import GameApp from './GameApp.jsx';
import './game.css';

startTranslation({ email: TRANSLATE_EMAIL });
const start = () => createRoot(document.getElementById('root')).render(<GameApp />); // sans StrictMode : un seul contexte WebGL
if (FREE_ACCESS) start();
else {
  fetchPurchaseConfig().then(
    (c) => (c.owned ? start() : window.location.replace('./index.html#acheter')),
    () => window.location.replace('./index.html#acheter'),
  );
}
