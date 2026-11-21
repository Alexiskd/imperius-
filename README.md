# Imperium Urbis — version web

Bâtisseur de cités romaines en **React + Three.js**. Le site est servi par un petit serveur Node **sans dépendance** (`server/index.mjs`) qui détient la clé secrète Stripe :

| Page | Rôle |
|---|---|
| `index.html` | Accueil : vidéo de présentation (motion design), présentation du jeu, campagne, prix, FAQ, fenêtre d’achat. |
| `achat.html` | Retour de Stripe : le serveur vérifie le paiement, pose le cookie d’achat signé, puis ouvre le jeu. |
| `jeu.html` | Le jeu. Le serveur ne le sert qu’avec un cookie d’achat valide, sinon renvoie vers `index.html#acheter`. |

Le moteur (`src/game/engine/`) est le portage JavaScript du moteur Go d’`ImperiumUrbis.exe` : mêmes règles, et sauvegardes **compatibles dans les deux sens** (bouton « Exporter » dans le jeu, « Importer une sauvegarde » dans le menu).

## Traduction du site

Un sélecteur de langue (accueil, menu et barre du haut du jeu, page d’achat) traduit **tout le texte affiché** dans plus de 80 langues et écritures, de droite à gauche comprises (arabe, hébreu, persan, ourdou, kurde). Langue par défaut : celle du navigateur ; le choix est mémorisé (`imperium.lang`). Le français est la langue source.

| Fichier | Rôle |
|---|---|
| `src/i18n/moteur.js` | Parcourt les nœuds texte et les attributs `title`, `placeholder`, `aria-label`, `alt` ; un `MutationObserver` traduit ensuite ce que React écrit (HUD, messages, fenêtres). Cache mémoire + `localStorage` (3 000 textes par langue). |
| `src/i18n/mymemory.js` | Client du moteur **MyMemory** (gratuit, sans clé), requêtes de 380 caractères au plus, détection du quota épuisé. |
| `src/i18n/masque.js` | Remplace nombres et noms propres par des repères (`Pop : {0}`) avant l'envoi : les chiffres qui changent à chaque tour ne génèrent aucune requête, et « Imperium Urbis », Stripe, etc. ne sont jamais traduits. |
| `src/i18n/langues.js` | Liste des langues, détection de la langue du navigateur. |

Ajouter `translate="no"` (ou la classe `notranslate`) à un élément l'exclut de la traduction. Si le quota gratuit est atteint, les textes restent en français et le sélecteur l'indique dans son infobulle ; `VITE_TRADUCTION_EMAIL` relève ce quota (voir `.env.example`). Les textes dessinés dans le canvas 3D, s'il y en avait, ne sont pas traduits.

## Démarrer

```bash
npm install
cp .env.example .env      # puis renseigner STRIPE_SECRET_KEY (sk_test_… pour tester)
npm run serveur           # API d'achat sur http://localhost:3000
npm run dev               # site sur http://localhost:5173 (/api relayé vers le serveur)
npm test                  # tests du moteur et du paywall
npm run build && npm start # production : dist/ + API sur $PORT
```

En développement, `VITE_ACCES_LIBRE=1` dans `.env` ignore le paywall.

## Paiement Stripe (clé API)

Le paywall suit le modèle de la fenêtre de dons de GobaiWebService : configuration chargée depuis l’API, sur-titre, pastille « Mode test », bouton « par carte bancaire », mention Stripe, message « pas encore ouvertes ».

Il suffit de la **clé secrète** Stripe (`STRIPE_SECRET_KEY`, côté serveur uniquement) :

