# Webfetch v1.1.0 - 수동 테스트 시나리오

모든 테스트는 `~/elon/ai/projects/webfetch` 에서 실행.

---

## 0. Smoke Test (빠른 확인)

```bash
# 어댑터 목록 - 7개 표시되어야 함
node src/index.js list

# 사이트 접근성 체크
node src/index.js check

# 도움말
node src/index.js --help
```

**기대 결과:**
- `list`: livewiki, longblack, themiilk, medium, substack, naver, generic 출력
- `check`: 각 사이트 OK/FAIL 표시 (네트워크 상태에 따라 다름)

---

## 1. Generic Adapter (Phase 1.1)

### 1-1. Lightweight 추출 (브라우저 없이)

```bash
# 위키피디아 - SSR 사이트, lightweight로 충분
node src/index.js "https://en.wikipedia.org/wiki/Web_scraping" -f markdown
```

**기대 결과:**
- 브라우저 없이 빠르게 추출
- `output/General/2026/2026-02-05_Web_scraping.md` 생성
- frontmatter에 title, url, scraped_at 포함

### 1-2. 브라우저 Fallback

```bash
# JavaScript 렌더링 필요한 사이트 (SPA 등)
node src/index.js "https://news.ycombinator.com" -f markdown --no-cache
```

**기대 결과:**
- lightweight 실패 시 자동으로 브라우저 fallback
- 로그에 "falling back to browser" 메시지
- Markdown 파일 생성

### 1-3. 존재하지 않는 URL

```bash
node src/index.js "https://httpstat.us/404" -f markdown
```

**기대 결과:**
- ContentError 또는 적절한 에러 메시지
- 힌트 메시지 표시

---

## 2. Error Hint 시스템 (Phase 1.2)

### 2-1. 인증 에러 힌트

```bash
# 403 응답을 반환하는 URL
node src/index.js "https://httpstat.us/403" -f markdown
```

**기대 결과:**
- `[AUTH_ERROR]` 또는 `[CONTENT_ERROR]` 메시지
- `Hint:` 줄에 사용자 친화적 안내 표시

### 2-2. 빈 문자열 입력

```bash
node src/index.js "" -f markdown
```

**기대 결과:**
- 에러 메시지 (어댑터를 찾을 수 없음)

---

## 3. Rate Limiting (Phase 1.3)

### 3-1. 배치 파일 생성 후 속도 제한 테스트

```bash
# 테스트용 URL 파일 생성
cat > /tmp/webfetch-test-urls.txt << 'EOF'
# Rate limit test
https://en.wikipedia.org/wiki/Web_scraping
https://en.wikipedia.org/wiki/Data_mining
EOF

# 속도 제한 3초로 배치 실행 (같은 도메인이므로 지연 발생)
node src/index.js batch /tmp/webfetch-test-urls.txt -f markdown --rate-limit 3000 --no-cache
```

**기대 결과:**
- 첫 URL 즉시 처리
- 두 번째 URL은 ~3초 후 처리 (같은 도메인)
- 배치 결과 요약 출력

### 3-2. 다른 도메인은 지연 없음

```bash
cat > /tmp/webfetch-test-mixed.txt << 'EOF'
https://en.wikipedia.org/wiki/Web_scraping
https://news.ycombinator.com
EOF

node src/index.js batch /tmp/webfetch-test-mixed.txt -f markdown --rate-limit 5000 --no-cache
```

**기대 결과:**
- 두 URL 모두 빠르게 처리 (도메인이 다르므로 속도 제한 미적용)

---

## 4. Medium Adapter (Phase 2.1)

```bash
# Medium 공개 글 (member-only가 아닌 것)
node src/index.js "https://medium.com/free-code-camp/the-best-way-to-learn-to-code-c8b52f34db5f" -f markdown --no-cache
```

**기대 결과:**
- `output/Medium/2026/` 에 파일 생성
- metadata에 author, publication 포함
- lightweight 추출 성공 시 브라우저 미사용

### 4-1. Member-only 감지

```bash
# member-only 콘텐츠 (paywall)
node src/index.js "https://medium.com/@user/some-premium-article" -f markdown
```

