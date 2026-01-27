# webfetch

Web scraping CLI + Web UI + MCP Server for LiveWiki & Longblack.
YouTube 영상을 LiveWiki로 요약하거나, 콘텐츠를 Markdown/PDF로 저장합니다.

- **CLI** — 터미널에서 직접 스크랩
- **Web UI** — 모바일 브라우저에서 `http://<서버IP>:3000` 접속
- **MCP Server** — Claude Code 등 AI 클라이언트에서 webfetch 도구 호출

## Installation

```bash
# 로컬 설치
npm install
npx playwright install chromium firefox

# 또는 npx로 바로 실행
npx webfetch "https://youtu.be/VIDEO_ID"
```

## Quick Start

```bash
# YouTube 영상 → LiveWiki 요약 추출
node src/index.js "https://youtu.be/VIDEO_ID"

# Longblack 오늘의 기사 자동 스크랩
node src/index.js "https://longblack.co"

# 결과는 output/ 폴더에 Markdown + PDF로 자동 저장됩니다
# 예: output/2026-01-26_기사_제목.md + .pdf
```

## Usage Examples

### 1. YouTube 영상 스크래핑 (LiveWiki 경유)

```bash
# YouTube URL을 입력하면 LiveWiki가 자동으로 요약
node src/index.js "https://youtu.be/2z9JsnMDWHE"

# 또는 전체 YouTube URL
node src/index.js "https://www.youtube.com/watch?v=2z9JsnMDWHE"
```

**결과물:**
- 핵심 요약 (3개 항목)
- 타임라인 (타임스탬프별 내용)
- 아티클 (산문 형태 본문)

> ⚠️ 첫 실행 시 LiveWiki 로그인이 필요합니다. 브라우저가 열리면 로그인하세요.

### 2. LiveWiki 콘텐츠 직접 스크래핑

```bash
# 이미 생성된 LiveWiki 콘텐츠 URL
node src/index.js "https://livewiki.com/ko/content/article-slug"
```

### 3. Longblack 기사 스크래핑

```bash
# Longblack 기사 URL
node src/index.js "https://longblack.co/note/1234"

# 홈페이지 → 오늘의 기사 자동 감지
node src/index.js "https://longblack.co"
```

> ⚠️ 유료 기사는 로그인이 필요합니다. 첫 실행 시 브라우저가 열리면 로그인하세요.

### 4. 출력 형식 지정

```bash
# 기본값: Markdown + PDF 동시 출력
node src/index.js "https://youtu.be/VIDEO_ID"

# Markdown만
node src/index.js "https://youtu.be/VIDEO_ID" -f markdown

# PDF만
node src/index.js "https://youtu.be/VIDEO_ID" -f pdf

# JSON (메타데이터 포함)
node src/index.js "https://youtu.be/VIDEO_ID" -f json
```

### 5. 출력 경로 지정

```bash
# 기본: output/YYYY-MM-DD_제목.md + .pdf
node src/index.js "https://youtu.be/VIDEO_ID"

# 사용자 지정 경로
node src/index.js "https://youtu.be/VIDEO_ID" -o ~/Documents/my-note.md
```

### 6. 브라우저 옵션

```bash
# Firefox 사용
node src/index.js "https://youtu.be/VIDEO_ID" -b firefox

# 브라우저 열어두기 (디버깅용)
node src/index.js "https://youtu.be/VIDEO_ID" --keep-open
```

### 7. 배치 처리 (여러 URL 한번에)

```bash
# URL 목록 파일 생성
cat > urls.txt << EOF
https://youtu.be/VIDEO_ID_1
https://youtu.be/VIDEO_ID_2
https://longblack.co/note/1234
# 주석은 # 으로 시작
EOF

# 배치 실행
node src/index.js batch urls.txt

# PDF로 저장 + 리포트 생성
node src/index.js batch urls.txt -f pdf --report batch-report.json

# 에러 발생시 중단
node src/index.js batch urls.txt --stop-on-error
```

### 8. 캐싱

```bash
# 캐시 사용 (기본값, 24시간 유효)
node src/index.js "https://youtu.be/VIDEO_ID"

# 캐시 무시 (항상 새로 스크랩)
node src/index.js "https://youtu.be/VIDEO_ID" --no-cache

# 캐시 유효 시간 변경 (48시간)
node src/index.js "https://youtu.be/VIDEO_ID" --cache-max-age 48

# 캐시 통계 확인
node src/index.js cache --stats

# 캐시 전체 삭제
node src/index.js cache --clear
```

