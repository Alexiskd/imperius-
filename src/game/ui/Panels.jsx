// Barre du haut, panneau latéral (construction, informations, gestion, objectifs) et messages.
import { useEffect, useState } from 'react';
import { K, DEFS, GOODS, G, CATEGORIES, HOUSE_NAMES, HOUSE_CAP, MONTHS, RAID_SIDES, PRIO_NAMES, isProducer, isProcessor } from '../engine/defs.js';
import { TOOL_CLEAR, TOOL_NONE, HOTKEYS, OVERLAYS, areaTool } from '../constants.js';

const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
const hotkeyFor = (t) => Object.keys(HOTKEYS).find((k) => HOTKEYS[k] === t);

// Libellé et description d'un outil de construction.
export function toolLabel(k) {
  if (k === K.None || k === TOOL_CLEAR) return ['Déblayer', 'Détruit bâtiments et arbres (glisser un rectangle). 2 dn/case, 5 dn/arbre. [X]'];
  const d = DEFS[k];
  let l = `${d.name}`;
  let tip = d.desc;
  if (d.marble) tip += ` Marbre : ${d.marble}.`;
  if (d.workers) tip += ` Employés : ${d.workers}.`;
  if (areaTool(k)) tip += ' Glisser pour en poser plusieurs.';
  const h = hotkeyFor(k);
  if (h) tip += ` [${h.toUpperCase()}]`;
  l += ` · ${d.cost}${d.marble ? `+${d.marble}m` : ''}`;
  return [l, tip];
}

function Btn({ children, onClick, active, disabled, tip, setHoverTip, className = '', small }) {
  return (
    <button type="button" className={`iu-btn ${active ? 'on' : ''} ${small ? 'small' : ''} ${className}`} disabled={disabled}
      onClick={onClick} onMouseEnter={() => setHoverTip && setHoverTip(tip || '')} onMouseLeave={() => setHoverTip && setHoverTip('')}>
      {children}
    </button>
  );
}

export function TopBar({ game: g, speed, setSpeed, overlay, setOverlay, actions, setModal, setHoverTip }) {
  const net = g.LastIncome - g.LastExpend;
  const fp = g.LastProd[G.Wheat] + g.LastProd[G.Veg] + g.LastProd[G.Fish];
  const fc = g.LastCons[G.Wheat] + g.LastCons[G.Veg] + g.LastCons[G.Fish];
  return (
    <div className="iu-top">
      <span className={g.Money < 0 ? 'neg strong' : 'strong'}>Deniers : {fmt(g.Money)}</span>
      <span className={net < 0 ? 'neg small' : 'pos small'}>({net >= 0 ? '+' : ''}{net}/mois)</span>
      <span className="strong">Pop : {fmt(g.population())}</span>
      <span className={g.food() < fc ? 'warn' : ''}>Vivres : {fmt(g.food())} ({fp - fc >= 0 ? '+' : ''}{Math.round(fp - fc)})</span>
      <span className={g.Labor < g.JobsNeeded ? 'warn' : ''}>Emplois : {g.Employed}/{g.JobsNeeded}</span>
      {g.Unemploy > 0.08 && <span className="warn small">Chômage {Math.round(g.Unemploy * 100)} %</span>}
      <span className="grow" />
      {['II', '▶', '▶▶', '▶▶▶', '×4'].map((l, i) => (
        <Btn key={l} small active={speed === i} onClick={() => setSpeed(i)} tip="Vitesse (Espace = pause, touches 1 à 4)" setHoverTip={setHoverTip}>{l}</Btn>
      ))}
      <select className="iu-select" value={overlay} onChange={(e) => setOverlay(Number(e.target.value))} title="Calques d'information [O]">
        {OVERLAYS.map((o, i) => <option key={o.name} value={i}>Calque : {o.name}</option>)}
      </select>
      <span className="gold strong date">{MONTHS[g.Month % 12]} an {g.year()}</span>
      <Btn small onClick={actions.save} tip="Sauvegarder dans ce navigateur [Ctrl+S]" setHoverTip={setHoverTip}>Sauver</Btn>
      <Btn small onClick={actions.exportSave} tip="Télécharger la sauvegarde (compatible avec l'exe)" setHoverTip={setHoverTip}>Exporter</Btn>
      <Btn small onClick={() => setModal('help')} tip="Aide [H]" setHoverTip={setHoverTip}>Aide</Btn>
      <Btn small onClick={actions.menu} tip="Menu principal [Échap]" setHoverTip={setHoverTip}>Menu</Btn>
    </div>
  );
}

