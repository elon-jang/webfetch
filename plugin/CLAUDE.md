# Webfetch Plugin - Developer Guide

## Overview

webfetch는 다양한 웹사이트의 기사/콘텐츠를 스크랩하여 Markdown/PDF/EPUB으로 저장하는 CLI 도구의 Claude Code 플러그인입니다.

지원 사이트: YouTube(LiveWiki 경유), Longblack, TheMiilk, Medium, Substack, Naver Blog, 모든 HTTP/HTTPS URL(Generic)

> **소스코드/테스트/스펙은 CLI 프로젝트 참조**: `~/elon/ai/projects/webfetch`
> 이 플러그인은 CLI를 호출하는 래퍼이며, 자체 소스코드는 없습니다.

## Plugin Structure

```
plugin/
├── .claude-plugin/
│   └── plugin.json          # Plugin manifest
├── commands/
│   ├── webfetch-scrape.md   # Single URL scrape
│   ├── webfetch-today.md    # Today's article (Longblack/TheMiilk)
│   ├── webfetch-batch.md    # Batch processing
│   ├── webfetch-cache.md    # Cache management
│   ├── webfetch-search.md   # Search scraped files
│   ├── webfetch-list.md     # List scraped files
│   └── webfetch-config.md   # Configuration management
├── skills/
│   └── webfetch-assistant/
│       └── SKILL.md         # Auto-activation skill
├── CLAUDE.md                # This file
└── README.md                # User guide
```

## Commands

| Command | Description |
|---------|-------------|
| `webfetch-scrape` | URL 스크랩 (YouTube/Longblack/TheMiilk/Medium/Substack/Naver/Generic) |
| `webfetch-today` | 롱블랙/TheMiilk 오늘의 기사 자동 스크랩 |
| `webfetch-batch` | URL 파일 일괄 처리 (속도 제한 지원) |
| `webfetch-cache` | 캐시 관리 (통계/삭제) |
| `webfetch-search` | 스크랩된 파일 키워드 검색 |
| `webfetch-list` | 스크랩된 파일 목록/필터링 |
| `webfetch-config` | 설정 조회/초기화/편집 |

## Key Dependencies

- **webfetch project**: `~/elon/ai/projects/webfetch`
- **Node.js**: CLI 실행
- **Playwright**: 브라우저 자동화 (chromium, firefox)
- **Commander.js**: CLI 프레임워크
- **@mozilla/readability + linkedom**: Generic adapter 콘텐츠 추출
- **turndown-plugin-gfm**: GFM 테이블 지원
- **epub-gen-memory**: EPUB 생성

## Architecture

플러그인은 webfetch CLI를 호출하는 래퍼입니다:
- Commands -> `node src/index.js` 호출
- Skill -> 자연어 요청을 적절한 command로 라우팅

### 알려진 제한: 하드코딩 경로

현재 commands 7개 + SKILL.md에서 `~/elon/ai/projects/webfetch` 경로를 하드코딩 (19곳).
다른 사용자 머신에서는 동작하지 않음 — 범용 배포 불가.

**개선 계획 (Phase 6)**: `.mcp.json` + `setup.sh` 방식으로 전환 예정.
- CLI의 MCP 서버 (6개 도구)를 `.mcp.json`으로 자동 연결
- `setup.sh`로 CLI 자동 설치 (`~/.webfetch/`)
- 하드코딩 경로 → `${WEBFETCH_HOME:-$HOME/.webfetch}` 환경변수로 치환
- 상세: CLI 프로젝트 `PLAN.md` Phase 6 참조

### Adapter Pattern
webfetch는 사이트별 adapter를 사용:
- `livewiki.js` - YouTube/LiveWiki 스크랩
- `longblack.js` - Longblack 기사 스크랩
- `themiilk.js` - TheMiilk 기사 스크랩
- `medium.js` - Medium 아티클 스크랩
- `substack.js` - Substack 뉴스레터 스크랩
- `naver.js` - Naver Blog 스크랩
- `generic.js` - 범용 URL 스크랩 (catch-all, Readability 기반)
- 새 사이트 추가: `/src/adapters/`에 adapter 구현

### Output Format
- 기본: Markdown + PDF 동시 생성
- 추가: EPUB 포맷 지원
- 파일명: `YYYY-MM-DD_제목.ext` (커스텀 템플릿 지원)
- 출력 디렉토리: `output/{Source}/{Year}/`
- Obsidian 호환 모드 (`--obsidian`)
- GFM 테이블 보존
- 이미지 로컬 다운로드 (`--download-images`)

## Adding New Commands

1. `commands/` 에 새 `.md` 파일 생성
2. YAML frontmatter 포함 (name, description, argument-hint, allowed-tools)
3. Workflow 단계별 설명
4. 필요시 SKILL.md에 트리거 조건 추가

## Troubleshooting

### 브라우저 프로필 문제
```bash
# 세션 초기화
rm -rf ~/elon/ai/projects/webfetch/auth/chrome-profile/
```

### Playwright 설치
```bash
cd ~/elon/ai/projects/webfetch && npx playwright install chromium firefox
```
