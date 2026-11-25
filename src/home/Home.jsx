// Page d'accueil : vidéo de présentation en motion design, présentation du jeu, prix et achat (paywall Stripe).
import { useCallback, useEffect, useState } from 'react';
import { Paywall } from '../paywall/Paywall.jsx';
import { usePurchaseConfig } from '../paywall/api.js';
import { takePurchaseReturn } from '../paywall/purchase.js';
import { money } from '../config.js';
import { SCENARIOS } from '../game/engine/defs.js';
import { LangSelect } from '../i18n/index.js';
import { MentionsLegales } from '../legal/MentionsLegales.jsx';
import { FAQ, GENRE } from './referencement.js';

const FEATURES = [
  ['Une cité en 3D', 'Routes, quartiers, aqueducs, forum et temples : votre ville se construit sous vos yeux, case après case, dans une vue 3D orientable.'],
  ['7 niveaux de logement', 'De la tente à la villa : eau, vivres variés, temple, école, thermes et prestige font monter vos quartiers en gamme.'],
  ['12 marchandises', 'Blé, olives, vin, argile, bois, marbre… Fermes, ateliers, greniers et entrepôts forment de vraies chaînes de production.'],
  ['Rome vous observe', 'Requêtes de César, cadeaux, fêtes publiques : gardez la faveur de l’Empereur ou soyez relevé de vos fonctions.'],
  ['Dangers et défense', 'Incendies, effondrements, épidémies, raids barbares : préfectures, ingénieurs, médecins, casernes et tours veillent.'],
  ['Sauvegardes partagées', 'Sauvegarde automatique dans le navigateur, export et import compatibles avec la version Windows (ImperiumUrbis.exe).'],
];


// Retour d'un paiement abandonné chez Stripe (index.html?achat=annule#acheter), lu une seule fois.
const back = takePurchaseReturn();

