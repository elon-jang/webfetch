# Webfetch

다양한 웹사이트의 기사/콘텐츠를 스크랩하여 Markdown/PDF/EPUB으로 저장하는 Claude Code 플러그인입니다.

> **이 플러그인은 [webfetch CLI](~/elon/ai/projects/webfetch)의 Claude Code 래퍼입니다.**
> 소스코드, 테스트, 스펙은 CLI 프로젝트를 참조하세요.

## 설치

### 플러그인 설치

```bash
# Marketplace에서 설치
/plugin install webfetch@claude-kit
```

### 사전 요구사항

webfetch CLI 프로젝트가 설치되어 있어야 합니다:

```bash
cd ~/elon/ai/projects/webfetch
npm install
npx playwright install chromium firefox
```

> **참고**: 현재 CLI 경로가 하드코딩되어 있어 제작자 환경에서만 동작합니다.
> 범용 배포를 위한 `.mcp.json` + `setup.sh` 방식 전환이 계획되어 있습니다 (CLI PLAN.md Phase 6).

## 지원 사이트

| Site | URL Pattern | Description |
|------|-------------|-------------|
| YouTube | `youtube.com/watch?v=*`, `youtu.be/*` | LiveWiki 경유 요약 추출 |
| LiveWiki | `livewiki.com/*/content/*` | 직접 스크랩 |
| Longblack | `longblack.co/note/*` | 기사 스크랩 |
| Longblack | `longblack.co` | 홈페이지 → 오늘의 기사 자동 감지 |
| TheMiilk | `themiilk.com/articles/*` | 기사 스크랩 |
| TheMiilk | `themiilk.com` | 홈페이지 → 최신 기사 자동 감지 |
| Medium | `medium.com/@user/*`, `*.medium.com/*` | 아티클 스크랩 |
| Substack | `*.substack.com/p/*` | 뉴스레터 스크랩 |
| Naver Blog | `blog.naver.com/*` | 블로그 스크랩 |
| **모든 URL** | `https://*` | Generic 스크랩 (Readability 기반) |

## 명령어

| Command | Description | 예시 |
|---------|-------------|------|
| `/webfetch:webfetch-scrape` | URL 스크랩 | `/webfetch:webfetch-scrape <url>` |
| `/webfetch:webfetch-today` | 오늘의 기사 자동 스크랩 | `/webfetch:webfetch-today` |
| `/webfetch:webfetch-batch` | URL 파일 일괄 처리 | `/webfetch:webfetch-batch urls.txt` |
| `/webfetch:webfetch-cache` | 캐시 관리 | `/webfetch:webfetch-cache --stats` |
| `/webfetch:webfetch-search` | 파일 키워드 검색 | `/webfetch:webfetch-search "AI"` |
| `/webfetch:webfetch-list` | 파일 목록/필터링 | `/webfetch:webfetch-list --source Medium` |
| `/webfetch:webfetch-config` | 설정 관리 | `/webfetch:webfetch-config --show` |

## 자연어 사용

webfetch-assistant 스킬이 자연어 요청을 자동으로 인식합니다:

```
"롱블랙 오늘 기사 스크랩해줘"
"https://medium.com/@user/article 스크랩"
"이 URL들 다 스크랩해줘: url1, url2, url3"
"스크랩한 파일에서 AI 검색해줘"
"스크랩 파일 목록 보여줘"
"캐시 삭제해줘"
```

## 사용 예시

### 기사 스크랩

```bash
# Longblack 기사
/webfetch:webfetch-scrape https://longblack.co/note/1872

# Medium 아티클
/webfetch:webfetch-scrape https://medium.com/@user/article-title

# Substack 뉴스레터
/webfetch:webfetch-scrape https://newsletter.substack.com/p/post-title

# Naver Blog
/webfetch:webfetch-scrape https://blog.naver.com/user/12345

# 아무 URL (generic)
/webfetch:webfetch-scrape https://example.com/interesting-article
```

### YouTube 영상 요약

```bash
/webfetch:webfetch-scrape https://youtu.be/Iz26OkoAk0w
```

### 출력 포맷

```bash
# 기본: Markdown + PDF 동시 생성
/webfetch:webfetch-scrape https://longblack.co/note/1872

# PDF만
/webfetch:webfetch-scrape https://longblack.co/note/1872 -f pdf

# EPUB만
/webfetch:webfetch-scrape https://longblack.co/note/1872 -f epub

# Obsidian 호환 모드
/webfetch:webfetch-scrape https://longblack.co/note/1872 --obsidian

# 이미지 로컬 다운로드
/webfetch:webfetch-scrape https://medium.com/@user/article --download-images
```

### 오늘의 기사

```bash
# Longblack 오늘의 기사
/webfetch:webfetch-today

# TheMiilk 최신 기사
/webfetch:webfetch-today --source themiilk
```

### Google Drive 저장

```bash
# Google Drive에만 저장
/webfetch:webfetch-scrape https://longblack.co/note/1872 --save-to gdrive

# 로컬 + Google Drive 동시 저장
/webfetch:webfetch-scrape https://longblack.co/note/1872 --save-to local,gdrive

# Drive 폴더 지정
/webfetch:webfetch-scrape https://longblack.co/note/1872 --save-to gdrive --drive-folder "Longblack/2026"

# 기존 파일 덮어쓰기
/webfetch:webfetch-scrape https://longblack.co/note/1872 --save-to gdrive --drive-overwrite
```

