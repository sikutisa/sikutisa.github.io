const fs = require('node:fs');
const path = require('node:path');

function within(root, file) {
  const rel = path.relative(root, file);
  if (rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) {
    throw new Error(`Image path escapes root: ${file}`);
  }
  return file;
}

// The repository's {: w="..." h = "..."} syntax is not understood by marked.
// Consume it from the parsed DOM; preserve each image's intrinsic aspect ratio.
function prepareImages(document) {
  for (const image of document.querySelectorAll('img')) {
    const next = image.nextSibling;
    if (next && next.nodeType === 3) {
      const annotation = next.textContent.match(/^\s*\{:\s*([^}]*)\}/);
      if (annotation) {
        const width = annotation[1].match(/\bw\s*=\s*["']?(\d+)["']?/);
        if (width && Number(width[1]) > 0 && Number(width[1]) <= 4096) image.setAttribute('width', width[1]);
        next.textContent = next.textContent.slice(annotation[0].length);
      }
    }
    image.removeAttribute('height');
    image.style.maxWidth = '100%';
    image.style.height = 'auto';
    image.setAttribute('loading', 'lazy');
    image.setAttribute('decoding', 'async');
    // Dense technical diagrams remain readable on small screens via the full PNG.
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

function copyImageAssets(document, sourceDocument, wikiRoot, outputRoot) {
  const copied = new Set();
  for (const image of document.querySelectorAll('img')) {
    const src = image.getAttribute('src');
    if (!src || /^(?:[a-z]+:|\/\/)/i.test(src)) continue;
    if (src.startsWith('/')) throw new Error(`Root-relative image needs explicit mapping: ${sourceDocument}: ${src}`);
    const clean = decodeURIComponent(src.split(/[?#]/)[0]);
    const source = within(wikiRoot, path.resolve(path.dirname(sourceDocument), clean));
    const destination = within(outputRoot, path.resolve(outputRoot, 'wikis', path.relative(wikiRoot, source)));
    if (!fs.statSync(source).isFile()) throw new Error(`Image is not a file: ${source}`);
    if (copied.has(source)) continue;
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
    copied.add(source);
  }
  return [...copied];
}

module.exports = { prepareImages, copyImageAssets };
