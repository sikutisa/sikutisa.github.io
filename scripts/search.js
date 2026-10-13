/**
 * @file search.js
 * @description 클라이언트 사이드 검색 엔진. 
 * - 지연 로딩(Lazy Loading)으로 search.json을 페칭합니다.
 * - IME(한글 입력) 대응을 포함한 검색 이벤트를 처리합니다.
 * - 검색 결과를 모달 오버레이로 표시합니다.
 */

(function() {
  // --- DOM 요소 캐싱 ---
  const searchForm = document.getElementById('search-form');
  const searchInput = document.getElementById('search-input');
  
  // --- 상태 관리 변수 ---
  let searchData = null;      // JSON 인덱스 데이터
  let isFetching = false;     // 페칭 중 중복 요청 방지 플래그
  let overlayElement = null;  // 생성된 모달 오버레이 캐시

  /**
   * 서버로부터 search.json 데이터를 불러옵니다. (최초 1회 실행)
   * @returns {Promise<Array|null>} 검색 데이터 배열
   */
  async function ensureSearchData() {
    if (searchData) return searchData;
    
    // 이미 페칭 중인 경우, 완료될 때까지 대기하는 프로미스 반환
    if (isFetching) {
      return new Promise((resolve) => {
        const check = setInterval(() => {
          if (searchData) {
            clearInterval(check);
            resolve(searchData);
          }
        }, 100);
      });
    }

    isFetching = true;
    try {
      const response = await fetch('/search.json');
      if (!response.ok) throw new Error('Search index load failed');
      searchData = await response.json();
    } catch (err) {
      console.error('Search Engine Error:', err);
    } finally {
      isFetching = false;
    }
    return searchData;
  }

  /**
   * 검색 결과 표시용 모달 오버레이를 생성 및 초기화합니다.
   * @returns {HTMLElement} 오버레이 요소
   */
  function getOrCreateOverlay() {
    if (overlayElement) return overlayElement;

    overlayElement = document.createElement('div');
    overlayElement.id = 'search-overlay';
    overlayElement.innerHTML = `
      <div class="search-modal">
        <div class="search-header">
          <h2 id="search-title-text">검색 결과</h2>
          <span id="search-close" title="닫기">&times;</span>
        </div>
        <div id="search-results-list"></div>
      </div>
    `;
    document.body.appendChild(overlayElement);

    // 닫기 버튼 이벤트
    document.getElementById('search-close').onclick = closeSearch;
    // 외부 영역 클릭 시 닫기
    window.onclick = (e) => { if (e.target === overlayElement) closeSearch(); };

    return overlayElement;
  }

  function closeSearch() {
    if (overlayElement) overlayElement.style.display = 'none';
    document.body.style.overflow = ''; // 배경 스크롤 복구
  }

  /**
   * 텍스트 내의 키워드를 <strong> 태그로 강조합니다.
   */
  function highlight(text, keyword) {
    if (!keyword) return text;
    // 검색어 내 특수문자가 정규표현식으로 오작동하지 않도록 이스케이프 처리
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    return text.replace(regex, '<strong>$1</strong>');
  }

  /**
   * 검색어 주변의 컨텐츠 일부(Snippet)를 추출합니다.
   */
  function generateSnippet(content, keyword) {
    const lowerContent = content.toLowerCase();
    const lowerKeyword = keyword.toLowerCase();
    const index = lowerContent.indexOf(lowerKeyword);
    
    // 키워드를 찾지 못한 경우 (제목에만 키워드가 있는 경우 등) 앞부분만 반환
    if (index === -1) return content.substring(0, 100) + '...';

    // 키워드 앞뒤로 약 50자씩 추출
    const start = Math.max(0, index - 50);
    const end = Math.min(content.length, index + 50);
    let snippet = content.substring(start, end);

    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';

    return highlight(snippet, keyword);
  }

  /**
   * 실제 검색을 수행하고 결과를 UI에 렌더링합니다.
   */
  async function performSearch(query) {
    const keyword = query ? query.trim() : '';
    if (!keyword) return;

    // 데이터 로딩 보장
    const data = await ensureSearchData();
    if (!data) return alert('검색 데이터를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');

    // 필터링: 제목 또는 본문에 키워드 포함 여부 확인
    const results = data.filter(item =>
      item.title.toLowerCase().includes(keyword.toLowerCase()) ||
      item.content.toLowerCase().includes(keyword.toLowerCase())
    );

    const overlay = getOrCreateOverlay();
    const resultsList = document.getElementById('search-results-list');
    const titleText = document.getElementById('search-title-text');
    
    // 결과 렌더링
    resultsList.innerHTML = '';
    titleText.innerText = `"${keyword}" 검색 결과 (${results.length})`;

    if (results.length === 0) {
      resultsList.innerHTML = '<p class="no-results">검색 결과가 없습니다.</p>';
    } else {
      results.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'search-item';
        itemDiv.innerHTML = `
          <a href="${item.url}" class="search-item-title">${highlight(item.title, keyword)}</a>
          <p class="search-item-snippet">${generateSnippet(item.content, keyword)}</p>
        `;
        resultsList.appendChild(itemDiv);
      });
    }

    // 모달 표시
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // 배경 스크롤 방지
  }

  // --- 이벤트 리스너 초기화 ---

  if (searchInput && searchForm) {
    // 1. 지연 로딩 트리거: 검색창 접근 시 데이터 미리 로드 시작
    searchInput.addEventListener('focus', ensureSearchData, { once: true });
    searchInput.addEventListener('input', ensureSearchData, { once: true });

    // 2. 검색 제출 핸들러 (엔터키 및 버튼 클릭 대응)
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      performSearch(searchInput.value);
    });

    // 3. IME(한글 입력) 대응: 엔터 키 중복 실행 방지 보조
    searchInput.addEventListener('keydown', (e) => {
      // e.isComposing이 true면 한글 자모음 조합 중인 상태이므로 무시
      if (e.isComposing || e.keyCode === 229) return;
    });
  }
})();
