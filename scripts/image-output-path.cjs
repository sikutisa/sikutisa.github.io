const fs = require('node:fs');
const path = require('node:path');
const { documentPath } = require('../_include/urls');

// Current site uses directory/index.html; accept the previous layout for old QA runs.
function imagePage(root, document) {
  const rel = document.replace(/^_wiki\//, '').replace(/\.md$/, '');
  const urlRel = documentPath(rel);
  const current = path.join(root, 'public', 'wikis', urlRel, 'index.html');
  return fs.existsSync(current) ? current : path.join(root, 'public', 'wikis', rel + '.html');
}

module.exports = { imagePage };
