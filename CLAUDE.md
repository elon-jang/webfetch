# webfetch Project Context

## Overview
Web scraping CLI for LiveWiki & Longblack. Extracts YouTube video summaries via LiveWiki or saves web articles to Markdown/PDF.

## Development Commands

### Run CLI
```bash
# Single URL
node src/index.js "https://youtu.be/VIDEO_ID"

# Longblack - 오늘의 기사 자동 스크랩
node src/index.js "https://longblack.co"

# Batch processing
node src/index.js batch urls.txt

# Cache management
node src/index.js cache --stats
node src/index.js cache --clear
```

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
```

## Architecture Patterns

### Adapter Pattern
Add new site adapters in `/src/adapters/`:
- Implement `match(url)` and `scrape(url, options)` methods
- Register in `/src/adapters/index.js`
- See `livewiki.js` and `longblack.js` for examples

### Error Handling
- Use custom error classes from `/src/utils/errors.js`
- `NetworkError` and `TimeoutError` trigger automatic retries (3x with exponential backoff)
- `AuthError` and `ContentError` do not retry

### Logging
```javascript
import { createLogger } from './utils/logger.js';
const log = createLogger('module-name');
log.info('message');  // HH:MM:SS INFO [module-name] message
```

## Key Files

- `/src/index.js` - CLI entry point with Commander.js
- `/src/adapters/` - Site-specific scrapers (Strategy Pattern)
- `/src/formatters/` - Output formatters (markdown, pdf, json)
- `/src/utils/` - logger, errors, retry, cache utilities
- `/src/batch.js` - Batch processing module
- `/src/browser.js` - Playwright browser management

## Environment & Dependencies

### Required Setup
```bash
npm install
npx playwright install chromium firefox
```

### Persistent Browser Profiles
- Located in `/auth/` (gitignored)
- Stores OAuth sessions for LiveWiki/Longblack
- Delete `/auth/` folder to reset sessions

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

## Common Tasks

### Adding a New Site Adapter
1. Create `/src/adapters/newsite.js` with `match()` and `scrape()` methods
2. Import and register in `/src/adapters/index.js`
3. Test with real URL using `--keep-open` flag

### Adding a New Output Format
1. Create `/src/formatters/newformat.js` with export function
2. Import in `/src/index.js`
3. Add to CLI options in `--format` choices

### Debugging Scraping Issues
- Use `--keep-open` to inspect browser state
- Check selectors in adapter CONFIG objects
- Review logs with timestamp and module prefixes

## Roadmap

### Completed (Phase 1 & 2)
- Error handling with custom error classes
- Retry logic with exponential backoff
- Structured logging system
- Batch processing from URL files
- Cache system with TTL
- Batch reports in JSON
- Longblack 홈페이지 → 오늘의 기사 자동 감지
- `--skip-existing` 중복 스크랩 방지 옵션

### Planned (Phase 3+)
- New adapters: Vrew, Notion, Medium, Substack
- New formatters: HTML, DOCX, Notion export
- npx support
- Config file support (`webfetch.config.js`)
- Interactive mode
