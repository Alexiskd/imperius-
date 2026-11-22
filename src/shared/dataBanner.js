// Bandeau d'information « données utilisées pour l'entraînement d'IA » : affiché tout en haut de chaque page
// (accueil, achat, jeu), sur toute la largeur, sans bouton de fermeture.
// Il est fixé au-dessus de tout (position: fixed) ; sa hauteur réelle est publiée dans la variable CSS --db-h
// pour que la page (barre de navigation, jeu plein écran, sélecteur de langue) se décale en dessous.
// À appeler après startTranslation() : le moteur de traduction traduit alors aussi ce bandeau.
import './dataBanner.css';

export const DATA_BANNER_TEXT = 'Information importante : toutes les données de sauvegarde de partie sont utilisées à des fins d’entraînement de modèles d’IA, pour la création et l’amélioration d’une autre application : Gobaispace.com.';

export function mountDataBanner() {
  if (typeof document === 'undefined' || document.getElementById('data-banner')) return null;
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

  bar.append(icon, text, more);
  document.body.prepend(bar);

  // Hauteur réelle (le texte passe sur plusieurs lignes sur téléphone) -> --db-h.
  const publish = () => document.documentElement.style.setProperty('--db-h', `${bar.offsetHeight}px`);
  publish();
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(publish).observe(bar);
  else window.addEventListener('resize', publish);
  return bar;
}
