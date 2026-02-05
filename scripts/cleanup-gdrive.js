#!/usr/bin/env node

/**
 * cleanup-gdrive.js
 * 잘못 생성된 Drive 폴더(ID 문자열이 이름으로 사용된 폴더)를 삭제한다.
 *
 * Usage:
 *   node scripts/cleanup-gdrive.js              # dry-run
 *   node scripts/cleanup-gdrive.js --apply      # 실제 삭제
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_DRIVE_FOLDER } from '../src/outputs/gdrive.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOKEN_PATH = join(__dirname, '..', 'auth/gdrive-token.json');
const CREDS_PATH = join(__dirname, '..', 'auth/gdrive-credentials.json');
const DRY_RUN = !process.argv.includes('--apply');

async function cleanup() {
  const { google } = await import('googleapis');

  const raw = JSON.parse(readFileSync(CREDS_PATH, 'utf-8'));
  const creds = raw.installed || raw.web;
  const redirectUri = creds.redirect_uris?.[0] || 'http://localhost';

  const oauth2Client = new google.auth.OAuth2(creds.client_id, creds.client_secret, redirectUri);
  oauth2Client.setCredentials(JSON.parse(readFileSync(TOKEN_PATH, 'utf-8')));

  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  // Search for the misnamed folder (folder named with the Drive ID string)
  console.log(`Searching for folder named "${DEFAULT_DRIVE_FOLDER}"...\n`);

  const res = await drive.files.list({
    q: `name='${DEFAULT_DRIVE_FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name, parents)',
  });

  if (res.data.files.length === 0) {
    console.log('No misnamed folder found. Nothing to clean up.');
    return;
  }

  for (const folder of res.data.files) {
    console.log(`Found misnamed folder: "${folder.name}" (ID: ${folder.id})`);

    // Count files inside recursively
    const count = await countFiles(drive, folder.id);
    console.log(`  Contains ${count} files/folders\n`);

    if (DRY_RUN) {
      console.log(`  Would DELETE this folder and all contents`);
    } else {
      console.log(`  Deleting...`);
      await drive.files.delete({ fileId: folder.id });
      console.log(`  Deleted successfully`);
    }
  }

  if (DRY_RUN) {
    console.log('\n⚡ Run with --apply to delete');
  }
}

async function countFiles(drive, parentId) {
  const res = await drive.files.list({
    q: `'${parentId}' in parents and trashed=false`,
    fields: 'files(id, mimeType)',
    pageSize: 100,
  });

  let count = res.data.files.length;
  for (const f of res.data.files) {
    if (f.mimeType === 'application/vnd.google-apps.folder') {
      count += await countFiles(drive, f.id);
    }
  }
  return count;
}

cleanup().catch(e => console.error('Error:', e.message));
