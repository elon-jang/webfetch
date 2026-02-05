# Webfetch Assistant Skill

웹 콘텐츠 스크랩을 돕는 스킬입니다. 다양한 사이트의 기사를 Markdown/PDF/EPUB으로 저장합니다.

## When to Use This Skill

다음과 같은 경우에 이 스킬을 자동으로 활성화하세요:

1. 사용자가 URL 스크랩을 요청할 때 (YouTube, Longblack, TheMiilk, Medium, Substack, Naver Blog, 기타 URL)
2. 사용자가 "롱블랙 오늘 기사", "오늘의 기사 스크랩" 등을 요청할 때
3. 사용자가 여러 URL을 일괄 처리하고 싶을 때
4. 사용자가 캐시 관리를 요청할 때
5. 사용자가 웹 콘텐츠를 마크다운, PDF, EPUB으로 변환하고 싶을 때
6. 사용자가 스크랩된 파일을 검색하거나 목록을 보고 싶을 때
7. 사용자가 webfetch 설정을 관리하고 싶을 때

## Core Capabilities

### 1. 단일 URL 스크랩
- YouTube URL -> LiveWiki 요약 추출
- LiveWiki 직접 URL 스크랩
- Longblack 기사 스크랩
- TheMiilk 기사 스크랩
- Medium 아티클 스크랩
- Substack 뉴스레터 스크랩
- Naver Blog 포스트 스크랩
- **모든 HTTP/HTTPS URL** (generic fallback: Readability 기반)
- 기본 출력: Markdown + PDF 동시 생성
- 추가 포맷: EPUB

### 2. 오늘의 기사 자동 감지
- Longblack 홈페이지에서 오늘의 첫 번째 기사 자동 탐지
- TheMiilk 홈페이지에서 최신 기사 자동 탐지
- 로그인 세션 자동 관리
- `--skip-existing`으로 중복 방지

### 3. 배치 처리
- URL 파일에서 다수 URL 일괄 처리
- 도메인별 속도 제한 (`--rate-limit`)
- 실패한 URL 건너뛰기 / 중단 옵션
- JSON 리포트 생성

### 4. 파일 검색 및 목록
- output/ 디렉토리에서 키워드 검색
- source/날짜별 파일 필터링

### 5. 캐시 관리
- URL 기반 캐시 (24시간 TTL)
- 캐시 통계 조회
- 캐시 전체 삭제

### 6. 출력 옵션
- Markdown + PDF 동시 생성 (기본)
- EPUB 포맷 지원
- GFM 테이블 보존
- 이미지 로컬 다운로드 (`--download-images`)
- Obsidian 호환 frontmatter (`--obsidian`)
- 커스텀 파일명 템플릿 (`--filename-template`)

## Workflow Examples

### URL 스크랩 요청
```
사용자: "https://longblack.co/note/1872 스크랩해줘"

Claude:
1. /webfetch:webfetch-scrape 명령 실행
2. node src/index.js "https://longblack.co/note/1872" 실행
3. 저장된 파일 경로 표시
```

### 오늘의 기사 요청
```
사용자: "롱블랙 오늘 기사 스크랩"

Claude:
1. /webfetch:webfetch-today 명령 실행
2. 오늘 날짜 파일 존재 여부 확인
3. node src/index.js "https://longblack.co" --no-cache 실행
4. 결과 표시
```

### YouTube 요약 요청
```
사용자: "https://youtu.be/VIDEO_ID 요약 가져와"

Claude:
1. /webfetch:webfetch-scrape 명령 실행
2. LiveWiki를 통한 요약 추출
3. Markdown + PDF 저장
```

### Medium/Substack 스크랩
```
사용자: "https://medium.com/@user/article 스크랩"

Claude:
1. /webfetch:webfetch-scrape 명령 실행
2. Medium adapter로 lightweight 추출 시도
3. Markdown + PDF 저장
```

