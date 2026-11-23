// Bandeau d'information « données utilisées pour l'entraînement d'IA » : affiché tout en haut de chaque page
// (accueil, achat, jeu), sur toute la largeur, avec un bouton « × » pour le fermer.
// La fermeture est mémorisée (localStorage) : le bandeau ne revient plus, sur aucune page de ce navigateur.
// Il est fixé au-dessus de tout (position: fixed) ; sa hauteur réelle est publiée dans la variable CSS --db-h
// pour que la page (barre de navigation, jeu plein écran, sélecteur de langue) se décale en dessous.
// À appeler après startTranslation() : le moteur de traduction traduit alors aussi ce bandeau.
import './dataBanner.css';

export const DATA_BANNER_TEXT = 'Information importante : toutes les données de sauvegarde de partie sont utilisées à des fins d’entraînement de modèles d’IA, pour la création et l’amélioration d’une autre application : Gobaispace.com.';

// Clé de stockage : bandeau fermé par le visiteur.
const CLOSED_KEY = 'imperium.bandeau.ferme';
const isClosed = () => { try { return localStorage.getItem(CLOSED_KEY) === '1'; } catch { return false; } };

export function mountDataBanner() {
  if (typeof document === 'undefined' || document.getElementById('data-banner') || isClosed()) return null;
  const bar = document.createElement('div');
  bar.id = 'data-banner';
  bar.className = 'data-banner';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', 'Utilisation des données');

  const icon = document.createElement('span');
  icon.className = 'data-banner-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = 'ⓘ';

  const text = document.createElement('span');
  text.className = 'data-banner-text';
  text.textContent = DATA_BANNER_TEXT;

  const more = document.createElement('a');
  more.className = 'data-banner-link';
  more.href = './index.html#faq';
  more.textContent = 'En savoir plus';

  // Bouton « × » : retire le bandeau, remet la page en haut (--db-h à 0) et mémorise la fermeture.
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'data-banner-close';
  close.setAttribute('aria-label', 'Fermer le bandeau');
  close.textContent = '×';

  bar.append(icon, text, more, close);
  document.body.prepend(bar);

  // Hauteur réelle (le texte passe sur plusieurs lignes sur téléphone) -> --db-h.
  const publish = () => document.documentElement.style.setProperty('--db-h', `${bar.offsetHeight}px`);
  publish();
  const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(publish) : null;
  if (observer) observer.observe(bar);
  else window.addEventListener('resize', publish);

  close.addEventListener('click', () => {
    if (observer) observer.disconnect();
    else window.removeEventListener('resize', publish);
    bar.remove();
    document.documentElement.style.setProperty('--db-h', '0px');
    try { localStorage.setItem(CLOSED_KEY, '1'); } catch { /* stockage indisponible : fermé pour cette page seulement */ }
  });
  return bar;
}
