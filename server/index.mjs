// Serveur d'Imperium Urbis : sert le site construit (dist/) et l'API d'achat Stripe.
// La clé secrète Stripe (STRIPE_SECRET_KEY) ne quitte jamais le serveur.
//
//   GET  /api/achat/config   → { enabled, environment, price, currency, owned, access }
//                              owned : jeu acheté (session Stripe) ; access : jeu jouable (achat ou easter egg)
//   POST /api/achat/commande → crée une session Stripe Checkout → { id, url }
//   POST /api/achat/capture  → { id } : vérifie la session auprès de Stripe, pose le cookie signé → { ok }
//   POST /api/achat/oeuf     → easter egg des mentions légales : accès gratuit (cookie signé d'un joueur anonyme) → { ok }
//   GET  /jeu.html           → le jeu, seulement avec un cookie valide, achat ou easter egg (sinon /index.html#acheter)
// Dons (méthode reprise de GobaiWebService) : montant libre validé côté serveur, page de paiement hébergée par Stripe.
//   GET  /api/dons/config   → { enabled, environment, minAmount }
//   POST /api/dons/commande → { montant } crée la page de paiement d'un don → { id, url }
//   POST /api/dons/capture  → { id } confirme le don payé auprès de Stripe → { ok, amount }
//   POST /api/dons/annule   → { id } ferme la page de paiement d'un don abandonné → { ok }
import { createServer } from 'node:http';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seoConfig, robotsTxt, sitemapXml } from '../tools/seo.js';
import { connecterBP, routeSauvegardes } from './sauvegardes.mjs';

// Fichiers .env : « Secret File » Render (/etc/secrets/.env) puis .env à la racine du projet.
// Une variable déjà définie dans l'environnement n'est jamais écrasée.
export function loadEnvFile(path, env = process.env) {
  let text;
  try { text = readFileSync(path, 'utf8'); } catch { return false; }
  for (const raw of text.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(raw);
    if (!m || raw.trimStart().startsWith('#')) continue;
    let v = m[2];
    if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, '');
    if (env[m[1]] === undefined || env[m[1]] === '') env[m[1]] = v;
  }
  return true;
}
loadEnvFile('/etc/secrets/.env');
loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));

const ROOT = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const PORT = Number(process.env.PORT || 3000);
const KEY = (process.env.STRIPE_SECRET_KEY || '').trim();
// Prix en euros (centimes calculés côté serveur : le client ne choisit jamais le montant).
const PRICE = Number(process.env.PRIX || process.env.VITE_PRIX || 13.5);
const CENTS = Math.round(PRICE * 100);
const COOKIE = 'imperium_achat';
const MAX_AGE = 400 * 24 * 3600; // plafond des navigateurs
// Clé de signature du cookie : COOKIE_SECRET, sinon dérivée de la clé Stripe.
const SIGN_KEY = process.env.COOKIE_SECRET || createHmac('sha256', 'imperium-urbis-cookie').update(KEY || 'dev').digest('hex');
export const SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]{8,250}$/;
// Joueur anonyme entré par l'easter egg des mentions légales : « j_ » puis 24 caractères base64url.
export const JOUEUR_ID = /^j_[A-Za-z0-9_-]{24}$/;
export const nouveauJoueur = () => `j_${randomBytes(18).toString('base64url')}`;
const FREE = process.env.ACCES_LIBRE === '1';

// ---------- dons (méthode de GobaiWebService : Stripe Checkout hébergé) ----------
// Montant libre en euros, borné et converti en centimes côté serveur : le navigateur ne fixe jamais le prix.
export const DON_MIN = 1; // euros
export const DON_MAX = 100000; // même borne que Gobai
export const CHECKOUT_TTL_MS = 31 * 60 * 1000; // 30 minutes minimum Stripe, plus une marge
// donCents : valide un montant saisi (« 10 » ou « 9,90 ») et le convertit en centimes ; null si invalide.
export function donCents(montant) {
  const n = Number(String(montant ?? '').replace(',', '.'));
  if (!Number.isFinite(n) || n < DON_MIN || n > DON_MAX || Math.round(n * 100) / 100 !== n) return null;
  return Math.round(n * 100);
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.json': 'application/json', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8' };

