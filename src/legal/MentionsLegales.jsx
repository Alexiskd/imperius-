// Fenêtre « Mentions légales » de l'accueil (lien du pied de page, ou #mentions-legales dans l'adresse).
// Easter egg : un minuscule bouton « start », presque invisible en bas de la fenêtre, lance le jeu sans payer.
// Il demande au serveur un accès gratuit (POST /api/achat/oeuf → cookie d'accès signé), puis ouvre jeu.html.
import { useEffect, useState } from 'react';
import { unlockEasterEgg } from '../paywall/api.js';
import '../paywall/paywall.css';
import './legal.css';

export function MentionsLegales({ open, onClose }) {
  // État : demande d'accès en cours (le bouton ne réagit qu'une fois).
  const [busy, setBusy] = useState(false);

  // Échap ferme la fenêtre.
  useEffect(() => {
    if (!open) return undefined;
    setBusy(false);
    const key = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [open, onClose]);

  // start : accès gratuit demandé au serveur, puis ouverture du jeu (même en cas d'erreur, le serveur tranchera).
  const start = async () => {
    if (busy) return;
    setBusy(true);
    try { await unlockEasterEgg(); } catch { /* sans accès, jeu.html renverra vers l'accueil */ }
    window.location.assign('./jeu.html');
  };

  if (!open) return null;
  return (
    <div className="pw-bg" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pw-dialog legal-dialog" role="dialog" aria-modal="true" aria-labelledby="legal-title">
        <div className="pw-head">
          <div className="pw-titles">
            <span className="pw-kicker">Imperium Urbis</span>
            <h2 id="legal-title" className="legal-title">Mentions légales</h2>
          </div>
          <button type="button" className="pw-close" onClick={onClose} aria-label="Fermer">×</button>
        </div>
        <div className="pw-content legal-content">
          <section>
            <h3>Éditeur du site</h3>
            <p>Alexis Bouvet-Mallet, micro-entreprise<br />Conflans-Sainte-Honorine (78700), France<br />
              Contact : <a href="mailto:alexis_bouvet@icloud.com">alexis_bouvet@icloud.com</a> · 07 81 23 60 41<br />
              Directeur de la publication : Alexis Bouvet-Mallet</p>
          </section>
          <section>
            <h3>Hébergement</h3>
            <p>Render Services, Inc., San Francisco, Californie, États-Unis — <a href="https://render.com" target="_blank" rel="noreferrer">render.com</a></p>
          </section>
          <section>
            <h3>Paiement</h3>
            <p>Les paiements sont traités par Stripe. Aucune donnée de carte bancaire n’est reçue ni conservée par ce site.</p>
          </section>
          <section>
            <h3>Cookies et données</h3>
            <p>Un cookie technique (imperium_achat), strictement nécessaire, mémorise l’accès au jeu sur votre navigateur. Toutes les données de sauvegarde de partie sont utilisées à des fins d’apprentissage de modèles d’IA, dans le but d’améliorer leurs performances de représentation d’arborescences de données.</p>
          </section>
          <section>
            <h3>Propriété intellectuelle</h3>
            <p>Le jeu Imperium Urbis, ses textes, visuels, vidéos et code sont la propriété de leur auteur. Toute reproduction sans autorisation est interdite.</p>
          </section>
          {/* Easter egg : bouton discret qui lance le jeu sans payer. */}
          <button type="button" className="legal-egg" onClick={start} disabled={busy} title="start">start</button>
        </div>
      </div>
    </div>
  );
}
