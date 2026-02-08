# ~/.codex/AGENTS.md

## 프로젝트 개요
- vimwiki를 활용한 개인 블로그 및 위키
- 내가 vimwiki로 글을 작성하면, 이를 GithubPage에 활용할 수 있는 용도로 자동 변환해줘야 함.

## 위키 구조
- vimwiki root는 _wiki
- root를 중심으로, 카테고리별 문서 분류가 돼 있음
- leaf 폴더에는 해당 폴더명과 동일한 이름의 md 파일
- 해당 md 파일이 페이지로 변환돼야 함
- URL 예시 : github.io/Book/가상_면접_사례로_배우는_대규모_시스템_설계_기초_1권/URL_단축기_설계
- 각 문서에서 참조하는 이미지 파일은 종단 폴더 내 img 폴더에 존재
- 각 md 파일은 상대 경로로 이를 가져옴

## 블로그 생성 규칙
- _layout에 있는 각 html이 페이지 생성 시 사용하는 레이아웃임
- 페이지는 크게 3가지로 분류 가능
- 메인페이지. main.html을 사용하고, 블로그 접속 시 root 페이지
- 최근에 수정한 문서들을 보여줘야 함. generate-main.js 참고
- 인덱스 페이지. /wikis URL 사용
- index.html을 laytout으로 사용
- 전체 문서 목록을 보여줘야 함. generate-index.js 참고
- 각 문서별 페이지. layout.html을 사용. generate-documents.js 참고
- 모든 페이지 상단에는 header.html, 하단에는 footer.html 사용
- 각 페이지에서 제공하는 이미지, 표 등이 정상적으로 보여야 함.
- 각 페이지 상단에 메타데이터 use_math: true 여부를 통해, LaTEX를 지원해야 함

## 홈페이지 라우팅
- Node를 통해 빌드
- React나 Next 사용을 최소화. 가능한 한 프레임워크 및 라이브러리 의존도가 작게 구성할 예정
- 실제 GithubPage에서는, wiki 변환 결과를 public이란 폴더를 생성해 그 곳에 변환 파일을 올려놓고, 해당 파일들을 깃헙에서 서빙할 것
- 따라서, 깃헙 레포지토리에 올라갈 때는 public 폴더가 없으나, 배포 파이프라인을 통해 md 파일 변환, 위키 생성, 라우팅 설정 등을 해야 함