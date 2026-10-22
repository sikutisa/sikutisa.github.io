const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { renderMarkdown } = require('../_include/markdown');

test('HTML examples in headings remain text in the TOC, including event attributes', () => {
  const result = renderMarkdown('## `<img src="x" onerror="demo()">`\n\n## A & B');
  const dom = new JSDOM(result.toc);
  try {
    assert.equal(dom.window.document.querySelector('img'), null);
    assert.equal(dom.window.document.querySelector('[onerror]'), null);
    assert.equal(dom.window.document.querySelector('a').textContent, '<img src="x" onerror="demo()">');
    assert.ok(dom.window.document.body.textContent.includes('A & B'));
  } finally { dom.window.close(); }
});

test('TOC IDs stay unique and nested lists contain list items even when headings skip levels', () => {
  const result = renderMarkdown('### Intro\n## Same\n### Child\n## Same\n## Same-2');
  const dom = new JSDOM(`<article>${result.html}</article><nav>${result.toc}</nav>`);
  try {
    const document = dom.window.document;
    const headings = [...document.querySelectorAll('article h2, article h3')];
    assert.equal(new Set(headings.map(heading => heading.id)).size, headings.length);
    for (const list of document.querySelectorAll('nav ul')) {
      assert.ok([...list.children].every(child => child.tagName === 'LI'));
    }
    for (const link of document.querySelectorAll('nav a')) assert.ok(document.getElementById(link.hash.slice(1)));
  } finally { dom.window.close(); }
});

test('percentage image widths and captions survive sanitization; arbitrary styles do not', () => {
  const result = renderMarkdown('![caption](./img/a.png){: w="37.5%"}\n*Visible caption*\n\n<img src="a.png" style="position:fixed" onerror="demo()">');
  const dom = new JSDOM(result.html);
  try {
    const images = dom.window.document.querySelectorAll('img');
    assert.equal(images[0].style.width, '37.5%');
    assert.equal(images[0].style.height, 'auto');
    assert.equal(images[0].style.maxWidth, '100%');
    assert.equal(images[0].hasAttribute('height'), false);
    assert.equal(dom.window.document.querySelector('figcaption').textContent, 'Visible caption');
    assert.equal(images[1].style.position, '');
    assert.equal(images[1].hasAttribute('onerror'), false);
  } finally { dom.window.close(); }
});

test('image annotations and wiki-link examples inside code fences stay literal', () => {
  const sample = '![example](./img/a.png){: w="50%"}\n[[Example]]';
  const result = renderMarkdown('```markdown\n' + sample + '\n```');
  const dom = new JSDOM(result.html);
  try {
    assert.equal(dom.window.document.querySelector('code').textContent.trim(), sample);
    assert.equal(dom.window.document.querySelector('figure, img'), null);
  } finally { dom.window.close(); }
});

test('image and wiki URLs preserve Unicode, spaces, ampersands and BASE_URL', () => {
  const wikiRoot = path.resolve('fixture-wiki');
  const result = renderMarkdown('[[한글 & space]]\n\n![image](./img/a-generated.png){: w="760"}', {
    sourceDocument: path.join(wikiRoot, 'folder', 'article.md'), wikiRoot,
    relativeDirectory: 'folder', baseUrl: '/project',
  });
  const dom = new JSDOM(result.html);
  try {
    assert.ok(dom.window.document.querySelector('a').getAttribute('href').startsWith('/project/wikis/folder/'));
    const image = dom.window.document.querySelector('img');
    assert.equal(image.getAttribute('src'), '/project/wikis/folder/img/a-generated.png');
    assert.equal(image.getAttribute('width'), '760');
    assert.equal(image.closest('a').getAttribute('href'), image.getAttribute('src'));
    assert.equal(result.images.length, 1);
  } finally { dom.window.close(); }
});

test('search text decodes entities and excludes scripts and unsafe URLs', () => {
  const result = renderMarkdown('## A &amp; B\n\n&lt;example&gt;\n\n<script>secret()</script>\n<a href="java\nscript:demo()">link</a>');
  assert.ok(result.plainText.includes('A & B'));
  assert.ok(result.plainText.includes('<example>'));
  assert.ok(!result.plainText.includes('secret()'));
  const dom = new JSDOM(result.html);
  try { assert.equal(dom.window.document.querySelector('a').hasAttribute('href'), false); }
  finally { dom.window.close(); }
});

test('search text separates adjacent blocks without breaking inline words', () => {
  const result = renderMarkdown('<p>First</p><p>Second O<strong>pen</strong>AI</p>');
  assert.equal(result.plainText, 'First Second OpenAI');
});