// ---------- cookie signé ----------
const sign = (v) => createHmac('sha256', SIGN_KEY).update(v).digest('base64url');
export function makeToken(sessionId) { return `${sessionId}.${sign(sessionId)}`; }
export function checkToken(token) {
  if (!token) return false;
  const i = token.lastIndexOf('.');
  if (i < 0) return false;
  const id = token.slice(0, i); const mac = Buffer.from(token.slice(i + 1));
  const good = Buffer.from(sign(id));
  return (SESSION_ID.test(id) || JOUEUR_ID.test(id)) && mac.length === good.length && timingSafeEqual(mac, good);
}
function readCookie(req) {
  const m = (req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`));
  return m ? decodeURIComponent(m.slice(COOKIE.length + 1)) : '';
}
// Identifiant contenu dans un cookie signé valide (session Stripe « cs_… » ou joueur de l'easter egg « j_… »), sinon null.
const cookieId = (req) => { const t = readCookie(req); return checkToken(t) ? t.slice(0, t.lastIndexOf('.')) : null; };
// owned : jeu réellement acheté (seule une session Stripe compte) → le bouton d'achat disparaît de l'accueil.
const owned = (req) => FREE || SESSION_ID.test(cookieId(req) || '');
// access : jeu jouable → achat, ou accès gratuit de l'easter egg (qui laisse le bouton d'achat affiché).
const access = (req) => FREE || Boolean(cookieId(req));
// Joueur : la session Stripe de son achat, ou son identifiant anonyme (easter egg), ou « acces-libre » en développement.
export function joueurDe(req) {
  return cookieId(req) || (FREE ? 'acces-libre' : null);
}

// Base de données BP (DATABASE_URL) : connexion au démarrage ; null si non configurée ou injoignable.
let bp = null;
const bpPrete = connecterBP().then((db) => { bp = db; if (db) console.log('BP : sauvegardes des joueurs actives'); }, (e) => { console.error('BP injoignable :', e.message); });
/** Remplace la connexion BP (tests). */
export function utiliserBP(db) { bp = db; }
function cookieHeader(req, value, maxAge) {
  const secure = (req.headers['x-forwarded-proto'] || '').startsWith('https') ? '; Secure' : '';
  return `${COOKIE}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax${secure}`;
}

// ---------- Stripe (API REST, sans dépendance) ----------
async function stripe(method, path, form) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Stripe-Version': '2024-06-20' },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error?.message || `Stripe ${res.status}`), { status: 502 });
  return data;
}

export function origin(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  const proto = (req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim() === 'https' ? 'https' : 'http';
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  // Nom d'hôte invalide : adresse du build.
  return /^[a-z0-9.-]+(:\d{1,5})?$/i.test(host) ? `${proto}://${host}` : BUILD_SITE;
}

// Adresse écrite dans les pages au build (canonical, Open Graph, JSON-LD) : remplacée à la volée par l'adresse
// réellement demandée, pour que robots.txt, sitemap.xml et les balises correspondent toujours au domaine
// de la propriété Google Search Console (onrender.com ou nom de domaine personnalisé).
const BUILD_SITE = seoConfig().site;

// ---------- réponses ----------
function json(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
}
async function readBody(req, max) {
  const chunks = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > max) throw Object.assign(new Error('Sauvegarde trop volumineuse'), { status: 413 }); chunks.push(c); }
  return Buffer.concat(chunks).toString('utf8');
}
async function readJson(req) {
  let s = '';
  for await (const c of req) { s += c; if (s.length > 4096) throw Object.assign(new Error('Requête trop longue'), { status: 413 }); }
  try { return JSON.parse(s || '{}'); } catch { throw Object.assign(new Error('JSON invalide'), { status: 400 }); }
}

