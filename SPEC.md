# webfetch 기술 스펙

## 개요

웹 콘텐츠 스크래핑 CLI 도구. YouTube 영상을 LiveWiki로 요약 추출하거나, 웹 기사를 Markdown/PDF로 저장합니다.

## 기술 스택

| 구분 | 기술 | 버전 |
|------|------|------|
| Runtime | Node.js | 18+ |
| Browser Automation | Playwright | ^1.57.0 |
| CLI Framework | Commander.js | ^12.0.0 |
| HTML → Markdown | Turndown | ^7.1.2 |
| Google Drive API | googleapis | ^144.0.0 |
| MCP SDK | @modelcontextprotocol/sdk | ^1.12.0 |
| Schema Validation | zod | ^3.24.0 |
| Web Server | Node.js built-in http | - |

## 아키텍처

### 전체 구조 (3-Entry Point)

```
CLI (index.js)      Web UI (index.html)      MCP Client (Claude 등)
    │                     │                        │
Commander.js         HTTP Server               MCP Server
    │               (web/server.js)           (mcp/server.js)
    │                     │                        │
    └─────────────────────┼────────────────────────┘
                          ▼
                    handler.js (공통 비즈니스 로직)
                          │
               ┌──────────┼──────────┐
               ▼          ▼          ▼
            adapters   formatters  outputs
```

### 상세 흐름

```
┌─────────────────────────────────────────────────────────────┐
│                      Entry Points                            │
│                                                              │
│  CLI (index.js)         Web (web/server.js)   MCP (mcp/)    │
│  - Commander.js         - built-in http       - stdio JSON  │
│  - 직접 호출            - SSE 진행률           - 5개 도구    │
│  - Config 머지          - REST API             - zod 스키마  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    handler.js (공통 로직)                     │
│  - scrape(url, options) — 동기 스크랩 (CLI/MCP)              │
│  - enqueueScrape(url, options) — 비동기 큐 (Web UI/SSE)      │
│  - getHistory() / readFile() / getFileStream()               │
│  - getCacheInfo() / clearCache()                             │
│  - uploadToGdrive(filename, options)                         │
│  - FIFO Job Queue (브라우저 싱글톤 제약)                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Adapter Registry                          │
│  - URL 패턴 매칭으로 적절한 어댑터 선택                        │
│  - getAdapter(url) → Adapter                                 │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │ LiveWiki │   │Longblack │   │ (Future) │
        │ Adapter  │   │ Adapter  │   │ Adapters │
        └──────────┘   └──────────┘   └──────────┘
              │               │
              └───────┬───────┘
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    Browser Module                            │
│  - Playwright 브라우저 관리                                   │
│  - Persistent Context (OAuth 세션 유지)                      │
│  - Chrome/Firefox 지원                                       │
│  - 싱글톤 context → FIFO 큐로 순차 처리                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Formatter Registry                        │
│  - Markdown (Turndown)                                       │
│  - PDF (Playwright page.pdf)                                 │
│  - JSON (구조화된 메타데이터)                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Output Handler Registry                    │
│  - Local (파일시스템 저장)                                    │
│  - Google Drive (OAuth 2.0 업로드)                           │
│  - resolveOutputs("local,gdrive") → [handler, handler]      │
└─────────────────────────────────────────────────────────────┘
                              │
                  ┌───────────┼───────────┐
                  ▼                       ▼
            output/ 폴더           Google Drive
```

## 핵심 인터페이스

### Adapter Interface

```typescript
interface Adapter {
  name: string;
  match(url: string): boolean;
  scrape(url: string, options: ScrapeOptions): Promise<ScrapeResult>;
}

interface ScrapeOptions {
  browser?: 'chrome' | 'firefox';
  headless?: boolean;
  keepOpen?: boolean;
}

interface ScrapeResult {
  title: string;
  html: string;
  url: string;
  metadata?: {
    description?: string;
    [key: string]: any;
  };
}
```

### Formatter Interface

```typescript
type Formatter = (result: ScrapeResult) => string | Buffer;
```

### Output Handler Interface

```typescript
interface OutputHandler {
  name: string;
  save(content: string | Buffer, filename: string, options: OutputOptions): Promise<OutputResult>;
  setup?(): Promise<void>;
  test?(): Promise<void>;
  revoke?(): Promise<void>;
}

interface OutputOptions {
  outputDir?: string;
  driveFolder?: string;
  driveOverwrite?: boolean;
}

interface OutputResult {
  path?: string;       // 로컬 저장 경로
  url?: string;        // 원격 저장 URL
  id?: string;         // 원격 파일 ID
  name?: string;       // 파일명
  handler?: string;    // 핸들러 이름
  fallback?: boolean;  // 폴백 저장 여부
}
```

