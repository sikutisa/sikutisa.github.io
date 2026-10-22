const path = require('node:path');
const { escapeExpression } = require('handlebars');

function generateSitemap(site) {
  if (!site.siteUrl) throw new Error('SITE_URL or a GitHub repository remote is required for sitemap.xml');
  const latest = site.documents.reduce((time, document) => document.lastmodIso > time ? document.lastmodIso : time,
    site.modified(path.join(site.config.WIKI_DIR, 'index.md')));
  const pages = [
    { url: `${site.config.BASE_URL}/`, lastmodIso: latest },
    { url: `${site.config.BASE_URL}/wikis/`, lastmodIso: site.modified(path.join(site.config.WIKI_DIR, 'index.md')) },
    ...site.documents,
  ];
  const urls = pages.map(page => `  <url>\n    <loc>${escapeExpression(site.siteUrl + page.url)}</loc>\n    <lastmod>${page.lastmodIso}</lastmod>\n  </url>`);
  site.write('sitemap.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls, '</urlset>', '',
  ].join('\n'));
  console.log('✔ Generated sitemap');
}

if (require.main === module) require('./cli').run(generateSitemap);
module.exports = { generateSitemap };
