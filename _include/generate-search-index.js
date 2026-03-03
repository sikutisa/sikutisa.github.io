/**
 * @file generate-search-index.js
 * @description 빌드 시점에 마크다운 파일을 순회하며 검색용 JSON 인덱스를 생성합니다.
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');

const {
  WIKI_DIR,
  OUTPUT_DIR,
  BASE_URL
} = require('./const');

/**
 * 마크다운 상대 경로로부터 최종 서비스될 URL을 생성합니다.
 * @param {string} relPath - 마크다운 파일의 상대 경로
 * @returns {string} 생성된 URL 경로
 */
function getUrlRelFromRelPath(relPath) {
  const cleanRelPath = relPath.replace(/\.md$/, '');
  const parsed = path.posix.parse(cleanRelPath);
  
  // 파일명이 디렉토리명과 같으면 해당 디렉토리의 인덱스로 간주 (VimWiki/Jekyll 스타일 대응)
  const dirBase = path.posix.basename(parsed.dir);
  const isLeaf = dirBase && parsed.name === dirBase;
  const urlPath = isLeaf ? parsed.dir : path.posix.join(parsed.dir, parsed.name);
  
  return `${BASE_URL}/wikis/${urlPath}/`;
}

/**
 * HTML 문자열에서 태그를 제거하고 순수 텍스트만 추출합니다.
 * 용량 최적화를 위해 모든 줄바꿈과 연속된 공백을 단일 공백으로 압축합니다.
 * @param {string} html - 변환된 HTML 문자열
 * @returns {string} 정제된 Plain Text
 */
function stripHtmlAndOptimize(html) {
  return html
    .replace(/<[^>]*>?/gm, ' ')       // 모든 HTML 태그를 공백으로 치환
    .replace(/&nbsp;/g, ' ')          // HTML 엔티티 치환
    .replace(/\s+/g, ' ')             // 연속된 공백, 탭, 줄바꿈을 단일 공백으로 통합
    .trim();
}

/**
 * 지정된 디렉토리를 재귀적으로 탐색하여 검색 데이터를 수집합니다.
 */
function collectSearchData() {
  const searchData = [];

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith('.md')) {
        // 1. 마크다운 파일 읽기 및 Front-matter 파싱
        const fileContent = fs.readFileSync(fullPath, 'utf8');
        const { data, content } = matter(fileContent);

        // 2. 메타데이터 추출
        const relPath = path.relative(WIKI_DIR, fullPath).replace(/\\/g, '/');
        const title = entry.name.replace(/\.md$/, '').replace(/_/g, ' ');
        const url = getUrlRelFromRelPath(relPath);

        // 3. 본문 텍스트 추출 및 최적화
        const html = marked.parse(content);
        const plainText = stripHtmlAndOptimize(html);

        searchData.push({
          title,
          url,
          content: plainText,
          tags: Array.isArray(data.tags) ? data.tags : []
        });
      }
    }
  }

  walk(WIKI_DIR);
  return searchData;
}

/**
 * 메인 실행 함수
 */
function main() {
  try {
    console.log('🔍 Generating search index...');
    const searchData = collectSearchData();
    
    const outputPath = path.join(OUTPUT_DIR, 'search.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(searchData, null, 2), 'utf8');
    
    console.log(`✔ Search index generated: ${outputPath} (${searchData.length} documents)`);
  } catch (err) {
    console.error('❌ Error generating search index:', err);
    process.exit(1);
  }
}

main();
