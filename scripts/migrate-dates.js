#!/usr/bin/env node

/**
 * migrate-dates.js
 * 기존 output 파일들의 파일명을 글 작성일(publish date) 기준으로 변경하고,
 * markdown frontmatter에 date: 필드를 추가한다.
 *
 * Longblack/TheMiilk 등 페이월 사이트는 저장된 브라우저 세션으로 접근.
 *
 * Usage:
 *   node scripts/migrate-dates.js              # dry-run (변경 사항만 출력)
 *   node scripts/migrate-dates.js --apply      # 실제 변경 적용
 */

import { readdirSync, readFileSync, writeFileSync, renameSync, existsSync, statSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import { normalizeDate } from '../src/utils/filename.js';
import { launch, getPage, close } from '../src/browser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'output');
const DRY_RUN = !process.argv.includes('--apply');

if (DRY_RUN) {
  console.log('=== DRY RUN (변경 사항만 표시, --apply로 실제 적용) ===\n');
}

/**
 * Recursively find all .md files
 */
function findMdFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...findMdFiles(fullPath));
    } else if (entry.endsWith('.md')) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Parse frontmatter from markdown content
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return { fields: {}, body: content, raw: '' };

  const raw = match[1];
  const body = content.slice(match[0].length);
  const fields = {};

  for (const line of raw.split('\n')) {
    const m = line.match(/^(\w+):\s*(.+)$/);
    if (m) {
      fields[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
    }
  }

  return { fields, body, raw, fullMatch: match[0] };
}

/**
 * Extract publish date from a page using browser (handles paywall sites)
 */
async function fetchPublishDateBrowser(page, url) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    const date = await page.evaluate(() => {
      return document.querySelector('meta[property="article:published_time"]')?.content
        || document.querySelector('meta[property="og:article:published_time"]')?.content
        || document.querySelector('meta[name="DC.date"]')?.content
        || document.querySelector('time[datetime]')?.getAttribute('datetime')
        || document.querySelector('[class*="date"]')?.textContent?.trim()
        || null;
    });

    if (date) {
      return normalizeDate(date);
    }
    return null;
  } catch (error) {
    console.log(`  ⚠ browser fetch failed: ${error.message}`);
    return null;
  }
}

/**
 * Find companion files (pdf, json, epub) that share the same base name
 */
function findCompanionFiles(mdPath) {
  const dir = dirname(mdPath);
  const base = basename(mdPath, '.md');
  const companions = [];

  for (const ext of ['.pdf', '.json', '.epub']) {
    const path = join(dir, base + ext);
    if (existsSync(path)) {
      companions.push(path);
    }
  }

  return companions;
}

/**
 * Replace date prefix in filename
 */
function replaceDateInFilename(filename, oldDate, newDate) {
  if (filename.startsWith(oldDate)) {
    return newDate + filename.slice(oldDate.length);
  }
  return filename;
}

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  const mdFiles = findMdFiles(OUTPUT_DIR);
  console.log(`Found ${mdFiles.length} markdown files\n`);

  // Launch browser once with persistent profile (headless for speed)
  console.log('Launching browser (headless, with stored session)...\n');
  await launch({ browser: 'chrome', headless: true });
  const page = await getPage();

  let renamed = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  try {
    for (const mdPath of mdFiles) {
      const content = readFileSync(mdPath, 'utf-8');
      const { fields, raw, fullMatch } = parseFrontmatter(content);

      const url = fields.url;
      if (!url) {
        console.log(`⊘ SKIP (no URL): ${basename(mdPath)}`);
        skipped++;
        continue;
      }

      // Extract current date from filename
      const fname = basename(mdPath);
      const dateMatch = fname.match(/^(\d{4}-\d{2}-\d{2})_/);
      if (!dateMatch) {
        console.log(`⊘ SKIP (no date prefix): ${fname}`);
        skipped++;
        continue;
      }
      const currentDate = dateMatch[1];

      // Already has date in frontmatter and filename matches?
      if (fields.date) {
        const existingDate = normalizeDate(fields.date);
        if (existingDate && fname.startsWith(existingDate)) {
          console.log(`✓ OK: ${fname} (date: ${existingDate})`);
          skipped++;
          continue;
        }
      }

      // Fetch publish date via browser
      console.log(`→ ${fname}`);
      console.log(`  URL: ${url}`);
      const publishDate = await fetchPublishDateBrowser(page, url);

      if (!publishDate) {
        console.log(`  ⚠ No publish date found — skipping`);
        failed++;
        continue;
      }

      console.log(`  publish date: ${publishDate} (filename: ${currentDate})`);

      // Update frontmatter — add date field
      let currentContent = content;
      const needsFrontmatterUpdate = !fields.date;
      if (needsFrontmatterUpdate) {
        const newRaw = raw.replace(
          /^(scraped_at:.+)$/m,
          `$1\ndate: ${publishDate}`
        );
        currentContent = content.replace(fullMatch, `---\n${newRaw}\n---\n`);

        if (DRY_RUN) {
          console.log(`  📝 Would add frontmatter: date: ${publishDate}`);
        } else {
          writeFileSync(mdPath, currentContent, 'utf-8');
          console.log(`  📝 Added frontmatter: date: ${publishDate}`);
        }
        updated++;
      }

      // Rename if dates differ
      if (publishDate !== currentDate) {
        const companions = findCompanionFiles(mdPath);
        const allFiles = [mdPath, ...companions];

        for (const filePath of allFiles) {
          const dir = dirname(filePath);
          const oldName = basename(filePath);
          const newName = replaceDateInFilename(oldName, currentDate, publishDate);

          if (oldName === newName) continue;

          const newPath = join(dir, newName);

          if (existsSync(newPath)) {
            console.log(`  ⚠ CONFLICT: ${newName} already exists — skipping rename`);
            continue;
          }

          if (DRY_RUN) {
            console.log(`  📁 Would rename: ${oldName} → ${newName}`);
          } else {
            // For .md files with updated frontmatter, write the updated content to new path
            if (filePath === mdPath && needsFrontmatterUpdate) {
              writeFileSync(newPath, currentContent, 'utf-8');
              const { unlinkSync } = await import('fs');
              unlinkSync(filePath);
            } else {
              renameSync(filePath, newPath);
            }
            console.log(`  📁 Renamed: ${oldName} → ${newName}`);
          }
        }
        renamed++;
      } else {
        console.log(`  ✓ Date matches — no rename needed`);
      }

      console.log();
    }
  } finally {
    await close();
  }

  console.log('═'.repeat(50));
  console.log(`Summary: ${mdFiles.length} files processed`);
  console.log(`  Renamed:  ${renamed}`);
  console.log(`  Updated:  ${updated} (frontmatter)`);
  console.log(`  Skipped:  ${skipped}`);
  console.log(`  Failed:   ${failed}`);
  if (DRY_RUN) {
    console.log('\n⚡ Run with --apply to apply changes');
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
