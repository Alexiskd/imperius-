// Tests des sauvegardes en ligne (BP simulée en mémoire, aucun accès réseau).
import assert from 'node:assert/strict';

process.env.STRIPE_SECRET_KEY = 'sk_test_fauxpourlestests';
delete process.env.DATABASE_URL;
const { server, makeToken, utiliserBP } = await import('../server/index.mjs');
const { nomFichier } = await import('../server/sauvegardes.mjs');

// BP simulée : une table en mémoire.
const rows = [];
const db = {
  async query(sql, p) {
    if (sql.startsWith('INSERT')) { const id = rows.length + 1; rows.push({ id, joueur: p[0], emplacement: p[1], nom_fichier: p[2], contenu: p[3], taille: p[4], cree_le: new Date().toISOString() }); return { rows: [{ id }] }; }
    if (sql.startsWith('SELECT id')) return { rows: rows.filter((r) => r.joueur === p[0]).reverse() };
    if (sql.startsWith('SELECT nom_fichier')) return { rows: rows.filter((r) => String(r.id) === p[0] && r.joueur === p[1]) };
    throw new Error('requête inattendue');
  },
};

await new Promise((r) => server.listen(0, r));
const B = `http://127.0.0.1:${server.address().port}`;
const A = 'cs_test_joueurAAAAAAAA1'; const Bj = 'cs_test_joueurBBBBBBBB2';
const ck = (id) => ({ cookie: `imperium_achat=${encodeURIComponent(makeToken(id))}` });
const post = (body, h = {}) => fetch(`${B}/api/sauvegardes`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...h }, body: JSON.stringify(body) });

try {
  // base non configurée
  assert.equal((await post({ emplacement: 'imperium.save', contenu: '{}' }, ck(A))).status, 503);
  utiliserBP(db);
  // sans achat
  assert.equal((await post({ emplacement: 'imperium.save', contenu: '{}' })).status, 401);
  // emplacement ou contenu invalide
  assert.equal((await post({ emplacement: 'autre', contenu: '{}' }, ck(A))).status, 400);
  assert.equal((await post({ emplacement: 'imperium.save', contenu: 'pas du json' }, ck(A))).status, 400);
  // enregistrement
  const partie = JSON.stringify({ Version: 2, Money: 5000, Tiles: [] });
  let r = await post({ emplacement: 'imperium.save', contenu: partie }, ck(A));
  assert.equal(r.status, 201);
  const s1 = await r.json();
  assert.match(s1.nom, /^imperium_rAAAAAAAA1_save_\d{8}-\d{6}\.txt$/);
  assert.equal(s1.taille, Buffer.byteLength(partie));
  await post({ emplacement: 'imperium.autosave', contenu: partie }, ck(A));
  await post({ emplacement: 'imperium.save', contenu: '{"autre":1}' }, ck(Bj));
  // liste : seulement celles du joueur
  const liste = (await (await fetch(`${B}/api/sauvegardes`, { headers: ck(A) })).json()).sauvegardes;
  assert.equal(liste.length, 2);
  assert.deepEqual(liste.map((s) => s.emplacement), ['imperium.autosave', 'imperium.save']);
  // téléchargement .txt
  r = await fetch(`${B}/api/sauvegardes/${s1.id}.txt`, { headers: ck(A) });
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /^text\/plain/);
  assert.match(r.headers.get('content-disposition'), /attachment; filename="imperium_.*\.txt"/);
  assert.equal(await r.text(), partie);
  // un autre joueur ne peut pas lire ce fichier
  assert.equal((await fetch(`${B}/api/sauvegardes/${s1.id}.txt`, { headers: ck(Bj) })).status, 404);
  // trop volumineux
  r = await post({ emplacement: 'imperium.save', contenu: '{' + 'x'.repeat(8 * 1024 * 1024) + '}' }, ck(A));
  assert.equal(r.status, 413);
  // nom de fichier
  assert.equal(nomFichier('cs_live_abcdefghijKLMNOPQRST', 'imperium.autosave', new Date('2026-11-21T20:15:42.123Z')), 'imperium_KLMNOPQRST_autosave_20261121-201542.txt');
  console.log('sauvegardes: ok');
} finally {
  server.close();
}
