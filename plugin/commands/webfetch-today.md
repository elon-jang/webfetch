---
name: webfetch-today
description: 롱블랙/TheMiilk 오늘의 기사를 자동으로 찾아 스크랩합니다
argument-hint: "[--source longblack|themiilk] [options]"
allowed-tools:
  - Bash
  - Read
  - Glob
---

# Webfetch Today

롱블랙 또는 TheMiilk 홈페이지에서 오늘의 기사를 자동으로 찾아 스크랩합니다.

## Workflow

Execute the following steps in order:

### 0. Detect Project Root

```bash
WEBFETCH_ROOT=$(find ~/elon/ai/projects/webfetch -name "index.js" -path "*/src/*" -exec dirname {} \; | head -1 | xargs dirname)
```

### 1. Check Existing Article

Check if today's article has already been scraped:

```bash
cd "$WEBFETCH_ROOT" && ls output/$(date +%Y-%m-%d)_* 2>/dev/null
```

If files exist:
- Display: "오늘의 기사가 이미 스크랩되어 있습니다:"
- List existing files
- Ask user if they want to re-scrape anyway

### 2. Execute Scrape

Determine the source (default: longblack):
- `--source longblack` (기본): 롱블랙 홈페이지
- `--source themiilk`: TheMiilk 홈페이지

**Longblack:**
```bash
cd "$WEBFETCH_ROOT" && node src/index.js "https://longblack.co" --no-cache
```

**TheMiilk:**
```bash
cd "$WEBFETCH_ROOT" && node src/index.js "https://themiilk.com" --no-cache
```

This will:
1. Open the homepage
2. Auto-detect today's/latest article
3. Navigate to the article page
4. Extract content
5. Save as both Markdown and PDF

**With skip-existing flag** (for cron/automation):
```bash
cd "$WEBFETCH_ROOT" && node src/index.js "https://longblack.co" --skip-existing --no-cache
```

### 3. Report Results

After successful scrape, display:
```
Today's article scraped!

Title: [기사 제목]
Saved files:
- output/YYYY-MM-DD_제목.md
- output/YYYY-MM-DD_제목.pdf
```

Read the saved markdown file to show a brief summary (first 5 lines of content).

### 4. Login Handling

If login is required:
- Browser will open automatically for manual login
- Wait up to 5 minutes for user to complete login
- After login, scraping continues automatically

If login keeps failing:
- Suggest deleting `/auth/chrome-profile/` to reset session
- Suggest using `--keep-open` to debug

## Cron Setup

For daily automated scraping:
```bash
# 매일 오전 9시 실행
0 9 * * * cd /path/to/webfetch && node src/index.js "https://longblack.co" --skip-existing --no-cache >> ~/logs/webfetch.log 2>&1
```

## Examples

```bash
# 오늘의 기사 스크랩
/webfetch:webfetch-today

# 이미 있어도 다시 스크랩
/webfetch:webfetch-today --no-cache
```
