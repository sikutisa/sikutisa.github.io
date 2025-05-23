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
let wiki = {}
let wiki.path = '{_wiki path}'
let wiki.ext = '.md'

let g:vimwiki_list = [wiki]
let g:vimwiki_conceallevel = 0
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
* Node.js v18 이상

| 패키지 | 버전 | 설명 |
|--------|------|------|
| [fs-extra](https://www.npmjs.com/package/fs-extra) | `^11.3.0` | 파일 시스템(`fs`) 확장 기능 (폴더 생성, 파일 복사 등) |
| [gray-matter](https://www.npmjs.com/package/gray-matter) | `^4.0.3` | 마크다운 문서의 메타데이터(`use_math: true`) 파싱 |
| [marked](https://www.npmjs.com/package/marked) | `^15.0.7` | 마크다운을 HTML로 변환하는 라이브러리 |
| [mathjax](https://www.npmjs.com/package/mathjax) | `^3.2.2` | LaTeX 수식을 웹에서 렌더링하는 라이브러리 |


## Reference
* https://johngrib.github.io/wiki/my-wiki/
