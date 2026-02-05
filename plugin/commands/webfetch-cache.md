---
name: webfetch-cache
description: 캐시를 관리합니다 (통계 조회, 캐시 삭제)
argument-hint: "[--stats|--clear]"
allowed-tools:
  - Bash
  - Read
---

# Webfetch Cache

캐시 통계를 조회하거나 캐시를 삭제합니다.

## Workflow

Execute the following steps in order:

### 0. Detect Project Root

```bash
WEBFETCH_ROOT=$(find ~/elon/ai/projects/webfetch -name "index.js" -path "*/src/*" -exec dirname {} \; | head -1 | xargs dirname)
```

### 1. Determine Action

Based on user intent:

**Show stats** (default):
```bash
cd "$WEBFETCH_ROOT" && node src/index.js cache --stats
```

**Clear cache**:
```bash
cd "$WEBFETCH_ROOT" && node src/index.js cache --clear
```

### 2. Display Results

**For stats**:
```
Cache Statistics

Entries: N
Size: X.XX KB

Recent entries:
- https://longblack.co/note/1872 (cached: 2026-01-26T09:00:00)
- ...
```

**For clear**:
```
Cache cleared successfully.
```

## Notes

- Cache is stored in `.cache/` directory (gitignored)
- Default TTL: 24 hours
- Use `--no-cache` flag on scrape commands to bypass cache
- Use `--cache-max-age <hours>` to customize TTL per request

## Examples

```bash
# 캐시 통계 조회
/webfetch:webfetch-cache --stats

# 캐시 삭제
/webfetch:webfetch-cache --clear
```
