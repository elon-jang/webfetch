# webfetch Project Context

## Overview
Web scraping CLI + Web UI + MCP Server for LiveWiki, Longblack & TheMiilk. Extracts YouTube video summaries via LiveWiki or saves web articles to Markdown/PDF. Supports mobile access via Web UI and AI tool integration via MCP.

## Development Commands

### Run CLI
```bash
# Single URL (기본: MD + PDF 둘 다 출력)
node src/index.js "https://youtu.be/VIDEO_ID"

# 특정 포맷만 출력
node src/index.js "https://youtu.be/VIDEO_ID" -f markdown
node src/index.js "https://youtu.be/VIDEO_ID" -f pdf

# Longblack - 오늘의 기사 자동 스크랩
node src/index.js "https://longblack.co"

# Batch processing
node src/index.js batch urls.txt

# Cache management
node src/index.js cache --stats
node src/index.js cache --clear
```

### Google Drive
```bash
# OAuth 초기 설정
node src/index.js gdrive --setup

# 연결 테스트
node src/index.js gdrive --test

# Google Drive에만 저장
node src/index.js "https://longblack.co" --save-to gdrive

# 로컬 + Google Drive 동시 저장
node src/index.js "https://longblack.co" --save-to local,gdrive

# Drive 폴더 지정 (이름 또는 폴더 ID)
node src/index.js "https://longblack.co" --save-to gdrive --drive-folder "Longblack/2026"

# Batch + Drive
node src/index.js batch urls.txt --save-to local,gdrive --drive-folder "Research"

# 인증 해제
node src/index.js gdrive --revoke
```

### Web UI Server
```bash
# 웹 UI 서버 시작 (기본 포트 3000, 모든 인터페이스, MCP 엔드포인트 포함)
node src/index.js serve

# 포트/호스트 지정
node src/index.js serve -p 8080 --host 127.0.0.1

# Bearer token 인증으로 MCP 엔드포인트 보호
node src/index.js serve --auth-token my-secret-token

# MCP 엔드포인트 비활성화 (Web UI만)
node src/index.js serve --no-mcp

# 모바일 접속: http://<서버IP>:3000
```
- Mobile-first 반응형 UI (dark theme)
- 3 탭: Scrape / History / Settings
- SSE로 스크랩 진행률 실시간 표시
- 서버 모드에서는 headless: true 강제 (첫 로그인은 CLI로 수행)
- `/mcp` 엔드포인트: Streamable HTTP transport (원격 MCP 클라이언트용)
- `/health` 엔드포인트: 서버 상태 및 MCP 세션 수 확인

**원격 MCP 클라이언트 설정 (Claude Desktop 등):**
```json
{
  "mcpServers": {
    "webfetch-remote": {
      "url": "http://<server-ip>:3000/mcp",
      "headers": {
        "Authorization": "Bearer my-secret-token"
      }
    }
  }
}
```

### MCP Server
```bash
# MCP 서버 시작 (stdio transport, Claude Code용)
node src/index.js mcp

# Claude Code 연동 테스트 (JSON-RPC initialize)
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test"}}}' | node src/index.js mcp
```

**MCP 설정 (`.mcp.json` 또는 `~/.claude.json`):**
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

**MCP 도구 (5개):**
| Tool | Description |
|------|-------------|
| `webfetch_scrape` | URL 스크랩 → MD/PDF 저장 |
| `webfetch_history` | output/ 파일 목록 |
| `webfetch_download` | 파일 내용 반환 (text) |
| `webfetch_cache` | 캐시 통계/삭제 |
| `webfetch_gdrive_upload` | 파일 → Google Drive 업로드 |

### Config
```bash
# 설정 파일 템플릿 생성
node src/index.js config --init

# 현재 로드된 설정 확인
node src/index.js config --show
```
- 검색 순서: `cwd` → `$HOME`
- 지원 파일: `webfetch.config.js`, `webfetch.config.json`, `.webfetchrc.json`
- CLI 옵션이 config 값보다 우선

