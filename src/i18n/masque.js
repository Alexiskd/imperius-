// Protège ce qui ne doit pas être traduit avant l'envoi au moteur : noms propres du site et nombres.
// Le texte devient un « gabarit » (« Pop : {0} ») : les nombres qui changent à chaque tour de jeu ne
// créent donc pas de nouvelle traduction, et le nom du jeu reste intact dans toutes les langues.

// Noms jamais traduits (les plus longs d'abord, pour que « ImperiumUrbis.exe » passe avant « ImperiumUrbis »).
export const PROTECTED = ['ImperiumUrbis.exe', 'Imperium Urbis', 'ImperiumUrbis', 'Three.js', 'WebGL', 'Stripe', 'React'];

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Un nom protégé, ou un nombre (séparateurs de milliers espace / espace insécable, décimales . ou ,).
const RE = new RegExp(`(${PROTECTED.map(esc).join('|')})|(\\d+(?:[\\u202f\\u00a0]\\d{3})*(?:[.,]\\d+)?)`, 'g');

// splitSpaces : sépare les blancs de début et de fin du texte (ils sont remis tels quels après traduction).
export function splitSpaces(text) {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
  return { lead: m[1], core: m[2], trail: m[3] };
}

// mask : { key, values }. key = texte avec {0}, {1}… à la place des nombres et noms protégés, blancs compactés.
export function mask(core) {
  const values = [];
  // Les repères d'abord (les milliers sont séparés par une espace insécable), puis compactage des blancs.
  const key = core.replace(RE, (m) => `{${values.push(m) - 1}}`).replace(/\s+/g, ' ');
  return { key, values };
}

// needsTranslation : faux si le gabarit ne contient aucune lettre (nombres, symboles, nom du jeu seul).
export const needsTranslation = (key) => /\p{L}/u.test(key.replace(/\{\d+\}/g, ''));

// unmask : remet les valeurs à leur place. Renvoie null si le moteur a perdu ou dupliqué un repère
// (la traduction est alors rejetée plutôt qu'affichée avec un nombre manquant).
export function unmask(translated, values) {
  const seen = new Set();
  const out = translated.replace(/\{\s*(\d+)\s*\}/g, (m, i) => {
    const n = Number(i);
    if (n >= values.length || seen.has(n)) { seen.add(-1); return m; }
    seen.add(n);
    return values[n];
  });
  if (seen.has(-1) || seen.size !== values.length) return null;
  return out;
}
