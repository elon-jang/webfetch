---
name: webfetch-list
description: 스크랩된 파일 목록을 표시합니다
argument-hint: "[--source <name>] [--date <YYYY-MM-DD>]"
allowed-tools:
  - Bash
  - Read
  - Glob
---

# Webfetch List

output/ 디렉토리의 스크랩된 파일 목록을 표시합니다. source별/날짜별 필터링을 지원합니다.

## Workflow

Execute the following steps in order:

### 0. Detect Project Root

```bash
WEBFETCH_ROOT=~/elon/ai/projects/webfetch
```

### 1. Parse Options

사용자가 제공한 옵션을 파싱합니다:
- `--source <name>`: 소스별 필터 (LongBlack, YouTube, TheMiilk, Medium, Substack, NaverBlog, General)
- `--date <YYYY-MM-DD>`: 날짜별 필터
- 옵션 없으면: 전체 목록

### 2. List Files

Use the **Glob** tool to find files in `~/elon/ai/projects/webfetch/output/`:

- 전체: `output/**/*.{md,pdf,epub}`
- Source 필터: `output/<SourceName>/**/*.{md,pdf,epub}`
- Date 필터: `output/**/<YYYY-MM-DD>_*`

### 3. Display Results

파일 목록을 표시합니다:
```
Scraped files:

LongBlack (3 files):
  2026-02-05_기사_제목.md (12.5 KB)
  2026-02-05_기사_제목.pdf (45.2 KB)
  2026-02-04_어제_기사.md (10.1 KB)

YouTube (2 files):
  2026-02-03_영상_제목.md (8.7 KB)
  2026-02-03_영상_제목.pdf (32.4 KB)

Total: 5 files
```

## Examples

```bash
# 전체 파일 목록
/webfetch:webfetch-list

# 롱블랙 파일만
/webfetch:webfetch-list --source LongBlack

# 오늘 스크랩한 파일
/webfetch:webfetch-list --date 2026-02-05

# Medium 파일만
/webfetch:webfetch-list --source Medium
```
