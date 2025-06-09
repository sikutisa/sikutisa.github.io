const fs = require('fs');
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
  GITHUB_REPO_URL
} = require('./const');

// Git 마지막 수정 시간
function getGitLastModifiedTime(filePath) {
  try {
    const result = execSync(`git log -1 --format="%ci" -- "${filePath}"`, {
      encoding: 'utf8',
    });
    return result.trim().replace(' +0900', '');
  } catch {
    return null;
  }
}

// 목차 생성 + HTML에 id 반영
function generateTableOfContentsAndUpdateHtml(html) {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const headings = [...document.querySelectorAll('h2, h3')];

  let toc = '';
  let lastLevel = 2;

  headings.forEach(h => {
    const level = parseInt(h.tagName[1], 10);
    const text = h.textContent;
    const id = text.toLowerCase().replace(/[^\w가-힣]+/g, '-').replace(/^-|-$/g, '');
    h.id = id;

    if (level > lastLevel) {
      toc += '<ul>'.repeat(level - lastLevel);
    } else if (level < lastLevel) {
      toc += '</ul>'.repeat(lastLevel - level);
    }
    toc += `<li><a href="#${id}">${text}</a></li>\n`;
    lastLevel = level;
  });

  toc += '</ul>'.repeat(lastLevel - 2);

  return {
    html: dom.serialize(),
    toc
  };
}

// VimWiki 스타일 링크 수정
function patchVimWikiLinks(markdown) {
  return markdown.replace(/\[([^\]]+?)\/([^\]]+?)\]\(([^)]+?)\/\3\)/g, (_, folder, title, link) => {
    return `[${title}](/wikis/${link})`;
  });
}

// Markdown -> HTML 변환
function convertMarkdownFile(filePath) {
  const markdownRaw = fs.readFileSync(filePath, 'utf8');
  const { content, data } = matter(markdownRaw);

  const patchedMarkdown = patchVimWikiLinks(content);
  let html = marked.parse(patchedMarkdown);

  const { html: updatedHtml, toc } = generateTableOfContentsAndUpdateHtml(html);
  html = updatedHtml;

  const relPath = path.relative(WIKI_DIR, filePath).replace(/\\/g, '/');
  const fileName = path.basename(filePath, '.md');
  const title = fileName.replace(/_/g, ' ');
  const lastmod = getGitLastModifiedTime(filePath) || 'Unknown';
  const historyUrl = GITHUB_REPO_URL + relPath;

  return {
    html,
    title,
    lastmod,
    historyUrl,
    toc,
    tags: Array.isArray(data.tags) ? data.tags : [],
    use_math: !!data.use_math,
    outputPath: path.join(OUTPUT_DIR, 'wikis', relPath.replace(/\.md$/, '.html')),
  };
}

// 전체 변환 실행
function convertAll() {
  const header = fs.readFileSync(HEADER_PATH, 'utf8');
  const footer = fs.readFileSync(FOOTER_PATH, 'utf8');
  const layout = fs.readFileSync(DOCUMENT_LAYOUT_PATH, 'utf8');
  const template = Handlebars.compile(layout);

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
        table_of_contents: new Handlebars.SafeString(toc),
        content: new Handlebars.SafeString(html),
        use_math
      };

      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, template(data), 'utf8');
      console.log(`✔ Converted: ${outputPath}`);
    });
  }

  walk(WIKI_DIR);
}

convertAll();