### Scheduled Scraping (Cron)
```bash
# 매일 오전 9시 Longblack 오늘의 기사 스크랩
0 9 * * * cd /path/to/webfetch && node src/index.js "https://longblack.co" --skip-existing --no-cache >> ~/logs/webfetch.log 2>&1
```
- `--skip-existing`: 오늘 날짜 파일이 이미 있으면 스킵
- `--no-cache`: 항상 새로 스크랩

### Testing
```bash
# Test with real URLs
node src/index.js "https://youtu.be/2z9JsnMDWHE" --keep-open

# Test batch processing
echo "https://youtu.be/VIDEO_ID" > test-urls.txt
node src/index.js batch test-urls.txt --report test-report.json

# Web UI API 직접 테스트
node src/index.js serve &
curl -X POST http://localhost:3000/api/scrape -H "Content-Type: application/json" -d '{"url":"https://longblack.co"}'
curl http://localhost:3000/api/history
curl http://localhost:3000/api/cache

# MCP 도구 목록 확인
printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}\n{"jsonrpc":"2.0","method":"notifications/initialized"}\n{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}\n' | node src/index.js mcp

# 원격 MCP 엔드포인트 테스트
node src/index.js serve --auth-token test123 &
curl http://localhost:3000/health
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer test123" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test"}}}'

# 기존 테스트 실행
npm test
```

## Architecture Patterns

### Adapter Pattern
Add new site adapters in `/src/adapters/`:
- Implement `match(url)` and `scrape(url, options)` methods
- Register in `/src/adapters/index.js`
- See `livewiki.js` and `longblack.js` for examples

### Output Handler Pattern
Add new output destinations in `/src/outputs/`:
- Implement `name` property and async `save(content, filename, options)` method
- Register in `/src/outputs/index.js`
- See `local.js` and `gdrive.js` for examples

### Error Handling
- Use custom error classes from `/src/utils/errors.js`
- Retryable: `NetworkError`, `TimeoutError`, `UploadError` (3x with exponential backoff)
- Non-retryable: `AuthError`, `ContentError`

### Handler Pattern (공통 비즈니스 로직)
CLI, Web UI, MCP 모두 `handler.js`의 함수를 공유:
- `enqueueScrape(url, options)` → 비동기 job 큐 (Web UI용, SSE 진행률)
- `scrape(url, options)` → 동기 스크랩 (MCP/CLI용)
- `getHistory()` / `readFile(filename)` / `getFileStream(filename)`
- `getCacheInfo()` / `clearCache()`
- `uploadToGdrive(filename, options)`

### Logging
```javascript
import { createLogger } from './utils/logger.js';
const log = createLogger('module-name');
log.info('message');  // HH:MM:SS INFO [module-name] message
```
- **stderr 출력**: logger는 `console.error`로 stderr에 출력 (MCP stdio 호환)

## Key Files

- `/src/index.js` - CLI entry point with Commander.js (serve, mcp 서브커맨드 포함)
- `/src/handler.js` - 공통 비즈니스 로직 (스크랩 큐, 히스토리, 캐시, 다운로드, GDrive)
- `/src/web/server.js` - HTTP 서버 (built-in http 모듈, SSE 지원)
- `/src/web/index.html` - 모바일 반응형 프론트엔드 (Single File, inline CSS/JS)
- `/src/mcp/server.js` - MCP 서버 진입점 (StdioServerTransport)
- `/src/mcp/http-transport.js` - MCP HTTP 세션 매니저 (StreamableHTTPServerTransport, 원격 MCP용)
- `/src/mcp/tools.js` - MCP 도구 정의 (zod 스키마 + handler.js 래핑)
- `/src/adapters/` - Site-specific scrapers (Strategy Pattern)
- `/src/formatters/` - Output formatters (markdown, pdf, json)
- `/src/outputs/` - Output destination handlers (local, gdrive)
- `/src/utils/` - logger, errors, retry, cache, config utilities
- `/src/batch.js` - Batch processing module
- `/src/browser.js` - Playwright browser management (싱글톤 context)

## Environment & Dependencies

