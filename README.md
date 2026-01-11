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
* Node.js v22 이상

| 패키지 | 버전 | 설명 |
|--------|------|------|
| [fs-extra](https://www.npmjs.com/package/fs-extra) | `^11.3.3` | 파일 시스템(`fs`) 확장 기능 (폴더 생성, 파일 복사 등) |
| [gray-matter](https://www.npmjs.com/package/gray-matter) | `^4.0.3` | 마크다운 문서의 메타데이터(`use_math: true`) 파싱 |
| [handlebars](https://www.npmjs.com/package/handlebars) | `^4.7.8` | HTML 레이아웃 템플릿 렌더링 |
| [highlight.js](https://www.npmjs.com/package/highlight.js) | `^11.11.1` | 코드 블록 문법 하이라이팅 |
| [jsdom](https://www.npmjs.com/package/jsdom) | `^27.4.0` | TOC 생성 및 HTML 정제 처리 |
| [marked](https://www.npmjs.com/package/marked) | `^17.0.1` | 마크다운을 HTML로 변환하는 라이브러리 |
| [mathjax](https://www.npmjs.com/package/mathjax) | `^4.1.0` | LaTeX 수식을 웹에서 렌더링하는 라이브러리 |
| [serve](https://www.npmjs.com/package/serve) | `^14.2.5` | 로컬 정적 서버 실행 (dev) |

## 로컬 빌드 및 미리보기
```powershell
npm install
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


## Reference
* https://johngrib.github.io/wiki/my-wiki/

