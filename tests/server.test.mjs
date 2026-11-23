// Tests du serveur d'achat : Stripe est simulé, aucun appel réseau réel.
import assert from 'node:assert/strict';

process.env.STRIPE_SECRET_KEY = 'sk_test_fauxpourlestests';
process.env.PRIX = '13.5';
const realFetch = globalThis.fetch;
const calls = [];
const SID = 'cs_test_a1B2c3D4e5F6g7H8';
let paid = 'paid';
globalThis.fetch = async (url, opts = {}) => {
  if (String(url).startsWith('https://api.stripe.com/')) {
    calls.push({ url: String(url), opts });
    assert.equal(opts.headers.Authorization, 'Bearer sk_test_fauxpourlestests');
    if (opts.method === 'POST') return new Response(JSON.stringify({ id: SID, url: 'https://checkout.stripe.com/c/pay/' + SID }), { status: 200 });
    return new Response(JSON.stringify({ id: SID, payment_status: paid, amount_total: 1350, metadata: { produit: 'imperium-urbis' } }), { status: 200 });
  }
  return realFetch(url, opts);
};

const { server, makeToken, checkToken, loadEnvFile } = await import('../server/index.mjs');

// lecture d'un fichier .env (Secret File Render)
{
  const { writeFileSync, mkdtempSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const f = join(mkdtempSync(join(tmpdir(), 'iu-')), '.env');
  writeFileSync(f, '# commentaire\nSTRIPE_SECRET_KEY="sk_test_abc"\nexport PRIX=12.5 # prix\nDEJA=nouveau\n');
  const env = { DEJA: 'ancien' };
  assert.ok(loadEnvFile(f, env));
  assert.deepEqual(env, { DEJA: 'ancien', STRIPE_SECRET_KEY: 'sk_test_abc', PRIX: '12.5' });
  assert.equal(loadEnvFile(f + '.absent', env), false);
}
await new Promise((r) => server.listen(0, r));
const B = `http://127.0.0.1:${server.address().port}`;
const post = (p, body) => realFetch(B + p, { method: 'POST', body: JSON.stringify(body || {}), headers: { 'Content-Type': 'application/json' } });

try {
  let r = await (await realFetch(`${B}/api/achat/config`)).json();
  assert.deepEqual(r, { enabled: true, environment: 'test', price: 13.5, currency: 'EUR', owned: false });

  r = await (await post('/api/achat/commande')).json();
  assert.equal(r.id, SID);
  const form = new URLSearchParams(calls[0].opts.body);
  assert.equal(form.get('line_items[0][price_data][unit_amount]'), '1350');
  assert.equal(form.get('mode'), 'payment');
  assert.match(form.get('success_url'), /\/achat\.html\?achat=merci&session_id=\{CHECKOUT_SESSION_ID\}$/);

  // jeu.html protégé sans cookie
  let res = await realFetch(`${B}/jeu.html`, { redirect: 'manual' });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/index.html#acheter');

  // identifiant mal formé, paiement non payé
  assert.equal((await post('/api/achat/capture', { id: 'nimportequoi' })).status, 400);
  paid = 'unpaid';
  assert.equal((await post('/api/achat/capture', { id: SID })).status, 402);

  // paiement confirmé : cookie signé HttpOnly
  paid = 'paid';
  res = await post('/api/achat/capture', { id: SID });
  assert.equal(res.status, 200);
  const cookie = res.headers.get('set-cookie');
  assert.match(cookie, /^imperium_achat=.+; Max-Age=34560000; Path=\/; HttpOnly; SameSite=Lax$/);
  const jar = cookie.split(';')[0];
  r = await (await realFetch(`${B}/api/achat/config`, { headers: { cookie: jar } })).json();
  assert.equal(r.owned, true);

  // cookie falsifié refusé
  assert.ok(checkToken(makeToken(SID)));
  assert.ok(!checkToken(`${SID}.faux`));
  assert.ok(!checkToken(makeToken(SID).replace('a1B2', 'a1B3')));
  r = await (await realFetch(`${B}/api/achat/config`, { headers: { cookie: `imperium_achat=${SID}.AAAA` } })).json();
  assert.equal(r.owned, false);

  // easter egg des mentions légales : cookie signé anonyme, jeu.html accessible
  const avant = calls.length;
  res = await post('/api/achat/oeuf');
  assert.equal(res.status, 200);
  const egg = res.headers.get('set-cookie').split(';')[0];
  assert.match(egg, /^imperium_achat=j_[A-Za-z0-9_-]{24}\./);
  r = await (await realFetch(`${B}/api/achat/config`, { headers: { cookie: egg } })).json();
  assert.equal(r.owned, true);
  res = await realFetch(`${B}/jeu.html`, { headers: { cookie: egg }, redirect: 'manual' });
  assert.notEqual(res.status, 302);
  // accès déjà valide : pas de nouveau cookie
  res = await realFetch(`${B}/api/achat/oeuf`, { method: 'POST', body: '{}', headers: { cookie: egg } });
  assert.equal(res.headers.get('set-cookie'), null);
  assert.equal(calls.length, avant); // aucun appel à Stripe

  // pas de sortie du dossier publié
  res = await realFetch(`${B}/..%2fpackage.json`);
  assert.ok([403, 404].includes(res.status));
  // robots.txt et sitemap.xml : adresse du domaine demandé
  const h = { 'x-forwarded-host': 'imperium-urbis-app.onrender.com', 'x-forwarded-proto': 'https' };
  res = await realFetch(`${B}/robots.txt`, { headers: h });
  assert.equal(res.status, 200);
  assert.match(await res.text(), /^Sitemap: https:\/\/imperium-urbis-app\.onrender\.com\/sitemap\.xml$/m);
  res = await realFetch(`${B}/sitemap.xml`, { headers: { ...h, 'x-forwarded-host': 'www.exemple.fr' } });
  assert.match(res.headers.get('content-type'), /xml/);
  const map = await res.text();
  assert.match(map, /<loc>https:\/\/www\.exemple\.fr\/<\/loc>/);
  assert.ok(!map.includes('onrender.com'));
  res = await realFetch(`${B}/robots.txt`, { headers: { 'x-forwarded-host': 'mauvais hôte/<x>' } });
  assert.match(await res.text(), /Sitemap: https:\/\/imperium-urbis-app\.onrender\.com\/sitemap\.xml/);
  console.log('server: ok');
} finally {
  server.close();
}
