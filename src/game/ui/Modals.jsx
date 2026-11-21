// Fenêtres : aide, conseillers, commerce, briefing de province, victoire.
import { K, GOODS, NUM_GOODS, G, DEFS, HOUSE_NAMES, HOUSE_CAP, MAX_LEVEL, SCENARIOS, RAID_SIDES } from '../engine/defs.js';

const fmt = (n) => Math.round(n).toLocaleString('fr-FR');

function Frame({ title, children, footer, close, wide }) {
  return (
    <div className="iu-modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget && close) close(); }}>
      <div className={`iu-modal ${wide ? 'wide' : ''}`} role="dialog" aria-label={title}>
        <header>{title}{close && <button type="button" className="x" onClick={close} aria-label="Fermer">×</button>}</header>
        <div className="body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    </div>
  );
}

function Help({ close }) {
  return (
    <Frame title="Guide du gouverneur" close={close} footer={<button type="button" className="iu-btn" onClick={close}>Fermer</button>}>
      <h4>Commandes</h4>
      <p>Caméra : ZQSD (ou WASD) et flèches pour se déplacer, molette pour zoomer, clic droit glissé pour tourner (ou A/E), clic molette glissé pour déplacer. Clic sur la minicarte pour s’y rendre. Tab : minicarte.</p>
      <p>Clic gauche : construire ou inspecter. Clic droit ou Échap : annuler. Espace : pause. 1 à 4 : vitesse. O : calques. M : commerce. K : conseillers. Ctrl+S : sauvegarder.</p>
      <p>Raccourcis : R route, X déblayer, I logement, P puits, F ferme, C marché, T temple, J jardin. Logements, jardins et cyprès se posent en rectangle : cliquez puis glissez.</p>
      <h4>Bâtir une cité</h4>
      <p>Tout doit être relié par la route au drapeau rouge (l’entrée). Les maisons ont besoin d’eau et d’un marché approvisionné.</p>
      <p>Chaînes de production : argilière → poterie, bûcherons → menuiserie, oliveraie → pressoir, vignoble → cave, carrière → marbre. Greniers et entrepôts augmentent les stocks ; le comptoir ouvre le commerce ; les réservoirs portent l’eau loin du fleuve.</p>
      <p>Main-d’œuvre : sécurité d’abord, puis vivres et eau, services, enfin industrie.</p>
      <h4>Logements (7 niveaux)</h4>
      <p>Tente → Hutte (eau + nourriture) → Insula (poterie, temple) → Grande insula (fontaine, théâtre, huile) → Domus (2 vivres, meubles, école, médecin) → Grande domus (thermes, vin, amphithéâtre) → Villa (3 vivres, bibliothèque, prestige).</p>
      <h4>Rome et dangers</h4>
      <p>Honorez les requêtes de César, offrez des cadeaux, organisez des fêtes : faveur à 0 = destitution. Raids barbares : casernes et tours. Épidémies : médecins et thermes. Incendies : préfectures. Effondrements : ingénieurs.</p>
      <h4>Sauvegardes</h4>
      <p>Les parties sont gardées dans ce navigateur (sauvegarde automatique chaque année). « Exporter » télécharge un fichier compatible avec ImperiumUrbis.exe ; le menu permet d’importer une sauvegarde de l’exe.</p>
    </Frame>
  );
}

