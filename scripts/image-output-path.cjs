const fs = require('node:fs');
const path = require('node:path');

// Current site uses directory/index.html; accept the previous layout for old QA runs.
function imagePage(root, document) {
  const rel = document.replace(/^_wiki\//, '').replace(/\.md$/, '');
  const parsed = path.posix.parse(rel);
  const urlRel = path.posix.basename(parsed.dir) === parsed.base ? parsed.dir : rel;
  const current = path.join(root, 'public', 'wikis', urlRel, 'index.html');
  return fs.existsSync(current) ? current : path.join(root, 'public', 'wikis', rel + '.html');
}

module.exports = { imagePage };
