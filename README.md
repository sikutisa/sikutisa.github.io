# Personal Wiki

## Vimwiki local 세팅
* Linux 기준

### Vim-Plug 설치
```sh
curl -fLo ~/.vim/autoload/plug.vim --create-dirs \
    https://raw.githubusercontent.com/junegunn/vim-plug/master/plug.vim
``` 

### .vimrc 편집
```sh
vim ~/.vimrc
```

* 아래 내용 추가
```vim
" =========================
" vim-plug
" =========================
call plug#begin('~/.vim/plugged')

Plug 'vimwiki/vimwiki'

call plug#end()

" =========================
" Vimwiki
" =========================
" 위키 1개 설정
let wiki = {}

" (WSL에서 Windows 경로를 쓰려면 /mnt/c/... 로)
let wiki.path = '{_wiki path}'

" 위키 파일 확장자: Markdown
let wiki.ext = '.md'

" Vimwiki가 관리할 위키 목록
let g:vimwiki_list = [wiki]

" conceal 비활성화 (문법 숨김/대체 표시 하지 않음)
let g:vimwiki_conceallevel = 0

" =========================
" 저장 시 디렉터리 자동 생성
" =========================
function! VimwikiAutoMkDir()
  " 현재 파일이 위치할 디렉터리(절대경로)
  let l:dir = expand('%:p:h')

  " 디렉터리가 없으면 상위 폴더 포함 생성
  if !isdirectory(l:dir)
    call mkdir(l:dir, "p")
  endif
endfunction

" 모든 파일 저장 전에 디렉터리 자동 생성 실행
autocmd BufWritePre * call VimwikiAutoMkDir()
```

### 플러그인 설치
* Vim에서 실행
```vim
:PlugInstall
```

## Vimwiki 기본 사용법
* Wiki index 열기
```vim
:VimwikiIndex
```

* 문서 생성/폴더 생성
```vim
# Before
테스트
subfolder/테스트2

# After
[[테스트]]
[[subfolder/테스트2]]
```

* 문서 열기: 링크 위에서 Enter
* 상위 문서: Backspace

## Dependencies
* Node.js v26.12.1 (`.nvmrc` 기준), npm v12.2.1 이상

| 패키지 | 버전 | 설명 |
|--------|------|------|
| [gray-matter](https://www.npmjs.com/package/gray-matter) | `^4.0.3` | 마크다운 문서의 메타데이터(`use_math: true`) 파싱 |
| [handlebars](https://www.npmjs.com/package/handlebars) | `^4.7.10` | HTML 레이아웃 템플릿 렌더링 |
| [highlight.js](https://www.npmjs.com/package/highlight.js) | `^11.12.0` | 코드 블록 문법 하이라이팅 |
| [jsdom](https://www.npmjs.com/package/jsdom) | `^30.1.3` | TOC 생성 및 HTML 정제 처리 |
| [marked](https://www.npmjs.com/package/marked) | `^18.1.1` | 마크다운을 HTML로 변환하는 라이브러리 |
| [mathjax](https://www.npmjs.com/package/mathjax) | `^4.1.3` | LaTeX 수식을 웹에서 렌더링하는 라이브러리 |
| [serve](https://www.npmjs.com/package/serve) | `^14.2.6` | 로컬 정적 서버 실행 (dev) |

* `serve`가 고정한 `compression`은 보안 패치가 포함된 `^1.8.2`로 override합니다.
* `gray-matter@4.0.3`의 간접 의존성 `sprintf-js`에는 아직 수정 버전이 없어 npm audit의 moderate 경고가 남습니다. `npm audit fix --force`는 `gray-matter`와 `serve`를 구버전으로 내릴 수 있으므로 사용하지 않습니다.

## 로컬 빌드 및 미리보기
```powershell
nvm install 26.12.1
nvm use 26.12.1
npm install --global npm@12.2.1
npm ci
npm test
npm run build
npm run serve
```

* 출력: `public/`
* 접속: `http://localhost:3000`

## GitHub Pages 배포 경로(BASE_URL)
* 프로젝트 페이지(`/repo-name/`)는 BASE_URL 필요

```powershell
$env:BASE_URL="repo-name"
npm run build
```

* 사용자 페이지(`username.github.io`)는 BASE_URL 불필요
* 정적 자산 경로는 BASE_URL 기준으로 보정


## JavaScript 구조와 검증

* `src/client/search.js`: 브라우저 검색 UI. `public/assets/scripts/`에는 이 파일만 배포합니다.
* `scripts/`: 로컬 이미지 관리·검증 도구와 Node 테스트. 배포에 포함하지 않습니다.
* `_include/build.js`: 단일 빌드 진입점. 문서 목록·메타데이터·Git 수정 시각을 한 번 수집하고 생성기들이 공유합니다.
* `_include/site.js`, `urls.js`: 공통 문서 정보·템플릿·URL 처리.
* `_include/markdown.js`, `image-assets.js`: 문서당 하나의 DOM에서 HTML 정제, 코드 강조, 목차, 이미지와 검색 텍스트를 처리합니다.
* `_include/assets.js`: 스타일·브라우저 JS·MathJax·사이트 인증 파일 복사. 필수 자산이나 참조 이미지가 없으면 빌드를 실패시킵니다.

`npm run build`는 출력 폴더를 정리하고 전체를 생성합니다. `npm run build:docs`는 정리 없이 생성하며, 개별 `node _include/generate-*.js` 실행도 지원합니다.

`npm test`는 검색 요청 공유·실패 후 재시도, 한글 입력, 안전한 검색 결과·목차, 이미지 크기, Git 수정 시각, 하위 경로 배포와 전체 빌드 결과를 검증합니다.

선택적인 브라우저 이미지 검증 도구는 `playwright`를 사용합니다. 별도로 설치하거나 `PLAYWRIGHT_MODULE`로 모듈 경로를 지정할 수 있습니다. `preview-source-images.cjs`는 `PLAYWRIGHT_EXECUTABLE_PATH` 또는 `PLAYWRIGHT_CHANNEL`로 브라우저를 선택할 수 있습니다.

## Reference
* https://johngrib.github.io/wiki/my-wiki/