**기대 결과:**
- AuthError + "Medium 유료 회원 전용" 힌트

---

## 5. Substack Adapter (Phase 2.2)

```bash
# 공개 Substack 포스트
node src/index.js "https://newsletter.pragmaticengineer.com/p/what-is-old-is-new-again" -f markdown --no-cache
```

**기대 결과:**
- `output/Substack/2026/` 에 파일 생성
- metadata에 author, publication 포함

---

## 6. Naver Blog Adapter (Phase 2.3)

```bash
# 네이버 블로그 포스트
node src/index.js "https://blog.naver.com/naver_diary/223741397267" -f markdown --no-cache
```

**기대 결과:**
- 브라우저 자동 실행 (iframe 구조)
- `output/NaverBlog/2026/` 에 파일 생성
- iframe 내부 콘텐츠 정상 추출

---

## 7. GFM 테이블 보존 (Phase 3.1)

```bash
# 테이블이 포함된 위키피디아 페이지
node src/index.js "https://en.wikipedia.org/wiki/Comparison_of_programming_languages" -f markdown --no-cache
```

**기대 결과:**
- 생성된 .md 파일에 Markdown 테이블(`| col | col |`) 형식 포함
- 이전에는 테이블이 깨졌을 것

### 7-1. 확인 방법

```bash
# 테이블 파이프 문자 존재 확인
grep '|' output/General/2026/2026-02-05_Comparison*.md | head -5
```

---

## 8. EPUB 포맷 (Phase 3.2)

```bash
node src/index.js "https://en.wikipedia.org/wiki/Web_scraping" -f epub --no-cache
```

**기대 결과:**
- `output/General/2026/2026-02-05_Web_scraping.epub` 생성
- 파일 크기 > 0
- EPUB 리더에서 열 수 있어야 함

### 8-1. 확인 방법

```bash
# EPUB은 ZIP 포맷 - 유효한 ZIP인지 확인
file output/General/2026/2026-02-05_Web_scraping.epub
# -> "Zip archive data" 표시되어야 함
```

---

## 9. 이미지 다운로드 (Phase 3.3)

```bash
node src/index.js "https://en.wikipedia.org/wiki/Cat" -f markdown --download-images --no-cache
```

**기대 결과:**
- `output/General/2026/images/` 폴더에 이미지 파일 저장
- .md 파일 내 img src가 `images/xxxx.jpg` 형태의 로컬 경로
- 로그에 "Downloading N images" 메시지

### 9-1. 확인 방법

```bash
ls output/General/2026/images/
grep 'images/' output/General/2026/2026-02-05_Cat.md | head -3
```

---

## 10. 커스텀 파일명 (Phase 3.4)

```bash
node src/index.js "https://en.wikipedia.org/wiki/Web_scraping" -f markdown \
  --filename-template "{source}_{date}_{title}" --no-cache
```

**기대 결과:**
- 파일명이 `generic_2026-02-05_Web_scraping.md` 형태
- 기본 `{date}_{title}` 대신 커스텀 패턴 적용

---

## 11. Obsidian 호환 (Phase 3.5)

```bash
node src/index.js "https://en.wikipedia.org/wiki/Web_scraping" -f markdown --obsidian --no-cache
```

**기대 결과:**
- frontmatter에 `tags: [webfetch]` 포함
- frontmatter에 `aliases: ["Web scraping"]` 포함

### 11-1. 확인 방법

```bash
head -15 output/General/2026/2026-02-05_Web_scraping.md
# tags: 와 aliases: 라인이 보여야 함
```

---

## 12. Proxy 지원 (Phase 5.1)

```bash
# 프록시 없이 (기본 동작 확인)
node src/index.js "https://en.wikipedia.org/wiki/Proxy_server" -f markdown --no-cache

# 프록시 설정 (실제 프록시 서버가 있을 때만)
# node src/index.js "https://example.com" -f markdown --proxy http://localhost:8080
```

**기대 결과:**
- `--proxy` 없이는 정상 동작
- `--proxy` 있으면 브라우저가 프록시 경유 (프록시 서버 필요)

---

## 13. Health Check (Phase 5.2)

