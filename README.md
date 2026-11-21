# Imperium Urbis — version web

Bâtisseur de cités romaines en **React + Three.js**. Le site est servi par un petit serveur Node **sans dépendance** (`server/index.mjs`) qui détient la clé secrète Stripe :

| Page | Rôle |
|---|---|
| `index.html` | Accueil : vidéo de présentation (motion design), présentation du jeu, campagne, prix, FAQ, fenêtre d’achat. |
| `achat.html` | Retour de Stripe : le serveur vérifie le paiement, pose le cookie d’achat signé, puis ouvre le jeu. |
| `jeu.html` | Le jeu. Le serveur ne le sert qu’avec un cookie d’achat valide, sinon renvoie vers `index.html#acheter`. |

Le moteur (`src/game/engine/`) est le portage JavaScript du moteur Go d’`ImperiumUrbis.exe` : mêmes règles, et sauvegardes **compatibles dans les deux sens** (bouton « Exporter » dans le jeu, « Importer une sauvegarde » dans le menu).

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
| `PRIX` | Prix en euros (défaut 9.99). |
| `COOKIE_SECRET` | Clé de signature du cookie (générée par Render ; sinon dérivée de la clé Stripe). |
| `PUBLIC_URL` | Facultatif : adresse publique pour les retours Stripe. |

Carte de test : `4242 4242 4242 4242`, date future, CVC quelconque.

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
