const fs = require('fs');
const fse = require('fs-extra');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');
const { JSDOM } = require('jsdom');
const { execSync } = require('child_process');
const Handlebars = require('handlebars');

const {
  WIKI_DIR,
  OUTPUT_DIR,
  HEADER_PATH,
  FOOTER_PATH,
  DOCUMENT_LAYOUT_PATH,
  GITHUB_REPO_URL,
  BASE_URL,
  STYLE_DIR
} = require('./const');

function formatTimestamp(date) {
  const iso = date.toISOString();
  return iso.replace('T', ' ').replace('Z', ' +0000');
}

// Git 마지막 수정 시간
function getGitLastModifiedTime(filePath) {
  try {
    const result = execSync(`git log -1 --format="%ci" -- "${filePath}"`, {
      encoding: 'utf8',
    });
    return result.trim();
  } catch {
    return null;
  }
}

function getLastModifiedTime(filePath) {
  return getGitLastModifiedTime(filePath) || formatTimestamp(fs.statSync(filePath).mtime);
}

function sanitizeHtml(html) {
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`);
  const { document } = dom.window;

  document.querySelectorAll('script, iframe, object, embed, link, meta, base').forEach(node => {
    node.remove();
  });

  const elements = [...document.querySelectorAll('*')];
  elements.forEach(el => {
    [...el.attributes].forEach(attr => {
      const name = attr.name.toLowerCase();
      const value = attr.value;

      if (name.startsWith('on') || name === 'style' || name === 'srcdoc') {
        el.removeAttribute(attr.name);
        return;
      }

      if (name === 'href' || name === 'src' || name === 'xlink:href') {
        const normalized = value.trim().toLowerCase();
        if (normalized.startsWith('javascript:') || normalized.startsWith('vbscript:')) {
          el.removeAttribute(attr.name);
        }
        if (normalized.startsWith('data:') && !normalized.startsWith('data:image/')) {
          el.removeAttribute(attr.name);
        }
      }
    });
  });

  return document.body.innerHTML;
}

function removeDuplicateTitle(html) {
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`);
  const { document } = dom.window;
  const headings = [...document.body.querySelectorAll('h1')];
  if (headings.length === 0) {
    return html;
  }
  headings.forEach(h1 => h1.remove());
  return document.body.innerHTML;
}

function getUrlRelFromRelPath(relPath) {
  const cleanRelPath = relPath.replace(/\.md$/, '');
  const parsed = path.posix.parse(cleanRelPath);
  const dirBase = path.posix.basename(parsed.dir);
  const isLeaf = dirBase && parsed.name === dirBase;
  return isLeaf ? parsed.dir : path.posix.join(parsed.dir, parsed.name);
}

function withBaseUrl(urlPath) {
  return `${BASE_URL}${urlPath}`;
}

function applyBaseUrlToHtml(html) {
  if (!BASE_URL) {
    return html;
  }
  return html
    .replace(/\bhref="\/(?!\/)/g, `href="${BASE_URL}/`)
    .replace(/\bsrc="\/(?!\/)/g, `src="${BASE_URL}/`);
}

function rewriteImageSources(html, urlRel) {
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`);
  const { document } = dom.window;

  document.querySelectorAll('img').forEach(img => {
    const src = (img.getAttribute('src') || '').trim();
    if (!src || src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
      return;
    }

    const normalized = src.replace(/^\.?\//, '');
    if (normalized.startsWith('img/')) {
      const rest = normalized.slice('img/'.length);
      img.setAttribute('src', withBaseUrl(`/wikis/${urlRel}/img/${rest}`));
    }
  });

  return document.body.innerHTML;
}

function copyLocalImages(filePath, outputPath) {
  const sourceDir = path.join(path.dirname(filePath), 'img');
  if (!fs.existsSync(sourceDir)) {
    return;
  }
  const targetDir = path.join(path.dirname(outputPath), 'img');
  fse.ensureDirSync(targetDir);
  fse.copySync(sourceDir, targetDir, { overwrite: true });
}

// 목차 생성 + HTML에 id 반영
function generateTableOfContentsAndUpdateHtml(html) {
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`);
  const document = dom.window.document;
  const headings = [...document.body.querySelectorAll('h2, h3')];
  if (headings.length === 0) {
    return {
      html: document.body.innerHTML,
      toc: ''
    };
  }

  const idCounts = new Map();
  const items = headings.map(h => {
    const level = parseInt(h.tagName[1], 10);
    const text = h.textContent;
    const baseId = text.toLowerCase().replace(/[^\w가-힣]+/g, '-').replace(/^-|-$/g, '');
    const safeBaseId = baseId || 'section';
    const count = (idCounts.get(safeBaseId) || 0) + 1;
    idCounts.set(safeBaseId, count);
    const id = count === 1 ? safeBaseId : `${safeBaseId}-${count}`;
    h.id = id;
    return { level, text, id };
  });

  let toc = '';
  if (items.length > 0) {
    const minLevel = 2;
    let currentLevel = minLevel;
    toc = '<ul>';

    items.forEach((item, index) => {
      if (item.level > currentLevel) {
        toc += '<ul>'.repeat(item.level - currentLevel);
      } else if (item.level < currentLevel) {
        toc += '</li>';
        toc += '</ul></li>'.repeat(currentLevel - item.level);
      } else if (index > 0) {
        toc += '</li>';
      }

      toc += `<li><a href="#${item.id}">${item.text}</a>`;
      currentLevel = item.level;
    });

    toc += '</li>';
    toc += '</ul></li>'.repeat(currentLevel - minLevel);
    toc += '</ul>';
  }

  return {
    html: document.body.innerHTML,
    toc: toc.trim()
  };
}

