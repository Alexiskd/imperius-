// Référencement (SEO), appliqué au build par vite.config.js :
// - remplace %SITE_URL%, %PRIX% et %GOOGLE_VERIFICATION% dans les pages HTML ;
// - écrit robots.txt et sitemap.xml (avec la vidéo de présentation) à la racine de dist/.
// SITE_URL : adresse publique du site (défaut : le service Render). GOOGLE_SITE_VERIFICATION : code
// de la balise « google-site-verification » donné par Google Search Console (facultatif).

export function seoConfig(env = process.env) {
  const site = (env.SITE_URL || env.PUBLIC_URL || 'https://imperium-urbis-app.onrender.com').replace(/\/+$/, '');
  const price = Number(env.PRIX || env.VITE_PRIX || 19.99).toFixed(2);
  const google = (env.GOOGLE_SITE_VERIFICATION || '').trim();
  return { site, price, google };
}

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
        .replace('<!--GOOGLE_VERIFICATION-->', cfg.google ? `<meta name="google-site-verification" content="${esc(cfg.google)}" />` : ''),
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsTxt(cfg) });
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml(cfg) });
    },
  };
}
