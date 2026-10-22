const path = require('node:path');
const { marked } = require('marked');
const hljs = require('highlight.js');
const { JSDOM } = require('jsdom');
const { documentUrl } = require('./urls');
const { prepareImages, resolveImageAssets, imageWidth } = require('./image-assets');

function escapeHtml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function patchVimWikiLinks(markdown, relativeDirectory, baseUrl) {
  return markdown.replace(/\[\[([^\]]+?)\]\]/g, (_, link) => {
    const normalized = link.trim().replace(/^\.\//, '');
    const relative = path.posix.join(relativeDirectory, normalized);
    return `[${path.posix.basename(normalized)}](${documentUrl(relative, baseUrl)})`;
  }).replace(/\[([^\]]+?)\/([^\]]+?)\]\(([^)]+?)\/\3\)/g, (_, folder, title, link) =>
    `[${title}](${documentUrl(path.posix.join(relativeDirectory, link), baseUrl)})`);
}

function preprocessProse(markdown, options) {
  const lines = patchVimWikiLinks(markdown, options.relativeDirectory || '', options.baseUrl || '').split('\n');
  const result = [];
  for (let index = 0; index < lines.length; index++) {
    const match = lines[index].match(/^(\s*)!\[([^\]]*)\]\(([^)]+)\)\{:\s*([^}]+)\}\s*$/);
    if (!match) { result.push(lines[index]); continue; }
    const [, indent, alt, src, attributes] = match;
    const rawWidth = attributes.match(/\bw\s*=\s*["']?(\d+(?:\.\d+)?%?)["']?/)?.[1];
    const width = imageWidth(rawWidth);
    let figure = `${indent}<figure class="wiki-figure"><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"`;
    if (width) figure += ` data-wiki-width="${width}"`;
    figure += '>';
    const caption = lines[index + 1]?.match(/^\s*\*([^*]+)\*\s*$/);
    if (caption) { figure += `<figcaption class="wiki-figcaption">${escapeHtml(caption[1].trim())}</figcaption>`; index++; }
    result.push(`${figure}</figure>`);
  }
  return result.join('\n');
}

// Preserve code fences verbatim; image attributes and wiki links are prose syntax.
function preprocessMarkdown(markdown, options = {}) {
  const result = [];
  let prose = [], fence = null;
  const flush = () => { result.push(preprocessProse(prose.join('\n'), options)); prose = []; };
  for (const line of markdown.split(/\r?\n/)) {
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      result.push(line);
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
    } else if (marker) {
      if (prose.length) flush();
      fence = marker[1];
      result.push(line);
    } else prose.push(line);
  }
  if (prose.length) flush();
  return result.join('\n');
}

function sanitizeDocument(document) {
  document.querySelectorAll('script, iframe, object, embed, link, meta, base').forEach(node => node.remove());
  for (const element of document.querySelectorAll('*')) {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      if (name.startsWith('on') || ['style', 'srcdoc', 'srcset'].includes(name)) {
        element.removeAttribute(attribute.name);
      } else if (['href', 'src', 'xlink:href'].includes(name)) {
        const value = attribute.value.replace(/[\u0000-\u0020\u007f]/g, '').toLowerCase();
        if (/^(?:javascript|vbscript):/.test(value) || (value.startsWith('data:') && !(name === 'src' && value.startsWith('data:image/')))) {
          element.removeAttribute(attribute.name);
        }
      }
    }
  }
}

function highlightCode(document) {
  for (const code of document.querySelectorAll('pre code')) {
    const language = code.className.match(/language-([A-Za-z0-9_-]+)/)?.[1]?.toLowerCase();
    const result = language && hljs.getLanguage(language)
      ? hljs.highlight(code.textContent, { language }) : hljs.highlightAuto(code.textContent);
    code.innerHTML = result.value;
    code.className = `hljs${language ? ` language-${language}` : ''}`;
  }
}

function createTableOfContents(document) {
  const headings = [...document.body.querySelectorAll('h2, h3')];
  if (!headings.length) return '';
  const usedIds = new Set();
  const root = document.createElement('ul');
  let parentItem = null, childList = null;
  for (const heading of headings) {
    const base = heading.textContent.toLowerCase().replace(/[^\w가-힣]+/g, '-').replace(/^-|-$/g, '') || 'section';
    let id = base, suffix = 2;
    while (usedIds.has(id)) id = `${base}-${suffix++}`;
    usedIds.add(id);
    heading.id = id;
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.setAttribute('href', `#${id}`);
    link.textContent = heading.textContent;
    item.appendChild(link);
    if (heading.tagName === 'H3' && parentItem) {
      if (!childList) { childList = document.createElement('ul'); parentItem.appendChild(childList); }
      childList.appendChild(item);
    } else {
      root.appendChild(item);
      if (heading.tagName === 'H2') { parentItem = item; childList = null; }
    }
  }
  return root.outerHTML;
}

function plainText(node) {
  if (node.nodeType === 3) return node.nodeValue;
  const text = [...node.childNodes].map(plainText).join('');
  return /^(?:P|DIV|H[1-6]|LI|TR|TD|TH|PRE|BLOCKQUOTE|FIGURE|FIGCAPTION|BR|HR)$/.test(node.nodeName) ? ` ${text} ` : text;
}

function renderMarkdown(markdown, options = {}) {
  const dom = new JSDOM(`<!doctype html><body>${marked.parse(preprocessMarkdown(markdown, options))}</body>`);
  const { document } = dom.window;
  try {
    sanitizeDocument(document);
    highlightCode(document);
    const images = options.sourceDocument
      ? resolveImageAssets(document, options.sourceDocument, options.wikiRoot, options.baseUrl) : [];
    // Apply only validated image sizes after stripping author-supplied inline styles.
    prepareImages(document);
    const toc = createTableOfContents(document);
    const searchText = plainText(document.body).replace(/\s+/g, ' ').trim();
    document.querySelectorAll('h1').forEach(node => node.remove());
    return { html: document.body.innerHTML, toc, plainText: searchText, images };
  } finally { dom.window.close(); }
}

function renderedDocument(site, document) {
  if (!document.rendered) {
    document.rendered = renderMarkdown(document.content, {
      relativeDirectory: path.posix.dirname(document.relPath),
      sourceDocument: document.filePath, wikiRoot: site.config.WIKI_DIR, baseUrl: site.config.BASE_URL,
    });
  }
  return document.rendered;
}

module.exports = { renderMarkdown, renderedDocument, preprocessMarkdown, sanitizeDocument, createTableOfContents };
