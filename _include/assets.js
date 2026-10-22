const fs = require('node:fs');
const path = require('node:path');

function copyRequired(source, destination) {
  try {
    fs.cpSync(source, destination, { recursive: true, force: true });
  } catch (cause) {
    throw new Error(`Required asset copy failed: ${source}`, { cause });
  }
}

function copyAssets(site) {
  const config = site.config;
  const assets = path.join(config.OUTPUT_DIR, 'assets');
  copyRequired(config.STYLE_DIR, path.join(assets, 'style'));
  // Only browser code belongs in the published site; scripts/ contains local tools.
  const search = path.join(config.CLIENT_DIR, 'search.js');
  copyRequired(search, path.join(assets, 'scripts/search.js'));
  const mathSource = fs.existsSync(path.join(config.MATHJAX_DIR, 'es5'))
    ? path.join(config.MATHJAX_DIR, 'es5') : config.MATHJAX_DIR;
  if (!fs.statSync(path.join(mathSource, 'tex-svg.js')).isFile()) throw new Error('MathJax tex-svg.js is missing');
  fs.cpSync(mathSource, path.join(assets, 'mathjax/es5'), {
    recursive: true, force: true,
    filter: source => !path.relative(mathSource, source).split(path.sep).some(part => part === 'node_modules' || part.startsWith('.git')),
  });
  for (const entry of fs.readdirSync(config.PROJECT_ROOT, { withFileTypes: true })) {
    if (entry.isFile() && /^google.*\.html$/i.test(entry.name)) {
      copyRequired(path.join(config.PROJECT_ROOT, entry.name), path.join(config.OUTPUT_DIR, entry.name));
    }
  }
}

module.exports = { copyAssets, copyRequired };
