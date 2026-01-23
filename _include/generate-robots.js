const fs = require('fs');
const path = require('path');

const { OUTPUT_DIR, BASE_URL } = require('./const');

function normalizeBasePath() {
    return BASE_URL ? `${BASE_URL}/` : '/';
}

function buildRobots() {
    const basePath = normalizeBasePath();
    const sitemapPath = `${basePath}sitemap.xml`.replace(/\/{2,}/g, '/');

    const content = [
        'User-agent: *',
        'Disallow:',
        `Sitemap: ${sitemapPath}`,
        ''
    ].join('\n');

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUTPUT_DIR, 'robots.txt'), content, 'utf8');
    console.log('✔ Generated robots.txt: public/robots.txt');
}

buildRobots();
