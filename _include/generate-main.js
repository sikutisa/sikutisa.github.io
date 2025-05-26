const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const Handlebars = require('handlebars');

const {
    WIKI_DIR,
    OUTPUT_DIR,
    MAIN_LAYOUT_PATH,
    HEADER_PATH,
    FOOTER_PATH
} = require('./const');

// Git 로그 기반 마지막 수정 시간
function getGitLastModifiedTime(filePath) {
    try {
        const result = execSync(`git log -1 --format="%ci" -- "${filePath}"`, {
            encoding: 'utf8'
        });
        return result.trim().replace(' +0900', '');
    } catch (err) {
        return null; // Git 로그 없을 경우
    }
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
            const relPath = path.relative(WIKI_DIR, filePath).replace(/\\/g, '/');;
            const parsed = path.parse(relPath);

            const lastmod = getGitLastModifiedTime(filePath) || 'Unknown';

            return {
                title: parsed.name.replace(/_/g, ' '), 
                url: `/wikis/${relPath.replace(/\.md$/, '')}`,
                lastmod
            };
        })
        .sort((a, b) => new Date(b.lastmod) - new Date(a.lastmod))
        .slice(0, limit);
}

// 메인 페이지 생성
function generateMainPage() {
    const header = fs.readFileSync(HEADER_PATH, 'utf8');
    const footer = fs.readFileSync(FOOTER_PATH, 'utf8');
    const layout = fs.readFileSync(MAIN_LAYOUT_PATH, 'utf8');

    const template = Handlebars.compile(layout);

    const data = {
        header: new Handlebars.SafeString(header),
        footer: new Handlebars.SafeString(footer),
        recent_docs: getRecentDocuments()
    };

    const finalHtml = template(data);

    const outputPath = path.join(OUTPUT_DIR, 'index.html');
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    fs.writeFileSync(outputPath, finalHtml, 'utf8');
    console.log(`✔ Generated main page: ${outputPath}`);
}

generateMainPage();