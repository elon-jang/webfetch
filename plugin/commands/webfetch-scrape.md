---
name: webfetch-scrape
description: URL을 스크랩하여 Markdown/PDF로 저장합니다 (YouTube, LiveWiki, Longblack)
argument-hint: "<url> [options]"
allowed-tools:
  - Bash
  - Read
  - Glob
---

# Webfetch Scrape

URL을 스크랩하여 Markdown과 PDF로 저장합니다.

## Workflow

Execute the following steps in order:

### 0. Detect Project Root

```bash
WEBFETCH_ROOT=$(find ~/elon/ai/projects/webfetch -name "index.js" -path "*/src/*" -exec dirname {} \; | head -1 | xargs dirname)
```

If not found:
- Display error: "Error: webfetch 프로젝트를 찾을 수 없습니다."
- Stop execution

### 1. Validate URL

Check if the user provided a URL argument. Supported URL patterns:
- YouTube: `https://youtube.com/watch?v=*`, `https://youtu.be/*`
- LiveWiki: `https://livewiki.com/*/content/*`
- Longblack: `https://longblack.co/note/*`
- TheMiilk: `https://themiilk.com/articles/*`
- Medium: `https://medium.com/@user/*`, `https://*.medium.com/*`
- Substack: `https://*.substack.com/p/*`
- Naver Blog: `https://blog.naver.com/*`
- Any HTTP/HTTPS URL (generic fallback)

If no URL provided:
- Ask user for the URL to scrape

### 2. Execute Scrape

Run the webfetch CLI:

```bash
cd "$WEBFETCH_ROOT" && node src/index.js "<url>"
```

**Default behavior** (no format flag):
- Outputs both Markdown (.md) and PDF (.pdf) files
- Files saved to `output/` directory with format: `YYYY-MM-DD_제목.ext`

**Optional format flags**:
- `-f markdown` - Markdown only
- `-f pdf` - PDF only
- `-f epub` - EPUB only
- `-f json` - JSON only
- `-o <path>` - Custom output path

**Browser options**:
- `--keep-open` - Keep browser open after scrape (useful for debugging)
- `--headless` - Run headless (not recommended for login-required sites)
- `--no-cache` - Skip cache, always fetch fresh
- `--proxy <url>` - Use proxy server

**Content options**:
- `--download-images` - Download images locally
- `--obsidian` - Add Obsidian-compatible frontmatter tags
- `--filename-template <pattern>` - Custom filename (vars: `{date}`, `{title}`, `{source}`, `{author}`)

### 3. Report Results

After successful scrape, display:
```
Scraping complete!

Saved files:
- output/YYYY-MM-DD_제목.md
- output/YYYY-MM-DD_제목.pdf
```

If scrape fails:
- Show error message from CLI output
- Suggest `--keep-open` flag for debugging
- For login issues, suggest deleting `/auth/` folder to reset sessions

## Examples

```bash
# YouTube video summary
/webfetch:webfetch-scrape https://youtu.be/VIDEO_ID

# Longblack article
/webfetch:webfetch-scrape https://longblack.co/note/1872

# Medium article
/webfetch:webfetch-scrape https://medium.com/@user/article-title

# Substack post
/webfetch:webfetch-scrape https://newsletter.substack.com/p/post-title

# Naver Blog
/webfetch:webfetch-scrape https://blog.naver.com/user/12345

# Any URL (generic)
/webfetch:webfetch-scrape https://example.com/article

# EPUB format
/webfetch:webfetch-scrape https://longblack.co/note/1872 -f epub

# With images download
/webfetch:webfetch-scrape https://medium.com/@user/article --download-images

# Obsidian mode
/webfetch:webfetch-scrape https://longblack.co/note/1872 --obsidian

# With debugging
/webfetch:webfetch-scrape https://longblack.co/note/1872 --keep-open
```
