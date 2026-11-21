# Imperium Urbis — version web

Bâtisseur de cités romaines en **React + Three.js**, publié comme **site 100 % statique** :

| Page | Rôle |
|---|---|
| `index.html` | Accueil : vidéo de présentation (motion design), présentation du jeu, campagne, prix, FAQ, fenêtre d’achat. |
| `achat.html` | Retour de Stripe : enregistre l’achat dans un cookie puis ouvre le jeu. |
| `jeu.html` | Le jeu. Sans cookie d’achat, renvoie vers `index.html#acheter`. |

Le moteur (`src/game/engine/`) est le portage JavaScript du moteur Go d’`ImperiumUrbis.exe` : mêmes règles, et sauvegardes **compatibles dans les deux sens** (bouton « Exporter » dans le jeu, « Importer une sauvegarde » dans le menu).

## Démarrer

```bash
npm install
cp .env.example .env      # puis renseigner le lien de paiement Stripe
npm run dev               # http://localhost:5173
npm test                  # tests du moteur et du paywall
npm run build             # site statique dans dist/
```

En développement, `VITE_ACCES_LIBRE=1` dans `.env` ignore le paywall.

## Paiement Stripe (sans serveur)

Le paywall suit le modèle de la fenêtre de dons de GobaiWebService (sur-titre, pastille « Mode test », bouton « par carte bancaire », mention Stripe, message « pas encore ouvertes »), mais utilise un **Payment Link** Stripe pour rester entièrement statique :

1. Dashboard Stripe → **Liens de paiement** → créer un lien pour le produit « Imperium Urbis » (prix unique).
2. Onglet **Après le paiement** → « Ne pas afficher de page de confirmation » → rediriger vers :
   `https://VOTRE-DOMAINE/achat.html?achat=merci&session_id={CHECKOUT_SESSION_ID}`
3. Renseigner les variables du build :
   - `VITE_STRIPE_PAYMENT_LINK` : l’adresse du lien (`https://buy.stripe.com/...`). Un lien de test (`/test_...`) affiche « Mode test ».
   - `VITE_PRIX` : le prix affiché (doit correspondre au lien).

Parcours : bouton « Acheter … par carte bancaire » → page Stripe → `achat.html` vérifie la forme de `session_id` (`cs_test_…` / `cs_live_…`), le garde dans le cookie `imperium_achat` (400 jours, prolongé à chaque partie, `SameSite=Lax`, `Secure` en HTTPS), nettoie l’adresse et ouvre `jeu.html`.

> **Limite assumée du tout-statique** : sans serveur, l’identifiant de session n’est pas vérifié auprès de Stripe ; le cookie est une protection côté navigateur, contournable par un utilisateur averti. Pour une vérification forte, il faut un petit endpoint serveur (fonction serverless) qui interroge l’API Stripe avant de délivrer l’accès.

## Déploiement

- **Render** : `render.yaml` décrit un site statique (`npm install && npm run build`, publication de `dist/`). Définir `VITE_STRIPE_PAYMENT_LINK` dans le tableau de bord.
- Tout hébergeur statique convient (GitHub Pages, Netlify…) : `base: './'` rend le site utilisable dans un sous-dossier.
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
src/config.js                        variables du build (lien Stripe, prix)
src/home/                            accueil + styles du site
src/paywall/                         fenêtre d’achat, cookie, retour Stripe
src/achat/                           page de retour de paiement
src/game/engine/                     moteur (définitions, simulation, sauvegardes)
src/game/render/                     rendu Three.js (terrain, bâtiments instanciés, passants)
src/game/ui/                         interface React (barres, panneau, fenêtres, minicarte, menu)
tests/                               tests du moteur et du paywall, ville de démonstration
tools/motion/                        vidéo de présentation (page + script de rendu)
public/                              favicon, vidéo et affiche
```

## Commandes du jeu

ZQSD / flèches : déplacer · molette : zoom · clic droit glissé ou A/E : tourner · clic : construire / inspecter · Échap : annuler · Espace : pause · 1–4 : vitesse · O : calques · M : commerce · K : conseillers · H : aide · Tab : minicarte · Ctrl+S : sauvegarder.
