const path = require('node:path');

function normalizeBaseUrl(value = '') {
  const base = value.trim().replace(/^\/+|\/+$/g, '');
  if (!base) return '';
  if (/[?#\\]/.test(base) || base.split('/').some(part => part === '.' || part === '..')) {
    throw new Error(`Invalid BASE_URL: ${value}`);
  }
  return `/${base}`;
}

function documentPath(relativePath) {
  const clean = relativePath.replace(/\\/g, '/').replace(/\.md$/, '');
  const parsed = path.posix.parse(clean);
  return path.posix.basename(parsed.dir) === parsed.name ? parsed.dir : clean;
}

function encodePath(value) {
  return value.split('/').map(encodeURIComponent).join('/');
}

function documentUrl(relativePath, baseUrl = '') {
  return `${baseUrl}/wikis/${encodePath(documentPath(relativePath))}/`;
}

function applyBaseUrl(html, baseUrl) {
  if (!baseUrl) return html;
  return html.replace(/\b(href|src)="\/(?!\/)/g, (_, attr) => `${attr}="${baseUrl}/`);
}

function parseGitHubRepo(remoteUrl = '') {
  const match = remoteUrl.match(/^(?:https?:\/\/github\.com\/|git@github\.com:)([^/]+)\/([^/]+?)(?:\.git)?$/i);
  return match ? { owner: match[1], repo: match[2] } : null;
}

module.exports = { normalizeBaseUrl, documentPath, documentUrl, encodePath, applyBaseUrl, parseGitHubRepo };