### Config Interface

```typescript
interface WebfetchConfig {
  browser?: 'chrome' | 'firefox';
  format?: 'markdown' | 'pdf' | 'json';
  saveTo?: string;           // 'local', 'gdrive', 'local,gdrive'
  driveFolder?: string;      // Drive 폴더명, 경로, 또는 ID
  driveOverwrite?: boolean;
  cacheMaxAge?: string;      // 시간 단위
  headless?: boolean;
}
```

## 어댑터 상세

### LiveWiki Adapter

**URL 패턴:**
- YouTube: `youtube.com/watch?v=*`, `youtu.be/*`
- Content: `livewiki.com/*/content/*`

**동작 모드:**

| 모드 | 입력 | 동작 |
|------|------|------|
| YouTube 추출 | YouTube URL | LiveWiki 접속 → 로그인 → URL 입력 → 추출 버튼 클릭 → 결과 대기 → 스크랩 |
| 콘텐츠 스크랩 | LiveWiki URL | 직접 페이지 스크랩 |

**추출 섹션:**
1. **핵심 요약**: `<h2>핵심 요약</h2><ol>...</ol>`
2. **타임라인**: `<h2>타임라인</h2><ul>...</ul>` (타임스탬프 포함)
3. **아티클**: `<h2>아티클</h2><p>...</p>` (산문 형태)

**로그인 처리:**
- 로그인 버튼 감지 → 사용자에게 브라우저 로그인 요청
- 로그인 모달 감지 (`#login-modal`) → 대기
- Persistent Context로 세션 유지

### Longblack Adapter

**URL 패턴:**
- `longblack.co/*`

**동작:**
1. 페이지 접속
2. 페이월 감지 (로그인 필요 여부)
3. 필요시 로그인 요청
4. CONFIG 기반 콘텐츠 필터링

**필터링 CONFIG:**
```javascript
{
  contentSelectors: ['[class*="note-content"]', 'article'],
  removeSelectors: ['header', 'footer', 'nav', '[class*="audio"]', ...],
  introPatterns: [/^오늘의 노트/, /지식 구독 서비스/, ...]
}
```

## 브라우저 관리

### Persistent Context

```
auth/
├── chrome-profile/    # Chrome 브라우저 프로필
└── firefox-profile/   # Firefox 브라우저 프로필
```

- OAuth 로그인 세션 유지
- 쿠키, 로컬 스토리지 보존
- `.gitignore`에 포함

### 브라우저 옵션

| 옵션 | 설명 |
|------|------|
| `--disable-blink-features=AutomationControlled` | 자동화 감지 우회 (Chrome) |
| `viewport: 1280x800` | 일관된 렌더링 |
| `headless: false` | 기본값 (로그인 필요) |

## 출력 형식

### Markdown

```markdown
---
title: "제목"
url: https://...
scraped_at: 2026-01-22T12:00:00.000Z
description: "설명"
---

# 제목

## 핵심 요약
1. ...

## 타임라인
- **00:00** ...

## 아티클
...
```

### PDF

- A4 포맷
- 여백: 상하 25mm, 좌우 20mm
- 폰트: -apple-system, Noto Sans KR
- 스타일링된 HTML → PDF 변환

### JSON

```json
{
  "title": "제목",
  "html": "<h2>핵심 요약</h2>...",
  "url": "https://...",
  "metadata": {
    "description": "..."
  }
}
```

## 파일 명명 규칙

```
output/YYYY-MM-DD_제목.ext
```

- 날짜: ISO 8601 (YYYY-MM-DD)
- 제목: 최대 80자, 특수문자 제거, 공백→언더스코어
- 확장자: md, pdf, json

## Utils 모듈

### Logger (`utils/logger.js`)

컬러 출력과 타임스탬프를 지원하는 로깅 시스템.

```javascript
import { createLogger } from './utils/logger.js';
const log = createLogger('mymodule');

log.info('Information message');
log.warn('Warning message');
log.error('Error message');
log.debug('Debug message');
```

**출력 형식:**
```
HH:MM:SS LEVEL [prefix] message
05:35:13 INFO  [livewiki] Scraping: https://...
```

