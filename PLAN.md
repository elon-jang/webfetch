# Webfetch Improvement Plan

## Status: Phase 1–5 Complete, Phase 6 Planned

Phase 1–5: new adapters, plugin commands, output/format, infrastructure/stability — 모두 완료.
Phase 6: 플러그인 범용화 (MCP 활용) — 계획 단계.

## Phase 1: Foundation (Generic Adapter + Error Hints + Rate Limiting)

- [x] 1.1 Generic/Readability Fallback Adapter
- [x] 1.2 Error Hint System
- [x] 1.3 Rate Limiting

## Phase 2: New Site-Specific Adapters

- [x] 2.1 Medium Adapter
- [x] 2.2 Substack Adapter
- [x] 2.3 Naver Blog Adapter
- [x] 2.4 Registration (index.js, routing.js)

## Phase 3: Output/Format Improvements

- [x] 3.1 GFM Table Preservation
- [x] 3.2 EPUB Format
- [x] 3.3 Image Downloading
- [x] 3.4 Custom Filename Template
- [x] 3.5 Obsidian Compatibility

## Phase 4: Plugin Command Improvements

- [x] 4.1 webfetch-search command
- [x] 4.2 webfetch-list command
- [x] 4.3 webfetch-config command
- [x] 4.4 Existing command updates
- [x] 4.5 Skill & Manifest updates

## Phase 5: Infrastructure & Stability

- [x] 5.1 Proxy Support
- [x] 5.2 Adapter Health Check
- [x] 5.3 Test Coverage
- [x] 5.4 MCP Tool Updates

## New Dependencies

| Package | Purpose | Phase |
|---------|---------|-------|
| `@mozilla/readability` | Article content extraction | 1 |
| `linkedom` | Server-side DOM for Readability | 1 |
| `turndown-plugin-gfm` | GFM table support | 3 |
| `epub-gen-memory` | EPUB generation | 3 |

## Implementation Order

```
Phase 1 (Foundation) -> Phase 3 (Outputs) -> Phase 2 (Adapters) -> Phase 5 (Infra) -> Phase 4 (Plugin)
```

## Adapter Order (final)

```
[livewiki, longblack, themiilk, medium, substack, naver, generic]
```

## Phase 6: Plugin Portability (MCP + setup.sh)

현재 플러그인은 `~/elon/ai/projects/webfetch` 경로를 9개 파일 19곳에 하드코딩.
다른 사용자 머신에서 동작 불가 — 범용 배포를 위해 구조 개선 필요.

### 현황

- CLI에 MCP 서버 이미 구현됨 (6개 도구: scrape, history, download, cache, search, gdrive_upload)
- Claude Code 플러그인은 `.mcp.json`으로 MCP 서버 선언 가능 (`${CLAUDE_PLUGIN_ROOT}` 변수 지원)
- 하드코딩 경로: commands 7개, SKILL.md 1개, README.md, CLAUDE.md

### 계획: .mcp.json + setup.sh

```
plugins/webfetch/
├── .mcp.json                    ← MCP 서버 → ~/.webfetch/src/index.js mcp
├── scripts/setup.sh             ← git clone + npm install + playwright
├── commands/                    ← 경로를 ${WEBFETCH_HOME:-$HOME/.webfetch}로 치환
├── skills/
└── README.md
```

- [ ] 6.1 `scripts/setup.sh` 작성 — git clone → `~/.webfetch/`, npm install, playwright install
- [ ] 6.2 `.mcp.json` 추가 — `~/.webfetch/src/index.js mcp` 참조
- [ ] 6.3 commands 경로 치환 — 하드코딩 19곳 → `${WEBFETCH_HOME:-$HOME/.webfetch}`
- [ ] 6.4 README/CLAUDE.md 간소화 — 설치: setup.sh 실행 한 줄
- [ ] 6.5 (선택) MCP 도구 보강 — today, batch, config 도구 추가

### MCP 커버리지

| 플러그인 Command | MCP Tool | 상태 |
|-----------------|----------|------|
| webfetch-scrape | webfetch_scrape | ✅ |
| webfetch-today | — | ❌ 미구현 |
| webfetch-batch | — | ❌ 미구현 |
| webfetch-cache | webfetch_cache | ✅ |
| webfetch-search | webfetch_search | ✅ |
| webfetch-list | webfetch_history | ⚠️ 필터링 미지원 |
| webfetch-config | — | ❌ 미구현 |

### 리스크

| 리스크 | 대응 |
|--------|------|
| `${HOME}` 변수가 `.mcp.json`에서 미지원 | setup.sh에서 `.mcp.json` 동적 생성 |
| CLI 업데이트 시 사용자 수동 pull 필요 | setup.sh에 `--update` 옵션 추가 |
| CLI `__dirname` 기반 경로 (output, auth, cache) | `src/utils/paths.js` 추상화 필요 (npm 게시 시) |
