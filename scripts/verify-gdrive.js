#!/usr/bin/env node

/**
 * Google Drive 업로드 검증 스크립트
 * Webfetch 폴더 구조를 확인한다.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOKEN_PATH = join(__dirname, '..', 'auth/gdrive-token.json');
const CREDS_PATH = join(__dirname, '..', 'auth/gdrive-credentials.json');

async function verify() {
  const { google } = await import('googleapis');

  const raw = JSON.parse(readFileSync(CREDS_PATH, 'utf-8'));
  const creds = raw.installed || raw.web;
  const redirectUri = creds.redirect_uris?.[0] || 'http://localhost';

  const oauth2Client = new google.auth.OAuth2(creds.client_id, creds.client_secret, redirectUri);
  oauth2Client.setCredentials(JSON.parse(readFileSync(TOKEN_PATH, 'utf-8')));

  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  // Search for "Webfetch" folder
  console.log('=== Webfetch folder on Google Drive ===\n');
  const res = await drive.files.list({
    q: `name='Webfetch' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name, parents)',
  });

  if (res.data.files.length === 0) {
    console.log('Webfetch folder not found!');
    return;
  }

  const folder = res.data.files[0];
  console.log(`📁 Webfetch/ (ID: ${folder.id})\n`);

  const totalFiles = await listRecursive(drive, folder.id, 'Webfetch/', 1);
  console.log(`\n═══════════════════════════════`);
  console.log(`Total: ${totalFiles} files`);
}

async function listRecursive(drive, parentId, prefix, depth) {
  const res = await drive.files.list({
    q: `'${parentId}' in parents and trashed=false`,
    fields: 'files(id, name, size, mimeType)',
    orderBy: 'name',
    pageSize: 100,
  });

  let fileCount = 0;
  for (const f of res.data.files) {
    const isFolder = f.mimeType === 'application/vnd.google-apps.folder';
    if (isFolder) {
      console.log(`${'  '.repeat(depth)}📁 ${f.name}/`);
      fileCount += await listRecursive(drive, f.id, `${prefix}${f.name}/`, depth + 1);
    } else {
      const size = f.size ? `${(parseInt(f.size) / 1024).toFixed(0)}KB` : '-';
      console.log(`${'  '.repeat(depth)}📄 ${f.name} (${size})`);
      fileCount++;
    }
  }
  return fileCount;
}

verify().catch(e => console.error('Error:', e.message));