```bash
node src/index.js check
```

**기대 결과:**
```
Checking adapter sites...
  ✓ livewiki: OK (200)
  ✓ longblack: OK (200)
  ✓ themiilk: OK (200)
  ✓ medium: OK (200)
  ✓ substack: OK (200)
  ✓ naver: OK (200)
```

---

## 14. 복합 시나리오

### 14-1. 전체 포맷 동시 생성 (기본 동작)

```bash
node src/index.js "https://en.wikipedia.org/wiki/Markdown" --no-cache
```

**기대 결과:**
- .md + .pdf 두 파일 동시 생성
- 둘 다 `output/General/2026/` 에 위치

### 14-2. Google Drive 업로드 (OAuth 설정된 경우만)

```bash
node src/index.js "https://en.wikipedia.org/wiki/Web_scraping" \
  --save-to local,gdrive --no-cache
```

### 14-3. 배치 + 리포트 + EPUB

```bash
cat > /tmp/webfetch-epub-batch.txt << 'EOF'
https://en.wikipedia.org/wiki/Web_scraping
https://en.wikipedia.org/wiki/Data_mining
EOF

node src/index.js batch /tmp/webfetch-epub-batch.txt \
  -f epub --report /tmp/epub-report.json --rate-limit 2000 --no-cache
```

**기대 결과:**
- 2개 EPUB 파일 생성
- `/tmp/epub-report.json`에 배치 리포트

---

## 15. 기존 기능 회귀 테스트

기존 기능이 깨지지 않았는지 확인:

### 15-1. Longblack (기존)

```bash
# 홈페이지 → 오늘의 기사 자동 감지 (로그인 필요)
node src/index.js "https://longblack.co" --no-cache
```

### 15-2. TheMiilk (기존)

```bash
node src/index.js "https://themiilk.com" --no-cache
```

### 15-3. 캐시

```bash
# 캐시 통계
node src/index.js cache --stats

# 캐시 삭제
node src/index.js cache --clear
```

### 15-4. 설정

```bash
node src/index.js config --show
```

---

## 테스트 결과 체크리스트

| # | 시나리오 | 결과 | 비고 |
|---|---------|------|------|
| 0 | Smoke test (list, check) | | |
| 1-1 | Generic lightweight | | |
| 1-2 | Generic browser fallback | | |
| 1-3 | 404 URL 에러 | | |
| 2-1 | Error hint 표시 | | |
| 3-1 | Rate limit (같은 도메인) | | |
| 3-2 | Rate limit (다른 도메인) | | |
| 4 | Medium adapter | | |
| 5 | Substack adapter | | |
| 6 | Naver Blog adapter | | |
| 7 | GFM 테이블 | | |
| 8 | EPUB 포맷 | | |
| 9 | 이미지 다운로드 | | |
| 10 | 커스텀 파일명 | | |
| 11 | Obsidian 모드 | | |
| 12 | Proxy (옵션) | | |
| 13 | Health check | | |
| 14-1 | MD+PDF 동시 생성 | | |
| 14-3 | 배치 + EPUB | | |
| 15-1 | Longblack 회귀 | | |
| 15-2 | TheMiilk 회귀 | | |
| 15-3 | 캐시 기능 | | |
| 15-4 | 설정 기능 | | |

---

## 빠른 전체 테스트 (5분 코스)

가장 중요한 것만 빠르게:

```bash
cd ~/elon/ai/projects/webfetch

# 1. 어댑터 목록 (7개)
node src/index.js list

# 2. Health check
node src/index.js check

# 3. Generic adapter - Wikipedia
node src/index.js "https://en.wikipedia.org/wiki/Web_scraping" -f markdown --no-cache

# 4. EPUB 포맷
node src/index.js "https://en.wikipedia.org/wiki/Markdown" -f epub --no-cache

# 5. Obsidian 모드
node src/index.js "https://en.wikipedia.org/wiki/Note-taking" -f markdown --obsidian --no-cache

# 6. 결과 확인
ls -la output/General/2026/
head -15 output/General/2026/*Web_scraping.md
file output/General/2026/*Markdown.epub
head -15 output/General/2026/*Note-taking.md
```
