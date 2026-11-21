// Menu principal : campagne, partie libre, sauvegardes, import d'une sauvegarde de l'exe.
import { useRef, useState } from 'react';
import { SCENARIOS } from '../engine/defs.js';
import { hasSave } from '../saves.js';
import { LangSelect } from '../../i18n/index.js';

export function Menu({ progress, actions, canResume }) {
  const [view, setView] = useState('main');
  const fileRef = useRef(null);
  const saved = hasSave('imperium.save');
  const auto = hasSave('imperium.autosave');

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
        <LangSelect className="iu-select iu-menu-lang" />
        <p className="iu-menu-foot muted small">Les parties sont sauvegardées dans ce navigateur. Les fichiers exportés sont compatibles avec ImperiumUrbis.exe.</p>
      </div>
    </div>
  );
}
