// Application du jeu : relie le moteur (engine/), le rendu 3D (render/) et l'interface React (ui/).
import { useCallback, useEffect, useRef, useState } from 'react';
import { Game, roadPath, inMap } from './engine/sim.js';
import { K, DEFS, SCENARIOS, CATEGORIES } from './engine/defs.js';
import { CityRenderer } from './render/CityRenderer.js';
import { TopBar, SidePanel, Messages, Flash } from './ui/Panels.jsx';
import { Modal } from './ui/Modals.jsx';
import { Minimap } from './ui/Minimap.jsx';
import { Menu } from './ui/Menu.jsx';
import { saveGame, loadGame, hasSave, loadProgress, saveProgress, exportSave } from './saves.js';
import { TOOL_NONE, TOOL_CLEAR, MONTH_SECONDS, HOTKEYS, areaTool, OVERLAYS } from './constants.js';

export default function GameApp() {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const rendRef = useRef(null);
  const gameRef = useRef(null);
  const [, setUi] = useState(0);
  const refresh = useCallback(() => setUi((v) => v + 1), []);
  const [state, setState] = useState('menu'); // 'menu' | 'play'
  const [modal, setModal] = useState(null);
  const [cat, setCat] = useState(0);
  const [tool, setToolState] = useState(TOOL_NONE);
  const [selected, setSelected] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [overlay, setOverlay] = useState(0);
  const [flash, setFlash] = useState(null);
  const [hoverTip, setHoverTip] = useState('');
  const [miniOn, setMiniOn] = useState(true);
  const [progress, setProgress] = useState(loadProgress);
  const ui = useRef({ speed: 1, tool: TOOL_NONE, modal: null, state: 'menu', acc: 0, keys: new Set(), drag: null, mouse: null, lastYear: 1, victorySeen: false });
  ui.current.speed = speed; ui.current.tool = tool; ui.current.modal = modal; ui.current.state = state;

  const say = useCallback((text) => { if (text) setFlash({ text, t: Date.now() }); }, []);
  const g = gameRef.current;

  // ---------- démarrage ----------
  const startGame = useCallback((game, opts = {}) => {
    gameRef.current = game;
    rendRef.current.setGame(game);
    rendRef.current.centerOn(18, game.EntryY);
    rendRef.current.cam.dist = 28;
    ui.current.lastYear = game.year();
    ui.current.victorySeen = game.Won;
    ui.current.inGame = true;
    setSelected(0); setToolState(TOOL_NONE); setOverlay(0);
    setState('play');
    setModal(opts.brief ? 'brief' : null);
    setSpeed(opts.brief ? 0 : 1);
    refresh();
  }, [refresh]);

  const newScenario = useCallback((idx) => startGame(new Game(idx), { brief: true }), [startGame]);

  // menu de fond : une province libre qui sert de décor
  useEffect(() => {
    const r = new CityRenderer(canvasRef.current, { shadows: true });
    rendRef.current = r;
    const bg = new Game(-1, 7);
    gameRef.current = bg;
    r.setGame(bg);
    r.centerOn(30, bg.EntryY);
    r.cam.dist = 45;
    const resize = () => { const el = wrapRef.current; if (el) r.resize(el.clientWidth, el.clientHeight); };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrapRef.current);
    // ouverture directe d'une sauvegarde : jeu.html?charger=1
    if (new URLSearchParams(window.location.search).get('charger') && hasSave('imperium.save')) {
      const gl = loadGame('imperium.save');
      if (gl) setTimeout(() => startGame(gl), 0);
    }
    return () => { ro.disconnect(); r.dispose(); };
  }, [startGame]);

  // ---------- boucle de jeu ----------
  useEffect(() => {
    let raf; let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const r = rendRef.current; const game = gameRef.current; const u = ui.current;
      if (r && game) {
        // caméra au clavier
        const k = u.keys; const pan = r.cam.dist * 0.9 * dt;
        let dx = 0; let dz = 0;
        if (k.has('KeyA') || k.has('ArrowLeft')) dx -= pan;
        if (k.has('KeyD') || k.has('ArrowRight')) dx += pan;
        if (k.has('KeyW') || k.has('ArrowUp')) dz -= pan;
        if (k.has('KeyS') || k.has('ArrowDown')) dz += pan;
        if (dx || dz) r.pan(dx, dz);
        if (k.has('KeyQ')) r.rotate(-1.4 * dt);
        if (k.has('KeyE')) r.rotate(1.4 * dt);
        if (u.state === 'menu') r.rotate(0.03 * dt);
        // temps
        const playing = u.state === 'play' && !u.modal && u.speed > 0 && !game.Lost;
        if (playing) {
          u.acc += dt;
          if (u.acc >= MONTH_SECONDS[u.speed]) {
            u.acc = 0;
            const wasWon = game.Won;
            game.tick();
            if (game.year() !== u.lastYear) { u.lastYear = game.year(); saveGame('imperium.autosave', game); }
            if (game.Alert && game.AlertMonth === game.Month) say(game.Alert);
            if (game.Won && !wasWon && !u.victorySeen) {
              u.victorySeen = true;
              if (game.ScenarioIdx >= 0) {
                setProgress((p) => {
                  const best = { ...p.Best }; const name = SCENARIOS[game.ScenarioIdx].name;
                  if (!best[name] || game.year() < best[name]) best[name] = game.year();
                  const np = { Unlocked: Math.max(p.Unlocked, Math.min(SCENARIOS.length - 1, game.ScenarioIdx + 1)), Best: best };
                  saveProgress(np);
                  return np;
                });
              }
              setModal('victory'); setSpeed(0);
            }
            setSelected((s) => (game.Buildings.has(s) ? s : 0));
            setUi((v) => v + 1);
          }
        }
        r.frame(dt, u.state === 'play' && !u.modal ? u.speed : (u.state === 'menu' ? 1 : 0));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [say]);

  // ---------- calques ----------
  useEffect(() => {
    const r = rendRef.current; if (!r) return;
    const o = OVERLAYS[overlay];
    r.setOverlay(state === 'play' && o.fn ? o.fn : null, state === 'play' ? String(overlay) : '0');
    r.showDesirability(state === 'play' && Boolean(o.desir));
  }, [overlay, state]);

  // sélection
  useEffect(() => {
    const r = rendRef.current; if (!r || !gameRef.current) return;
    r.setSelection(state === 'play' && selected ? gameRef.current.Buildings.get(selected) : null);
  });

  // ---------- outils ----------
  const selectTool = useCallback((t) => {
    setToolState((cur) => (cur === t ? TOOL_NONE : t));
    setSelected(0);
    if (t !== TOOL_CLEAR && t !== TOOL_NONE) CATEGORIES.forEach((c, i) => { if (c.kinds.includes(t)) setCat(i); });
  }, []);
  useEffect(() => { if (tool === TOOL_NONE && rendRef.current) rendRef.current.setGhost(K.None, []); }, [tool]);

  const anchor = (k, tx, ty) => [tx - Math.floor((DEFS[k].W - 1) / 2), ty - Math.floor((DEFS[k].H - 1) / 2)];
  const areaSpots = (k, x0, y0, x1, y1) => {
    const df = DEFS[k]; const out = [];
    const sx = x1 < x0 ? -1 : 1; const sy = y1 < y0 ? -1 : 1;
    for (let y = y0; (y - y1) * sy <= 0; y += sy * df.H) for (let x = x0; (x - x1) * sx <= 0; x += sx * df.W) out.push([x, y]);
    return out;
  };

  // aperçu de pose sous la souris
  const updateGhost = useCallback((tx, ty) => {
    const r = rendRef.current; const game = gameRef.current; const u = ui.current; const t = u.tool;
    if (t === TOOL_NONE || !game) { r.setGhost(K.None, []); return; }
    if (t === TOOL_CLEAR) {
      const [sx, sy] = u.drag ? [u.drag.x, u.drag.y] : [tx, ty];
      const spots = [];
      for (let x = Math.min(sx, tx); x <= Math.max(sx, tx); x++) for (let y = Math.min(sy, ty); y <= Math.max(sy, ty); y++) spots.push({ x, y, ok: false });
      r.setGhost(K.None, spots.slice(0, 900));
      return;
    }
    if (t === K.Road) {
      const path = u.drag ? roadPath(u.drag.x, u.drag.y, tx, ty) : [[tx, ty]];
      r.setGhost(K.Road, path.filter(([x, y]) => inMap(x, y)).map(([x, y]) => ({ x, y, ok: !game.canPlace(K.Road, x, y)[1] })));
      u.preview = u.drag ? `${game.roadCost(path)} dn` : '';
      return;
    }
    const spots = u.drag && areaTool(t) ? areaSpots(t, u.drag.x, u.drag.y, tx, ty) : [anchor(t, tx, ty)];
    let total = 0;
    const list = spots.map(([x, y]) => { const [c, e] = game.canPlace(t, x, y); if (!e) total += c; return { x, y, ok: !e && game.Money >= total, e }; });
    r.setGhost(t, list, DEFS[t].radius || (t === K.Reservoir ? 14 : t === K.Fountain ? 6 : 0));
    u.preview = list.length === 1 ? (list[0].e || (DEFS[t].marble ? `${total} dn + ${DEFS[t].marble} marbre` : `${total} dn`)) : `${list.filter((s) => s.ok).length} × ${DEFS[t].name} : ${total} dn`;
  }, []);

  // ---------- souris sur la carte ----------
  const tileAt = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const p = rendRef.current.pick(e.clientX - rect.left, e.clientY - rect.top);
    return p ? [Math.floor(p.x), Math.floor(p.z)] : null;
  };
  const onMouseDown = (e) => {
    if (ui.current.state !== 'play' || modal) return;
    const u = ui.current; const game = gameRef.current;
    u.mouse = { x: e.clientX, y: e.clientY, button: e.button, moved: false };
    if (e.button !== 0 || game.Lost) return;
    const tt = tileAt(e); if (!tt) return;
    const [tx, ty] = tt; const t = u.tool;
    if (t === TOOL_CLEAR || t === K.Road || areaTool(t)) { u.drag = { x: tx, y: ty }; updateGhost(tx, ty); return; }
    if (t !== TOOL_NONE) {
      const [ax, ay] = anchor(t, tx, ty);
      say(game.build(t, ax, ay)); refresh(); updateGhost(tx, ty);
      rendRef.current.ghostKey = '';
      return;
    }
    const b = game.at(tx, ty);
    setSelected(b && b.Kind !== K.Road ? b.ID : 0);
  };
  const onMouseMove = (e) => {
    const u = ui.current; const r = rendRef.current;
    if (u.state !== 'play') return;
    if (u.mouse) {
      const dx = e.clientX - u.mouse.x; const dy = e.clientY - u.mouse.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) u.mouse.moved = true;
      if (u.mouse.button === 1) { r.pan(-dx * r.cam.dist / 600, -dy * r.cam.dist / 600); }
      if (u.mouse.button === 2) { r.rotate(-dx * 0.006, dy * 0.004); }
      if (u.mouse.button !== 0) { u.mouse.x = e.clientX; u.mouse.y = e.clientY; }
    }
    const tt = tileAt(e);
    if (tt) { updateGhost(tt[0], tt[1]); u.cursor = { x: e.clientX, y: e.clientY }; }
  };
  const onMouseUp = (e) => {
    const u = ui.current; const game = gameRef.current;
    const m = u.mouse; u.mouse = null;
    if (!m || u.state !== 'play') return;
    if (m.button === 2 && !m.moved) { setToolState(TOOL_NONE); setSelected(0); u.drag = null; return; }
    if (m.button !== 0 || !u.drag) return;
    const tt = tileAt(e) || [u.drag.x, u.drag.y];
    const [tx, ty] = tt; const t = u.tool; const d = u.drag; u.drag = null;
    if (t === TOOL_CLEAR) { const c = game.clear(d.x, d.y, tx, ty); if (c > 0) say(`Déblayage : ${c} dn`); }
    else if (t === K.Road) { if (game.buildRoad(roadPath(d.x, d.y, tx, ty)) === 0) say('Impossible de construire la route ici'); }
    else if (areaTool(t)) {
      let n = 0; let last = '';
      for (const [x, y] of areaSpots(t, d.x, d.y, tx, ty)) { const er = game.build(t, x, y); if (!er) n++; else last = er; }
      if (!n && last) say(last);
    }
    rendRef.current.ghostKey = '';
    updateGhost(tx, ty);
    setSelected((s) => (game.Buildings.has(s) ? s : 0));
    refresh();
  };
  const onWheel = (e) => { if (ui.current.state === 'play' || ui.current.state === 'menu') rendRef.current.zoom(Math.pow(1.0015, e.deltaY)); };

  // ---------- clavier ----------
  useEffect(() => {
    const down = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      const u = ui.current; const game = gameRef.current;
      u.keys.add(e.code);
      if (u.state !== 'play') return;
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === 's') { e.preventDefault(); saveGame('imperium.save', game); say('Partie sauvegardée.'); return; }
      if (e.key === 'Escape') {
        if (u.modal) { if (u.modal === 'brief') setSpeed(1); setModal(null); return; }
        if (u.tool !== TOOL_NONE) { setToolState(TOOL_NONE); return; }
        setSelected((s) => { if (!s) { setState('menu'); setSpeed(0); } return 0; });
        return;
      }
      if (u.modal) return;
      if (e.key === ' ') { e.preventDefault(); setSpeed((s) => (s === 0 ? 1 : 0)); return; }
      if (e.key === 'Tab') { e.preventDefault(); setMiniOn((v) => !v); return; }
      if (['1', '2', '3', '4'].includes(e.key)) { setSpeed(Number(e.key)); return; }
      if (key === 'o') { setOverlay((v) => (v + 1) % OVERLAYS.length); return; }
      if (key === 'h') { setModal('help'); return; }
      if (key === 'm') { setModal('trade'); return; }
      if (key === 'k') { setModal('advisor'); return; }
      if (HOTKEYS[key] !== undefined && !e.ctrlKey && !e.metaKey) {
        const t = HOTKEYS[key];
        if (t !== TOOL_CLEAR && game.locked(t)) return;
        selectTool(t);
      }
    };
    const up = (e) => ui.current.keys.delete(e.code);
    const blur = () => ui.current.keys.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, [say, selectTool]);

  // ---------- actions ----------
  const act = useCallback((fn) => { const game = gameRef.current; say(fn(game)); refresh(); }, [say, refresh]);
  const actions = {
    save: () => { saveGame('imperium.save', gameRef.current); say('Partie sauvegardée dans ce navigateur.'); },
    exportSave: () => { exportSave(gameRef.current); say('Sauvegarde téléchargée (compatible avec ImperiumUrbis.exe).'); },
    menu: () => { setState('menu'); setSpeed(0); setModal(null); },
    load: (key) => { const gl = loadGame(key); if (gl) { startGame(gl); say(`Partie chargée : ${gl.scen().name}, an ${gl.year()}`); } else say('Aucune sauvegarde trouvée.'); },
    importFile: async (file) => {
      try {
        const gl = Game.fromJSON(JSON.parse(await file.text()));
        startGame(gl); say(`Sauvegarde importée : ${gl.scen().name}, an ${gl.year()}`);
      } catch { say('Fichier de sauvegarde illisible.'); }
    },
    newScenario,
    resume: () => { setState('play'); setSpeed(1); },
  };

  const game = gameRef.current;
  const inPlay = state === 'play' && game;
  return (
    <div className="iu-root">
      <div className="iu-map" ref={wrapRef}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
        onMouseLeave={() => { ui.current.mouse = null; }}
        onWheel={onWheel} onContextMenu={(e) => e.preventDefault()}>
        <canvas ref={canvasRef} className="iu-canvas" />
        {inPlay && ui.current.preview && tool !== TOOL_NONE && ui.current.cursor && (
          <div className="iu-cursor-tip" style={{ left: ui.current.cursor.x + 16, top: ui.current.cursor.y + 10 }}>{ui.current.preview}</div>
        )}
        {inPlay && <Messages game={game} wide={!miniOn} />}
        {inPlay && <Flash flash={flash} />}
        {inPlay && speed === 0 && !modal && !game.Lost && <div className="iu-pause">PAUSE</div>}
        {inPlay && miniOn && <Minimap game={game} renderer={rendRef.current} />}
        {inPlay && game.Lost && (
          <div className="iu-lost"><h2>César vous a relevé de vos fonctions</h2><button type="button" onClick={actions.menu}>Retour au menu</button></div>
        )}
      </div>
      {inPlay && (
        <TopBar game={game} speed={speed} setSpeed={setSpeed} overlay={overlay} setOverlay={setOverlay} actions={actions} setModal={setModal} setHoverTip={setHoverTip} />
      )}
      {inPlay && (
        <SidePanel game={game} cat={cat} setCat={setCat} tool={tool} selectTool={selectTool} selected={selected}
          hoverTip={hoverTip} setHoverTip={setHoverTip} act={act} setModal={setModal} miniOn={miniOn} setMiniOn={setMiniOn} />
      )}
      {inPlay && modal && (
        <Modal kind={modal} game={game} close={() => { if (modal === 'brief') setSpeed(1); setModal(null); }} act={act}
          actions={actions} setSpeed={setSpeed} />
      )}
      {state === 'menu' && <Menu progress={progress} actions={actions} canResume={Boolean(ui.current.inGame)} />}
    </div>
  );
}
