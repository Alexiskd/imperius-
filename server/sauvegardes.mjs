// Sauvegardes des joueurs dans la base de données BP (PostgreSQL Render, variable DATABASE_URL).
// Chaque sauvegarde (manuelle ou automatique) devient un fichier texte « .txt » rangé dans la table
// imperium_sauvegardes : le contenu est la partie au format JSON de l'exe, stockée telle quelle en texte.
// Le joueur est identifié par son achat (session Stripe du cookie signé) : chacun ne voit que ses fichiers.
//
//   POST /api/sauvegardes            { emplacement, contenu } → { id, nom, taille }
//   GET  /api/sauvegardes            → { sauvegardes: [{ id, nom, emplacement, taille, cree_le }] }
//   GET  /api/sauvegardes/<id>.txt   → le fichier texte (téléchargement)

// Taille maximale d'une sauvegarde : 8 Mo de texte.
export const MAX_TAILLE = 8 * 1024 * 1024;
// Emplacements reconnus (clés du jeu) ; tout autre nom est refusé.
const EMPLACEMENTS = new Set(['imperium.save', 'imperium.autosave', 'export']);

const SCHEMA = `
CREATE TABLE IF NOT EXISTS imperium_sauvegardes (
  id          BIGSERIAL PRIMARY KEY,
  joueur      TEXT        NOT NULL,
  emplacement TEXT        NOT NULL,
  nom_fichier TEXT        NOT NULL,
  contenu     TEXT        NOT NULL,
  taille      INTEGER     NOT NULL,
  cree_le     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS imperium_sauvegardes_joueur ON imperium_sauvegardes (joueur, cree_le DESC);`;

/** Connexion à BP : renvoie { query, end } ou null si DATABASE_URL est absente. */
export async function connecterBP(url = process.env.DATABASE_URL) {
  if (!url) return null;
  const { default: pg } = await import('pg');
  // Adresse externe Render (…render.com) : SSL obligatoire ; adresse interne (dpg-…) : sans SSL.
  const externe = /\.render\.com(:\d+)?\//.test(url) || /sslmode=require/.test(url);
  const pool = new pg.Pool({ connectionString: url, max: 4, ssl: externe ? { rejectUnauthorized: false } : undefined });
  await pool.query(SCHEMA);
  return { query: (text, params) => pool.query(text, params), end: () => pool.end() };
}

/** Nom du fichier texte : imperium_<joueur>_<emplacement>_<date>.txt */
export function nomFichier(joueur, emplacement, date = new Date()) {
  const j = joueur.replace(/^cs_(test|live)_/, '').slice(-10);
  const e = emplacement.replace(/^imperium\./, '');
  const d = date.toISOString().replace(/\.\d+Z$/, '').replace(/[-:]/g, '').replace('T', '-');
  return `imperium_${j}_${e}_${d}.txt`;
}

/** Routes des sauvegardes. `db` : connexion BP (ou null), `joueur` : identifiant du joueur ou null. */
export async function routeSauvegardes({ req, path, db, joueur, readBody, json, res }) {
  if (!db) return json(res, 503, { error: 'Base de données non configurée (DATABASE_URL).' });
  if (!joueur) return json(res, 401, { error: 'Achetez le jeu pour enregistrer vos parties.' });

  if (path === '/api/sauvegardes' && req.method === 'POST') {
    const { emplacement, contenu } = JSON.parse(await readBody(req, MAX_TAILLE) || '{}');
    if (!EMPLACEMENTS.has(emplacement)) return json(res, 400, { error: 'Emplacement de sauvegarde inconnu.' });
    if (typeof contenu !== 'string' || !contenu.startsWith('{')) return json(res, 400, { error: 'Sauvegarde invalide.' });
    const nom = nomFichier(joueur, emplacement);
    const taille = Buffer.byteLength(contenu);
    const r = await db.query(
      'INSERT INTO imperium_sauvegardes (joueur, emplacement, nom_fichier, contenu, taille) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [joueur, emplacement, nom, contenu, taille],
    );
    return json(res, 201, { id: Number(r.rows[0].id), nom, taille });
  }

  if (path === '/api/sauvegardes' && req.method === 'GET') {
    const r = await db.query(
      'SELECT id, nom_fichier, emplacement, taille, cree_le FROM imperium_sauvegardes WHERE joueur = $1 ORDER BY cree_le DESC LIMIT 200',
      [joueur],
    );
    return json(res, 200, { sauvegardes: r.rows.map((s) => ({ id: Number(s.id), nom: s.nom_fichier, emplacement: s.emplacement, taille: s.taille, cree_le: s.cree_le })) });
  }

  const m = /^\/api\/sauvegardes\/(\d{1,18})\.txt$/.exec(path);
  if (m && req.method === 'GET') {
    const r = await db.query('SELECT nom_fichier, contenu FROM imperium_sauvegardes WHERE id = $1 AND joueur = $2', [m[1], joueur]);
    if (!r.rows.length) return json(res, 404, { error: 'Sauvegarde introuvable.' });
    const { nom_fichier: nom, contenu } = r.rows[0];
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': `attachment; filename="${nom}"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    return res.end(contenu);
  }

  return json(res, 404, { error: 'Introuvable' });
}
