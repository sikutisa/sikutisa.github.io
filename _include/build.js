const { createSite } = require('./site');
const { copyAssets } = require('./assets');
const { generateDocuments } = require('./generate-documents');
const { generateIndex } = require('./generate-index');
const { generateMain } = require('./generate-main');
const { generateSitemap } = require('./generate-sitemap');
const { generateRobots } = require('./generate-robots');
const { generateSearchIndex } = require('./generate-search-index');

function build(options) {
  const site = createSite(options);
  copyAssets(site);
  generateDocuments(site);
  generateIndex(site);
  generateMain(site);
  generateSitemap(site);
  generateRobots(site);
  generateSearchIndex(site);
  return site;
}

if (require.main === module) {
  try { build(); } catch (error) { console.error(error); process.exitCode = 1; }
}
module.exports = { build };