### Required Setup
```bash
npm install
npx playwright install chromium firefox
```

### Persistent Browser Profiles
- Located in `/auth/` (gitignored)
- Stores OAuth sessions for LiveWiki/Longblack
- Delete `/auth/chrome-profile/` to reset browser sessions

### Google Drive Setup (Optional)
1. Google Cloud Console에서 OAuth 2.0 클라이언트 ID 생성 (Desktop app)
2. JSON 다운로드 → `/auth/gdrive-credentials.json`에 저장
3. `node src/index.js gdrive --setup` 실행 → 브라우저 인증
4. `/auth/gdrive-token.json` 자동 생성 (refresh token으로 자동 갱신)
5. Scope: `drive.file` (앱이 생성한 파일만 접근)

### Cache System
- Located in `/.cache/` (gitignored)
- URL-hash based, 24hr default TTL
- Use `--no-cache` to bypass

## Adapter-Specific Features

### Longblack
- **홈페이지 자동 감지**: `https://longblack.co` 입력 시 오늘의 첫 번째 기사 자동 스크랩
- **로그인 세션 유지**: `/auth/chrome-profile/`에 세션 저장
- 셀렉터 전략: `[data-tab="note"]` → `a[href*="/note/"]` fallback

### LiveWiki
- YouTube URL 자동 변환: `youtu.be/xxx` → LiveWiki 요약 페이지
- 아티클/타임라인/요약 탭 자동 추출

### TheMiilk
- **페이월 감지**: `.article-detail-cta` 존재 시 로그인 유도
- **로그인 세션 유지**: `auth.themiilk.com` 인증 → `/auth/chrome-profile/`에 세션 저장
- 콘텐츠 셀렉터: `.article-detail-content` → `.article-body` → `article` fallback
- 메타데이터 추출: 저자 (`.reporter-profile`), `og:description`

## Common Tasks

### Adding a New Site Adapter
1. Create `/src/adapters/newsite.js` with `match()` and `scrape()` methods
2. Import and register in `/src/adapters/index.js`
3. Test with real URL using `--keep-open` flag

### Adding a New Output Format
1. Create `/src/formatters/newformat.js` with export function
2. Import in `/src/index.js`
3. Add to CLI options in `--format` choices

### Adding a New Output Destination
1. Create `/src/outputs/newdest.js` with `{ name, save() }` export
2. Import and register in `/src/outputs/index.js`
3. Add CLI options (`--newdest-option`) to default command and batch command

### Debugging Scraping Issues
- Use `--keep-open` to inspect browser state
- Check selectors in adapter CONFIG objects
- Review logs with timestamp and module prefixes

## Roadmap

### Completed (Phase 1–3)
- Error handling with custom error classes
- Retry logic with exponential backoff
- Structured logging system
- Batch processing from URL files
- Cache system with TTL
- Batch reports in JSON
- Longblack 홈페이지 → 오늘의 기사 자동 감지
- `--skip-existing` 중복 스크랩 방지 옵션
- 기본 출력: MD + PDF 동시 저장 (포맷 미지정 시)
- Google Drive 연동 (`--save-to gdrive`)
- Output handler 패턴 (local, gdrive)
- 복수 저장 대상 동시 지원 (`--save-to local,gdrive`)
- Config file support (`webfetch.config.js` / `.webfetchrc.json`)
- npx support (`engines: node>=18`, `bin`, `files` 설정)
- `--drive-overwrite` 기존 파일 덮어쓰기
- Web UI 서버 (`serve` 커맨드, SSE 진행률, 모바일 반응형)
- MCP 서버 (`mcp` 커맨드, stdio transport, 5개 도구)
- 공통 handler.js (CLI/Web/MCP 비즈니스 로직 공유)
- Logger stderr 출력 (MCP stdio 호환)
- 원격 MCP 지원 (`serve` 명령 `/mcp` 엔드포인트, Streamable HTTP, Bearer token 인증)

### Planned (Phase 4+)
- New adapters: Vrew, Notion, Medium, Substack
- New formatters: HTML, DOCX, Notion export
- Interactive mode
