# webfetch

Web scraping CLI for LiveWiki & Longblack.

## Installation

```bash
npm install
npx playwright install chromium firefox
```

## Usage

```bash
# LiveWiki - YouTube extraction (requires login)
webfetch https://youtube.com/watch?v=VIDEO_ID

# LiveWiki - Direct content scrape
webfetch https://livewiki.com/ko/content/article-slug

# Longblack - Article scrape (login if needed)
webfetch https://longblack.co/note/1234

# Output formats
webfetch <url> -f pdf       # PDF (auto: YYYY-MM-DD_제목.pdf)
webfetch <url> -f markdown  # Markdown
webfetch <url> -f json      # JSON

# Custom output path
webfetch <url> -f pdf -o custom.pdf

# Browser options
webfetch <url> -b firefox   # Use Firefox
webfetch <url> --keep-open  # Keep browser open
```

## Features

- **Auto filename**: `YYYY-MM-DD_제목.pdf` 형식 자동 생성
- **Persistent login**: 브라우저 프로필에 세션 저장 (Google OAuth 지원)
- **Content filtering**: 본문만 추출 (네비게이션, 광고, 플레이어 UI 제거)

## How it works

### LiveWiki
- **YouTube URL**: LiveWiki 접속 → 로그인 → URL 입력 → 추출 대기 → 결과 스크랩
- **Content URL**: 직접 스크랩
- **추출 섹션**:
  - 핵심 요약 (Key Summary)
  - 타임라인 (Timeline with timestamps)
  - 아티클 (Prose-style article content)

### Longblack
- 기사 본문만 추출 (CONFIG 기반 필터링)
- 페이월 감지시 자동 로그인 요청

## Project Structure

```
webfetch/
├── src/
│   ├── index.js           # CLI + auto filename
│   ├── browser.js         # Playwright (persistent profile)
│   ├── adapters/
│   │   ├── index.js       # Registry
│   │   ├── livewiki.js    # LiveWiki (2 modes)
│   │   └── longblack.js   # Longblack (CONFIG filtering)
│   └── formatters/
│       ├── markdown.js    # Turndown
│       └── pdf.js         # Styled PDF
├── auth/                  # Browser profiles (gitignored)
└── package.json
```

## Adding new adapters

```javascript
// src/adapters/mysite.js
export const mysite = {
  name: 'mysite',
  match(url) { return /mysite\.com/.test(url); },
  async scrape(url, options) {
    // Return { title, html, url, metadata }
  }
};

// Register in src/adapters/index.js
import { mysite } from './mysite.js';
const adapters = [livewiki, longblack, mysite];
```
