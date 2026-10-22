const { renderedDocument } = require('./markdown');

function generateSearchIndex(site) {
  const entries = site.documents.map(document => ({
    title: document.title, url: document.url, tags: document.tags,
    content: renderedDocument(site, document).plainText,
  }));
  site.write('search.json', JSON.stringify(entries, null, 2) + '\n');
  console.log(`✔ Generated search index (${entries.length} documents)`);
}

if (require.main === module) require('./cli').run(generateSearchIndex);
module.exports = { generateSearchIndex };