function Trade({ game: g, act, close }) {
  return (
    <Frame title="Commerce et stocks" wide close={close} footer={<button type="button" className="iu-btn" onClick={close}>Fermer</button>}>
      <p className="strong">{g.TradeCap ? `Capacité commerciale ce mois : ${g.TradeUsed} / ${g.TradeCap} unités` : 'Construisez un Comptoir (catégorie Industrie) relié à la route pour commercer avec l’Empire.'}</p>
      <p className="muted">Stockage : nourriture {fmt(g.food())} / {fmt(g.FoodCap)} (greniers) — marchandises {fmt(g.GoodCap)} chacune (entrepôts)</p>
      <table className="iu-table">
        <thead><tr><th>Marchandise</th><th>Stock</th><th>Prod/mois</th><th>Conso/mois</th><th>Vente</th><th>Achat</th><th colSpan={4} /></tr></thead>
        <tbody>
          {Array.from({ length: NUM_GOODS }, (_, gd) => (
            <tr key={gd}>
              <td><i className="dot" style={{ background: GOODS[gd].color }} />{GOODS[gd].name}</td>
              <td className={!GOODS[gd].food && g.Stock[gd] >= g.cap(gd) * 0.98 ? 'warn' : ''}>{fmt(g.Stock[gd])}</td>
              <td className="pos">{fmt(g.LastProd[gd])}</td>
              <td className="neg">{fmt(g.LastCons[gd])}</td>
              <td>{GOODS[gd].sell} dn</td>
              <td>{GOODS[gd].buy} dn</td>
              <td><button type="button" className="iu-btn small" disabled={!g.TradeCap} onClick={() => act((gg) => gg.sell(gd, 10))}>Vendre 10</button></td>
              <td><button type="button" className="iu-btn small" disabled={!g.TradeCap} onClick={() => act((gg) => gg.sell(gd, 50))}>Vendre 50</button></td>
              <td><button type="button" className="iu-btn small" disabled={!g.TradeCap} onClick={() => act((gg) => gg.buy(gd, 10))}>Acheter 10</button></td>
              <td><button type="button" className={`iu-btn small ${g.AutoExport[gd] ? 'on' : ''}`} disabled={!g.TradeCap}
                title="Exporter automatiquement le surplus chaque mois (garde la moitié du stockage)"
                onClick={() => act((gg) => { gg.AutoExport[gd] = !gg.AutoExport[gd]; return ''; })}>Export auto : {g.AutoExport[gd] ? 'oui' : 'non'}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Frame>
  );
}

function Advisor({ game: g, close }) {
  const pop = g.population();
  const cnt = {}; const ppl = {}; let capTot = 0;
  for (const b of g.Buildings.values()) if (b.Kind === K.House) { cnt[b.Level] = (cnt[b.Level] || 0) + 1; ppl[b.Level] = (ppl[b.Level] || 0) + b.Pop; capTot += HOUSE_CAP[Math.max(1, b.Level)]; }
  const needs = {};
  for (const b of g.Buildings.values()) if (b.Kind === K.House && b.Pop > 0) needs[b.Needs] = (needs[b.Needs] || 0) + 1;
  const needList = Object.entries(needs).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const fp = g.LastProd[G.Wheat] + g.LastProd[G.Veg] + g.LastProd[G.Fish];
  const need = pop / 9;
  const net = g.LastIncome - g.LastExpend;
  const gl = g.Goal;
  const notes = [
    ['Culture', g.Culture, gl.Culture, 'temples, spectacles, écoles, médecins, thermes, monuments'],
    ['Prospérité', g.Prosper, gl.Prosper, 'maisons riches et budget positif'],
    ['Sécurité', g.Security, gl.Security, 'préfectures, ingénieurs, emploi, éducation'],
    ['Faveur', g.Favor, gl.Favor, 'requêtes, cadeaux, grand temple, trésor positif'],
  ];
  return (
    <Frame title="Rapport des conseillers" wide close={close} footer={<button type="button" className="iu-btn" onClick={close}>Fermer</button>}>
      <div className="iu-cols">
        <section>
          <h4>Population</h4>
          <p>{fmt(pop)} habitants, capacité {fmt(capTot)}, logement max : {HOUSE_NAMES[g.maxReachable()]}</p>
          <ul>{Array.from({ length: MAX_LEVEL }, (_, i) => i + 1).filter((l) => cnt[l]).map((l) => <li key={l}>{HOUSE_NAMES[l]} : {cnt[l]} maisons, {ppl[l]} hab.</li>)}</ul>
          <h4>Emploi</h4>
          <p>Travailleurs {g.Labor}, postes {g.JobsNeeded}, chômage {Math.round(g.Unemploy * 100)} %</p>
          {g.Labor < g.JobsNeeded && <p className="warn">Manque de bras : attirez plus d’habitants ou détruisez des bâtiments inutiles.</p>}
          {g.Unemploy > 0.1 && <p className="warn">Chômage élevé : construisez des ateliers et des fermes.</p>}
          <h4>Finances (mois dernier)</h4>
          <table className="iu-fin"><tbody>
            {[['Impôts', g.IncTax], ['Taxe sur les ventes', g.IncSales], ['Salaires', -g.ExpWages], ['Entretien', -g.ExpUpkeep]].map(([n, v]) => <tr key={n}><td>{n}</td><td>{v}</td></tr>)}
            <tr className={net < 0 ? 'neg' : 'pos'}><td>Solde (commerce compris)</td><td>{net}</td></tr>
          </tbody></table>
          {g.count(K.Forum) === 0 && <p className="neg">Aucun forum : vos impôts ne sont pas collectés !</p>}
        </section>
        <section>
          <h4>Vivres</h4>
          <p>Production {fmt(fp)}/mois, besoins {fmt(need)}/mois, réserves {fmt(g.food())} / {fmt(g.FoodCap)}</p>
          <p className={fp < need ? 'neg' : 'pos'}>{fp < need ? 'La production ne suffit pas : fermes, potagers, pêcheries !' : 'Les greniers sont bien approvisionnés.'}</p>
          <h4>Ce qui bloque vos maisons</h4>
          <ul>{needList.map(([k, v]) => <li key={k}><b>{v}</b> {k}</li>)}</ul>
          <h4>Notes de la province</h4>
          {notes.map(([n, v, o, tip]) => <p key={n}><span className={v >= o ? 'pos' : 'warn'}>{n} : {Math.round(v)} / {o}</span><br /><small className="muted">{tip}</small></p>)}
          <h4>Défense</h4>
          <p>Défense {Math.round(g.Defense)} (casernes, tours de guet). {g.RaidIn > 0 ? `Raid de ${g.RaidStr} dans ${g.RaidIn} mois par ${RAID_SIDES[g.RaidSide]}.` : g.scen().raids ? 'Les éclaireurs ne signalent aucune menace.' : 'Province paisible.'}</p>
        </section>
      </div>
    </Frame>
  );
}

function Brief({ game: g, close }) {
  const sc = g.scen(); const gl = g.Goal;
  return (
    <Frame title={`${sc.name} — ${sc.region}`} footer={<button type="button" className="iu-btn big" onClick={close}>Commencer</button>}>
      <p className="lead">{sc.brief}</p>
      <h4>Objectifs</h4>
      <ul>
        <li>Population : {gl.Pop} habitants</li>
        <li>Culture {gl.Culture} · Prospérité {gl.Prosper} · Sécurité {gl.Security} · Faveur de César {gl.Favor}</li>
        <li>Logement le plus riche possible : {HOUSE_NAMES[g.maxReachable()]}</li>
        <li>Trésor de départ : {fmt(g.Money)} deniers</li>
      </ul>
      {sc.locked.length > 0 && (<><h4>Bâtiments non disponibles</h4><p className="muted">{sc.locked.map((k) => DEFS[k].name).join(', ')}</p></>)}
      {sc.raids && <p className="neg">Attention : des raids barbares menacent cette province. Casernes et tours de guet vous défendront.</p>}
    </Frame>
  );
}

function Victory({ game: g, close, actions }) {
  const sc = g.scen();
  const next = g.ScenarioIdx >= 0 && g.ScenarioIdx + 1 < SCENARIOS.length ? g.ScenarioIdx + 1 : -1;
  return (
    <Frame title="Victoire !" footer={(
      <>
        {next >= 0 && <button type="button" className="iu-btn big" onClick={() => actions.newScenario(next)}>Province suivante</button>}
        <button type="button" className="iu-btn big" onClick={close}>Continuer à bâtir</button>
        <button type="button" className="iu-btn big" onClick={actions.menu}>Menu principal</button>
      </>
    )}>
      <h2 className="gold center">Rome célèbre votre gouvernance de {sc.name}</h2>
      <p className="center">Objectifs atteints en {g.year()} année(s).</p>
      <p className="center">Population {fmt(g.population())} · Culture {Math.round(g.Culture)} · Prospérité {Math.round(g.Prosper)} · Sécurité {Math.round(g.Security)} · Faveur {Math.round(g.Favor)}</p>
      {next >= 0 && <p className="center">L’Empereur vous confie désormais {SCENARIOS[next].name} ({SCENARIOS[next].region}).</p>}
      {g.ScenarioIdx === SCENARIOS.length - 1 && <p className="center gold">Vous avez achevé la campagne. Votre nom restera gravé dans le marbre !</p>}
    </Frame>
  );
}

export function Modal({ kind, game, close, act, actions }) {
  switch (kind) {
    case 'help': return <Help close={close} />;
    case 'trade': return <Trade game={game} act={act} close={close} />;
    case 'advisor': return <Advisor game={game} close={close} />;
    case 'brief': return <Brief game={game} close={close} />;
    case 'victory': return <Victory game={game} close={close} actions={actions} />;
    default: return null;
  }
}
