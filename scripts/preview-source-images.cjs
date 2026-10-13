// Inspection only: render unchanged transparent source PNGs on a white web page.
// These screenshots are QA artifacts and must never be imported as replacements.
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('C:/Users/luke1046/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { inside } = require('./image-refresh.cjs');
const root = path.resolve(__dirname, '..');
const sourceDir = inside(path.join(root, '_wiki'), path.resolve(root, process.argv[2]));
const out = path.join(root, '.cache/image-refresh/source-images');
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1800, height: 1600 } });
    for (const file of fs.readdirSync(sourceDir).filter(f => /^\d+\.png$/.test(f))) {
      const source = inside(sourceDir, path.join(sourceDir, file));
      const html = path.join(out, 'inspection.html');
      fs.writeFileSync(html, '<!doctype html><html><body style="margin:0;background:white"><img id="source" style="display:block" src="' + pathToFileURL(source).href + '"></body></html>');
      await page.goto(pathToFileURL(html).href);
      await page.locator('#source').evaluate(image => image.decode());
      const target = path.join(out, path.basename(path.dirname(sourceDir)) + '-' + file);
      await page.locator('#source').screenshot({ path: target, omitBackground: false });
      console.log(path.relative(root, target));
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
