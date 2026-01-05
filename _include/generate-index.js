const fs = require('fs');
const fse = require('fs-extra');
const path = require('path');
const Handlebars = require('handlebars');
const { execSync } = require('child_process');

const {
    WIKI_DIR,
    OUTPUT_DIR,
    HEADER_PATH,
    FOOTER_PATH,
    GITHUB_REPO_URL,
    BASE_URL,
    STYLE_DIR
} = require('./const');

const INDEX_LAYOUT_PATH = path.join(__dirname, '../_layout/index.html');

function formatTimestamp(date) {
    const iso = date.toISOString();
    return iso.replace('T', ' ').replace('Z', ' +0000');
}

function getGitLastModifiedTime(filePath) {
    try {
        const result = execSync(`git log -1 --format="%ci" -- "${filePath}"`, { encoding: 'utf8' });
        return result.trim();
    } catch (err) {
        return null;
    }
}

function getLastModifiedTime(filePath) {
    return getGitLastModifiedTime(filePath) || formatTimestamp(fs.statSync(filePath).mtime);
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
                    const parsed = path.posix.parse(relPath);
                    const dirBase = path.posix.basename(parsed.dir);
                    const isLeaf = dirBase && parsed.name === dirBase;
                    const urlRel = isLeaf ? parsed.dir : path.posix.join(parsed.dir, parsed.name);
                    documents.push({
                        title: parsed.name.replace(/_/g, ' '),
                        url: `${BASE_URL}/wikis/${urlRel}/`,
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

// Index 페이지 생성
function generateIndexPage() {
    const header = applyBaseUrlToHtml(fs.readFileSync(HEADER_PATH, 'utf8'));
    const footer = applyBaseUrlToHtml(fs.readFileSync(FOOTER_PATH, 'utf8'));
    const layout = fs.readFileSync(INDEX_LAYOUT_PATH, 'utf8');

    const template = Handlebars.compile(layout);

    const categories = getCategoriesAndDocs(WIKI_DIR);

    const indexFilePath = path.join(WIKI_DIR, 'index.md');
    const relPath = path.relative(WIKI_DIR, indexFilePath).replace(/\\/g, '/');
    const lastmod = getLastModifiedTime(indexFilePath);
    const historyUrl = GITHUB_REPO_URL + relPath;

    const data = {
        header: new Handlebars.SafeString(header),
        footer: new Handlebars.SafeString(footer),
        categories,
        last_updated: lastmod,
        history_url: historyUrl,
        base_url: BASE_URL
    };

    const finalHtml = template(data);

    const indexOutputPath = path.join(OUTPUT_DIR, 'wikis', 'index.html');
    fs.mkdirSync(path.dirname(indexOutputPath), { recursive: true });
    copyStyleAssets();
    fs.writeFileSync(indexOutputPath, finalHtml, 'utf8');

    console.log(`✔ Generated index page: ${indexOutputPath}`);
}

generateIndexPage();