// Texte du cadre d'informations.
function infoText(g, selected, hoverTip, tool) {
  const b = g.Buildings.get(selected);
  const yes = (v) => (v ? 'oui' : 'non');
  if (b) {
    const d = DEFS[b.Kind];
    const info = [];
    if (b.Kind === K.House) {
      info.push(
        `Habitants ${b.Pop}/${HOUSE_CAP[Math.max(1, b.Level)]} · Bonheur ${Math.round(b.Happy)}`,
        `Eau : ${['non', 'puits', 'fontaine'][b.WaterLvl]} · Nourriture : ${b.Variety} sorte(s) · Temple : ${yes(b.Religion)}`,
        `Spectacles : ${yes(b.Entertain)} · École : ${yes(b.Educ)} · Médecin : ${yes(b.Health)} · Thermes : ${yes(b.Hygiene)}`,
        `Désirabilité ${b.Desir.toFixed(1)} · Impôts : ${yes(b.Taxed)}`,
        `Pour évoluer : ${b.Needs}`,
      );
    } else if (isProducer(b.Kind)) {
      info.push(`Production : ${b.Prod.toFixed(1)} ${GOODS[d.out].name} / mois (max ${d.outN})`);
      if (isProcessor(b.Kind)) info.push(`Consomme : ${GOODS[d.inp].name} (stock ${fmt(g.Stock[d.inp])})`);
      if (b.Status) info.push(`⚠ ${b.Status}`);
      info.push(`Employés ${Math.round(d.workers * b.Eff)}/${d.workers}`);
    } else {
      if (d.workers) info.push(`Employés ${Math.round(d.workers * b.Eff)}/${d.workers} (efficacité ${Math.round(b.Eff * 100)} %)`);
      if (b.Kind === K.Granary) info.push(`Capacité nourriture de la ville : ${fmt(g.FoodCap)}`);
      if (b.Kind === K.Warehouse) info.push(`Capacité par marchandise : ${fmt(g.GoodCap)}`);
      if (b.Kind === K.TradePost) info.push(`Échanges ce mois : ${g.TradeUsed}/${g.TradeCap}`);
      if (b.Kind === K.Barracks || b.Kind === K.Tower) info.push(`Défense totale de la ville : ${Math.round(g.Defense)}`);
      info.push(d.desc);
    }
    if (d.workers && !b.HasRoad) info.unshift("⚠ Non relié à la route d'entrée");
    if (b.Kind !== K.Rubble) info.push(`Risque incendie ${Math.round(Math.min(100, b.Fire))} %, effondrement ${Math.round(Math.min(100, b.Damage))} %`);
    return [g.bname(b), info];
  }
  if (hoverTip) return ['Info', [hoverTip]];
  if (tool === TOOL_CLEAR) return ['Déblayer', ['Glissez pour détruire. Clic droit pour annuler.']];
  if (tool !== TOOL_NONE) { const [l, tip] = toolLabel(tool); return [l, [tip]]; }
  return ['Gouverneur', ['Choisissez un bâtiment à construire, ou cliquez sur un bâtiment pour l’inspecter.', 'Caméra : ZQSD / flèches, molette, clic droit glissé pour tourner. H : aide.']];
}

function Bar({ label, v, goal }) {
  const done = v >= goal;
  return (
    <div className="iu-bar">
      <span>{label}</span>
      <div className="track"><div className={`fill ${done ? 'done' : ''}`} style={{ width: `${Math.min(100, (v / Math.max(1, goal)) * 100)}%` }} /><em>{fmt(v)} / {fmt(goal)}</em></div>
    </div>
  );
}

