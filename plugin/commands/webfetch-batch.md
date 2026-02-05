---
name: webfetch-batch
description: 여러 URL을 파일에서 읽어 일괄 스크랩합니다
argument-hint: "<file> [options]"
allowed-tools:
  - Bash
  - Read
  - Write
  - Glob
---

# Webfetch Batch

URL 목록 파일에서 여러 URL을 읽어 일괄 스크랩합니다.

## Workflow

Execute the following steps in order:

### 0. Detect Project Root

```bash
WEBFETCH_ROOT=$(find ~/elon/ai/projects/webfetch -name "index.js" -path "*/src/*" -exec dirname {} \; | head -1 | xargs dirname)
```

### 1. Prepare URL File

If user provides a file path, validate it exists.

If user provides URLs directly (not a file):
- Create a temporary URL file
- Write each URL on a separate line

**URL file format** (one URL per line, `#` for comments):
```
# YouTube videos
https://youtu.be/VIDEO_ID_1
https://youtu.be/VIDEO_ID_2

# Longblack articles
https://longblack.co/note/1868
https://longblack.co/note/1872
```

### 2. Execute Batch

```bash
cd "$WEBFETCH_ROOT" && node src/index.js batch "<file>"
```

**Options**:
- `-f, --format <type>` - Output format (markdown, json, pdf, epub). Default: both md+pdf
- `-o, --output-dir <path>` - Output directory
- `--no-cache` - Skip cache
- `--stop-on-error` - Stop on first error
- `--skip-existing` - Skip if already scraped today
- `--report <path>` - Save batch report JSON
- `--rate-limit <ms>` - Minimum delay between requests in ms (default: 2000)

**Recommended for full report**:
```bash
cd "$WEBFETCH_ROOT" && node src/index.js batch "<file>" --report batch-report.json
```

### 3. Report Results

Display batch processing summary:
```
Batch complete!

Total: N URLs
Success: X
Failed: Y
Skipped: Z

Report saved to: batch-report.json
```

If report file exists, read and display details of any failures.

## Examples

```bash
# Process URL file
/webfetch:webfetch-batch urls.txt

# With error stop and report
/webfetch:webfetch-batch urls.txt --stop-on-error --report report.json

# Skip already scraped URLs
/webfetch:webfetch-batch urls.txt --skip-existing
```