### 9. 중복 스크랩 방지

```bash
# 오늘 날짜 파일이 이미 있으면 스킵
node src/index.js "https://longblack.co" --skip-existing
```

### 10. 스케줄러 연동 (cron)

```bash
# 매일 오전 9시 롱블랙 오늘의 기사 자동 스크랩
0 9 * * * cd /path/to/webfetch && node src/index.js "https://longblack.co" --skip-existing --no-cache >> ~/logs/webfetch.log 2>&1

# 배치 URL 일괄 처리
0 9 * * * cd /path/to/webfetch && node src/index.js batch urls.txt --report /path/to/reports/$(date +\%Y-\%m-\%d).json
```

### 11. Google Drive 연동

```bash
# OAuth 초기 설정 (최초 1회)
node src/index.js gdrive --setup

# 연결 테스트
node src/index.js gdrive --test

# Google Drive에만 저장
node src/index.js "https://longblack.co" --save-to gdrive

# 로컬 + Google Drive 동시 저장
node src/index.js "https://longblack.co" --save-to local,gdrive

# Drive 폴더 지정 (이름, 경로, 또는 폴더 ID)
node src/index.js "https://longblack.co" --save-to gdrive --drive-folder "Longblack/2026"

# 기존 파일 덮어쓰기
node src/index.js "https://longblack.co" --save-to gdrive --drive-overwrite

# 인증 해제
node src/index.js gdrive --revoke
```

