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

## 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                         CLI (index.js)                       │
│  - URL 파싱 및 어댑터 선택                                    │
│  - 옵션 처리 (-f, -o, -b, --headless, --keep-open)          │
│  - 출력 파일 저장                                            │
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
                        output/ 폴더
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

## 에러 처리

| 상황 | 처리 |
|------|------|
| 어댑터 없음 | 지원 URL 목록 출력 후 종료 |
| 로그인 필요 | 브라우저에서 로그인 요청, 5분 타임아웃 |
| 네트워크 오류 | 에러 메시지 출력 후 종료 |
| 콘텐츠 없음 | 빈 결과 반환 |

## 보안 고려사항

- `auth/` 폴더 `.gitignore` 처리
- OAuth 토큰은 브라우저 프로필에만 저장
- 사용자 크레덴셜 코드에 하드코딩 금지

## 성능

| 작업 | 예상 시간 |
|------|----------|
| 브라우저 시작 | 2-3초 |
| 페이지 로드 | 2-5초 |
| YouTube 추출 (LiveWiki) | 30초-2분 |
| PDF 생성 | 1-2초 |

## 제약사항

- Node.js 18+ 필요
- Playwright 브라우저 설치 필요
- LiveWiki YouTube 추출은 로그인 필수
- Headless 모드에서 로그인 불가
