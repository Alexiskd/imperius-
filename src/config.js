// Configuration du site, lue au moment du build (variables Vite, voir .env.example).

// Variables d'environnement (objet vide hors Vite, par exemple dans les tests Node).
const env = import.meta.env || {};

// Lien de paiement Stripe (Payment Link) du jeu ; vide = ventes pas encore ouvertes.
export const PAYMENT_LINK = (env.VITE_STRIPE_PAYMENT_LINK || '').trim();
// Prix affiché, en euros.
export const PRICE = Number(env.VITE_PRIX || 9.99);
// Mode test : un lien de paiement de test Stripe commence par https://buy.stripe.com/test_.
export const TEST_MODE = /\/test_/.test(PAYMENT_LINK);
// Accès libre (développement uniquement) : le paywall est ignoré si VITE_ACCES_LIBRE vaut 1.
export const FREE_ACCESS = env.VITE_ACCES_LIBRE === '1';

// money : met un montant en forme, en français, en euros, avec des décimales seulement si besoin.
export const money = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
