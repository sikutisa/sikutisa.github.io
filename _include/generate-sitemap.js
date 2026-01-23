const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const { WIKI_DIR, OUTPUT_DIR, BASE_URL } = require('./const');

const PROJECT_ROOT = path.join(__dirname, '..');

function getGitRemoteUrl() {
    try {
        const result = execSync('git config --get remote.origin.url', {
            cwd: PROJECT_ROOT,
            encoding: 'utf8'
        });
        return result.trim();
    } catch (err) {
        return '';
    }
}

function parseGitHubRepo(remoteUrl) {
    if (!remoteUrl) {
        return null;
    }
    const httpsMatch = remoteUrl.match(/^https?:\/\/github\.com\/([^/]+)\/([^/.]+)(?:\.git)?$/i);
    if (httpsMatch) {
        return { owner: httpsMatch[1], repo: httpsMatch[2] };
    }
    const sshMatch = remoteUrl.match(/^git@github\.com:([^/]+)\/([^/.]+)(?:\.git)?$/i);
    if (sshMatch) {
        return { owner: sshMatch[1], repo: sshMatch[2] };
    }
    return null;
}

function normalizeSiteUrl() {
    if (process.env.SITE_URL) {
        return process.env.SITE_URL.replace(/\/+$/, '');
    }

    const fromEnv = process.env.GITHUB_REPOSITORY;
    const repoInfo = fromEnv
        ? (() => {
            const [owner, repo] = fromEnv.split('/');
            return owner && repo ? { owner, repo } : null;
        })()
        : parseGitHubRepo(getGitRemoteUrl());

    if (!repoInfo) {
        return '';
    }

    return `https://${repoInfo.owner}.github.io`;
}

function formatTimestamp(date) {
    return date.toISOString();
}

function getGitLastModifiedTime(filePath) {
    try {
        const result = execSync(`git log -1 --format="%ci" -- "${filePath}"`, {
            cwd: PROJECT_ROOT,
            encoding: 'utf8'
        });
        return result.trim();
    } catch (err) {
        return null;
    }
}

function getLastModifiedIso(filePath) {
    const gitStamp = getGitLastModifiedTime(filePath);
    if (gitStamp) {
        const parsed = new Date(gitStamp);
        if (!Number.isNaN(parsed.getTime())) {
            return formatTimestamp(parsed);
        }
    }
    return formatTimestamp(fs.statSync(filePath).mtime);
}

function getAllMarkdownFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    return entries.flatMap(entry => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            return getAllMarkdownFiles(fullPath);
        }
        if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'index.md') {
            return fullPath;
        }
        return [];
    });
}

function getUrlRelFromRelPath(relPath) {
    const cleanRelPath = relPath.replace(/\.md$/, '');
    const parsed = path.posix.parse(cleanRelPath);
    const dirBase = path.posix.basename(parsed.dir);
    const isLeaf = dirBase && parsed.name === dirBase;
    return isLeaf ? parsed.dir : path.posix.join(parsed.dir, parsed.name);
}

function escapeXml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function buildSitemap() {
    const siteUrl = normalizeSiteUrl();
    if (!siteUrl) {
        console.warn('Sitemap not generated: SITE_URL or a GitHub repo remote is required.');
        return;
    }

    const basePath = BASE_URL || '';
    const pages = [];

    const mainIndexPath = path.join(OUTPUT_DIR, 'index.html');
    const wikiIndexPath = path.join(WIKI_DIR, 'index.md');

    if (fs.existsSync(mainIndexPath)) {
        pages.push({
            path: '/',
            lastmod: getLastModifiedIso(mainIndexPath)
        });
    }

    if (fs.existsSync(wikiIndexPath)) {
        pages.push({
            path: '/wikis/',
            lastmod: getLastModifiedIso(wikiIndexPath)
        });
    }

    const markdownFiles = getAllMarkdownFiles(WIKI_DIR);
    markdownFiles.forEach(filePath => {
        const relPath = path.relative(WIKI_DIR, filePath).replace(/\\/g, '/');
        const urlRel = getUrlRelFromRelPath(relPath);
        pages.push({
            path: `/wikis/${urlRel}/`,
            lastmod: getLastModifiedIso(filePath)
        });
    });

    const urls = pages.map(page => {
        const loc = `${siteUrl}${basePath}${page.path}`;
        return `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${page.lastmod}</lastmod>\n  </url>`;
    });

    const xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...urls,
        '</urlset>',
        ''
    ].join('\n');

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUTPUT_DIR, 'sitemap.xml'), xml, 'utf8');
    console.log('✔ Generated sitemap: public/sitemap.xml');
}

buildSitemap();