// VimWiki 스타일 링크 수정
function patchVimWikiLinks(markdown, currentRelDir) {
  return markdown.replace(/\[([^\]]+?)\/([^\]]+?)\]\(([^)]+?)\/\3\)/g, (_, folder, title, link) => {
    const linkRelPath = path.posix.join(currentRelDir, link);
    const urlRel = getUrlRelFromRelPath(linkRelPath);
    return `[${title}](${withBaseUrl(`/wikis/${urlRel}/`)})`;
  });
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function preprocessMarkdownImages(markdown) {
  const lines = markdown.split(/\r?\n/);
  const output = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const match = line.match(/^!\[([^\]]*)\]\(([^)]+)\)\{\:\s*([^}]+)\}\s*$/);
    if (!match) {
      output.push(line);
      continue;
    }

    const alt = match[1] || '';
    const src = match[2];
    const attrs = match[3];
    const widthMatch = attrs.match(/\bw\s*=\s*"?(\d+(?:\.\d+)?%?)"?/i);
    const width = widthMatch ? widthMatch[1] : null;

    let caption = null;
    if (i + 1 < lines.length) {
      const captionMatch = lines[i + 1].match(/^\*([^*]+)\*\s*$/);
      if (captionMatch) {
        caption = captionMatch[1].trim();
        i += 1;
      }
    }

    let img = `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"`;
    if (width) {
      if (width.endsWith('%')) {
        img += ` style="width:${escapeHtml(width)};height:auto;"`;
      } else {
        img += ` width="${escapeHtml(width)}"`;
      }
    }
    img += '>';

    let figure = `<figure class="wiki-figure">${img}`;
    if (caption) {
      figure += `<figcaption class="wiki-figcaption">${escapeHtml(caption)}</figcaption>`;
    }
    figure += '</figure>';

    output.push(figure);
  }

  return output.join('\n');
}

// Markdown -> HTML 변환
function convertMarkdownFile(filePath) {
  const markdownRaw = fs.readFileSync(filePath, 'utf8');
  const { content, data } = matter(markdownRaw);

  const relPath = path.relative(WIKI_DIR, filePath).replace(/\\/g, '/');
  const currentRelDir = path.posix.dirname(relPath);
  const patchedMarkdown = patchVimWikiLinks(content, currentRelDir);
  const preprocessedMarkdown = preprocessMarkdownImages(patchedMarkdown);
  let html = marked.parse(preprocessedMarkdown);
  html = sanitizeHtml(html);

  const urlRel = getUrlRelFromRelPath(relPath);
  html = rewriteImageSources(html, urlRel);

  const { html: updatedHtml, toc } = generateTableOfContentsAndUpdateHtml(html);
  html = updatedHtml;

  const parsed = path.posix.parse(relPath);
  const fileName = parsed.name;
  const title = fileName.replace(/_/g, ' ');
  html = removeDuplicateTitle(html);
  const lastmod = getLastModifiedTime(filePath);
  const historyUrl = GITHUB_REPO_URL + relPath;
  const outputPath = path.join(OUTPUT_DIR, 'wikis', ...urlRel.split('/'), 'index.html');
  copyLocalImages(filePath, outputPath);

  return {
    html,
    title,
    lastmod,
    historyUrl,
    toc,
    tags: Array.isArray(data.tags) ? data.tags : [],
    use_math: !!data.use_math,
    outputPath
  };
}

// 전체 변환 실행
function copyMathJaxBundle() {
  const sourceDir = path.join(__dirname, '../node_modules/mathjax/es5');
  const targetDir = path.join(OUTPUT_DIR, 'assets', 'mathjax', 'es5');

  try {
    fse.ensureDirSync(targetDir);
    fse.copySync(sourceDir, targetDir, { overwrite: true });
  } catch (err) {
    console.warn('MathJax bundle copy failed:', err.message);
  }
}

function copyStyleAssets() {
  const targetDir = path.join(OUTPUT_DIR, 'assets', 'style');
  if (!fs.existsSync(STYLE_DIR)) {
    return;
  }
  try {
    fse.ensureDirSync(targetDir);
    fse.copySync(STYLE_DIR, targetDir, { overwrite: true });
  } catch (err) {
    console.warn('Style assets copy failed:', err.message);
  }
}

function convertAll() {
  const header = applyBaseUrlToHtml(fs.readFileSync(HEADER_PATH, 'utf8'));
  const footer = applyBaseUrlToHtml(fs.readFileSync(FOOTER_PATH, 'utf8'));
  const layout = fs.readFileSync(DOCUMENT_LAYOUT_PATH, 'utf8');
  const template = Handlebars.compile(layout);

  copyMathJaxBundle();
  copyStyleAssets();

  function walk(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(fullPath);
      if (!entry.name.endsWith('.md') || entry.name === 'index.md') return;

      const {
        html,
        title,
        lastmod,
        historyUrl,
        toc,
        use_math,
        outputPath
      } = convertMarkdownFile(fullPath);

      const data = {
        title,
        lastmod,
        history_url: historyUrl,
        header: new Handlebars.SafeString(header),
        footer: new Handlebars.SafeString(footer),
        table_of_contents: toc ? new Handlebars.SafeString(toc) : null,
        content: new Handlebars.SafeString(html),
        use_math,
        base_url: BASE_URL
      };

      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, template(data), 'utf8');
      console.log(`✔ Converted: ${outputPath}`);
    });
  }

  walk(WIKI_DIR);
}

convertAll();
