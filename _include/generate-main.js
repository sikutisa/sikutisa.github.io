const fs = require('fs');
const fse = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const Handlebars = require('handlebars');

const {
    WIKI_DIR,
    OUTPUT_DIR,
    MAIN_LAYOUT_PATH,
    HEADER_PATH,
    FOOTER_PATH,
    BASE_URL,
    STYLE_DIR
} = require('./const');

function formatTimestamp(date) {
    const iso = date.toISOString();
    return iso.replace('T', ' ').replace('Z', ' +0000');
}

// Git 로그 기반 마지막 수정 시간
function getGitLastModifiedTime(filePath) {
    try {
        const result = execSync(`git log -1 --format="%ci" -- "${filePath}"`, {
            encoding: 'utf8'
        });
        return result.trim();
    } catch (err) {
        return null; // Git 로그 없을 경우
    }
}

function getLastModifiedTime(filePath) {
    const mtime = formatTimestamp(fs.statSync(filePath).mtime);
    return getGitLastModifiedTime(filePath) || mtime;
}

// 재귀적으로 .md 파일 가져오기 (index.md 제외)
function getAllMarkdownFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    return entries.flatMap(entry => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            return getAllMarkdownFiles(fullPath);
        } else if (
            entry.isFile() &&
            entry.name.endsWith('.md') &&
            entry.name !== 'index.md'
        ) {
            return fullPath;
        }
        return [];
    });
}

// 최근 수정된 문서 30개 정렬
function getRecentDocuments(limit = 30) {
    return getAllMarkdownFiles(WIKI_DIR)
        .map(filePath => {
            const relPath = path.relative(WIKI_DIR, filePath).replace(/\\/g, '/');
            const parsed = path.posix.parse(relPath);
            const dirBase = path.posix.basename(parsed.dir);
            const isLeaf = dirBase && parsed.name === dirBase;
            const urlRel = isLeaf ? parsed.dir : path.posix.join(parsed.dir, parsed.name);

            const lastmod = getLastModifiedTime(filePath);

            return {
                title: parsed.name.replace(/_/g, ' '), 
                url: `${BASE_URL}/wikis/${urlRel}/`,
                lastmod
            };
        })
        .sort((a, b) => new Date(b.lastmod) - new Date(a.lastmod))
        .slice(0, limit);
}

function applyBaseUrlToHtml(html) {
    if (!BASE_URL) {
        return html;
    }
    return html
        .replace(/\bhref="\/(?!\/)/g, `href="${BASE_URL}/`)
        .replace(/\bsrc="\/(?!\/)/g, `src="${BASE_URL}/`);
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

// 메인 페이지 생성
function generateMainPage() {
    const header = applyBaseUrlToHtml(fs.readFileSync(HEADER_PATH, 'utf8'));
    const footer = applyBaseUrlToHtml(fs.readFileSync(FOOTER_PATH, 'utf8'));
    const layout = fs.readFileSync(MAIN_LAYOUT_PATH, 'utf8');

    const template = Handlebars.compile(layout);

    const data = {
        header: new Handlebars.SafeString(header),
        footer: new Handlebars.SafeString(footer),
        recent_docs: getRecentDocuments(),
        base_url: BASE_URL
    };

    const finalHtml = template(data);

    const outputPath = path.join(OUTPUT_DIR, 'index.html');
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    copyStyleAssets();
    fs.writeFileSync(outputPath, finalHtml, 'utf8');
    console.log(`✔ Generated main page: ${outputPath}`);
}

generateMainPage();
