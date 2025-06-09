const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const { execSync } = require('child_process');

const {
    WIKI_DIR,
    OUTPUT_DIR,
    HEADER_PATH,
    FOOTER_PATH,
    GITHUB_REPO_URL
} = require('./const');

const INDEX_LAYOUT_PATH = path.join(__dirname, '../_layout/index.html');

function getGitLastModifiedTime(filePath) {
    try {
        const result = execSync(`git log -1 --format="%ci" -- "${filePath}"`, { encoding: 'utf8' });
        return result.trim().replace(' +0900', '');
    } catch (err) {
        return null;
    }
}

function getCategoriesAndDocs(baseDir) {
    const categories = [];

    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    for (const entry of entries) {
        const entryPath = path.join(baseDir, entry.name);

        if (entry.isDirectory()) {
            const categoryName = entry.name.replace(/_/g, ' ');
            const documents = [];

            const files = fs.readdirSync(entryPath, { withFileTypes: true });
            for (const file of files) {
                if (file.isFile() && file.name.endsWith('.md') && file.name !== 'index.md') {
                    const relPath = path.relative(WIKI_DIR, path.join(entryPath, file.name)).replace(/\\/g, '/');
                    const parsed = path.parse(relPath);
                    documents.push({
                        title: parsed.name.replace(/_/g, ' '),
                        url: `/wikis/${relPath.replace(/\.md$/, '')}`,
                        history_url: GITHUB_REPO_URL + relPath
                    });
                }
            }

            if (documents.length > 0) {
                categories.push({
                    category_name: categoryName,
                    documents
                });
            }
        }
    }

    return categories;
}

// Index 페이지 생성
function generateIndexPage() {
    const header = fs.readFileSync(HEADER_PATH, 'utf8');
    const footer = fs.readFileSync(FOOTER_PATH, 'utf8');
    const layout = fs.readFileSync(INDEX_LAYOUT_PATH, 'utf8');

    const template = Handlebars.compile(layout);

    const categories = getCategoriesAndDocs(WIKI_DIR);

    const indexFilePath = path.join(WIKI_DIR, 'index.md');
    const relPath = path.relative(WIKI_DIR, indexFilePath).replace(/\\/g, '/');
    const lastmod = getGitLastModifiedTime(indexFilePath) || 'Unknown';
    const historyUrl = GITHUB_REPO_URL + relPath;

    const data = {
        header: new Handlebars.SafeString(header),
        footer: new Handlebars.SafeString(footer),
        categories,
        last_updated: lastmod,
        history_url: historyUrl
    };

    const finalHtml = template(data);

    const indexOutputPath = path.join(OUTPUT_DIR, 'wikis', 'index.html');
    fs.mkdirSync(path.dirname(indexOutputPath), { recursive: true });
    fs.writeFileSync(indexOutputPath, finalHtml, 'utf8');

    console.log(`✔ Generated index page: ${indexOutputPath}`);
}

generateIndexPage();
