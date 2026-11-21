// Tests du moteur de traduction : langues, gabarits (nombres et noms protégés), client MyMemory simulé.
import assert from 'node:assert/strict';
import { LANGUAGES, matchLanguage, detectLanguage, isRtl } from '../src/i18n/langues.js';
import { mask, unmask, needsTranslation, splitSpaces } from '../src/i18n/masque.js';
import { translate, splitForApi, ENDPOINT, TranslateError } from '../src/i18n/mymemory.js';

// langues
assert.equal(new Set(LANGUAGES.map(([c]) => c)).size, LANGUAGES.length, 'codes de langue uniques');
assert.equal(matchLanguage('en-US'), 'en');
assert.equal(matchLanguage('pt-BR'), 'pt-BR');
assert.equal(matchLanguage('pt'), 'pt-PT');
assert.equal(matchLanguage('zh-HK'), 'zh-TW');
assert.equal(matchLanguage('zh'), 'zh-CN');
assert.equal(matchLanguage('nb-NO'), 'no');
assert.equal(matchLanguage('xx'), null);
assert.equal(detectLanguage(null, ['xx', 'de-AT', 'fr']), 'de');   // langue du navigateur
assert.equal(detectLanguage('ja', ['de']), 'ja');                  // le choix mémorisé gagne
assert.equal(detectLanguage(null, ['xx']), 'fr');
assert.ok(isRtl('ar') && isRtl('he-IL') && !isRtl('fr'));

// gabarits
let m = mask('Deniers : 12 345 (+1,5/mois)');
assert.equal(m.key, 'Deniers : {0} (+{1}/mois)');
assert.deepEqual(m.values, ['12 345', '1,5']);
assert.equal(unmask('Denarii: {0} (+{1}/month)', m.values), 'Denarii: 12 345 (+1,5/month)');
assert.equal(unmask('Denarii: { 0 }', m.values), null, 'repère manquant : rejeté');
assert.equal(unmask('{0} {0} {1}', m.values), null, 'repère dupliqué : rejeté');
m = mask('Bienvenue dans Imperium Urbis, paiement par Stripe');
assert.equal(m.key, 'Bienvenue dans {0}, paiement par {1}');
assert.equal(unmask('Welcome to {0}, payment by {1}', m.values), 'Welcome to Imperium Urbis, payment by Stripe');
assert.equal(mask('ImperiumUrbis.exe').key, '{0}', 'le plus long nom protégé passe avant ImperiumUrbis');
assert.ok(!needsTranslation('{0}/{1}') && !needsTranslation('{0}') && !needsTranslation('— ×4'));
assert.ok(needsTranslation('Pop : {0}'));
assert.deepEqual(splitSpaces('  Salut \n'), { lead: '  ', core: 'Salut', trail: ' \n' });
assert.equal(mask('a \n  b').key, 'a b');

// découpe des longs textes
const long = Array.from({ length: 30 }, (_, i) => `Phrase numéro ${i} du texte.`).join(' ');
const parts = splitForApi(long);
assert.ok(parts.length > 1 && parts.every((p) => p.length <= 380));
assert.equal(parts.join(' '), long);
assert.deepEqual(splitForApi('court'), ['court']);

// client MyMemory simulé
const calls = [];
const ok = (text) => async (url) => { calls.push(url); return { status: 200, json: async () => ({ responseStatus: 200, responseData: { translatedText: text } }) }; };
assert.equal(await translate('Bonjour {0}', 'en', { fetchImpl: ok('Hello {0}') }), 'Hello {0}');
assert.ok(calls[0].startsWith(`${ENDPOINT}?q=Bonjour%20%7B0%7D&langpair=fr%7Cen`));
await translate('x', 'en', { fetchImpl: ok('y'), email: 'a@b.fr' });
assert.ok(calls[1].endsWith('&de=a%40b.fr'));
const fail = async (f) => { try { await f(); } catch (e) { return e; } assert.fail('erreur attendue'); };
let e = await fail(() => translate('x', 'en', { fetchImpl: async () => ({ status: 429, json: async () => ({}) }) }));
assert.ok(e instanceof TranslateError && e.code === 'quota');
e = await fail(() => translate('x', 'en', { fetchImpl: ok('MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY') }));
assert.equal(e.code, 'quota');
e = await fail(() => translate('x', 'xx', { fetchImpl: ok('INVALID LANGUAGE PAIR') }));
assert.equal(e.code, 'langue');
e = await fail(() => translate('x', 'en', { fetchImpl: async () => { throw new Error('offline'); } }));
assert.equal(e.code, 'reseau');

console.log('i18n: ok');