> Google Drive 사전 설정: `cd ~/elon/ai/projects/webfetch && node src/index.js gdrive --setup`

### 배치 처리

```bash
# URL 파일 일괄 처리
/webfetch:webfetch-batch urls.txt

# 리포트 생성 + 속도 제한
/webfetch:webfetch-batch urls.txt --report report.json --rate-limit 3000

# 에러 발생시 중단
/webfetch:webfetch-batch urls.txt --stop-on-error
```

### 파일 검색 & 목록

```bash
# 키워드 검색
/webfetch:webfetch-search "인공지능"

# 전체 파일 목록
/webfetch:webfetch-list

# 소스별 필터
/webfetch:webfetch-list --source Medium

# 날짜별 필터
/webfetch:webfetch-list --date 2026-02-05
```

### 캐시 & 설정

```bash
# 캐시 통계
/webfetch:webfetch-cache --stats

# 캐시 삭제
/webfetch:webfetch-cache --clear

# 현재 설정 보기
/webfetch:webfetch-config --show

# 설정 파일 생성
/webfetch:webfetch-config --init
```

## 옵션

### 스크랩 옵션

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `-f, --format <type>` | 출력 포맷 (markdown, pdf, epub, json) | md + pdf 동시 |
| `-o, --output <path>` | 저장 경로 지정 | `output/{Source}/{Year}/YYYY-MM-DD_제목.ext` |
| `-b, --browser <type>` | 브라우저 (chrome, firefox) | chrome |
| `--headless` | 헤드리스 모드 (로그인 불가) | false |
| `--keep-open` | 스크랩 후 브라우저 유지 (디버깅용) | false |
| `--no-cache` | 캐시 무시, 항상 새로 스크랩 | false |
| `--cache-max-age <hours>` | 캐시 유효기간 (시간) | 24 |
| `--skip-existing` | 오늘 날짜 파일이 있으면 스킵 | false |
| `--save-to <targets>` | 저장 대상 (local, gdrive, local,gdrive) | local |
| `--drive-folder <path>` | Google Drive 폴더 (이름/경로/ID) | webfetch |
| `--drive-overwrite` | Drive 기존 파일 덮어쓰기 | false |
| `--proxy <url>` | 프록시 서버 URL | - |
| `--download-images` | 이미지 로컬 다운로드 | false |
| `--obsidian` | Obsidian 호환 frontmatter | false |
| `--filename-template <pattern>` | 커스텀 파일명 (`{date}`, `{title}`, `{source}`, `{author}`) | - |

### 배치 옵션

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `--stop-on-error` | 첫 에러 시 중단 | false |
| `--report <path>` | JSON 리포트 저장 경로 | - |
| `--skip-existing` | 이미 스크랩한 URL 스킵 | false |
| `--rate-limit <ms>` | 도메인별 요청 간 최소 지연 (ms) | 2000 |
| `--save-to <targets>` | 저장 대상 (local, gdrive, local,gdrive) | local |
| `--drive-folder <path>` | Google Drive 폴더 | webfetch |
| `--drive-overwrite` | Drive 기존 파일 덮어쓰기 | false |

## 결과물

| 항목 | 경로/설명 |
|------|-----------|
| Markdown | `output/{Source}/{Year}/YYYY-MM-DD_제목.md` |
| PDF | `output/{Source}/{Year}/YYYY-MM-DD_제목.pdf` |
| EPUB | `output/{Source}/{Year}/YYYY-MM-DD_제목.epub` |
| 배치 리포트 | `report.json` (성공/실패 상세) |
| 캐시 | `.cache/` (URL 해시 기반, 24시간 TTL) |
| 브라우저 세션 | `auth/chrome-profile/` (로그인 유지) |

Source 폴더 매핑: `longblack→LongBlack`, `livewiki→YouTube`, `themiilk→TheMiilk`, `medium→Medium`, `substack→Substack`, `naver→NaverBlog`, `generic→General`

## 트러블슈팅

### 로그인 실패

```
Error: Login required
Hint: auth/ 폴더를 삭제 후 재로그인하거나 --keep-open으로 디버그
```

해결: `rm -rf ~/elon/ai/projects/webfetch/auth/chrome-profile/` 후 재실행

### 콘텐츠 추출 실패

```
Error: Could not find article content
Hint: 사이트 구조 변경 가능. --keep-open으로 페이지 확인
```

해결: `--keep-open` 플래그로 페이지 구조 확인, adapter 셀렉터 업데이트 필요

### Paywall 감지

```
Error: Paywall detected
Hint: 유료 구독이 필요한 콘텐츠입니다
```

해결: 해당 사이트 로그인/구독 후 `--keep-open`으로 브라우저에서 로그인

### 네트워크 에러

```
Error: net::ERR_ABORTED
```

자동 3회 재시도 (exponential backoff). 재실행으로 해결되는 경우가 대부분.

## 제한 사항

- Playwright 브라우저가 설치되어 있어야 함
- 로그인 필요 사이트는 첫 실행 시 수동 로그인 필요
- 헤드리스 모드에서는 로그인 불가
- Naver Blog는 iframe 구조상 항상 Playwright 필요
- Google Drive는 사전 OAuth 설정 필요 (`node src/index.js gdrive --setup`)

## 관련 문서

- [CLAUDE.md](./CLAUDE.md) - 플러그인 개발자 가이드
- **CLI 프로젝트**: `~/elon/ai/projects/webfetch` — 소스코드, 테스트, SPEC, PLAN
