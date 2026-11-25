// Référencement (SEO), appliqué au build par vite.config.js :
// - remplace %SITE_URL%, %PRIX%, %MOTS_CLES% et %GOOGLE_VERIFICATION% dans les pages HTML ;
// - insère la FAQ en données structurées (FAQPage) et un texte de page lisible sans JavaScript
//   (remplacé par React au chargement : même contenu que la page affichée) ;
// - écrit robots.txt et sitemap.xml (avec la vidéo de présentation) à la racine de dist/.
// SITE_URL : adresse publique du site (défaut : le service Render). GOOGLE_SITE_VERIFICATION : code
// de la balise « google-site-verification » donné par Google Search Console (facultatif).

export function seoConfig(env = process.env) {
  const site = (env.SITE_URL || env.PUBLIC_URL || 'https://gobaispace.info').replace(/\/+$/, '');
  const price = Number(env.PRIX || env.VITE_PRIX || 13.5).toFixed(2);
  const google = (env.GOOGLE_SITE_VERIFICATION || '').trim();
  return { site, price, google };
}

import { FAQ, GENRE, MOTS_CLES_META } from '../src/home/referencement.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function robotsTxt({ site }) {
  return [
    '# Imperium Urbis — robots.txt',
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    '',
    `Sitemap: ${site}/sitemap.xml`,
    '',
  ].join('\n');
}

export function sitemapXml({ site }, date = new Date().toISOString().slice(0, 10)) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${esc(site)}/</loc>
    <lastmod>${date}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
    <image:image><image:loc>${esc(site)}/video/poster.jpg</image:loc></image:image>
    <video:video>
      <video:thumbnail_loc>${esc(site)}/video/poster.jpg</video:thumbnail_loc>
      <video:title>Imperium Urbis — vidéo de présentation</video:title>
      <video:description>Une cité romaine se construit sous vos yeux : routes, production, villas, monuments et défense des quatre provinces de la campagne.</video:description>
      <video:content_loc>${esc(site)}/video/presentation.mp4</video:content_loc>
      <video:duration>24</video:duration>
      <video:family_friendly>yes</video:family_friendly>
    </video:video>
  </url>
</urlset>
`;
}

// Données structurées FAQPage (questions/réponses de la page d'accueil).
export function faqJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  };
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}

// Contenu lu par les robots qui n'exécutent pas JavaScript ; React le remplace dès le rendu.
export function contenuStatique() {
  return [
    '<h1>Imperium Urbis — jeu de construction de ville en ligne dans la Rome antique</h1>',
    '<p>City-builder 3D jouable dans le navigateur, sans téléchargement : routes, quartiers, chaînes de production, villas, monuments et campagne de quatre provinces.</p>',
    `<h2>${esc(GENRE.titre)}</h2>`,
    ...GENRE.paragraphes.map((p) => `<p>${esc(p)}</p>`),
    '<h2>Questions fréquentes</h2>',
    ...FAQ.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`),
    `<p>${esc(GENRE.marques)}</p>`,
  ].join('');
}

export function seoPlugin(env = process.env) {
  const cfg = seoConfig(env);
  return {
    name: 'imperium-seo',
    // « pre » : avant l'analyse HTML de Vite, qui refuse les adresses contenant « % ».
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => html
        .replaceAll('%SITE_URL%', cfg.site)
        .replaceAll('%PRIX%', cfg.price)
        .replaceAll('%MOTS_CLES%', esc(MOTS_CLES_META.join(', ')))
        .replace('<!--FAQ_LD-->', faqJsonLd())
        .replace('<!--CONTENU_STATIQUE-->', contenuStatique())
        .replace('<!--GOOGLE_VERIFICATION-->', cfg.google ? `<meta name="google-site-verification" content="${esc(cfg.google)}" />` : ''),
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsTxt(cfg) });
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml(cfg) });
    },
  };
}
