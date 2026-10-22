const path = require('node:path');
const { normalizeBaseUrl } = require('./urls');

const PROJECT_ROOT = path.resolve(__dirname, '..');

module.exports = {
  PROJECT_ROOT,
  WIKI_DIR: path.join(PROJECT_ROOT, '_wiki'),
  OUTPUT_DIR: path.join(PROJECT_ROOT, 'public'),
  MAIN_LAYOUT_PATH: path.join(PROJECT_ROOT, '_layout/main.html'),
  INDEX_LAYOUT_PATH: path.join(PROJECT_ROOT, '_layout/index.html'),
  DOCUMENT_LAYOUT_PATH: path.join(PROJECT_ROOT, '_layout/layout.html'),
  HEADER_PATH: path.join(PROJECT_ROOT, '_layout/header.html'),
  FOOTER_PATH: path.join(PROJECT_ROOT, '_layout/footer.html'),
  GITHUB_REPO_URL: 'https://github.com/sikutisa/sikutisa.github.io/blob/master/_wiki/',
  STYLE_DIR: path.join(PROJECT_ROOT, 'style'),
  CLIENT_DIR: path.join(PROJECT_ROOT, 'src/client'),
  MATHJAX_DIR: path.join(PROJECT_ROOT, 'node_modules/mathjax'),
  BASE_URL: normalizeBaseUrl(process.env.BASE_URL),
};
