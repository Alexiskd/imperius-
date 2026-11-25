// Tests du référencement : robots.txt, sitemap.xml, remplacements dans les pages.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { seoConfig, robotsTxt, sitemapXml, seoPlugin } from '../tools/seo.js';
import { FAQ, MOTS_CLES_LISTE, MOTS_CLES_META } from '../src/home/referencement.js';

const cfg = seoConfig({ SITE_URL: 'https://exemple.fr/', PRIX: '13.5', GOOGLE_SITE_VERIFICATION: 'abc123' });
assert.deepEqual(cfg, { site: 'https://exemple.fr', price: '13.50', google: 'abc123' });
assert.equal(seoConfig({}).site, 'https://imperium-urbis.onrender.com');

const robots = robotsTxt(cfg);
assert.match(robots, /^User-agent: \*$/m);
assert.match(robots, /^Allow: \/$/m);
assert.match(robots, /^Disallow: \/api\/$/m);
assert.match(robots, /^Sitemap: https:\/\/exemple\.fr\/sitemap\.xml$/m);

const map = sitemapXml(cfg, '2026-11-21');
assert.match(map, /<loc>https:\/\/exemple\.fr\/<\/loc>/);
assert.match(map, /<video:content_loc>https:\/\/exemple\.fr\/video\/presentation\.mp4<\/video:content_loc>/);
assert.match(map, /<lastmod>2026-11-21<\/lastmod>/);

const html = seoPlugin({ SITE_URL: 'https://exemple.fr', PRIX: '13.5', GOOGLE_SITE_VERIFICATION: 'abc123' }).transformIndexHtml.handler(readFileSync(new URL('../index.html', import.meta.url), 'utf8'));
assert.ok(!/%[A-Z_]+%/.test(html) && !html.includes('GOOGLE_VERIFICATION') && !html.includes('<!--FAQ_LD-->') && !html.includes('<!--CONTENU_STATIQUE-->'));
assert.match(html, /<title>[^<]*jeu de construction de ville en ligne[^<]*SimCity[^<]*<\/title>/);
assert.match(html, /<meta name="keywords" content="Imperium Urbis, jeu en ligne, [^"]*jeu comme SimCity[^"]*" \/>/);
assert.match(html, /<div id="root"><h1>[^<]+<\/h1>/);
assert.ok(MOTS_CLES_META.length <= 25 && MOTS_CLES_LISTE.length >= 60);
const blocs = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
const faq = blocs.find((b) => b['@type'] === 'FAQPage');
assert.equal(faq.mainEntity.length, FAQ.length);
assert.equal(faq.mainEntity[0].acceptedAnswer['@type'], 'Answer');
assert.match(html, /<link rel="canonical" href="https:\/\/exemple\.fr\/" \/>/);
assert.match(html, /<meta name="google-site-verification" content="abc123" \/>/);
const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
assert.equal(ld['@graph'][1].offers.price, '13.50');
const sans = seoPlugin({}).transformIndexHtml.handler('<!--GOOGLE_VERIFICATION-->');
assert.equal(sans, '');
console.log('seo: ok');
