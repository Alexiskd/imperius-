// Moteur de traduction du site : traduit à la volée tout le texte affiché (accueil, jeu, achat) dans la
// langue choisie, y compris ce que React réécrit après coup (HUD, messages, fenêtres).
// Principe : on parcourt les nœuds texte et quelques attributs (title, placeholder, aria-label, alt), on
// remplace chaque texte français par sa traduction (cache mémoire + localStorage, sinon requête MyMemory),
// et un MutationObserver traduit ensuite tout ce qui apparaît ou change. Langue par défaut : celle du navigateur.
import { LANGUAGES, SOURCE_LANG, detectLanguage, isRtl } from './langues.js';
import { mask, needsTranslation, splitSpaces, unmask } from './masque.js';
import { translate } from './mymemory.js';

const STORE_LANG = 'imperium.lang';
const STORE_CACHE = 'imperium.i18n.v1.';
const MAX_ENTRIES = 3000;     // traductions gardées par langue
const CONCURRENCY = 4;        // requêtes simultanées
const RETRY_AFTER_MS = 60000; // pause avant de redemander un texte en échec
const ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];
// Éléments jamais traduits : code, saisies, et tout ce qui porte translate="no" ou la classe notranslate.
const SKIP = 'script,style,noscript,textarea,code,pre,[translate="no"],.notranslate';

const storage = {
  get(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* stockage plein ou refusé : le cache mémoire suffit */ } },
};

const st = {
  started: false,
  lang: SOURCE_LANG,
  status: 'ok',                    // 'ok' | 'quota' | 'erreur' (affiché par le sélecteur)
  cache: new Map(),                // gabarit français -> traduction (langue courante)
  texts: new WeakMap(),            // nœud texte -> { src, out }
  attrs: new WeakMap(),            // élément -> { attribut: { src, out } }
  pending: new Map(),              // gabarit -> [{ apply }] en attente de réponse
  requested: new Set(),            // gabarits dont la requête est en cours
  inflight: 0,
  failedAt: new Map(),             // gabarit -> instant du dernier échec
  persistTimer: 0,
  listeners: new Set(),
  titleSrc: null,
  titleOut: null,
  email: '',
  fetchImpl: undefined,
};

const emit = () => st.listeners.forEach((f) => f(getState()));
export const getLanguage = () => st.lang;
export const getState = () => ({ lang: st.lang, status: st.status });
export function onChange(fn) { st.listeners.add(fn); return () => st.listeners.delete(fn); }

// ---- cache --------------------------------------------------------------------------------------

function loadCache(lang) {
  st.cache = new Map();
  if (lang === SOURCE_LANG) return;
  try { for (const [k, v] of JSON.parse(storage.get(STORE_CACHE + lang) || '[]')) st.cache.set(k, v); } catch (e) { /* cache corrompu : ignoré */ }
}

function persistSoon() {
  clearTimeout(st.persistTimer);
  st.persistTimer = setTimeout(() => {
    while (st.cache.size > MAX_ENTRIES) st.cache.delete(st.cache.keys().next().value); // plus anciens d'abord
    storage.set(STORE_CACHE + st.lang, JSON.stringify([...st.cache]));
  }, 600);
}

// ---- application d'une traduction ---------------------------------------------------------------

const skipped = (el) => !el || Boolean(el.closest && el.closest(SKIP));

// resolve : texte d'origine -> { text } si la traduction est en cache, { key, values, lead, trail } sinon, null si rien à faire.
function lookup(src) {
  const { lead, core, trail } = splitSpaces(src);
  const { key, values } = mask(core);
  if (!needsTranslation(key)) return null;
  const hit = st.cache.get(key);
  if (hit !== undefined) {
    const text = unmask(hit, values);
    return text === null ? null : { text: lead + text + trail };
  }
  return { key, values, lead, trail };
}

function request(key, waiter) {
  const failed = st.failedAt.get(key);
  if (failed && Date.now() - failed < RETRY_AFTER_MS) return;
  const list = st.pending.get(key);
  if (list) list.push(waiter);
  else { st.pending.set(key, [waiter]); pump(); }
}

// pump : lance les requêtes en attente, CONCURRENCY au plus à la fois.
function pump() {
  if (st.status === 'quota') return;
  for (const key of st.pending.keys()) {
    if (st.inflight >= CONCURRENCY) return;
    if (!st.requested.has(key)) launch(key);
  }
}

async function launch(key) {
  const reqs = st.requested;                // ensemble propre à la langue courante (remplacé au changement de langue)
  reqs.add(key);
  st.inflight++;
  const lang = st.lang;
  try {
    const tr = await translate(key, lang, { email: st.email, fetchImpl: st.fetchImpl });
    if (lang !== st.lang) return;           // langue changée entre-temps : réponse périmée
    st.cache.set(key, tr);
    persistSoon();
    if (st.status === 'erreur') { st.status = 'ok'; emit(); }
    const waiters = st.pending.get(key) || [];
    st.pending.delete(key);
    waiters.forEach((w) => w.apply(tr));
  } catch (e) {
    if (lang !== st.lang) return;
    st.failedAt.set(key, Date.now());
    st.pending.delete(key);                 // le texte reste en français
    const next = e.code === 'quota' ? 'quota' : 'erreur';
    if (next !== st.status) { st.status = next; emit(); }
    if (e.code === 'quota') st.pending.clear();
  } finally {
    reqs.delete(key);
    st.inflight--;
    pump();
  }
}

