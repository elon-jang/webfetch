# Webfetch Lessons Learned

개발 과정에서 얻은 교훈과 주의사항 기록.

---

## Google Drive API

### findOrCreateFolder() 동작 방식
- 슬래시 없는 10자+ 영숫자 문자열 → **폴더 ID**로 간주 (그대로 반환)
- 슬래시 포함 문자열 → **폴더 이름 경로**로 간주 (root부터 계층 생성)
- **절대 금지**: 폴더 ID에 경로를 붙이는 것 (`ID/subfolder`)
  - `findOrCreateFolder`가 ID 자체를 폴더 이름으로 해석해서 루트에 ID 이름의 폴더를 생성함
- **해결**: `DEFAULT_DRIVE_FOLDER = 'Webfetch'` (이름 기반) → `routeOutputOptions`가 `{source}/{year}` 자동 추가

### isDriveFolderId() 가드
- 패턴: `/^[a-zA-Z0-9_-]{10,}$/`
- 라우팅 로직에서 ID면 경로 추가 스킵, 이름이면 `{source}/{year}` 자동 추가
- 사용자가 `--drive-folder`로 ID를 직접 전달할 때 하위 호환 보장

### gdrive.test() 폴더 이름
- `test()` 함수에서 `DEFAULT_DRIVE_FOLDER` 상수를 사용해야 함
- 하드코딩 시 대소문자 불일치로 별도 폴더 생성 위험 (`'webfetch'` vs `'Webfetch'`)

---

## 날짜 처리

### normalizeDate() 주의사항
- `Date.parse()` fallback은 타임존 의존적: `new Date('Jan 15, 2026').toISOString().slice(0,10)` → UTC 변환 시 하루 밀릴 수 있음
- 테스트에서 ±1일 허용 (`/^2026-01-1[45]$/`)으로 대응
- **개선 필요**: 영문 월명 수동 파싱으로 교체하면 타임존 문제 완전 해결 가능

### 글 작성일(publish date) 추출 전략
- `article:published_time` 메타 태그가 가장 신뢰도 높음 (Open Graph 표준, ISO 8601)
- 폴백 체인: `article:published_time` → `og:article:published_time` → `DC.date` → `time[datetime]`
- 모든 어댑터가 동일 패턴 사용 → 새 어댑터 추가 시 반드시 포함

### 페이월 사이트 제약
- Longblack, TheMiilk: 미인증 HTTP 요청 → `/login`으로 리다이렉트
- 메타 태그가 로그인 페이지 HTML에 없음 → **반드시 Playwright + 저장된 세션** 필요
- Medium, Substack: 경량 HTTP 추출 가능 (공개 콘텐츠), Playwright 폴백

---

## 아키텍처 패턴

### 파일명 날짜 우선순위
```
publish date (metadata.date) → crawl date (현재 날짜)
```
- `generateFilename(title, ext, { publishDate })` — 모든 호출부에서 `result.metadata?.date` 전달
- frontmatter에 `date:` 필드 별도 기록 (scraped_at과 독립)

### 출력 라우팅
- `routeOutputOptions(options, adapterName)` — outputDir, driveFolder에 `{source}/{year}` 자동 추가
- adapterName 매핑: `longblack→LongBlack`, `livewiki→YouTube`, `themiilk→TheMiilk`
- driveFolder가 ID면 라우팅 스킵 (하위 호환)

### 스크립트 패턴
- 모든 scripts/ 파일은 `--apply` 플래그 (기본: dry-run)
- 실행 전 반드시 dry-run으로 영향 범위 확인
- Drive API 스크립트는 `auth/gdrive-token.json` 필요

---

## 테스트

### 타임존 의존 테스트
- `Date.parse()` 사용하는 함수 테스트 시 exact match 대신 패턴 매칭
- 예: `expect(result).toMatch(/^2026-01-1[45]$/)`

### Drive 관련 테스트
- `findOrCreateFolder`는 모킹된 Drive API로 단위 테스트 가능
- 실제 Drive 업로드 테스트는 인증 필요 — CI에서는 스킵

---

## 실수 기록

### 폴더 ID + 경로 결합 버그
- **증상**: Drive에 `1NrzlShH...` 이름의 폴더가 루트에 생성됨
- **원인**: `${DEFAULT_DRIVE_FOLDER_ID}/${source}/${year}` — 슬래시가 포함되어 이름 모드로 진입
- **교훈**: `findOrCreateFolder`는 "ID/path" 문법을 지원하지 않음. ID와 이름을 혼합하지 말 것

### gdrive.test() 대소문자 불일치
- **증상**: `'webfetch'`와 `'Webfetch'` 두 폴더가 Drive에 공존
- **원인**: test() 함수에 `'webfetch'` 하드코딩, 프로덕션은 `'Webfetch'` 사용
- **교훈**: 상수를 반드시 공유할 것. 하드코딩된 문자열 대신 `DEFAULT_DRIVE_FOLDER` 참조
