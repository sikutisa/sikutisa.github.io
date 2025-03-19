const fs = require('fs');
const Handlebars = require('handlebars');

const { WIKI_DIR, OUTPUT_DIR, MAIN_LAYOUT_PATH, HEADER_PATH, FOOTER_PATH } = require('./const');

// 최근 수정된 문서 30개 가져오기 (index.md 제외)
function getRecentDocuments(limit = 30) {
    return fs.readdirSync(WIKI_DIR)
        .filter(file => file.endsWith('.md') && file !== 'index.md')
        .map(file => {
            const filePath = `${WIKI_DIR}/${file}`;
            return {
                title: file.replace('.md', ''),
                url: `/wikis/${file.replace('.md', '')}`,
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
        recent_docs: getRecentDocuments(),
    };

    const finalHtml = template(data);

    fs.writeFileSync(`${OUTPUT_DIR}/index.html`, finalHtml, 'utf8');
    console.log('✔ Generated main page: index.html');
}

generateMainPage();