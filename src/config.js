// Configuration du site côté navigateur. Le prix et l'ouverture des ventes viennent du serveur (/api/achat/config).

// Variables d'environnement (objet vide hors Vite, par exemple dans les tests Node).
const env = import.meta.env || {};

// Accès libre (développement uniquement) : le paywall est ignoré si VITE_ACCES_LIBRE vaut 1.
export const FREE_ACCESS = env.VITE_ACCES_LIBRE === '1';

// money : met un montant en forme, en français, en euros, avec des décimales seulement si besoin.
export const money = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