async function api(req, res, path) {
  if (path === '/api/sauvegardes' || path.startsWith('/api/sauvegardes/')) {
    await bpPrete;
    try {
      return await routeSauvegardes({ req, res, path, db: bp, joueur: joueurDe(req), readBody, json });
    } catch (e) {
      if (e instanceof SyntaxError) return json(res, 400, { error: 'JSON invalide' });
      throw e;
    }
  }
  if (path === '/api/achat/config' && req.method === 'GET') {
    return json(res, 200, { enabled: Boolean(KEY), environment: KEY.startsWith('sk_live_') || KEY.startsWith('rk_live_') ? 'live' : 'test', price: PRICE, currency: 'EUR', owned: owned(req), access: access(req) });
  }
  if (path === '/api/achat/commande' && req.method === 'POST') {
    if (!KEY) return json(res, 503, { error: 'Les ventes ne sont pas encore ouvertes.' });
    const o = origin(req);
    const s = await stripe('POST', '/checkout/sessions', {
      mode: 'payment',
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': 'eur',
      'line_items[0][price_data][unit_amount]': String(CENTS),
      'line_items[0][price_data][product_data][name]': 'Imperium Urbis — version complète',
      'line_items[0][price_data][product_data][description]': 'Bâtisseur de cités romaines, jouable dans le navigateur.',
      success_url: `${o}/achat.html?achat=merci&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${o}/index.html?achat=annule#acheter`,
      locale: 'fr',
      'metadata[produit]': 'imperium-urbis',
    });
    return json(res, 200, { id: s.id, url: s.url });
  }
  if (path === '/api/achat/capture' && req.method === 'POST') {
    const { id } = await readJson(req);
    if (typeof id !== 'string' || !SESSION_ID.test(id)) return json(res, 400, { error: 'Identifiant de paiement invalide.' });
    if (!KEY) return json(res, 503, { error: 'Les ventes ne sont pas encore ouvertes.' });
    const s = await stripe('GET', `/checkout/sessions/${encodeURIComponent(id)}`);
    if (s.payment_status !== 'paid' || s.metadata?.produit !== 'imperium-urbis') return json(res, 402, { error: 'Paiement non confirmé par Stripe.' });
    return json(res, 200, { ok: true, amount: (s.amount_total || 0) / 100 }, { 'Set-Cookie': cookieHeader(req, makeToken(id), MAX_AGE) });
  }
  // Easter egg (bouton « start » des mentions légales) : cookie signé avec un identifiant anonyme « j_… ».
  // Il ouvre le jeu (access) sans compter comme un achat (owned) : l'accueil continue de proposer le paiement.
  // Un accès déjà valide (achat ou easter egg) est gardé tel quel, pour ne pas séparer le joueur de ses sauvegardes.
  if (path === '/api/achat/oeuf' && req.method === 'POST') {
    if (checkToken(readCookie(req))) return json(res, 200, { ok: true });
    return json(res, 200, { ok: true }, { 'Set-Cookie': cookieHeader(req, makeToken(nouveauJoueur()), MAX_AGE) });
  }
  if (path === '/api/achat/oublier' && req.method === 'POST') {
    return json(res, 200, { ok: true }, { 'Set-Cookie': cookieHeader(req, '', 0) });
  }

  // ---------- dons : même méthode que GobaiWebService ----------
  if (path === '/api/dons/config' && req.method === 'GET') {
    return json(res, 200, { enabled: Boolean(KEY), environment: KEY.startsWith('sk_live_') || KEY.startsWith('rk_live_') ? 'live' : 'test', currency: 'EUR', minAmount: DON_MIN });
  }
  if (path === '/api/dons/commande' && req.method === 'POST') {
    if (!KEY) return json(res, 503, { error: 'Les dons ne sont pas encore ouverts.' });
    const { montant } = await readJson(req);
    // Le montant est validé et fixé ici, côté serveur : le navigateur ne peut pas le modifier.
    const cents = donCents(montant);
    if (cents === null) return json(res, 400, { error: `Montant invalide : entre ${DON_MIN} et ${DON_MAX} €, deux décimales au maximum.` });
    const o = origin(req);
    const s = await stripe('POST', '/checkout/sessions', {
      mode: 'payment',
      // Bouton « Faire un don » : une session de don, sans client_reference_id.
      submit_type: 'donate',
      locale: 'fr',
      success_url: `${o}/index.html?don=merci&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${o}/index.html?don=annule#don`,
      // Expiration de la page de paiement : 31 minutes.
      expires_at: String(Math.floor((Date.now() + CHECKOUT_TTL_MS) / 1000)),
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': 'eur',
      'line_items[0][price_data][unit_amount]': String(cents),
      'line_items[0][price_data][product_data][name]': "Don au développeur d'Imperium Urbis",
      'metadata[produit]': 'imperium-don',
    });
    return json(res, 200, { id: s.id, url: s.url });
  }
  if (path === '/api/dons/capture' && req.method === 'POST') {
    const { id } = await readJson(req);
    if (typeof id !== 'string' || !SESSION_ID.test(id)) return json(res, 400, { error: 'Identifiant de don invalide.' });
    if (!KEY) return json(res, 503, { error: 'Les dons ne sont pas encore ouverts.' });
    const s = await stripe('GET', `/checkout/sessions/${encodeURIComponent(id)}`);
    if (s.payment_status !== 'paid' || s.metadata?.produit !== 'imperium-don') return json(res, 402, { error: 'Paiement non confirmé par Stripe.' });
    return json(res, 200, { ok: true, amount: (s.amount_total || 0) / 100 });
  }
  if (path === '/api/dons/annule' && req.method === 'POST') {
    const { id } = await readJson(req);
    if (typeof id !== 'string' || !SESSION_ID.test(id)) return json(res, 400, { error: 'Identifiant de don invalide.' });
    if (!KEY) return json(res, 503, { error: 'Les dons ne sont pas encore ouverts.' });
    try {
      // Ferme la page encore ouverte ; si elle vient d'être payée, rien n'est annulé.
      const s = await stripe('POST', `/checkout/sessions/${encodeURIComponent(id)}/expire`, {});
      return json(res, 200, { ok: s.status === 'expired' });
    } catch {
      // Déjà expirée ou payée : le donateur n'a rien perdu.
      return json(res, 200, { ok: true });
    }
  }

  return json(res, 404, { error: 'Introuvable' });
}

