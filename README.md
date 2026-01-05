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
* Vim을 열고 다음 명령 실행
```vim
:PlugInstall
```

## Vimwiki 기본 사용법
* Vim을 열고 다음 명령어를 실행하면 wiki index가 열림
```vim
:VimwikiIndex
```

* index에 글을 쓰고, 커서를 올려놓은 상태에서 엔터를 치면 문서 생성
* 폴더를 만들고 싶으면 폴더명까지 넣으면 됨
```vim
# Before
테스트
subfolder/테스트2

# After
[[테스트]]
[[subfolder/테스트2]]
```

* 문서에 커서를 올려놓고 엔터를 치면 해당 문서 열림
* 백스페이스로 상위 문서로 이동

## Dependencies
* Node.js v22 이상

| 패키지 | 버전 | 설명 |
|--------|------|------|
| [fs-extra](https://www.npmjs.com/package/fs-extra) | `^11.3.3` | 파일 시스템(`fs`) 확장 기능 (폴더 생성, 파일 복사 등) |
| [gray-matter](https://www.npmjs.com/package/gray-matter) | `^4.0.3` | 마크다운 문서의 메타데이터(`use_math: true`) 파싱 |
| [handlebars](https://www.npmjs.com/package/handlebars) | `^4.7.8` | HTML 레이아웃 템플릿 렌더링 |
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

* 빌드 결과는 `public/` 폴더에 생성됩니다.
* 로컬 서버는 기본적으로 `http://localhost:3000`에서 접근 가능합니다.

## GitHub Pages 배포 경로(BASE_URL)
GitHub Pages 프로젝트 페이지처럼 `/repo-name/` 하위로 서비스되는 경우, 빌드 시 BASE_URL을 지정해야 합니다.

```powershell
$env:BASE_URL="repo-name"
npm run build
```

* 사용자 페이지(`username.github.io`)라면 BASE_URL 없이 빌드하면 됩니다.
* 이미지/MathJax 등 정적 자산 경로는 BASE_URL 기준으로 자동 보정됩니다.


## Reference
* https://johngrib.github.io/wiki/my-wiki/

