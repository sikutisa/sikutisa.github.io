const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { JSDOM } = require('jsdom');
const defaults = require('../_include/const');
const { build } = require('../_include/build');
const { copyAssets } = require('../_include/assets');
const { createSite, gitModifiedTimes } = require('../_include/site');
const { documentUrl, normalizeBaseUrl, parseGitHubRepo } = require('../_include/urls');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-build-'));
  t.after(() => {
    assert.ok(root.startsWith(path.join(os.tmpdir(), 'wiki-build-')));
    fs.rmSync(root, { recursive: true, force: true });
  });
  const write = (relative, content) => {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
    return file;
  };
  write('_wiki/index.md', '# Wiki');
  write('_wiki/한글 & space/한글 & space.md', '---\nuse_math: true\ntags: [test]\n---\n# Title\n\n## A & B\n\n![caption](./img/a-generated.png){: w="50%"}');
  write('_wiki/한글 & space/$example.md', '# Another\n\n![caption](./img/a-generated.png){: w="120"}');
  write('style/base.css', 'body { color: black; }');
  write('client/search.js', '// browser only');
  write('mathjax/tex-svg.js', '// test bundle');
  write('scripts/private-tool.cjs', '// never publish');
  write('google-test.html', 'verification');
  const image = write('_wiki/한글 & space/img/a-generated.png', Buffer.from('test asset'));
  return {
    root, image, write,
    config: { ...defaults, PROJECT_ROOT: root, WIKI_DIR: path.join(root, '_wiki'), OUTPUT_DIR: path.join(root, 'public'),
      STYLE_DIR: path.join(root, 'style'), CLIENT_DIR: path.join(root, 'client'), MATHJAX_DIR: path.join(root, 'mathjax'),
      BASE_URL: '/project', SITE_URL: 'https://example.com' },
  };
}