// ---- nœuds texte --------------------------------------------------------------------------------

function setText(node, src, out) {
  st.texts.set(node, { src, out });
  node.data = out;
}

function translateText(node) {
  if (st.lang === SOURCE_LANG || skipped(node.parentElement)) return;
  const rec = st.texts.get(node);
  if (rec && node.data === rec.out) return;                // c'est notre propre écriture
  const src = node.data;
  const r = lookup(src);
  if (!r) return;
  if (r.text !== undefined) { if (r.text !== src) setText(node, src, r.text); return; }
  request(r.key, { apply: (tr) => {
    if (node.data !== src) return;                         // le texte a changé depuis : on ne l'écrase pas
    const text = unmask(tr, r.values);
    if (text !== null) setText(node, src, r.lead + text + r.trail);
  } });
}

// ---- attributs ----------------------------------------------------------------------------------

function translateAttr(el, name) {
  if (st.lang === SOURCE_LANG || skipped(el)) return;
  const cur = el.getAttribute(name);
  if (!cur) return;
  const recs = st.attrs.get(el) || {};
  if (recs[name] && cur === recs[name].out) return;
  const write = (out) => { recs[name] = { src: cur, out }; st.attrs.set(el, recs); el.setAttribute(name, out); };
  const r = lookup(cur);
  if (!r) return;
  if (r.text !== undefined) { if (r.text !== cur) write(r.text); return; }
  request(r.key, { apply: (tr) => {
    if (el.getAttribute(name) !== cur) return;
    const text = unmask(tr, r.values);
    if (text !== null) write(r.lead + text + r.trail);
  } });
}

// ---- parcours -----------------------------------------------------------------------------------

function walk(root) {
  if (root.nodeType === 3) { translateText(root); return; }
  if (root.nodeType !== 1) return;
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) translateText(n);
  const sel = ATTRS.map((a) => `[${a}]`).join(',');
  const els = root.matches(sel) ? [root, ...root.querySelectorAll(sel)] : root.querySelectorAll(sel);
  for (const el of els) for (const a of ATTRS) if (el.hasAttribute(a)) translateAttr(el, a);
}

// restore : remet le français partout où une traduction a été écrite (avant de changer de langue).
function restore(root) {
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const rec = st.texts.get(n);
    if (rec && n.data === rec.out) n.data = rec.src;
    st.texts.delete(n);
  }
  for (const el of root.querySelectorAll(ATTRS.map((a) => `[${a}]`).join(','))) {
    const recs = st.attrs.get(el);
    if (!recs) continue;
    for (const [a, rec] of Object.entries(recs)) if (el.getAttribute(a) === rec.out) el.setAttribute(a, rec.src);
    st.attrs.delete(el);
  }
}

function translateTitle() {
  if (st.titleSrc === null || document.title !== st.titleOut) st.titleSrc = document.title; // titre modifié par la page
  if (st.lang === SOURCE_LANG) { document.title = st.titleSrc; st.titleOut = null; return; }
  const src = st.titleSrc;
  const r = lookup(src);
  if (!r) return;
  if (r.text !== undefined) { st.titleOut = r.text; document.title = r.text; return; }
  request(r.key, { apply: (tr) => {
    const text = unmask(tr, r.values);
    if (text !== null && st.titleSrc === src) { st.titleOut = r.lead + text + r.trail; document.title = st.titleOut; }
  } });
}

function observe() {
  const obs = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData') translateText(m.target);
      else if (m.type === 'attributes') translateAttr(m.target, m.attributeName);
      else m.addedNodes.forEach((n) => walk(n));
    }
  });
  obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}

// ---- API publique -------------------------------------------------------------------------------

// setLanguage : change la langue de tout le site, mémorise le choix, met à jour <html lang> et le sens d'écriture.
export function setLanguage(code) {
  if (!LANGUAGES.some(([c]) => c === code)) return;
  if (st.started && document.body) restore(document.body);
  st.lang = code;
  st.status = 'ok';
  st.pending.clear();
  st.requested = new Set();
  st.failedAt.clear();
  storage.set(STORE_LANG, code);
  loadCache(code);
  document.documentElement.lang = code;
  document.documentElement.dir = isRtl(code) ? 'rtl' : 'ltr';
  if (st.started) { translateTitle(); walk(document.body); }
  emit();
}

// startTranslation : à appeler une fois, avant le premier rendu. options.email : adresse transmise à MyMemory
// pour relever le quota gratuit (50 000 caractères par jour au lieu de 5 000) ; options.fetchImpl : tests.
export function startTranslation({ email = '', fetchImpl } = {}) {
  if (st.started) return;
  st.email = email;
  st.fetchImpl = fetchImpl;
  st.started = true;
  observe();
  const nav = typeof navigator !== 'undefined' ? (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language]) : [];
  setLanguage(detectLanguage(storage.get(STORE_LANG), nav));
}

export { LANGUAGES };
