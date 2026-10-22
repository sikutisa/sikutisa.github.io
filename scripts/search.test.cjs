const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');

const source = fs.readFileSync(path.join(__dirname, '../src/client/search.js'), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
function environment(t, fetch) {
  const dom = new JSDOM('<form id="search-form"><input id="search-input"><button>Search</button></form>', {
    url: 'https://example.com/project/wikis/article/', runScripts: 'outside-only', virtualConsole: new VirtualConsole(),
  });
  t.after(() => dom.window.close());
  const document = dom.window.document;
  const script = document.createElement('script');
  script.src = '/project/assets/scripts/search.js';
  script.dataset.searchIndex = '/project/search.json';
  Object.defineProperty(document, 'currentScript', { value: script });
  dom.window.fetch = fetch;
  dom.window.eval(source);
  const input = document.getElementById('search-input');
  const submit = keyword => {
    input.value = keyword;
    document.getElementById('search-form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  };
  return { dom, document, input, submit };
}
const response = entries => ({ ok: true, json: async () => entries });

test('concurrent prefetch and search share one request; failures settle and allow retry', async t => {
  let calls = 0, rejectFirst;
  const fixture = environment(t, () => {
    calls++;
    if (calls === 1) return new Promise((resolve, reject) => { rejectFirst = reject; });
    return Promise.resolve(response([{ title: 'Node', content: 'Node content', url: '/project/wikis/node/' }]));
  });
  fixture.input.dispatchEvent(new fixture.dom.window.Event('focus'));
  fixture.input.dispatchEvent(new fixture.dom.window.Event('input'));
  fixture.submit('Node');
  assert.equal(calls, 1);
  rejectFirst(new Error('offline'));
  await tick();
  assert.match(fixture.document.getElementById('search-title-text').textContent, /검색 오류/);
  fixture.submit('Node');
  await tick();
  assert.equal(calls, 2);
  assert.equal(fixture.document.querySelectorAll('.search-item').length, 1);
});

test('search uses the project deployment path and safely highlights literal HTML and regexp characters', async t => {
  const urls = [];
  const fixture = environment(t, async url => {
    urls.push(url);
    return response([{ title: '<img src=x onerror=demo()> [x]', content: 'literal <b> & [x]', url: '/project/wikis/example/' }]);
  });
  fixture.submit('[x]');
  await tick();
  assert.equal(urls[0], 'https://example.com/project/search.json');
  assert.equal(fixture.document.querySelector('.search-item-title').textContent, '<img src=x onerror=demo()> [x]');
  assert.equal(fixture.document.querySelector('.search-item img, .search-item [onerror], .search-item b'), null);
  assert.equal(fixture.document.querySelector('.search-item-title strong').textContent, '[x]');
});

test('only the latest query renders and closing the dialog cancels pending presentation', async t => {
  let resolve;
  const fixture = environment(t, () => new Promise(done => { resolve = done; }));
  fixture.submit('first');
  fixture.submit('second');
  resolve(response([{ title: 'second', content: 'second', url: '/project/wikis/second/' }]));
  await tick();
  assert.match(fixture.document.getElementById('search-title-text').textContent, /second/);
  fixture.document.getElementById('search-close').click();
  assert.equal(fixture.document.getElementById('search-overlay').style.display, 'none');
});

test('Escape restores focus and scrolling without replacing other click handlers', async t => {
  const fixture = environment(t, async () => response([]));
  const original = () => {};
  fixture.dom.window.onclick = original;
  fixture.document.body.style.overflow = 'auto';
  fixture.input.focus();
  fixture.submit('node');
  await tick();
  assert.equal(fixture.document.activeElement.id, 'search-close');
  assert.equal(fixture.document.querySelector('[role="dialog"]').getAttribute('aria-modal'), 'true');
  fixture.document.activeElement.dispatchEvent(new fixture.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  assert.equal(fixture.document.activeElement, fixture.input);
  assert.equal(fixture.document.body.style.overflow, 'auto');
  assert.equal(fixture.dom.window.onclick, original);
});

test('Korean composition Enter is suppressed and submission works after composition ends', async t => {
  let calls = 0;
  const fixture = environment(t, async () => { calls++; return response([]); });
  fixture.input.dispatchEvent(new fixture.dom.window.CompositionEvent('compositionstart'));
  const event = new fixture.dom.window.KeyboardEvent('keydown', { key: 'Enter', isComposing: true, cancelable: true });
  fixture.input.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true);
  fixture.submit('한글');
  assert.equal(calls, 0);
  fixture.input.dispatchEvent(new fixture.dom.window.CompositionEvent('compositionend'));
  fixture.submit('한글');
  await tick();
  assert.equal(calls, 1);
});

test('invalid index entries and unsafe result URLs show a recoverable error', async t => {
  const fixture = environment(t, async () => response([{ title: 'node', content: 'node', url: 'javascript:demo()' }]));
  fixture.submit('node');
  await tick();
  assert.equal(fixture.document.querySelector('.search-item'), null);
  assert.match(fixture.document.getElementById('search-title-text').textContent, /검색 오류/);
});
