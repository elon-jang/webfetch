#!/usr/bin/env node

/**
 * dedupe-gdrive.js
 * Google Drive에서 날짜 마이그레이션 전후 중복 파일을 감지 및 삭제한다.
 * 같은 제목, 다른 날짜 접두사를 가진 파일 쌍을 찾아 오래된 쪽을 삭제.
 *
 * Usage:
 *   node scripts/dedupe-gdrive.js              # dry-run (중복 감지만)
 *   node scripts/dedupe-gdrive.js --apply      # 실제 삭제
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_DRIVE_FOLDER } from '../src/outputs/gdrive.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOKEN_PATH = join(__dirname, '..', 'auth/gdrive-token.json');
const CREDS_PATH = join(__dirname, '..', 'auth/gdrive-credentials.json');
const DRY_RUN = !process.argv.includes('--apply');

/**
 * Parse filename into { date, title, ext }
 * Expected format: YYYY-MM-DD_title.ext
 */
function parseFilename(name) {
  const match = name.match(/^(\d{4}-\d{2}-\d{2})_(.+)\.(\w+)$/);
  if (!match) return null;
  return { date: match[1], title: match[2], ext: match[3] };
}

async function dedupe() {
  const { google } = await import('googleapis');

  const raw = JSON.parse(readFileSync(CREDS_PATH, 'utf-8'));
  const creds = raw.installed || raw.web;
  const redirectUri = creds.redirect_uris?.[0] || 'http://localhost';

  const oauth2Client = new google.auth.OAuth2(creds.client_id, creds.client_secret, redirectUri);
  oauth2Client.setCredentials(JSON.parse(readFileSync(TOKEN_PATH, 'utf-8')));

  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  // Find the Webfetch root folder
  console.log(`Searching for "${DEFAULT_DRIVE_FOLDER}" folder...\n`);

  const rootRes = await drive.files.list({
    q: `name='${DEFAULT_DRIVE_FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
  });

  if (rootRes.data.files.length === 0) {
    console.log(`No "${DEFAULT_DRIVE_FOLDER}" folder found.`);
    return;
  }

  const rootFolder = rootRes.data.files[0];
  console.log(`Found root: ${rootFolder.name} (${rootFolder.id})\n`);

  // Recursively list all files under Webfetch/
  const allFiles = await listAllFiles(drive, rootFolder.id, DEFAULT_DRIVE_FOLDER);
  console.log(`Total files in Drive: ${allFiles.length}\n`);

  // Group by (title + ext) to find duplicates
  const groups = new Map();
  for (const file of allFiles) {
    const parsed = parseFilename(file.name);
    if (!parsed) continue;

    const key = `${parsed.title}.${parsed.ext}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push({ ...file, parsed });
  }

  // Find duplicates (same title+ext, different dates)
  let duplicateCount = 0;
  let deleteCount = 0;

  for (const [key, files] of groups) {
    if (files.length <= 1) continue;

    // Sort by date descending — keep the newest (publish date)
    files.sort((a, b) => b.parsed.date.localeCompare(a.parsed.date));

    const keep = files[0];
    const toDelete = files.slice(1);

    console.log(`Duplicate set: ${key}`);
    console.log(`  KEEP:   ${keep.name} (${keep.parsed.date}) [${keep.path}]`);

    for (const dup of toDelete) {
      duplicateCount++;
      console.log(`  DELETE: ${dup.name} (${dup.parsed.date}) [${dup.path}]`);

      if (!DRY_RUN) {
        try {
          await drive.files.delete({ fileId: dup.id });
          deleteCount++;
          console.log(`    Deleted successfully`);
        } catch (error) {
          console.log(`    Error: ${error.message}`);
        }
      }
    }
    console.log();
  }

  console.log('═'.repeat(50));
  console.log(`Duplicate files found: ${duplicateCount}`);
  if (DRY_RUN) {
    console.log(`Would delete: ${duplicateCount} files`);
    console.log('\n⚡ Run with --apply to delete');
  } else {
    console.log(`Deleted: ${deleteCount} files`);
  }
}

/**
 * Recursively list all files (not folders) under parentId
 */
async function listAllFiles(drive, parentId, pathPrefix) {
  const results = [];
  let pageToken = null;

  do {
    const res = await drive.files.list({
      q: `'${parentId}' in parents and trashed=false`,
      fields: 'nextPageToken, files(id, name, mimeType, size)',
      pageSize: 200,
      pageToken,
    });

    for (const file of res.data.files) {
      if (file.mimeType === 'application/vnd.google-apps.folder') {
        const subFiles = await listAllFiles(drive, file.id, `${pathPrefix}/${file.name}`);
        results.push(...subFiles);
      } else {
        results.push({ ...file, path: pathPrefix });
      }
    }

    pageToken = res.data.nextPageToken;
  } while (pageToken);

  return results;
}

dedupe().catch(e => console.error('Error:', e.message));