// ---------- fichiers statiques ----------
async function serveFile(req, res, path) {
  if (path === '/' || path === '') path = '/index.html';
  if (path === '/jeu') path = '/jeu.html';
  if (path === '/jeu.html' && !access(req)) { res.writeHead(302, { Location: '/index.html#acheter', 'Cache-Control': 'no-store' }); return res.end(); }
  // robots.txt et sitemap.xml : générés pour le domaine demandé.
  if (path === '/robots.txt' || path === '/sitemap.xml') {
    const site = { site: origin(req) };
    const body = path === '/robots.txt' ? robotsTxt(site) : sitemapXml(site);
    res.writeHead(200, { 'Content-Type': TYPES[extname(path)], 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff' });
    return res.end(req.method === 'HEAD' ? undefined : body);
  }
  const file = normalize(join(ROOT, decodeURIComponent(path)));
  if (!file.startsWith(ROOT + sep)) { res.writeHead(403); return res.end(); }
  let st;
  try { st = await stat(file); } catch { st = null; }
  if (!st || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Page introuvable'); }
  const type = TYPES[extname(file)] || 'application/octet-stream';
  const cache = path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : extname(file) === '.html' ? 'no-cache' : 'public, max-age=604800';
  const headers = { 'Content-Type': type, 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' };
  // Vidéo : requêtes partielles (lecture et avance rapide dans le navigateur).
  const range = req.headers.range && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
  let data = await readFile(file);
  if (extname(file) === '.html') {
    const o = origin(req);
    if (o !== BUILD_SITE) data = Buffer.from(data.toString('utf8').replaceAll(BUILD_SITE, o));
  }
  if (range) {
    const start = range[1] ? Number(range[1]) : Math.max(0, data.length - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), data.length - 1) : data.length - 1;
    if (start >= data.length || start > end) { res.writeHead(416, { 'Content-Range': `bytes */${data.length}` }); return res.end(); }
    res.writeHead(206, { ...headers, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${data.length}`, 'Content-Length': end - start + 1 });
    return res.end(req.method === 'HEAD' ? undefined : data.subarray(start, end + 1));
  }
  res.writeHead(200, { ...headers, 'Accept-Ranges': 'bytes', 'Content-Length': data.length });
  res.end(req.method === 'HEAD' ? undefined : data);
}

export const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  try {
    if (path.startsWith('/api/')) return await api(req, res, path);
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    return await serveFile(req, res, path);
  } catch (e) {
    if (!e.status) console.error(e);
    if (!res.headersSent) json(res, e.status || 500, { error: e.status ? e.message : 'Erreur du serveur.' });
  }
});

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  server.listen(PORT, () => console.log(`Imperium Urbis : http://localhost:${PORT} (Stripe ${KEY ? (KEY.includes('_live_') ? 'live' : 'test') : 'non configuré'})`));
}
