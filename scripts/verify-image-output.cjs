const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { JSDOM } = require('jsdom');
const { references } = require('./image-refresh.cjs');
const root = path.resolve(__dirname, '..');
const manifest = require('../docs/image-refresh/manifest.json');
const output = path.join(root, 'public');
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
let pages = 0, images = 0;
const issues = [];
for (const baseline of manifest.documentBaselines) {
  const source = path.join(root, baseline.path);
  const refs = references(source);
  if (!refs.length) continue;
  const html = path.join(output, 'wikis', path.relative(path.join(root, '_wiki'), source).replace(/\.md$/, '.html'));
  if (!fs.existsSync(html)) { issues.push(`Missing HTML: ${baseline.path}`); continue; }
  const dom = new JSDOM(fs.readFileSync(html, 'utf8'));
  const rendered = [...dom.window.document.querySelectorAll('article img')];
  pages++;
  if (rendered.length !== refs.length) issues.push(`Image count differs in ${baseline.path}: ${refs.length}/${rendered.length}`);
  for (let i = 0; i < refs.length; i++) {
    const image = rendered[i]; if (!image) continue;
    images++;
    const src = image.getAttribute('src');
    if (!src || /^(?:[a-z]+:|\/)/i.test(src)) { issues.push(`Unexpected img src in ${baseline.path}: ${src}`); continue; }
    const asset = path.resolve(path.dirname(html), decodeURIComponent(src.split(/[?#]/)[0]));
    const expected = path.join(root, refs[i].source);
    if (!fs.existsSync(asset)) issues.push(`Image missing from output: ${asset}`);
    else if (!fs.existsSync(expected) || digest(asset) !== digest(expected)) issues.push(`Image copy differs from source: ${asset}`);
    if (!image.alt.trim()) issues.push(`Empty alt: ${asset}`);
    if (image.hasAttribute('height') || image.style.height !== 'auto' || image.style.maxWidth !== '100%') issues.push(`Aspect ratio/responsiveness missing: ${asset}`);
    if (image.nextSibling?.textContent?.match(/^\s*\{:/)) issues.push(`Unconsumed image dimension syntax: ${asset}`);
    if (src.includes('-generated.png') && image.closest('a')?.getAttribute('href') !== src) issues.push(`Full-size image link missing: ${asset}`);
  }
}
for (const item of manifest.images.filter(item => item.status === 'completed')) {
  const rel = path.relative(path.join(root, '_wiki'), path.join(root, item.original));
  for (const file of [path.join(output, 'wikis', rel), path.join(output, rel)]) if (fs.existsSync(file)) issues.push(`Retired original remains in output: ${file}`);
}
const report = { at: new Date().toISOString(), pages, images, issues };
fs.writeFileSync(path.join(root, 'docs', 'image-refresh', 'output-audit.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (issues.length) process.exitCode = 1;