1. Bouton « Acheter … par carte bancaire » → `POST /api/achat/commande` : le serveur crée une session **Stripe Checkout** (prix fixé par `PRIX`, jamais par le navigateur).
2. Paiement sur la page sécurisée de Stripe → retour sur `achat.html?achat=merci&session_id=cs_…` (abandon : `index.html?achat=annule`).
3. `POST /api/achat/capture` : le serveur relit la session chez Stripe, exige `payment_status = paid`, puis pose le cookie `imperium_achat` **signé HMAC, HttpOnly**, `SameSite=Lax`, `Secure` en HTTPS, 400 jours.
4. `jeu.html` n’est servi qu’avec ce cookie ; un cookie falsifié est refusé.

| Variable | Rôle |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` (mode test) ou `sk_live_…`. Vide = « ventes pas encore ouvertes ». |
| `PRIX` | Prix en euros (défaut 13.5). |
| `COOKIE_SECRET` | Clé de signature du cookie (générée par Render ; sinon dérivée de la clé Stripe). |
| `PUBLIC_URL` | Facultatif : adresse publique pour les retours Stripe. |

Carte de test : `4242 4242 4242 4242`, date future, CVC quelconque.

## Référencement (SEO)

- `index.html` : titre et description, `canonical`, `robots`, Open Graph et Twitter (image et vidéo), données structurées JSON-LD (`WebSite`, `VideoGame` avec l’offre, `VideoObject`). `jeu.html` et `achat.html` sont en `noindex`.
- Au build, `tools/seo.js` remplace `%SITE_URL%` et `%PRIX%` et écrit `robots.txt` et `sitemap.xml` (avec la vidéo) dans `dist/`.
- Variables : `SITE_URL` (adresse publique, défaut `https://imperium-urbis-app.onrender.com`), `GOOGLE_SITE_VERIFICATION` (code de la balise donnée par Google Search Console).

Google Search Console : ajouter la propriété « Préfixe d’URL » avec l’adresse du site, choisir « Balise HTML », copier la valeur `content` dans `GOOGLE_SITE_VERIFICATION`, redéployer, valider, puis soumettre `sitemap.xml`.

## Déploiement

- **Render** : `render.yaml` décrit un **Web Service Node** (`npm install && npm run build`, puis `npm start`). Définir `STRIPE_SECRET_KEY` dans *Environment*.
- Tout hébergeur Node ≥ 20 convient : le serveur lit `PORT`.
- La CI GitHub (`.github/workflows/build.yml`) lance les tests et le build à chaque push et pull request.

## Vidéo de présentation

`public/video/presentation.mp4` (1280×720, 24 s) est rendue **avec le moteur 3D du jeu** : la cité de démonstration se construit (routes, tentes, production, villas, monuments, défense) pendant que la caméra la survole, avec titres animés.

```bash
npx vite                                                   # sert tools/motion/
python tools/motion/render.py http://localhost:5173/tools/motion/ public/video
```

`tools/motion/index.html?live` montre l’animation en temps réel.

## Arborescence

```
index.html, jeu.html, achat.html     pages (entrées Vite)
src/config.js                        format des prix, accès libre de développement
src/home/                            accueil + styles du site
server/index.mjs                     serveur : fichiers, API d’achat Stripe, protection du jeu
src/paywall/                         fenêtre d’achat, appels de l’API, retour Stripe
src/achat/                           page de retour de paiement
src/game/engine/                     moteur (définitions, simulation, sauvegardes)
src/game/render/                     rendu Three.js (terrain, bâtiments instanciés, passants)
src/game/ui/                         interface React (barres, panneau, fenêtres, minicarte, menu)
tests/                               tests du moteur, du retour Stripe et du serveur, ville de démonstration
tools/motion/                        vidéo de présentation (page + script de rendu)
public/                              favicon, vidéo et affiche
```

## Commandes du jeu

ZQSD / flèches : déplacer · molette : zoom · clic droit glissé ou A/E : tourner · clic : construire / inspecter · Échap : annuler · Espace : pause · 1–4 : vitesse · O : calques · M : commerce · K : conseillers · H : aide · Tab : minicarte · Ctrl+S : sauvegarder.
