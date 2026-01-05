const path = require('path');
const Handlebars = require('handlebars');

const WIKI_DIR = path.join(__dirname, '../_wiki');
const OUTPUT_DIR = path.join(__dirname, '../public');
const MAIN_LAYOUT_PATH = path.join(__dirname, '../_layout/main.html');
const HEADER_PATH = path.join(__dirname, '../_layout/header.html');
const FOOTER_PATH = path.join(__dirname, '../_layout/footer.html');
const GITHUB_REPO_URL = 'https://github.com/sikutisa/sikutisa.github.io/blob/master/_wiki/';
const DOCUMENT_LAYOUT_PATH = path.join(__dirname, '../_layout/layout.html');
const BASE_URL = process.env.BASE_URL ? `/${process.env.BASE_URL.replace(/^\/+|\/+$/g, '')}` : '';

module.exports = {
    WIKI_DIR,
    OUTPUT_DIR,
    MAIN_LAYOUT_PATH,
    HEADER_PATH,
    FOOTER_PATH,
    GITHUB_REPO_URL,
    DOCUMENT_LAYOUT_PATH,
    BASE_URL
};
