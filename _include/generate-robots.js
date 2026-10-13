const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const { OUTPUT_DIR, BASE_URL } = require('./const');

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
    const httpsMatch = remoteUrl.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/i);
    if (httpsMatch) {
        return { owner: httpsMatch[1], repo: httpsMatch[2] };
    }
    const sshMatch = remoteUrl.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i);
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

function buildRobots() {
    const siteUrl = normalizeSiteUrl();
    if (!siteUrl) {
        console.warn('Robots.txt not fully generated: SITE_URL or a GitHub repo remote is required for Sitemap URL.');
        return;
    }

    const basePath = BASE_URL || '';
    const sitemapFullUrl = `${siteUrl}${basePath}/sitemap.xml`.replace(/(?<!:)\/{2,}/g, '/');

    const content = [
        'User-agent: *',
        'Disallow:',
        `Sitemap: ${sitemapFullUrl}`,
        ''
    ].join('\n');

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUTPUT_DIR, 'robots.txt'), content, 'utf8');
    console.log('✔ Generated robots.txt: public/robots.txt');
}

buildRobots();