export default function Home() {
  const [pay, setPay] = useState(false);
  // Fenêtre des mentions légales (contient l'easter egg « start »).
  const [legal, setLegal] = useState(false);
  const [notice] = useState(back && back.kind === 'cancelled' ? 'Paiement annulé : rien n’a été prélevé.' : '');
  // Configuration de la vente (prix, ouverture, achat déjà fait), rechargée à la fermeture de la fenêtre d'achat.
  const { config, reload } = usePurchaseConfig();
  const owned = Boolean(config?.owned);
  const price = config?.price;

  // #acheter dans l'adresse (renvoi depuis jeu.html sans achat, ou paiement abandonné) : ouvre la fenêtre d'achat.
  useEffect(() => {
    const check = () => { if (window.location.hash === '#acheter') setPay(true); };
    check();
    window.addEventListener('hashchange', check);
    return () => window.removeEventListener('hashchange', check);
  }, []);

  // #mentions-legales dans l'adresse : ouvre la fenêtre des mentions légales.
  useEffect(() => {
    const check = () => { if (window.location.hash === '#mentions-legales') setLegal(true); };
    check();
    window.addEventListener('hashchange', check);
    return () => window.removeEventListener('hashchange', check);
  }, []);
  const closeLegal = useCallback(() => {
    setLegal(false);
    if (window.location.hash === '#mentions-legales') window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }, []);

  const close = useCallback(() => {
    setPay(false);
    reload();
    if (window.location.hash === '#acheter') window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }, [reload]);

  const Cta = ({ big }) => (owned
    ? <a className={`btn primary ${big ? 'big' : ''}`} href="./jeu.html">Jouer</a>
    : <button type="button" className={`btn primary ${big ? 'big' : ''}`} onClick={() => setPay(true)}>Acheter le jeu{price ? ` · ${money(price)}` : ''}</button>);

  return (
    <>
      <header className="nav">
        <a className="brand" href="./index.html"><span className="laurel" aria-hidden="true">❦</span>Imperium Urbis</a>
        <nav>
          <a href="#jeu">Le jeu</a>
          <a href="#provinces">Campagne</a>
          <a href="#genre">Genre</a>
          <a href="#prix">Prix</a>
          <a href="#faq">FAQ</a>
        </nav>
        <LangSelect className="nav-lang" />
        <Cta />
      </header>

      <main>
        <section className="hero">
          <div className="hero-text">
            <p className="kicker">Jeu de construction de ville en ligne · Rome antique</p>
            <h1>Fondez une cité.<br /><em>Gouvernez une province.</em></h1>
            <p className="lead">Un city-builder 3D jouable dans le navigateur, sans téléchargement. Tracez les routes, nourrissez le peuple, honorez les dieux et satisfaites César. Quatre provinces de l’Empire attendent leur gouverneur.</p>
            <div className="hero-actions">
              <Cta big />
              <a className="btn ghost big" href="#jeu">Découvrir</a>
            </div>
            <p className="small muted">{owned ? 'Le jeu est débloqué sur ce navigateur.' : 'Paiement unique · sans abonnement · jouable dans le navigateur'}</p>
          </div>
          <figure className="hero-video">
            <video src="./video/presentation.mp4" poster="./video/poster.jpg" autoPlay muted loop playsInline controls preload="metadata"
              aria-label="Vidéo de présentation d’Imperium Urbis" />
          </figure>
        </section>

        <section id="jeu" className="features">
          <h2 className="section-title">Tout ce qui fait une cité</h2>
          <div className="grid">
            {FEATURES.map(([t, d], i) => (
              <article key={t} className="feature">
                <span className="num">{['I', 'II', 'III', 'IV', 'V', 'VI'][i]}</span>
                <h3>{t}</h3>
                <p>{d}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="provinces" className="provinces">
          <h2 className="section-title">Une campagne en quatre provinces</h2>
          <ol>
            {SCENARIOS.map((s, i) => (
              <li key={s.name}>
                <span className="step">{i + 1}</span>
                <div>
                  <h3>{s.name} <small>{s.region}</small></h3>
                  <p>{s.brief}</p>
                  <p className="goal">Objectif : {s.goals.pop.toLocaleString('fr-FR')} habitants{s.raids ? ' · raids barbares' : ''}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="muted center">Et une partie libre, sans objectif, pour bâtir la cité de vos rêves.</p>
        </section>

        <section id="genre" className="genre">
          <h2 className="section-title">{GENRE.titre}</h2>
          {GENRE.paragraphes.map((p) => <p key={p}>{p}</p>)}
          <p className="small muted">{GENRE.marques}</p>
        </section>

        <section id="prix" className="price">
          <div className="price-card">
            <p className="kicker">Version complète</p>
            <h2>{price ? money(price) : '—'}</h2>
            <p className="muted">paiement unique</p>
            <ul>
              <li>Campagne complète (4 provinces) et partie libre</li>
              <li>40 bâtiments, 12 marchandises, 7 niveaux de logement</li>
              <li>Sauvegardes illimitées, export compatible Windows</li>
              <li>Mises à jour du jeu incluses</li>
            </ul>
            <Cta big />
            <p className="small muted">{!config || config.enabled || owned ? 'Paiement sécurisé par Stripe.' : 'Les ventes ouvriront bientôt.'}</p>
            <p className="small muted data-note">Toutes les données de sauvegarde de partie sont utilisées à des fins d’apprentissage de modèles d’IA, dans le but d’améliorer leurs performances de représentation d’arborescences de données.</p>
          </div>
        </section>

        <section id="faq" className="faq">
          <h2 className="section-title">Questions fréquentes</h2>
          {FAQ.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </section>
      </main>

      <footer className="foot">
        <span>© {new Date().getFullYear()} Imperium Urbis</span>
        <a className="muted foot-link" href="#mentions-legales" onClick={(e) => { e.preventDefault(); setLegal(true); }}>Mentions légales</a>
        <span className="muted">React · Three.js · paiements Stripe</span>
      </footer>

      <Paywall open={pay} onClose={close} notice={notice} />
      <MentionsLegales open={legal} onClose={closeLegal} />
    </>
  );
}
