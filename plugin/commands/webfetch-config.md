---
name: webfetch-config
description: webfetch 설정을 조회하거나 초기화합니다
argument-hint: "[--show|--init|--edit]"
allowed-tools:
  - Bash
  - Read
  - Edit
---

# Webfetch Config

webfetch 설정 파일을 관리합니다.

## Workflow

Execute the following steps in order:

### 0. Detect Project Root

```bash
WEBFETCH_ROOT=~/elon/ai/projects/webfetch
```

### 1. Parse Action

사용자가 요청한 액션을 파악합니다:
- `--show` (기본): 현재 설정 표시
- `--init`: 설정 파일 생성
- `--edit`: 설정 파일 편집

### 2. Execute Action

**--show (기본)**:
```bash
cd "$WEBFETCH_ROOT" && node src/index.js config --show
```

**--init**:
```bash
cd "$WEBFETCH_ROOT" && node src/index.js config --init
```

**--edit**:
Use the **Read** tool to read the config file, then use the **Edit** tool to modify it.

설정 파일 위치 (우선순위):
1. `$WEBFETCH_ROOT/webfetch.config.js`
2. `$WEBFETCH_ROOT/webfetch.config.json`
3. `~/.webfetchrc.json`

### 3. Display Results

현재 설정을 표시합니다:
```
Webfetch Configuration:

browser: chrome
format: (both md + pdf)
saveTo: local
headless: false
cacheMaxAge: 24h
driveFolder: (default ID)
```

## Examples

```bash
# 현재 설정 보기
/webfetch:webfetch-config

# 설정 파일 생성
/webfetch:webfetch-config --init

# 설정 편집
/webfetch:webfetch-config --edit
```
