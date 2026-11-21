// Tests du référencement : robots.txt, sitemap.xml, remplacements dans les pages.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { seoConfig, robotsTxt, sitemapXml, seoPlugin } from '../tools/seo.js';

const cfg = seoConfig({ SITE_URL: 'https://exemple.fr/', PRIX: '19.99', GOOGLE_SITE_VERIFICATION: 'abc123' });
assert.deepEqual(cfg, { site: 'https://exemple.fr', price: '19.99', google: 'abc123' });
assert.equal(seoConfig({}).site, 'https://imperium-urbis-app.onrender.com');

const robots = robotsTxt(cfg);
assert.match(robots, /^User-agent: \*$/m);
assert.match(robots, /^Allow: \/$/m);
assert.match(robots, /^Disallow: \/api\/$/m);
assert.match(robots, /^Sitemap: https:\/\/exemple\.fr\/sitemap\.xml$/m);

const map = sitemapXml(cfg, '2026-11-21');
assert.match(map, /<loc>https:\/\/exemple\.fr\/<\/loc>/);
assert.match(map, /<video:content_loc>https:\/\/exemple\.fr\/video\/presentation\.mp4<\/video:content_loc>/);
assert.match(map, /<lastmod>2026-11-21<\/lastmod>/);

const html = seoPlugin({ SITE_URL: 'https://exemple.fr', PRIX: '19.99', GOOGLE_SITE_VERIFICATION: 'abc123' }).transformIndexHtml.handler(readFileSync(new URL('../index.html', import.meta.url), 'utf8'));
assert.ok(!html.includes('%SITE_URL%') && !html.includes('%PRIX%') && !html.includes('GOOGLE_VERIFICATION'));
assert.match(html, /<link rel="canonical" href="https:\/\/exemple\.fr\/" \/>/);
assert.match(html, /<meta name="google-site-verification" content="abc123" \/>/);
const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
assert.equal(ld['@graph'][1].offers.price, '19.99');
const sans = seoPlugin({}).transformIndexHtml.handler('<!--GOOGLE_VERIFICATION-->');
assert.equal(sans, '');
console.log('seo: ok');
