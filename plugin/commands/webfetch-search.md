---
name: webfetch-search
description: 스크랩된 파일에서 키워드를 검색합니다
argument-hint: "<keyword>"
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
---

# Webfetch Search

스크랩된 output/ 디렉토리에서 키워드를 검색합니다.

## Workflow

Execute the following steps in order:

### 0. Detect Project Root

```bash
WEBFETCH_ROOT=~/elon/ai/projects/webfetch
```

### 1. Validate Keyword

사용자가 검색 키워드를 제공했는지 확인합니다.

키워드가 없으면:
- 사용자에게 검색 키워드를 물어봅니다

### 2. Search Files

output/ 디렉토리에서 Markdown 파일을 검색합니다:

Use the **Grep** tool to search for the keyword in `~/elon/ai/projects/webfetch/output/` directory, filtering to `*.md` files.

### 3. Display Results

검색 결과를 표시합니다:
```
Search results for "keyword":

1. output/LongBlack/2026/2026-01-26_기사_제목.md
   - Line 15: ...matching context...
   - Line 42: ...matching context...

2. output/YouTube/2026/2026-01-25_영상_제목.md
   - Line 8: ...matching context...

Total: N files, M matches
```

매칭된 파일이 없으면:
- "검색 결과가 없습니다" 표시
- 다른 키워드 제안

## Examples

```bash
# 키워드 검색
/webfetch:webfetch-search AI

# 특정 주제 검색
/webfetch:webfetch-search "인공지능"

# 저자 검색
/webfetch:webfetch-search "홍길동"
```