test('a complete project build agrees across pages, search, sitemap, images and published assets', t => {
  const { config } = fixture(t);
  const site = build(config);
  const read = relative => fs.readFileSync(path.join(config.OUTPUT_DIR, relative), 'utf8');
  const search = JSON.parse(read('search.json'));
  assert.equal(search.length, 2);
  assert.equal(search.some(entry => entry.url.endsWith('/wikis/index/')), false);
  const xml = new JSDOM(read('sitemap.xml'), { contentType: 'application/xml' });
  try {
    const locations = [...xml.window.document.querySelectorAll('loc')].map(node => node.textContent);
    for (const entry of search) {
      const relative = decodeURIComponent(entry.url.replace(/^\/project\//, ''));
      const dom = new JSDOM(read(path.join(relative, 'index.html')));
      try {
        assert.ok(locations.includes('https://example.com' + entry.url));
        const image = dom.window.document.querySelector('article img');
        assert.ok(image.getAttribute('src').startsWith('/project/wikis/'));
        const asset = decodeURIComponent(image.getAttribute('src').replace(/^\/project\//, ''));
        assert.equal(read(asset), 'test asset');
        assert.equal(image.closest('a').getAttribute('href'), image.getAttribute('src'));
      } finally { dom.window.close(); }
    }
  } finally { xml.window.close(); }
  assert.deepEqual(fs.readdirSync(path.join(config.OUTPUT_DIR, 'assets/scripts')), ['search.js']);
  assert.equal(read('google-test.html'), 'verification');
  assert.match(read('robots.txt'), /https:\/\/example.com\/project\/sitemap.xml/);
  assert.ok(site.documents.every(document => document.rendered));
  const first = ['index.html', 'sitemap.xml', 'search.json'].map(read);
  build(config);
  assert.deepEqual(['index.html', 'sitemap.xml', 'search.json'].map(read), first);
});

test('required asset and referenced-image failures stop the build', t => {
  const sample = fixture(t);
  assert.throws(() => copyAssets({ config: { ...sample.config, CLIENT_DIR: path.join(sample.root, 'missing') } }), /Required asset copy failed/);
  fs.unlinkSync(sample.image);
  assert.throws(() => build(sample.config), /ENOENT/);
});

test('Git timestamps match the latest commit for Unicode and shell-special filenames', t => {
  const sample = fixture(t);
  const git = (args, env = {}) => execFileSync('git', args, {
    cwd: sample.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...env },
  });
  git(['init', '--quiet']);
  git(['-c', 'core.autocrlf=false', 'add', '_wiki']);
  git(['-c', 'user.name=Build Test', '-c', 'user.email=build@example.com', 'commit', '--quiet', '-m', 'initial'], {
    GIT_AUTHOR_DATE: '2026-01-01T12:00:00+09:00', GIT_COMMITTER_DATE: '2026-01-01T12:00:00+09:00',
  });
  const changed = sample.write('_wiki/한글 & space/$example.md', '# Updated');
  git(['-c', 'core.autocrlf=false', 'add', '_wiki']);
  git(['-c', 'user.name=Build Test', '-c', 'user.email=build@example.com', 'commit', '--quiet', '-m', 'update'], {
    GIT_AUTHOR_DATE: '2026-02-02T12:00:00+09:00', GIT_COMMITTER_DATE: '2026-02-02T12:00:00+09:00',
  });
  const times = gitModifiedTimes(sample.config);
  assert.equal(times.get(changed), '2026-02-02T03:00:00.000Z');
  assert.equal(times.get(path.join(sample.config.WIKI_DIR, 'index.md')), '2026-01-01T03:00:00.000Z');
  assert.equal(createSite(sample.config).documents.find(document => document.filePath === changed).lastmodIso, times.get(changed));
  const mainBranch = git(['branch', '--show-current']).trim();
  git(['switch', '-c', 'merge-side', 'HEAD~1']);
  sample.write('_wiki/한글 & space/$example.md', '# Side');
  git(['-c', 'core.autocrlf=false', 'add', '_wiki']);
  git(['-c', 'user.name=Build Test', '-c', 'user.email=build@example.com', 'commit', '--quiet', '-m', 'side'], {
    GIT_AUTHOR_DATE: '2026-03-03T12:00:00+09:00', GIT_COMMITTER_DATE: '2026-03-03T12:00:00+09:00',
  });
  git(['switch', mainBranch]);
  assert.throws(() => git(['merge', '--no-commit', '--no-ff', 'merge-side']));
  sample.write('_wiki/한글 & space/$example.md', '# Resolved');
  git(['-c', 'core.autocrlf=false', 'add', '_wiki']);
  git(['-c', 'user.name=Build Test', '-c', 'user.email=build@example.com', 'commit', '--quiet', '-m', 'resolve'], {
    GIT_AUTHOR_DATE: '2026-04-04T12:00:00+09:00', GIT_COMMITTER_DATE: '2026-04-04T12:00:00+09:00',
  });
  assert.equal(gitModifiedTimes(sample.config).get(changed), '2026-04-04T03:00:00.000Z');
});

test('URL mapping handles leaf documents, encoded names and normalized deployment prefixes', () => {
  assert.equal(documentUrl('Folder/Folder.md', '/project'), '/project/wikis/Folder/');
  assert.equal(documentUrl('Folder/한글 & name.md', '/project'), '/project/wikis/Folder/%ED%95%9C%EA%B8%80%20%26%20name/');
  assert.equal(normalizeBaseUrl('///project///'), '/project');
  assert.equal(normalizeBaseUrl('/'), '');
  assert.throws(() => normalizeBaseUrl('../outside'), /Invalid BASE_URL/);
  assert.deepEqual(parseGitHubRepo('git@github.com:owner/site.git'), { owner: 'owner', repo: 'site' });
  assert.deepEqual(parseGitHubRepo('https://github.com/owner/site.git'), { owner: 'owner', repo: 'site' });
});
