(function () {
  'use strict';

  const form = document.getElementById('search-form');
  const input = document.getElementById('search-input');
  if (!form || !input) return;

  const script = document.currentScript;
  const indexUrl = new URL(script?.dataset.searchIndex || '../../search.json',
    script?.src || new URL('/assets/scripts/search.js', location.href));
  let indexPromise = null;
  let overlay = null;
  let composing = false;
  let requestVersion = 0;
  let previousFocus = null;
  let previousOverflow = '';
  let open = false;

  function ensureSearchData() {
    if (!indexPromise) {
      indexPromise = fetch(indexUrl.href, { signal: AbortSignal.timeout(15000) })
        .then(response => {
          if (!response.ok) throw new Error(`Search index request failed: ${response.status}`);
          return response.json();
        })
        .then(data => {
          if (!Array.isArray(data)) throw new Error('Invalid search index');
          return data.map(item => {
            if (!item || !['title', 'content', 'url'].every(key => typeof item[key] === 'string')) {
              throw new Error('Invalid search entry');
            }
            const url = new URL(item.url, location.href);
            if (url.origin !== location.origin || !['http:', 'https:'].includes(url.protocol)) {
              throw new Error('Invalid search result URL');
            }
            return { ...item, url: url.href, lowerTitle: item.title.toLowerCase(), lowerContent: item.content.toLowerCase() };
          });
        })
        .catch(error => {
          // Every caller observes the same rejection; the next attempt can retry.
          indexPromise = null;
          throw error;
        });
    }
    return indexPromise;
  }

  function closeSearch() {
    requestVersion++;
    if (!open) return;
    overlay.style.display = 'none';
    document.body.style.overflow = previousOverflow;
    open = false;
    if (previousFocus?.isConnected) previousFocus.focus();
  }

  function getOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'search-overlay';
    // This is a fixed template. Search terms and results are always text nodes.
    overlay.innerHTML = `
      <div class="search-modal" role="dialog" aria-modal="true" aria-labelledby="search-title-text" tabindex="-1">
        <div class="search-header">
          <h2 id="search-title-text">검색 결과</h2>
          <button type="button" id="search-close" title="닫기" aria-label="검색 결과 닫기">&times;</button>
        </div>
        <div id="search-results-list" aria-live="polite"></div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#search-close').addEventListener('click', closeSearch);
    overlay.addEventListener('click', event => { if (event.target === overlay) closeSearch(); });
    overlay.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); closeSearch(); }
      if (event.key === 'Tab') {
        const targets = [...overlay.querySelectorAll('button, a[href]')];
        const first = targets[0], last = targets.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    return overlay;
  }

  function showOverlay() {
    getOverlay();
    if (!open) {
      previousFocus = document.activeElement;
      previousOverflow = document.body.style.overflow;
      open = true;
      overlay.style.display = 'flex';
      document.body.style.overflow = 'hidden';
      overlay.querySelector('#search-close').focus();
    }
  }

  function highlightedText(text, keyword) {
    const fragment = document.createDocumentFragment();
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'gi');
    let start = 0;
    for (const match of text.matchAll(regex)) {
      fragment.appendChild(document.createTextNode(text.slice(start, match.index)));
      const strong = document.createElement('strong');
      strong.textContent = match[0];
      fragment.appendChild(strong);
      start = match.index + match[0].length;
    }
    fragment.appendChild(document.createTextNode(text.slice(start)));
    return fragment;
  }

  function snippet(content, keyword) {
    const index = content.toLowerCase().indexOf(keyword.toLowerCase());
    const start = index < 0 ? 0 : Math.max(0, index - 50);
    const end = index < 0 ? Math.min(content.length, 100) : Math.min(content.length, index + keyword.length + 50);
    return `${start > 0 ? '...' : ''}${content.slice(start, end)}${end < content.length ? '...' : ''}`;
  }

  function message(text) {
    const paragraph = document.createElement('p');
    paragraph.className = 'no-results';
    paragraph.textContent = text;
    overlay.querySelector('#search-results-list').replaceChildren(paragraph);
  }

  async function performSearch() {
    const keyword = input.value.trim();
    if (!keyword) return;
    const version = ++requestVersion;
    showOverlay();
    const title = overlay.querySelector('#search-title-text');
    title.textContent = '검색 중…';
    message('검색 데이터를 불러오고 있습니다.');
    try {
      const data = await ensureSearchData();
      if (version !== requestVersion) return;
      const lowerKeyword = keyword.toLowerCase();
      const results = data.filter(item => item.lowerTitle.includes(lowerKeyword) || item.lowerContent.includes(lowerKeyword));
      title.textContent = `"${keyword}" 검색 결과 (${results.length})`;
      const list = overlay.querySelector('#search-results-list');
      const fragment = document.createDocumentFragment();
      for (const item of results) {
        const row = document.createElement('div');
        row.className = 'search-item';
        const link = document.createElement('a');
        link.className = 'search-item-title';
        link.href = item.url;
        link.appendChild(highlightedText(item.title, keyword));
        const paragraph = document.createElement('p');
        paragraph.className = 'search-item-snippet';
        paragraph.appendChild(highlightedText(snippet(item.content, keyword), keyword));
        row.append(link, paragraph);
        fragment.appendChild(row);
      }
      list.replaceChildren(fragment);
      if (!results.length) message('검색 결과가 없습니다.');
    } catch (error) {
      if (version !== requestVersion) return;
      title.textContent = '검색 오류';
      message('검색 데이터를 불러오지 못했습니다. 다시 검색해주세요.');
      console.error('Search index load failed:', error);
    }
  }

  const preload = () => { ensureSearchData().catch(() => {}); };
  input.addEventListener('focus', preload, { once: true });
  input.addEventListener('input', preload, { once: true });
  input.addEventListener('compositionstart', () => { composing = true; });
  input.addEventListener('compositionend', () => { composing = false; });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && (composing || event.isComposing || event.keyCode === 229)) event.preventDefault();
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!composing) performSearch();
  });
})();
