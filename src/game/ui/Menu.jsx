// Menu principal : campagne, partie libre, sauvegardes, import d'une sauvegarde de l'exe.
import { useEffect, useRef, useState } from 'react';
import { SCENARIOS } from '../engine/defs.js';
import { hasSave, listerSauvegardesBP } from '../saves.js';
import { LangSelect } from '../../i18n/index.js';

export function Menu({ progress, actions, canResume }) {
  const [view, setView] = useState('main');
  const fileRef = useRef(null);
  const saved = hasSave('imperium.save');
  const auto = hasSave('imperium.autosave');
  // Sauvegardes enregistrées dans la base BP (fichiers .txt), chargées à l'ouverture de leur vue.
  const [cloud, setCloud] = useState(null);
  useEffect(() => { if (view === 'cloud') { setCloud(null); listerSauvegardesBP().then(setCloud); } }, [view]);
  const date = (d) => new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

  return (
    <div className="iu-menu">
      <div className="iu-menu-card">
        <p className="kicker">Bâtisseur de cités romaines</p>
        <h1>Imperium Urbis</h1>
        {view === 'main' && (
          <nav className="iu-menu-list">
            {canResume && <button type="button" className="iu-btn big primary" onClick={actions.resume}>Reprendre la partie</button>}
            <button type="button" className="iu-btn big" onClick={() => setView('campaign')}>Campagne</button>
            <button type="button" className="iu-btn big" onClick={() => actions.newScenario(-1)}>Partie libre</button>
            <button type="button" className="iu-btn big" disabled={!saved} onClick={() => actions.load('imperium.save')}>Charger la partie</button>
            <button type="button" className="iu-btn big" disabled={!auto} onClick={() => actions.load('imperium.autosave')}>Sauvegarde automatique</button>
            <button type="button" className="iu-btn big" onClick={() => setView('cloud')}>Mes sauvegardes en ligne</button>
            <button type="button" className="iu-btn big" onClick={() => fileRef.current && fileRef.current.click()}>Importer une sauvegarde (.json)</button>
            <input ref={fileRef} type="file" accept=".json,application/json" hidden
              onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) actions.importFile(f); e.target.value = ''; }} />
            <a className="iu-btn big ghost" href="./index.html">Retour à l’accueil</a>
          </nav>
        )}
        {view === 'campaign' && (
          <>
            <ol className="iu-campaign">
              {SCENARIOS.map((s, i) => {
                const locked = i > progress.Unlocked;
                const best = progress.Best[s.name];
                return (
                  <li key={s.name}>
                    <button type="button" className="iu-btn big" disabled={locked} onClick={() => actions.newScenario(i)}>
                      <span className="n">{i + 1}</span>
                      <span className="grow"><b>{s.name}</b> <small>{s.region}</small></span>
                      <small className={best ? 'gold' : 'muted'}>{locked ? 'verrouillée' : best ? `gagnée en ${best} an(s)` : 'disponible'}</small>
                    </button>
                  </li>
                );
              })}
            </ol>
            <button type="button" className="iu-btn" onClick={() => setView('main')}>← Retour</button>
          </>
        )}
        {view === 'cloud' && (
          <>
            {!cloud && <p className="muted">Chargement…</p>}
            {cloud && !cloud.length && <p className="muted">Aucune sauvegarde en ligne pour l’instant : chaque sauvegarde du jeu y est copiée automatiquement.</p>}
            {cloud && cloud.length > 0 && (
              <ul className="iu-cloud">
                {cloud.map((s) => (
                  <li key={s.id}>
                    <span className="grow"><b>{s.emplacement === 'imperium.autosave' ? 'Automatique' : s.emplacement === 'export' ? 'Export' : 'Manuelle'}</b> <small className="muted">{date(s.cree_le)} · {Math.round(s.taille / 1024)} Ko</small></span>
                    <button type="button" className="iu-btn small" onClick={() => actions.loadCloud(s.id)}>Charger</button>
                    <a className="iu-btn small" href={`./api/sauvegardes/${s.id}.txt`} download={s.nom}>.txt</a>
                  </li>
                ))}
              </ul>
            )}
            <p className="muted small">Toutes les données de sauvegarde de partie sont utilisées à des fins d’apprentissage de modèles d’IA, dans le but d’améliorer leurs performances de représentation d’arborescences de données.</p>
            <button type="button" className="iu-btn" onClick={() => setView('main')}>← Retour</button>
          </>
        )}
        <LangSelect className="iu-select iu-menu-lang" />
        <p className="iu-menu-foot muted small">Les parties sont sauvegardées dans ce navigateur et copiées en ligne. Les fichiers exportés sont compatibles avec ImperiumUrbis.exe.</p>
      </div>
    </div>
  );
}
