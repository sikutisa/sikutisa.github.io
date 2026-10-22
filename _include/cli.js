const { createSite } = require('./site');
const { copyAssets } = require('./assets');

function run(generator, { assets = false } = {}) {
  try {
    const site = createSite();
    if (assets) copyAssets(site);
    generator(site);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

module.exports = { run };
