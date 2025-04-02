const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');

const {
    WIKI_DIR,
    OUTPUT_DIR,
    MAIN_LAYOUT_PATH,
    HEADER_PATH,
    FOOTER_PATH
} = require('./const');

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
            const relPath = path.relative(WIKI_DIR, filePath); 
            const parsed = path.parse(relPath); 

            return {
                // 1. 문서 제목: 폴더 경로 및 '_' 제외
                title: parsed.name.replace(/_/g, ' '),

                // 2. URL: 상대 경로에서 확장자 제거
                url: `/wikis/${relPath.replace(/\.md$/, '')}`,

                // 3. 수정 시간
                lastmod: fs.statSync(filePath).mtime.toISOString().replace('T', ' ').slice(0, 19)
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

    // 출력 디렉터리 생성 여부 확인
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    fs.writeFileSync(path.join(OUTPUT_DIR, 'index.html'), finalHtml, 'utf8');
    console.log('✔ Generated main page: index.html');
}

generateMainPage();