export function SidePanel({ game: g, cat, setCat, tool, selectTool, selected, hoverTip, setHoverTip, act, setModal, miniOn, setMiniOn }) {
  const [title, info] = infoText(g, selected, hoverTip, tool);
  const sc = g.scen();
  const gl = g.Goal;
  const ev = [];
  if (g.RaidIn > 0) ev.push([`Raid par ${RAID_SIDES[g.RaidSide]} dans ${g.RaidIn} mois : ${g.RaidStr} contre défense ${Math.round(g.Defense)}`, g.Defense >= g.RaidStr ? 'pos' : 'neg']);
  if (g.HarvestM > 0) ev.push([`${g.HarvestMod > 1 ? 'Récoltes abondantes' : 'Sécheresse'} (${g.HarvestM} mois)`, 'warn']);
  if (g.FestBoost > 0) ev.push(['Le peuple est en fête !', 'pos']);
  if (!ev.length) ev.push(['Rien à signaler dans la province.', 'muted']);
  const have = g.Req.Money ? g.Money : g.Stock[g.Req.Good];
  return (
    <aside className="iu-panel">
      <div className="iu-tabs">
        {CATEGORIES.map((c, i) => <button type="button" key={c.name} className={cat === i ? 'on' : ''} onClick={() => setCat(i)}>{c.name}</button>)}
      </div>
      <div className="iu-tools">
        {CATEGORIES[cat].kinds.map((k) => {
          const t = k === K.None ? TOOL_CLEAR : k;
          const locked = k !== K.None && g.locked(k);
          const [label, tip] = toolLabel(k);
          return (
            <Btn key={k} className="tool" active={tool === t} disabled={locked} onClick={() => selectTool(t)}
              tip={locked ? `${DEFS[k].name} : non disponible dans cette province.` : tip} setHoverTip={setHoverTip}>{label}</Btn>
          );
        })}
      </div>
      <div className="iu-info">
        <h4>{title}</h4>
        {info.map((l) => <p key={l}>{l}</p>)}
      </div>
      <div className="iu-mgmt">
        <div><span>Impôts</span><Btn small onClick={() => act((gg) => { gg.TaxRate = Math.max(0, gg.TaxRate - 1); return ''; })}>−</Btn><b>{g.TaxRate} %</b><Btn small onClick={() => act((gg) => { gg.TaxRate = Math.min(25, gg.TaxRate + 1); return ''; })}>+</Btn></div>
        <Btn disabled={g.FestCool > 0} onClick={() => act((gg) => gg.festival())} setHoverTip={setHoverTip}
          tip={g.FestCool > 0 ? `Prochaine fête possible dans ${g.FestCool} mois.` : 'Fête publique : gros bonus de bonheur pendant plusieurs mois, Faveur +1.'}>Fête · {g.festivalCost()} dn</Btn>
        <div><span>Salaires</span><Btn small onClick={() => act((gg) => { gg.Wage = Math.max(15, gg.Wage - 1); return ''; })}>−</Btn><b>{g.Wage}</b><Btn small onClick={() => act((gg) => { gg.Wage = Math.min(50, gg.Wage + 1); return ''; })}>+</Btn></div>
        <Btn onClick={() => act((gg) => gg.gift())} setHoverTip={setHoverTip} tip="Offrir un cadeau à César : augmente la faveur (rendement décroissant).">Cadeau · {g.giftCost()} dn</Btn>
      </div>
      <div className={`iu-rome ${g.Req.Active ? 'active' : ''}`}>
        {g.Req.Active ? (
          <>
            <div><b>César exige {g.Req.Amount} {g.reqLabel()}</b><small>Délai {g.Req.Deadline} mois · stock {fmt(have)}</small></div>
            <Btn small onClick={() => act((gg) => gg.sendRequest())} tip="Honorer la requête (Faveur +15)" setHoverTip={setHoverTip}>Envoyer</Btn>
          </>
        ) : <small className="muted">Aucune requête de Rome.</small>}
      </div>
      <div className="iu-goals">
        <h4>Objectifs · {sc.name}</h4>
        <Bar label="Population" v={g.population()} goal={gl.Pop} />
        <Bar label="Culture" v={g.Culture} goal={gl.Culture} />
        <Bar label="Prospérité" v={g.Prosper} goal={gl.Prosper} />
        <Bar label="Sécurité" v={g.Security} goal={gl.Security} />
        <Bar label="Faveur" v={g.Favor} goal={gl.Favor} />
      </div>
      <div className="iu-events">{ev.slice(0, 2).map(([t, c]) => <p key={t} className={c}>{t}</p>)}</div>
      <div className="iu-row3">
        <Btn onClick={() => setModal('trade')} tip="Stocks et échanges avec l'Empire [M]" setHoverTip={setHoverTip}>Commerce</Btn>
        <Btn onClick={() => setModal('advisor')} tip="Rapports détaillés de la cité [K]" setHoverTip={setHoverTip}>Conseillers</Btn>
        <Btn active={miniOn} onClick={() => setMiniOn(!miniOn)} tip="Minicarte [Tab]" setHoverTip={setHoverTip}>Carte</Btn>
      </div>
      <div className="iu-labor">
        <h4>Main-d’œuvre</h4>
        {PRIO_NAMES.map((n, p) => (
          <div key={n} className="iu-lbar"><span>{n}</span><div className="track"><div className={`fill ${g.PrioRatio[p] < 0.999 ? 'low' : 'done'}`} style={{ width: `${g.PrioRatio[p] * 100}%` }} /></div><em>{Math.round(g.PrioRatio[p] * 100)} %</em></div>
        ))}
      </div>
    </aside>
  );
}

export function Messages({ game, wide }) {
  const msgs = game.Messages.slice(-5);
  return <div className={`iu-msgs ${wide ? 'wide' : ''}`}>{msgs.map((m, i) => <p key={`${i}-${m}`}>{m}</p>)}</div>;
}

export function Flash({ flash }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!flash) return undefined;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 3500);
    return () => clearTimeout(t);
  }, [flash]);
  if (!flash) return null;
  return <div className={`iu-flash ${visible ? 'show' : ''}`}>{flash.text}</div>;
}
