const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const matter = require('gray-matter');
const Handlebars = require('handlebars');
const defaults = require('./const');
const { normalizeBaseUrl, documentPath, documentUrl, encodePath, applyBaseUrl, parseGitHubRepo } = require('./urls');

function markdownFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
    .flatMap(entry => {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) return markdownFiles(file);
      return entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'index.md' ? [file] : [];
    });
}

// NUL-separated paths preserve spaces, Unicode and Git's quoted-path edge cases.
function gitModifiedTimes(config, git = execFileSync) {
  const times = new Map();
  let log;
  try {
    log = git('git', ['log', '-z', '--diff-merges=combined', '--format=%x1e%cI', '--name-only', '--',
      path.relative(config.PROJECT_ROOT, config.WIKI_DIR)], {
      cwd: config.PROJECT_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024,
    });
  } catch {
    return times;
  }
  for (const commit of log.split('\x1e').slice(1)) {
    const [stamp, ...files] = commit.split('\0');
    const time = new Date(stamp);
    if (Number.isNaN(time.getTime())) continue;
    for (const file of files) {
      const relative = file.replace(/^\n/, '');
      if (!relative) continue;
      const absolute = path.resolve(config.PROJECT_ROOT, relative);
      if (!times.has(absolute)) times.set(absolute, time.toISOString());
    }
  }
  return times;
}

function siteOrigin(config, git = execFileSync) {
  let value = config.SITE_URL ?? process.env.SITE_URL;
  if (!value) {
    let repository = process.env.GITHUB_REPOSITORY;
    if (!repository) {
      try {
        const remote = git('git', ['config', '--get', 'remote.origin.url'], {
          cwd: config.PROJECT_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
        }).trim();
        const parsed = parseGitHubRepo(remote);
        if (parsed) repository = `${parsed.owner}/${parsed.repo}`;
      } catch { /* A source archive can provide SITE_URL instead of Git metadata. */ }
    }
    if (repository && /^[^/]+\/[^/]+$/.test(repository)) value = `https://${repository.split('/')[0]}.github.io`;
  }
  if (!value) return '';
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.search || url.hash) throw new Error(`Invalid SITE_URL: ${value}`);
  return url.href.replace(/\/+$/, '');
}

function displayTimestamp(iso) {
  return iso.replace('T', ' ').replace(/\.\d{3}Z$/, ' +0000');
}

function createSite(options = {}) {
  const config = { ...defaults, ...options };
  config.BASE_URL = normalizeBaseUrl(config.BASE_URL);
  const times = gitModifiedTimes(config);
  const modified = file => times.get(path.resolve(file)) || fs.statSync(file).mtime.toISOString();
  const documents = markdownFiles(config.WIKI_DIR).map(filePath => {
    const relPath = path.relative(config.WIKI_DIR, filePath).split(path.sep).join('/');
    const { content, data } = matter(fs.readFileSync(filePath, 'utf8'));
    const lastmodIso = modified(filePath);
    return {
      filePath, relPath, content, data, lastmodIso,
      lastmod: displayTimestamp(lastmodIso),
      title: path.posix.basename(relPath, '.md').replace(/_/g, ' '),
      urlRel: documentPath(relPath),
      url: documentUrl(relPath, config.BASE_URL),
      history_url: config.GITHUB_REPO_URL + encodePath(relPath),
      tags: Array.isArray(data.tags) ? data.tags : [],
      use_math: Boolean(data.use_math),
    };
  });
  const urls = new Set();
  for (const document of documents) {
    if (urls.has(document.url)) throw new Error(`Duplicate document URL: ${document.url}`);
    urls.add(document.url);
  }
  const templates = new Map();
  let chrome;
  return {
    config, documents, modified, siteUrl: siteOrigin(config),
    render(layout, data) {
      if (!chrome) {
        chrome = Object.fromEntries(['header', 'footer'].map(name => [name, new Handlebars.SafeString(
          applyBaseUrl(fs.readFileSync(config[`${name.toUpperCase()}_PATH`], 'utf8'), config.BASE_URL),
        )]));
      }
      if (!templates.has(layout)) templates.set(layout, Handlebars.compile(fs.readFileSync(layout, 'utf8')));
      return templates.get(layout)({ ...chrome, base_url: config.BASE_URL, ...data });
    },
    write(relativePath, content) {
      const file = path.join(config.OUTPUT_DIR, relativePath);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content, 'utf8');
    },
  };
}

module.exports = { createSite, markdownFiles, gitModifiedTimes, siteOrigin, displayTimestamp };
