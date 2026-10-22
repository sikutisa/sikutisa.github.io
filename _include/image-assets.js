const fs = require('node:fs');
const path = require('node:path');
const { encodePath } = require('./urls');

function within(root, file) {
  const rel = path.relative(root, file);
  if (rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) {
    throw new Error(`Image path escapes root: ${file}`);
  }
  return file;
}

function imageWidth(value = '') {
  const match = String(value).match(/^(\d+(?:\.\d+)?)(%)?$/);
  if (!match) return null;
  const amount = Number(match[1]);
  return amount > 0 && amount <= (match[2] ? 100 : 4096) ? `${amount}${match[2] || ''}` : null;
}

function prepareImages(document) {
  for (const image of document.querySelectorAll('img')) {
    let width = imageWidth(image.getAttribute('data-wiki-width') || image.getAttribute('width'));
    const next = image.nextSibling;
    if (next?.nodeType === 3) {
      const annotation = next.textContent.match(/^\s*\{:\s*([^}]*)\}/);
      if (annotation) {
        const candidate = annotation[1].match(/\bw\s*=\s*["']?(\d+(?:\.\d+)?%?)["']?/);
        if (candidate) width = imageWidth(candidate[1]);
        next.textContent = next.textContent.slice(annotation[0].length);
      }
    }
    image.removeAttribute('data-wiki-width');
    image.removeAttribute('width');
    image.removeAttribute('height');
    if (width?.endsWith('%')) image.style.width = width;
    else if (width) image.setAttribute('width', width);
    image.style.maxWidth = '100%';
    image.style.height = 'auto';
    image.setAttribute('loading', 'lazy');
    image.setAttribute('decoding', 'async');
    if (/-generated\.png(?:[?#]|$)/.test(image.getAttribute('src') || '') && !image.closest('a')) {
      const link = document.createElement('a');
      link.href = image.getAttribute('src');
      link.target = '_blank';
      link.rel = 'noopener';
      link.title = '이미지 크게 보기';
      link.setAttribute('aria-label', `이미지 크게 보기: ${image.alt}`);
      image.replaceWith(link);
      link.appendChild(image);
    }
  }
}

function localImage(sourceDocument, wikiRoot, src) {
  if (!src || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(src)) return null;
  if (src.startsWith('/')) throw new Error(`Root-relative image needs explicit mapping: ${sourceDocument}: ${src}`);
  const clean = decodeURIComponent(src.split(/[?#]/)[0]);
  const source = within(wikiRoot, path.resolve(path.dirname(sourceDocument), clean));
  return { source, relative: path.relative(wikiRoot, source).split(path.sep).join('/') };
}

function resolveImageAssets(document, sourceDocument, wikiRoot, baseUrl = '') {
  const assets = new Map();
  for (const image of document.querySelectorAll('img')) {
    const src = image.getAttribute('src');
    const asset = localImage(sourceDocument, wikiRoot, src);
    if (!asset) continue;
    const suffix = src.match(/[?#].*$/)?.[0] || '';
    image.setAttribute('src', `${baseUrl}/wikis/${encodePath(asset.relative)}${suffix}`);
    assets.set(asset.source, asset);
  }
  return [...assets.values()];
}

function copyImageAssets(document, sourceDocument, wikiRoot, outputRoot) {
  const copied = new Set();
  for (const image of document.querySelectorAll('img')) {
    const asset = localImage(sourceDocument, wikiRoot, image.getAttribute('src'));
    if (!asset || copied.has(asset.source)) continue;
    const destination = within(outputRoot, path.resolve(outputRoot, 'wikis', asset.relative));
    if (!fs.statSync(asset.source).isFile()) throw new Error(`Image is not a file: ${asset.source}`);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(asset.source, destination);
    copied.add(asset.source);
  }
  return [...copied];
}

module.exports = { prepareImages, copyImageAssets, resolveImageAssets, imageWidth };