### 범용 URL 스크랩
```
사용자: "https://example.com/article 스크랩해줘"

Claude:
1. /webfetch:webfetch-scrape 명령 실행
2. Generic adapter 사용 (Readability 기반)
3. Markdown + PDF 저장
```

### 배치 처리 요청
```
사용자: "이 URL들 다 스크랩해줘: url1, url2, url3"

Claude:
1. URL 목록으로 임시 파일 생성
2. /webfetch:webfetch-batch 명령 실행
3. 결과 리포트 표시
```

### 파일 검색
```
사용자: "스크랩한 파일에서 AI 검색해줘"

Claude:
1. /webfetch:webfetch-search AI
2. 검색 결과 표시
```

### 파일 목록
```
사용자: "스크랩한 파일 목록 보여줘"

Claude:
1. /webfetch:webfetch-list
2. source별 파일 목록 표시
```

## Important Behaviors

### URL 자동 인식
사용자가 URL을 포함한 메시지를 보내면:
- YouTube URL -> LiveWiki 요약 추출
- Longblack URL -> 기사 스크랩
- TheMiilk URL -> 기사 스크랩
- Medium URL -> 아티클 스크랩
- Substack URL -> 뉴스레터 스크랩
- Naver Blog URL -> 블로그 스크랩
- 기타 HTTP URL -> Generic 스크랩 (Readability)
- 단순 "longblack.co" -> 오늘의 기사 자동 감지

### 출력 포맷 기본값
- 포맷 미지정 시 Markdown + PDF 동시 생성
- `-f markdown` -> Markdown만
- `-f pdf` -> PDF만
- `-f epub` -> EPUB만
- `-f json` -> JSON 구조 데이터

### 로그인 처리
- 첫 실행 시 브라우저가 열리며 수동 로그인 필요
- 로그인 세션은 `/auth/chrome-profile/`에 저장
- 세션 문제 시 `/auth/` 폴더 삭제 후 재로그인

### 에러 대응
- 네트워크 에러 -> 자동 3회 재시도 (exponential backoff)
- 로그인 필요 -> 브라우저 열기 및 수동 로그인 대기
- 콘텐츠 없음 -> 셀렉터 변경 가능성 안내
- **에러 힌트 시스템**: 에러 발생 시 해결 방법 자동 안내

## Commands to Use

```bash
# 단일 URL 스크랩
/webfetch:webfetch-scrape <url>

# 오늘의 기사 (롱블랙/TheMiilk)
/webfetch:webfetch-today

# 배치 처리
/webfetch:webfetch-batch <file>

# 파일 검색
/webfetch:webfetch-search <keyword>

# 파일 목록
/webfetch:webfetch-list

# 설정 관리
/webfetch:webfetch-config

# 캐시 관리
/webfetch:webfetch-cache --stats
/webfetch:webfetch-cache --clear
```

## Error Handling

### 프로젝트 미발견
```
Error: webfetch 프로젝트를 찾을 수 없습니다

-> 프로젝트 경로 확인: ~/elon/ai/projects/webfetch
```

### 로그인 실패
```
Error: Login required
Hint: auth/ 폴더를 삭제 후 재로그인하거나 --keep-open으로 디버그

-> /auth/ 폴더 삭제 후 재실행
-> --keep-open 플래그로 브라우저 상태 확인
```

### 콘텐츠 추출 실패
```
Error: Could not find article content
Hint: 사이트 구조 변경 가능. --keep-open으로 페이지 확인

-> 사이트 구조 변경 가능성
-> --keep-open으로 페이지 구조 확인
-> adapter CONFIG 셀렉터 업데이트 필요
```

### Paywall 감지
```
Error: Paywall detected
Hint: 유료 구독이 필요한 콘텐츠입니다

-> 해당 사이트 로그인/구독 필요
-> --keep-open으로 브라우저에서 로그인
```

## Resources

- [CLAUDE.md](../../CLAUDE.md) - 개발자 가이드
- [README.md](../../README.md) - 사용자 가이드
- [webfetch project](~/elon/ai/projects/webfetch) - 프로젝트 소스