### Errors (`utils/errors.js`)

커스텀 에러 클래스 계층.

| 클래스 | 코드 | 재시도 |
|--------|------|--------|
| `WebfetchError` | UNKNOWN_ERROR | - |
| `NetworkError` | NETWORK_ERROR | ✅ |
| `TimeoutError` | TIMEOUT_ERROR | ✅ |
| `AuthError` | AUTH_ERROR | ❌ |
| `ContentError` | CONTENT_ERROR | ❌ |
| `AdapterError` | ADAPTER_ERROR | ❌ |
| `UploadError` | UPLOAD_ERROR | ✅ |

### Retry (`utils/retry.js`)

Exponential backoff을 지원하는 재시도 로직.

```javascript
import { withRetry } from './utils/retry.js';

const result = await withRetry(
  async () => fetchData(),
  {
    maxRetries: 3,
    initialDelay: 1000,  // 1초
    maxDelay: 10000,     // 10초
    backoffFactor: 2,    // 지수 증가
  }
);
```

**재시도 조건:**
- `NetworkError`, `TimeoutError`, `UploadError`: 재시도
- `AuthError`, `ContentError`: 재시도 안함
- Playwright 에러 (`net::ERR_*`, `Timeout`): 재시도

### Cache (`utils/cache.js`)

URL 해시 기반 캐싱 시스템. 중복 스크래핑을 방지합니다.

```javascript
import { hasCache, getCache, setCache, clearCache } from './utils/cache.js';

// 캐시 확인 (24시간 유효)
if (hasCache(url, 24 * 60 * 60 * 1000)) {
  const cached = getCache(url);
  console.log(cached.result);
}

// 캐시 저장
setCache(url, result);

// 캐시 삭제
clearCache(url);       // 특정 URL
clearAllCache();       // 전체
```

**캐시 저장소:**
```
.cache/
├── {md5-hash}.json    # URL 해시 기반 파일명
└── ...
```

**캐시 데이터 구조:**
```json
{
  "url": "https://...",
  "cachedAt": "2026-01-22T12:00:00.000Z",
  "result": {
    "title": "...",
    "html": "...",
    "url": "...",
    "metadata": {}
  }
}
```

## 배치 처리 (`batch.js`)

여러 URL을 순차적으로 처리하는 배치 모듈.

```javascript
import { parseUrlFile, processBatch, saveBatchReport } from './batch.js';

// URL 파일 파싱
const urls = parseUrlFile('urls.txt');

// 배치 처리
const results = await processBatch(urls, {
  format: 'markdown',
  browser: 'chrome',
  useCache: true,
  cacheMaxAge: 24 * 60 * 60 * 1000,
  outputDir: './output',
  stopOnError: false,
});

// 리포트 저장
saveBatchReport(results, 'report.json');
```

**URL 파일 형식:**
```
# 주석은 # 으로 시작
https://youtu.be/VIDEO_ID_1
https://youtu.be/VIDEO_ID_2
https://longblack.co/note/1234
```

**배치 결과 구조:**
```json
{
  "total": 3,
  "success": 2,
  "failed": 1,
  "skipped": 0,
  "fromCache": 1,
  "outputSummary": {
    "local": { "success": 2, "failed": 0 },
    "gdrive": { "success": 1, "failed": 1, "fallback": 1 }
  },
  "startTime": "2026-01-22T12:00:00.000Z",
  "endTime": "2026-01-22T12:05:00.000Z",
  "items": [
    {
      "index": 1,
      "url": "https://...",
      "status": "success",
      "title": "제목",
      "outputs": [
        { "handler": "local", "path": "output/2026-01-22_제목.md" },
        { "handler": "gdrive", "url": "https://drive.google.com/..." }
      ],
      "fromCache": false
    }
  ]
}
```

## Output Handlers

### Local Handler (`outputs/local.js`)

로컬 파일시스템에 저장. 기본 출력 핸들러.

```javascript
{
  name: 'local',
  save(content, filename, options) → { path: string }
}
```

### Google Drive Handler (`outputs/gdrive.js`)

Google Drive에 OAuth 2.0으로 업로드.

**인증 흐름:**
1. `auth/gdrive-credentials.json` — Google Cloud Console에서 다운로드
2. `gdrive --setup` → localhost에 임시 서버 → 브라우저 인증
3. `auth/gdrive-token.json`에 토큰 저장 (자동 refresh)
4. Scope: `drive.file` (앱이 생성한 파일만 접근)

