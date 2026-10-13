// Optional visual QA using a supplied Playwright package path and headless browser.
// Does not modify source documents or images. Screenshots are ignored build artifacts.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
const { chromium } = require(process.argv[2] || 'playwright');
const manifest = require('../docs/image-refresh/manifest.json');
const { imagePage } = require('./image-output-path.cjs');
const artifacts = path.join(root, '.cache', 'image-refresh');
const pilotIds = process.argv[4]?.split(',') || ['5ea4de758c5f', 'a0a49df87cfe', '055b49444b5e'];
const pilotItems = pilotIds.map(id => {
  const item = manifest.images.find(item => item.id === id);
  if (!item) throw new Error('Unknown preview image: ' + id);
  return item;
});

(async () => {
  fs.mkdirSync(artifacts, { recursive: true });
  const publicRoot = path.join(root, 'public');
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let file = path.resolve(publicRoot, '.' + pathname);
    const rel = path.relative(publicRoot, file);
    if (rel.startsWith('..') || path.isAbsolute(rel)) { response.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { response.writeHead(404).end(); return; }
    const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.svg': 'image/svg+xml' };
    response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(response);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const pageUrl = html => origin + '/' + path.relative(publicRoot, html).split(path.sep).map(encodeURIComponent).join('/');
  const browser = await chromium.launch({ headless: true, executablePath: process.argv[3] || undefined });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.route(/^https?:\/\//, route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
  const issues = [], captures = []; let pages = 0, images = 0;
  try {
    for (const baseline of manifest.documentBaselines) {
      const html = imagePage(root, baseline.path);
      if (!fs.existsSync(html)) continue;
      await page.goto(pageUrl(html), { waitUntil: 'domcontentloaded' });
      const results = await page.locator('article img').evaluateAll(async elements => {
        for (const image of elements) image.loading = 'eager';
        return Promise.all(elements.map(async image => {
          try { await image.decode(); } catch (error) { return { src: image.getAttribute('src'), error: String(error) }; }
          return { src: image.getAttribute('src'), naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight };
        }));
      });
      if (!results.length) continue;
      pages++; images += results.length;
      for (const result of results) if (result.error || !result.naturalWidth || !result.naturalHeight) issues.push({ document: baseline.path, ...result });
    }
    for (const pilot of pilotItems) {
      const document = pilot.document;
      const html = imagePage(root, document);
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(pageUrl(html), { waitUntil: 'domcontentloaded' });
        const item = page.locator('article img[src$="/' + path.basename(pilot.generated) + '"]').first();
        await item.scrollIntoViewIfNeeded();
        await item.evaluate(async image => { await image.decode(); });
        const bounds = await item.boundingBox();
        const dimensions = await item.evaluate(image => ({ width: image.naturalWidth, height: image.naturalHeight }));
        if (bounds.width > width || Math.abs(bounds.width / bounds.height - dimensions.width / dimensions.height) > 0.01) issues.push({ document, width, error: 'Image overflow or distorted aspect ratio', bounds, dimensions });
        const filename = path.basename(document, '.md') + '-' + pilot.id + '-' + width + '.png';
        await page.screenshot({ path: path.join(artifacts, filename), fullPage: false });
        captures.push({ document, imageId: pilot.id, viewportWidth: width, screenshot: '.cache/image-refresh/' + filename, bounds, natural: dimensions });
      }
    }
    const report = { at: new Date().toISOString(), pages, images, captures, issues, visualInspection: 'pending: open all six screenshots before marking visual QA complete' };
    fs.writeFileSync(path.join(root, 'docs', 'image-refresh', 'browser-audit.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ pages, images, captures: captures.length, issues }, null, 2));
    if (issues.length) process.exitCode = 1;
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
