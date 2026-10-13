const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { marked } = require('marked');
const { prepareImages, copyImageAssets } = require('../_include/image-assets');
const { inside, validateSpec, validateReview, pngInfo } = require('./image-refresh.cjs');

test('legacy dimensions are consumed, captions survive, and aspect ratio is preserved', () => {
  const dom = new JSDOM(marked.parse('![설명](./img/1-generated.png){: w="760" h = "350"}\n*caption*'));
  prepareImages(dom.window.document);
  const image = dom.window.document.querySelector('img');
  assert.equal(image.getAttribute('width'), '760');
  assert.equal(image.getAttribute('height'), null);
  assert.equal(image.style.maxWidth, '100%');
  assert.equal(image.style.height, 'auto');
  assert.equal(image.alt, '설명');
  assert.equal(image.closest('a').getAttribute('href'), './img/1-generated.png');
  assert.equal(image.closest('a').getAttribute('target'), '_blank');
  assert.equal(dom.window.document.querySelector('em').textContent, 'caption');
  assert.ok(!dom.window.document.body.textContent.includes('{:'));
});

test('existing image links are preserved without nested anchors', () => {
  const dom = new JSDOM('<a href="/chosen-target"><img src="./img/1-generated.png"></a>');
  prepareImages(dom.window.document);
  assert.equal(dom.window.document.querySelectorAll('a').length, 1);
  assert.equal(dom.window.document.querySelector('a').getAttribute('href'), '/chosen-target');
});

test('image assets retain Unicode, spaces, ampersands and document-relative paths', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-assets-'));
  try {
    const wiki = path.join(dir, '_wiki'), output = path.join(dir, 'public');
    const source = path.join(wiki, '한글 & space', 'img', '1.png');
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.writeFileSync(source, 'asset contents');
    const documentPath = path.join(wiki, '한글 & space', '문서.md');
    const dom = new JSDOM('<img src="./img/1.png"><img src="https://example.com/remote.png">');
    assert.equal(copyImageAssets(dom.window.document, documentPath, wiki, output).length, 1);
    assert.equal(fs.readFileSync(path.join(output, 'wikis', '한글 & space', 'img', '1.png'), 'utf8'), 'asset contents');
    assert.throws(() => copyImageAssets(new JSDOM('<img src="../../outside.png">').window.document, documentPath, wiki, output), /escapes root/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('replacement cannot be approved without a review of every requirement', () => {
  const spec = { originalViewed: true, documentReviewed: true, purpose: 'purpose', alt: 'alt', prompt: 'prompt', requiredChecks: ['exact labels', 'arrow directions'] };
  validateSpec(spec);
  assert.throws(() => validateSpec({ ...spec, originalViewed: false }), /view the original/);
  const review = { viewed: true, decoded: true, passed: true, notes: 'inspected', checks: [{ requirement: 'exact labels', passed: true, evidence: 'visible' }] };
  assert.throws(() => validateReview(spec, review), /Every requirement/);
  review.checks.push({ requirement: 'arrow directions', passed: false, evidence: 'wrong direction' });
  assert.throws(() => validateReview(spec, review), /Failed check/);
});

test('workspace paths cannot escape through traversal', () => {
  const root = path.resolve('workspace');
  assert.throws(() => inside(root, path.resolve(root, '..', 'outside')), /outside/);
});

test('PNG signature alone does not prove a decodable image', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-png-'));
  try {
    const file = path.join(dir, 'bad.png');
    fs.writeFileSync(file, Buffer.from('89504e470d0a1a0a', 'hex'));
    assert.throws(() => pngInfo(file), /Not a PNG/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