**폴더 관리:**
- 이름(`webfetch`), 경로(`Longblack/2026`), ID(`1Nrzl...`) 지원
- 폴더 ID 감지: `/^[a-zA-Z0-9_-]{10,}$/` (API 호출 생략)
- 중첩 폴더 자동 생성: `A/B/C` → root → A → B → C

**파일 덮어쓰기:**
- `--drive-overwrite`: 동일 이름 파일 검색 → `drive.files.update()`
- 기본: 중복 파일 생성 (`drive.files.create()`)

**MIME 타입 매핑:**
| 확장자 | MIME Type |
|--------|-----------|
| `.md` | text/markdown |
| `.pdf` | application/pdf |
| `.json` | application/json |
| `.txt` | text/plain |

**비치명적 에러 처리:**
- `--save-to local,gdrive`: Drive 실패 시 warn (local은 독립 성공)
- `--save-to gdrive`: Drive 실패 시 local fallback
- `UploadError`: `withRetry` 3회 재시도

### Handler Registry (`outputs/index.js`)

```javascript
resolveOutputs("local,gdrive") → [localHandler, gdriveHandler]
resolveOutputs(null)            → [localHandler]  // 기본값
```

## Config 시스템 (`utils/config.js`)

**검색 순서:** CWD → $HOME
**지원 파일:** `webfetch.config.js`, `webfetch.config.json`, `.webfetchrc.json`

**로딩:** JS 파일은 dynamic import, JSON은 readFileSync

**머지 규칙:**
- `mergeConfig(cliOptions, config, CLI_DEFAULTS)`
- CLI 옵션이 default 값일 때만 config 적용
- CLI 명시 값 > config 값 > CLI default

```javascript
const CLI_DEFAULTS = {
  browser: 'chrome',
  headless: false,
  saveTo: 'local',
  driveFolder: 'webfetch',
  cacheMaxAge: '24',
};
```

## 에러 처리

| 상황 | 에러 클래스 | 처리 |
|------|------------|------|
| 어댑터 없음 | `AdapterError` | 지원 URL 목록 출력 후 종료 |
| 로그인 필요 | `AuthError` | 브라우저에서 로그인 요청, 5분 타임아웃 |
| 네트워크 오류 | `NetworkError` | 3회 재시도 후 종료 |
| 타임아웃 | `TimeoutError` | 3회 재시도 후 종료 |
| 콘텐츠 없음 | `ContentError` | 빈 결과 반환 |
| Drive 업로드 실패 | `UploadError` | 3회 재시도 후 local fallback |
| Drive 인증 없음 | `AuthError` | `gdrive --setup` 안내 |

## 보안 고려사항

- `auth/` 폴더 `.gitignore` 처리
- OAuth 토큰은 브라우저 프로필에만 저장
- Google Drive 토큰: `auth/gdrive-token.json` (자동 refresh)
- Google Drive 크레덴셜: `auth/gdrive-credentials.json` (사용자 제공)
- 사용자 크레덴셜 코드에 하드코딩 금지

```
auth/
├── chrome-profile/           # Playwright 브라우저 세션
├── gdrive-credentials.json   # Google Cloud OAuth 크레덴셜
└── gdrive-token.json         # 자동 생성/갱신 토큰
```

## 성능

| 작업 | 예상 시간 |
|------|----------|
| 브라우저 시작 | 2-3초 |
| 페이지 로드 | 2-5초 |
| YouTube 추출 (LiveWiki) | 30초-2분 |
| PDF 생성 | 1-2초 |

## Web UI Server (`src/web/`)

### HTTP 서버 (`web/server.js`)

Express 없이 Node.js 내장 `http.createServer` 사용.

**API 엔드포인트:**

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/` | index.html 서빙 |
| `POST` | `/api/scrape` | 스크랩 시작 → `{ jobId }` |
| `GET` | `/api/scrape/:jobId` | SSE 진행률 스트림 |
| `GET` | `/api/history` | output/ 파일 목록 |
| `GET` | `/api/download/:filename` | MD/PDF 다운로드 |
| `GET` | `/api/cache` | 캐시 통계 |
| `DELETE` | `/api/cache` | 캐시 삭제 |
| `POST` | `/api/gdrive/:filename` | 기존 파일 GDrive 업로드 |
| `GET` | `/api/sites` | 지원 사이트 목록 |

**보안:**
- Download 엔드포인트: `basename()` + `..`, `/` 검사로 path traversal 방지
- CORS: `Access-Control-Allow-Origin: *`

### SSE 진행률 프로토콜

```
POST /api/scrape → { jobId }
GET  /api/scrape/:jobId → SSE stream:

