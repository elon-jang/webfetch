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

### 9. 스케줄러 연동 (cron)

```bash
# crontab에 등록 (매일 오전 9시 실행)
crontab -e

# 추가할 내용:
0 9 * * * cd /path/to/webfetch && node src/index.js batch urls.txt --report /path/to/reports/$(date +\%Y-\%m-\%d).json

# macOS launchd 사용시
# ~/Library/LaunchAgents/com.webfetch.daily.plist 생성
```

## CLI Options

### 단일 URL 스크래핑

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `-f, --format` | 출력 형식 (markdown, pdf, json) | markdown |
| `-o, --output` | 출력 파일 경로 | output/YYYY-MM-DD_제목.ext |
| `-b, --browser` | 브라우저 (chrome, firefox) | chrome |
| `--headless` | 헤드리스 모드 (로그인 불가) | false |
| `--keep-open` | 완료 후 브라우저 유지 | false |
| `--no-cache` | 캐시 무시 (항상 새로 스크랩) | false |
| `--cache-max-age` | 캐시 유효 시간 (시간) | 24 |

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
| `--report` | 배치 리포트 저장 경로 | - |

### 캐시 관리 (`cache` 명령어)

| 옵션 | 설명 |
|------|------|
| `--stats` | 캐시 통계 표시 |
| `--clear` | 모든 캐시 삭제 |

## Features

- **자동 파일명**: `YYYY-MM-DD_제목.ext` 형식
- **영구 로그인**: 브라우저 프로필에 세션 저장 (Google OAuth 지원)
- **콘텐츠 필터링**: 본문만 추출 (광고, 네비게이션, 플레이어 UI 제거)
- **구조화된 출력**: 핵심요약, 타임라인, 아티클 섹션 분리
- **배치 처리**: URL 목록 파일로 여러 URL 한번에 처리
- **캐싱 시스템**: URL 해시 기반 캐시로 중복 스크래핑 방지 (24시간 유효)
- **배치 리포트**: JSON 형식의 실행 결과 리포트 생성

## Project Structure

```
webfetch/
├── src/
│   ├── index.js           # CLI 진입점
│   ├── browser.js         # Playwright 브라우저 관리
│   ├── batch.js           # 배치 처리 모듈
│   ├── adapters/          # 사이트별 어댑터 (Strategy Pattern)
│   │   ├── index.js       # 어댑터 레지스트리
│   │   ├── livewiki.js    # LiveWiki (YouTube 추출 + 콘텐츠 스크랩)
│   │   └── longblack.js   # Longblack (기사 스크랩)
│   ├── formatters/        # 출력 포맷터
│   │   ├── markdown.js    # Turndown 기반 변환
│   │   └── pdf.js         # Styled PDF 생성
│   └── utils/             # 유틸리티 모듈
│       ├── logger.js      # 로깅 시스템
│       ├── errors.js      # 커스텀 에러 클래스
│       ├── retry.js       # 재시도 로직
│       └── cache.js       # URL 캐싱 시스템
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
