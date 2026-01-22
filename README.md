# webfetch

Web scraping CLI for LiveWiki & Longblack. YouTube 영상을 LiveWiki로 요약하거나, 콘텐츠를 Markdown/PDF로 저장합니다.

## Installation

```bash
npm install
npx playwright install chromium firefox
```

## Quick Start

```bash
# YouTube 영상 → LiveWiki 요약 추출
node src/index.js "https://youtu.be/VIDEO_ID"

# 결과는 output/ 폴더에 자동 저장됩니다
# 예: output/2026-01-22_영상_제목.md
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
```

> ⚠️ 유료 기사는 로그인이 필요합니다.

### 4. 출력 형식 지정

```bash
# Markdown (기본값)
node src/index.js "https://youtu.be/VIDEO_ID" -f markdown

# PDF
node src/index.js "https://youtu.be/VIDEO_ID" -f pdf

# JSON (메타데이터 포함)
node src/index.js "https://youtu.be/VIDEO_ID" -f json
```

### 5. 출력 경로 지정

```bash
# 기본: output/YYYY-MM-DD_제목.md
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

## CLI Options

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `-f, --format` | 출력 형식 (markdown, pdf, json) | markdown |
| `-o, --output` | 출력 파일 경로 | output/YYYY-MM-DD_제목.ext |
| `-b, --browser` | 브라우저 (chrome, firefox) | chrome |
| `--headless` | 헤드리스 모드 (로그인 불가) | false |
| `--keep-open` | 완료 후 브라우저 유지 | false |

## Features

- **자동 파일명**: `YYYY-MM-DD_제목.ext` 형식
- **영구 로그인**: 브라우저 프로필에 세션 저장 (Google OAuth 지원)
- **콘텐츠 필터링**: 본문만 추출 (광고, 네비게이션, 플레이어 UI 제거)
- **구조화된 출력**: 핵심요약, 타임라인, 아티클 섹션 분리

## Project Structure

```
webfetch/
├── src/
│   ├── index.js           # CLI 진입점
│   ├── browser.js         # Playwright 브라우저 관리
│   ├── adapters/          # 사이트별 어댑터 (Strategy Pattern)
│   │   ├── index.js       # 어댑터 레지스트리
│   │   ├── livewiki.js    # LiveWiki (YouTube 추출 + 콘텐츠 스크랩)
│   │   └── longblack.js   # Longblack (기사 스크랩)
│   └── formatters/        # 출력 포맷터
│       ├── markdown.js    # Turndown 기반 변환
│       └── pdf.js         # Styled PDF 생성
├── output/                # 스크래핑 결과 저장
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

---

## Roadmap

### Phase 1: 안정성 개선
- [ ] 에러 핸들링 강화 (네트워크 오류, 타임아웃)
- [ ] 재시도 로직 추가 (3회 재시도)
- [ ] 로깅 시스템 구축 (winston/pino)

### Phase 2: 기능 확장
- [ ] 배치 처리 지원 (URL 목록 파일 입력)
- [ ] 스케줄러 연동 (cron job)
- [ ] 캐싱 시스템 (중복 스크래핑 방지)

### Phase 3: 새로운 어댑터
- [ ] Vrew 어댑터 (자막 추출)
- [ ] Notion 어댑터 (페이지 스크랩)
- [ ] Medium 어댑터
- [ ] Substack 어댑터

### Phase 4: 출력 형식 확장
- [ ] HTML 포맷터
- [ ] DOCX 포맷터
- [ ] Notion 내보내기

### Phase 5: 사용성 개선
- [ ] npx 지원 (`npx webfetch <url>`)
- [ ] 설정 파일 지원 (`webfetch.config.js`)
- [ ] 인터랙티브 모드 (inquirer)

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