event: status
data: {"phase":"launching","message":"브라우저 시작..."}

event: status
data: {"phase":"scraping","message":"콘텐츠 추출 중..."}

event: status
data: {"phase":"formatting","message":"PDF 생성 중..."}

event: result
data: {"title":"...","files":[{"name":"2026-01-27_제목.md","format":"md"}],"preview":"..."}
```

### 프론트엔드 (`web/index.html`)

Single HTML file, 빌드 불필요, vanilla JS.

| 탭 | 기능 |
|----|------|
| Scrape | URL 입력, 포맷 토글 (MD+PDF/MD/PDF), SSE 진행률, 결과 다운로드 |
| History | 날짜별 그룹핑, 파일 다운로드, GDrive 업로드 |
| Settings | 캐시 통계/삭제, 지원 사이트 목록 |

### Job 큐

`browser.js` 싱글톤 context → 동시 스크랩 불가. FIFO 큐로 순차 처리.

```javascript
const jobs = new Map();  // jobId → { status, result, listeners }
const queue = [];
let processing = false;
```

## MCP Server (`src/mcp/`)

### MCP 서버 (`mcp/server.js`)

`@modelcontextprotocol/sdk` 사용, `StdioServerTransport` (Claude Code용).

```javascript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new McpServer({ name: 'webfetch', version: '1.0.0' });
// ... tool registration ...
const transport = new StdioServerTransport();
await server.connect(transport);
```

### MCP 도구 (`mcp/tools.js`)

| Tool | Input Schema | Output |
|------|-------------|--------|
| `webfetch_scrape` | `{ url: string, format?: "md"\|"pdf"\|"both" }` | `{ title, files[], preview }` |
| `webfetch_history` | `{}` | `{ files[] }` |
| `webfetch_download` | `{ filename: string }` | 파일 내용 (text) 또는 바이너리 경로 |
| `webfetch_cache` | `{ action: "stats"\|"clear" }` | 캐시 통계 또는 삭제 결과 |
| `webfetch_gdrive_upload` | `{ filename: string, driveFolder?: string }` | `{ url, id, name }` |

### 설정 방법

```json
// .mcp.json (프로젝트) 또는 ~/.claude.json (전역)
{
  "mcpServers": {
    "webfetch": {
      "command": "node",
      "args": ["/absolute/path/to/webfetch/src/index.js", "mcp"]
    }
  }
}
```

### stdio 제약

- stdout은 JSON-RPC 전용 → Logger는 `console.error` (stderr) 사용
- `progress()` / `clearProgress()`도 `process.stderr`
- CLI/Web은 영향 없음 (stderr도 터미널에 표시)
- 바이너리 PDF는 파일 경로만 반환 (text content 제한)

## 공통 비즈니스 로직 (`src/handler.js`)

CLI, Web UI, MCP 모두 handler.js 함수를 공유.

```typescript
// 비동기 큐 (Web UI용)
enqueueScrape(url, options) → { jobId, position }
subscribeJob(jobId, listener) → unsubscribe()
getJobStatus(jobId) → { status, result, error }

// 동기 스크랩 (CLI/MCP용)
scrape(url, options) → { title, url, files[], preview }

// 유틸리티
getHistory() → FileInfo[]
readFile(filename) → { type: 'text', content } | { type: 'binary', path, size }
getFileStream(filename) → { stream, size, mimeType }
getCacheInfo() → { count, size, entries[] }
clearCache() → { cleared: true }
uploadToGdrive(filename, options) → { url, id, name }
getSupportedSites() → { name, patterns }[]
```

## 제약사항

- Node.js 18+ 필요
- Playwright 브라우저 설치 필요
- LiveWiki YouTube 추출은 로그인 필수
- Headless 모드에서 로그인 불가
- 서버 모드(Web/MCP)는 headless: true 강제 — 첫 로그인은 CLI에서 수행 필요
- 브라우저 싱글톤 context → 동시 스크랩 불가, FIFO 큐로 순차 처리
- MCP stdout은 JSON-RPC 전용 — 모든 로그는 stderr로 출력
