const path = require('node:path');
const { displayTimestamp } = require('./site');
const { encodePath } = require('./urls');

function generateIndex(site) {
  const groups = new Map();
  // Keep the existing category landing pages; all documents remain searchable.
  for (const document of site.documents) {
    const parts = document.relPath.split('/');
    if (parts.length !== 2) continue;
    if (!groups.has(parts[0])) groups.set(parts[0], []);
    groups.get(parts[0]).push(document);
  }
  const index = path.join(site.config.WIKI_DIR, 'index.md');
  site.write('wikis/index.html', site.render(site.config.INDEX_LAYOUT_PATH, {
    categories: [...groups].map(([name, documents]) => ({ category_name: name.replace(/_/g, ' '), documents })),
    last_updated: displayTimestamp(site.modified(index)),
    history_url: site.config.GITHUB_REPO_URL + encodePath('index.md'),
  }));
  console.log('✔ Generated wiki index');
}

if (require.main === module) require('./cli').run(generateIndex, { assets: true });
module.exports = { generateIndex };
