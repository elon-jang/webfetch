#!/usr/bin/env node

/**
 * upload-to-gdrive.js
 * output/ 폴더의 기존 파일들을 Google Drive에 일괄 업로드.
 * 소스별 폴더 라우팅 적용 (LongBlack/2026 등).
 *
 * Usage:
 *   node scripts/upload-to-gdrive.js              # dry-run
 *   node scripts/upload-to-gdrive.js --apply      # 실제 업로드
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import gdriveHandler, { findOrCreateFolder, findExistingFile } from '../src/outputs/gdrive.js';
import { SOURCE_FOLDER_NAMES } from '../src/utils/routing.js';

/** Base folder name on Google Drive (not an ID — findOrCreateFolder creates it by name) */
const DRIVE_BASE_FOLDER = 'Webfetch';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'output');
const DRY_RUN = !process.argv.includes('--apply');

if (DRY_RUN) {
  console.log('=== DRY RUN (업로드 대상만 표시, --apply로 실제 업로드) ===\n');
}

// Reverse map: URL pattern → source folder name
const URL_TO_SOURCE = {
  'longblack.co': 'LongBlack',
  'livewiki.com': 'YouTube',
  'youtube.com': 'YouTube',
  'youtu.be': 'YouTube',
  'themiilk.com': 'TheMiilk',
  'medium.com': 'Medium',
  'substack.com': 'Substack',
  'blog.naver.com': 'NaverBlog',
};

/**
 * Determine source folder from URL
 */
function getSourceFromUrl(url) {
  if (!url) return 'General';
  for (const [domain, source] of Object.entries(URL_TO_SOURCE)) {
    if (url.includes(domain)) return source;
  }
  return 'General';
}

/**
 * Extract year from filename date prefix
 */
function getYearFromFilename(filename) {
  const match = filename.match(/^(\d{4})-/);
  return match ? match[1] : new Date().getFullYear().toString();
}

/**
 * Parse frontmatter to get URL
 */
function getUrlFromMd(mdPath) {
  try {
    const content = readFileSync(mdPath, 'utf-8');
    const match = content.match(/^url:\s*(.+)$/m);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

/**
 * Recursively find all output files
 */
function findOutputFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...findOutputFiles(fullPath));
    } else if (/\.(md|pdf|json|epub)$/.test(entry)) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Group files by base name (same title, different extensions)
 */
function groupFiles(files) {
  const groups = new Map();

  for (const filePath of files) {
    const dir = dirname(filePath);
    const ext = extname(filePath);
    const base = basename(filePath, ext);
    const key = join(dir, base);

    if (!groups.has(key)) {
      groups.set(key, { base, dir, files: [] });
    }
    groups.get(key).files.push(filePath);
  }

  return Array.from(groups.values());
}

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  const allFiles = findOutputFiles(OUTPUT_DIR);
  console.log(`Found ${allFiles.length} files in output/\n`);

  const groups = groupFiles(allFiles);

  let uploaded = 0;
  let skippedExisting = 0;
  let failed = 0;

  for (const group of groups) {
    const { base, files } = group;

    // Find the .md file to extract URL for source detection
    const mdFile = files.find(f => f.endsWith('.md'));
    const url = mdFile ? getUrlFromMd(mdFile) : null;
    const source = getSourceFromUrl(url);
    const year = getYearFromFilename(basename(files[0]));

    // Drive folder: Webfetch/Source/Year (human-readable name, not ID)
    const driveFolder = `${DRIVE_BASE_FOLDER}/${source}/${year}`;

    console.log(`→ ${base}`);
    console.log(`  Source: ${source} | Year: ${year}`);
    console.log(`  Drive: ${driveFolder}/`);

    for (const filePath of files) {
      const filename = basename(filePath);
      const ext = extname(filePath);

      if (DRY_RUN) {
        console.log(`  📤 Would upload: ${filename}`);
        uploaded++;
      } else {
        try {
          const content = readFileSync(filePath);
          const result = await gdriveHandler.save(content, filename, {
            driveFolder,
            driveOverwrite: false,
          });
          console.log(`  📤 Uploaded: ${filename} → ${result.url || result.id}`);
          uploaded++;
        } catch (error) {
          console.log(`  ❌ Failed: ${filename} — ${error.message}`);
          failed++;
        }
      }
    }

    console.log();
  }

  console.log('═'.repeat(50));
  console.log(`Summary: ${allFiles.length} files`);
  console.log(`  Uploaded:  ${uploaded}`);
  console.log(`  Skipped:   ${skippedExisting} (already exists)`);
  console.log(`  Failed:    ${failed}`);
  if (DRY_RUN) {
    console.log('\n⚡ Run with --apply to upload');
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