**설정 방법:**
1. [Google Cloud Console](https://console.cloud.google.com) → OAuth 2.0 클라이언트 ID 생성 (Desktop app)
2. JSON 다운로드 → `auth/gdrive-credentials.json`에 저장
3. `node src/index.js gdrive --setup` 실행 → 브라우저에서 인증
4. `auth/gdrive-token.json` 자동 생성 (refresh token으로 자동 갱신)

### 12. Web UI 서버

```bash
# 웹 UI 서버 시작 (기본: 0.0.0.0:3000)
node src/index.js serve

# 포트/호스트 지정
node src/index.js serve -p 8080 --host 127.0.0.1
```

- 모바일 브라우저에서 `http://<서버IP>:3000` 접속
- URL 입력 → 포맷 선택 → Scrape 버튼
- SSE로 스크랩 진행률 실시간 표시
- History 탭에서 파일 다운로드 / Google Drive 업로드
- Settings 탭에서 캐시 관리

> 서버 모드에서는 `headless: true`로 동작합니다. 첫 로그인은 CLI에서 수행하세요.

### 13. MCP Server (AI 연동)

```bash
# MCP 서버 시작 (stdio transport)
node src/index.js mcp
```

**Claude Code 연동:**

프로젝트 `.mcp.json` 또는 `~/.claude.json`에 추가:

```json
{
  "mcpServers": {
    "webfetch": {
      "command": "node",
      "args": ["/absolute/path/to/webfetch/src/index.js", "mcp"]
    }
  }
}
```

**사용 가능한 MCP 도구:**

| 도구 | 입력 | 설명 |
|------|------|------|
| `webfetch_scrape` | `{ url, format? }` | URL 스크랩 → MD/PDF 저장 |
| `webfetch_history` | `{}` | output/ 파일 목록 조회 |
| `webfetch_download` | `{ filename }` | 파일 내용 반환 (text) |
| `webfetch_cache` | `{ action: "stats"\|"clear" }` | 캐시 통계/삭제 |
| `webfetch_gdrive_upload` | `{ filename }` | Google Drive 업로드 |

Claude Code에서 자연어로 사용:
```
"롱블랙 오늘 기사 스크랩해줘"
"스크랩 히스토리 보여줘"
"방금 스크랩한 파일 Drive에 올려줘"
```

### 14. 설정 파일 (Config)

```bash
# 설정 파일 템플릿 생성
node src/index.js config --init

# 현재 로드된 설정 확인
node src/index.js config --show
```

**지원 파일** (검색 순서: CWD → $HOME):
- `webfetch.config.js`
- `webfetch.config.json`
- `.webfetchrc.json`

```javascript
// webfetch.config.js 예시
export default {
  saveTo: 'local,gdrive',
  driveFolder: 'Articles',
  driveOverwrite: false,
  cacheMaxAge: '24',
  headless: false,
};
```

> CLI 옵션이 config 파일 값보다 항상 우선합니다.

## CLI Options

### 단일 URL 스크래핑

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `-f, --format` | 출력 형식 (markdown, pdf, json) | md + pdf 동시 |
| `-o, --output` | 출력 파일 경로 | output/YYYY-MM-DD_제목.ext |
| `-b, --browser` | 브라우저 (chrome, firefox) | chrome |
| `--headless` | 헤드리스 모드 (로그인 불가) | false |
| `--keep-open` | 완료 후 브라우저 유지 | false |
| `--no-cache` | 캐시 무시 (항상 새로 스크랩) | false |
| `--cache-max-age` | 캐시 유효 시간 (시간) | 24 |
| `--skip-existing` | 오늘 날짜 파일 존재 시 스킵 | false |
| `--save-to` | 저장 대상 (local, gdrive, local,gdrive) | local |
| `--drive-folder` | Google Drive 폴더 (이름/경로/ID) | webfetch |
| `--drive-overwrite` | Drive 기존 파일 덮어쓰기 | false |

### 배치 처리 (`batch` 명령어)

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `-f, --format` | 출력 형식 (markdown, pdf, json) | markdown |
| `-o, --output-dir` | 출력 디렉토리 | output/ |
| `-b, --browser` | 브라우저 (chrome, firefox) | chrome |
| `--headless` | 헤드리스 모드 | false |
| `--no-cache` | 캐시 무시 | false |
| `--cache-max-age` | 캐시 유효 시간 (시간) | 24 |
| `--stop-on-error` | 에러 발생시 중단 | false |
| `--skip-existing` | 오늘 날짜 파일 존재 시 스킵 | false |
| `--report` | 배치 리포트 저장 경로 | - |
| `--save-to` | 저장 대상 (local, gdrive, local,gdrive) | local |
| `--drive-folder` | Google Drive 폴더 (이름/경로/ID) | webfetch |
| `--drive-overwrite` | Drive 기존 파일 덮어쓰기 | false |

### Google Drive 관리 (`gdrive` 명령어)

| 옵션 | 설명 |
|------|------|
| `--setup` | OAuth 인증 설정 |
| `--test` | 연결 테스트 |
| `--revoke` | 인증 해제 |

### 설정 관리 (`config` 명령어)

| 옵션 | 설명 |
|------|------|
| `--init` | 설정 파일 템플릿 생성 |
| `--show` | 현재 설정 표시 |

### 캐시 관리 (`cache` 명령어)

| 옵션 | 설명 |
|------|------|
| `--stats` | 캐시 통계 표시 |
| `--clear` | 모든 캐시 삭제 |

### Web UI 서버 (`serve` 명령어)

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `-p, --port` | 포트 번호 | 3000 |
| `--host` | 호스트 주소 | 0.0.0.0 |

### MCP 서버 (`mcp` 명령어)

옵션 없음. stdio transport로 JSON-RPC 통신.

## Features

- **듀얼 출력**: 기본 Markdown + PDF 동시 생성
- **자동 파일명**: `YYYY-MM-DD_제목.ext` 형식
- **홈페이지 자동 감지**: `longblack.co` 입력 시 오늘의 기사 자동 탐지 및 스크랩
- **중복 방지**: `--skip-existing`으로 오늘 날짜 파일 존재 시 스킵
- **영구 로그인**: 브라우저 프로필에 세션 저장 (Google OAuth 지원)
- **콘텐츠 필터링**: 본문만 추출 (광고, 네비게이션, 플레이어 UI 제거)
- **구조화된 출력**: 핵심요약, 타임라인, 아티클 섹션 분리
- **배치 처리**: URL 목록 파일로 여러 URL 한번에 처리
- **캐싱 시스템**: URL 해시 기반 캐시로 중복 스크래핑 방지 (24시간 유효)
- **배치 리포트**: JSON 형식의 실행 결과 리포트 생성 (핸들러별 통계 포함)
- **Google Drive 연동**: `--save-to gdrive`로 Drive에 직접 저장 (OAuth 2.0)
- **복수 저장**: `--save-to local,gdrive`로 여러 대상 동시 저장
- **파일 덮어쓰기**: `--drive-overwrite`로 기존 Drive 파일 업데이트
- **설정 파일**: `webfetch.config.js` 또는 `.webfetchrc.json`으로 기본값 설정
- **npx 지원**: 설치 없이 `npx webfetch <url>` 실행 가능
- **Web UI**: 모바일 브라우저에서 스크랩 (SSE 진행률, dark theme)
- **MCP Server**: Claude Code 등 AI 클라이언트에서 5개 도구 직접 호출
- **Claude Code 플러그인**: `/webfetch:webfetch-scrape` 등 명령어로 Claude Code에서 직접 사용

## Project Structure

```
webfetch/
├── src/
│   ├── index.js           # CLI 진입점 (serve, mcp 서브커맨드 포함)
│   ├── handler.js         # 공통 비즈니스 로직 (CLI/Web/MCP 공유)
│   ├── browser.js         # Playwright 브라우저 관리
│   ├── batch.js           # 배치 처리 모듈
│   ├── adapters/          # 사이트별 어댑터 (Strategy Pattern)
│   │   ├── index.js       # 어댑터 레지스트리
│   │   ├── livewiki.js    # LiveWiki (YouTube 추출 + 콘텐츠 스크랩)
│   │   └── longblack.js   # Longblack (기사 스크랩)
│   ├── formatters/        # 출력 포맷터
│   │   ├── markdown.js    # Turndown 기반 변환
│   │   └── pdf.js         # Styled PDF 생성
│   ├── outputs/           # 출력 핸들러 (Strategy Pattern)
│   │   ├── index.js       # 핸들러 레지스트리
│   │   ├── local.js       # 로컬 파일시스템 저장
│   │   └── gdrive.js      # Google Drive 업로드
│   ├── web/               # Web UI 서버
│   │   ├── server.js      # HTTP 서버 + API 라우팅 + SSE
│   │   └── index.html     # 모바일 반응형 프론트엔드 (Single File)
│   ├── mcp/               # MCP 서버
│   │   ├── server.js      # MCP 진입점 (StdioServerTransport)
│   │   └── tools.js       # MCP 도구 정의 (zod 스키마)
│   └── utils/             # 유틸리티 모듈
│       ├── logger.js      # 로깅 시스템 (stderr 출력)
│       ├── errors.js      # 커스텀 에러 클래스
│       ├── retry.js       # 재시도 로직
│       ├── cache.js       # URL 캐싱 시스템
│       ├── config.js      # 설정 파일 로더
│       └── filename.js    # 파일명 생성 유틸
├── output/                # 스크래핑 결과 저장
├── .cache/                # URL 캐시 (gitignored)
├── auth/                  # 브라우저 프로필 (gitignored)
└── package.json
```

## Architecture

### Adapter Pattern (확장성)

새로운 사이트를 추가하려면:

```javascript
// src/adapters/newsite.js
export const newsite = {
  name: 'newsite',

  // URL 매칭
  match(url) {
    return /newsite\.com/.test(url);
  },

  // 스크래핑 로직
  async scrape(url, options) {
    // ...
    return { title, html, url, metadata };
  }
};

// src/adapters/index.js에 등록
import { newsite } from './newsite.js';
const adapters = [livewiki, longblack, newsite];
```

### Formatter Pattern (유연성)

새로운 출력 형식을 추가하려면:

```javascript
// src/formatters/newformat.js
export function toNewFormat(result) {
  const { title, html, url, metadata } = result;
  // 변환 로직
  return output;
}
```

### Output Handler Pattern (확장성)

새로운 저장 대상을 추가하려면:

```javascript
// src/outputs/newdest.js
export default {
  name: 'newdest',

  async save(content, filename, options) {
    // content: 포맷된 결과 (string 또는 Buffer)
    // filename: 저장할 파일명
    // options: { outputDir, driveFolder, ... }
    return { path: '/path/to/file' }; // 또는 { url: 'https://...' }
  }
};

// src/outputs/index.js에 등록
import newdestHandler from './newdest.js';
const handlers = { local, gdrive, newdest };
```

사용: `webfetch <url> --save-to local,newdest`

---

## Roadmap

### Phase 1: 안정성 개선 ✅
- [x] 에러 핸들링 강화 (네트워크 오류, 타임아웃)
- [x] 재시도 로직 추가 (3회 재시도, exponential backoff)
- [x] 로깅 시스템 구축 (커스텀 로거, 컬러 출력)

### Phase 2: 기능 확장 ✅
- [x] 배치 처리 지원 (URL 목록 파일 입력)
- [x] 스케줄러 연동 (cron job 문서화)
- [x] 캐싱 시스템 (중복 스크래핑 방지)
- [x] Longblack 홈페이지 → 오늘의 기사 자동 감지
- [x] `--skip-existing` 중복 스크랩 방지
- [x] 기본 출력 Markdown + PDF 동시 생성
- [x] Claude Code 플러그인 (commands + skill)

### Phase 3: 사용성 & 연동 ✅
- [x] Google Drive 연동 (`--save-to gdrive`, OAuth 2.0)
- [x] Output handler 패턴 (local, gdrive)
- [x] 복수 저장 대상 (`--save-to local,gdrive`)
- [x] `--drive-overwrite` 기존 파일 덮어쓰기
- [x] 설정 파일 지원 (`webfetch.config.js`, `.webfetchrc.json`)
- [x] npx 지원 (`npx webfetch <url>`)

### Phase 3.5: Web UI & MCP Server ✅
- [x] Web UI 서버 (`serve` 커맨드, built-in http 모듈)
- [x] 모바일 반응형 프론트엔드 (dark theme, Single HTML)
- [x] SSE 진행률 스트리밍 (스크랩 실시간 상태)
- [x] FIFO Job 큐 (브라우저 싱글톤 제약 대응)
- [x] MCP 서버 (`mcp` 커맨드, stdio transport)
- [x] MCP 도구 5개 (scrape, history, download, cache, gdrive_upload)
- [x] 공통 handler.js (CLI/Web/MCP 비즈니스 로직 공유)
- [x] Logger stderr 출력 (MCP stdio 호환)

### Phase 4: 새로운 어댑터
- [ ] Vrew 어댑터 (자막 추출)
- [ ] Notion 어댑터 (페이지 스크랩)
- [ ] Medium 어댑터
- [ ] Substack 어댑터

### Phase 5: 출력 형식 확장
- [ ] HTML 포맷터
- [ ] DOCX 포맷터
- [ ] Notion 내보내기
- [ ] 인터랙티브 모드 (inquirer)

---

## Claude Code Plugin

Claude Code에서 플러그인으로 사용할 수 있습니다.

### 설치

```bash
/plugin marketplace add elon-jang/claude-plugins
/plugin install webfetch@ai-plugins
```

### 명령어

```
/webfetch:webfetch-scrape <url>           # URL 스크랩 (YouTube/Longblack)
/webfetch:webfetch-today                  # 롱블랙 오늘의 기사 자동 스크랩
/webfetch:webfetch-batch <file>           # URL 파일 일괄 처리
/webfetch:webfetch-cache [--stats|--clear] # 캐시 관리
```

### 사용 예시

```bash
# Longblack 기사 스크랩
/webfetch:webfetch-scrape https://longblack.co/note/1872

# YouTube 영상 요약
/webfetch:webfetch-scrape https://youtu.be/VIDEO_ID

# 오늘의 기사 자동 스크랩
/webfetch:webfetch-today

# 배치 처리
/webfetch:webfetch-batch urls.txt --report report.json

# 캐시 관리
/webfetch:webfetch-cache --stats
```

> 자연어로 "롱블랙 오늘 기사 스크랩" 등을 요청하면 webfetch-assistant 스킬이 자동으로 적절한 명령을 실행합니다.

---

## Troubleshooting

### 로그인이 안 됨
- `auth/` 폴더를 삭제하고 다시 시도
- `--keep-open` 옵션으로 브라우저 상태 확인

### 콘텐츠가 추출되지 않음
- 페이지 로딩 대기 시간 부족 (코드에서 waitForTimeout 증가)
- 셀렉터 변경됨 (CONFIG 업데이트 필요)

### PDF 생성 오류
- Playwright chromium이 설치되어 있는지 확인
- `npx playwright install chromium`

## License

MIT
