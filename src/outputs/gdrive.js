import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { URL } from 'url';
import { createLogger } from '../utils/logger.js';
import { AuthError, UploadError } from '../utils/errors.js';
import { withRetry } from '../utils/retry.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = join(__dirname, '..', '..', 'auth');
const CREDENTIALS_PATH = join(AUTH_DIR, 'gdrive-credentials.json');
const TOKEN_PATH = join(AUTH_DIR, 'gdrive-token.json');

/** Default Google Drive folder ID (shared across CLI, handler, batch) */
export const DEFAULT_DRIVE_FOLDER_ID = '1NrzlShHPwlsvxMAKgmGqIBK6C8tnDioa';

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

const log = createLogger('output:gdrive');

const MIME_TYPES = {
  '.md': 'text/markdown',
  '.pdf': 'application/pdf',
  '.json': 'application/json',
  '.txt': 'text/plain',
};

function loadCredentials() {
  if (!existsSync(CREDENTIALS_PATH)) {
    throw new AuthError(
      `Google Drive credentials not found: ${CREDENTIALS_PATH}\n` +
      'Download OAuth credentials from Google Cloud Console and save as auth/gdrive-credentials.json\n' +
      'Then run: webfetch gdrive --setup'
    );
  }
  const raw = JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf-8'));
  // Support both "installed" and "web" credential types
  const creds = raw.installed || raw.web;
  // Derive redirect URI from credentials file
  const baseUri = creds.redirect_uris?.[0] || 'http://localhost';
  creds._redirectUri = baseUri;
  creds._redirectPort = new URL(baseUri).port || 80;
  return creds;
}

function loadToken() {
  if (!existsSync(TOKEN_PATH)) {
    return null;
  }
  return JSON.parse(readFileSync(TOKEN_PATH, 'utf-8'));
}

function saveToken(token) {
  writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
}

async function getAuthClient() {
  const { google } = await import('googleapis');
  const credentials = loadCredentials();

  const oauth2Client = new google.auth.OAuth2(
    credentials.client_id,
    credentials.client_secret,
    credentials._redirectUri
  );

  const token = loadToken();
  if (!token) {
    throw new AuthError(
      'Google Drive not authenticated. Run: webfetch gdrive --setup'
    );
  }

  oauth2Client.setCredentials(token);

  // Auto-refresh token if expired
  oauth2Client.on('tokens', (newTokens) => {
    const updated = { ...token, ...newTokens };
    saveToken(updated);
    log.info('Token refreshed');
  });

  return { google, oauth2Client };
}

export async function findOrCreateFolder(drive, folderName) {
  // Check if folderName looks like an ID (no slashes, alphanumeric)
  if (/^[a-zA-Z0-9_-]{10,}$/.test(folderName) && !folderName.includes('/')) {
    return folderName;
  }

  // Support nested folders: "Longblack/2026"
  const parts = folderName.split('/').filter(Boolean);
  let parentId = 'root';

  for (const part of parts) {
    const query = `name='${part}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`;
    const res = await drive.files.list({
      q: query,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    if (res.data.files.length > 0) {
      parentId = res.data.files[0].id;
    } else {
      // Create folder
      const folder = await drive.files.create({
        requestBody: {
          name: part,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentId],
        },
        fields: 'id',
      });
      parentId = folder.data.id;
      log.info(`Created Drive folder: ${part}`);
    }
  }

  return parentId;
}

export async function findExistingFile(drive, folderId, filename) {
  const query = `name='${filename}' and '${folderId}' in parents and trashed=false`;
  const res = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    spaces: 'drive',
  });
  return res.data.files.length > 0 ? res.data.files[0] : null;
}

export default {
  name: 'gdrive',

  async save(content, filename, options = {}) {
    const { google, oauth2Client } = await getAuthClient();
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const folderName = options.driveFolder || DEFAULT_DRIVE_FOLDER_ID;
    const overwrite = options.driveOverwrite || false;

    const folderId = await findOrCreateFolder(drive, folderName);
    const ext = extname(filename);
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

    // Convert content to Buffer if it isn't already
    const body = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8');

    const uploadFn = async () => {
      const { Readable } = await import('stream');

      // Check for existing file if overwrite mode
      if (overwrite) {
        const existing = await findExistingFile(drive, folderId, filename);
        if (existing) {
          log.info(`Overwriting existing file: ${filename}`);
          const res = await drive.files.update({
            fileId: existing.id,
            media: {
              mimeType,
              body: Readable.from(body),
            },
            fields: 'id, name, webViewLink',
          });
          return res.data;
        }
      }

      const res = await drive.files.create({
        requestBody: {
          name: filename,
          parents: [folderId],
        },
        media: {
          mimeType,
          body: Readable.from(body),
        },
        fields: 'id, name, webViewLink',
      });
      return res.data;
    };

    try {
      const file = await withRetry(uploadFn, { maxRetries: 3 });
      return { url: file.webViewLink, id: file.id, name: file.name };
    } catch (error) {
      const msg = error.message || '';
      if (msg.includes('invalid_grant') || msg.includes('Token has been expired or revoked')) {
        log.warn('Google Drive token expired or revoked, removing token file');
        if (existsSync(TOKEN_PATH)) {
          unlinkSync(TOKEN_PATH);
        }
        throw new AuthError(
          'Google Drive token expired. Run: webfetch gdrive --setup',
          { filename, folder: folderName }
        );
      }
      throw new UploadError(`Drive upload failed: ${error.message}`, {
        filename,
        folder: folderName,
        folderId,
        mimeType,
        contentSize: body.length,
      });
    }
  },

  async setup() {
    const { google } = await import('googleapis');
    const credentials = loadCredentials();
    const redirectUri = credentials._redirectUri;
    const redirectPort = credentials._redirectPort;

    const oauth2Client = new google.auth.OAuth2(
      credentials.client_id,
      credentials.client_secret,
      redirectUri
    );

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
    });

    log.info('Opening browser for Google authorization...');
    log.info(`If browser doesn't open, visit:\n${authUrl}`);

    // Start local server to receive callback
    const code = await new Promise((resolve, reject) => {
      const server = createServer((req, res) => {
        const url = new URL(req.url, redirectUri);
        const authCode = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h1>Authorization failed</h1><p>You can close this window.</p>');
          server.close();
          reject(new AuthError(`Authorization denied: ${error}`));
          return;
        }

        if (authCode) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<h1>Authorization successful!</h1><p>You can close this window.</p>');
          server.close();
          resolve(authCode);
        }
      });

      server.listen(redirectPort, () => {
        // Open browser
        import('child_process').then(({ exec }) => {
          const cmd = process.platform === 'darwin' ? 'open' :
                      process.platform === 'win32' ? 'start' : 'xdg-open';
          exec(`${cmd} "${authUrl}"`);
        });
      });

      // Timeout after 2 minutes
      setTimeout(() => {
        server.close();
        reject(new AuthError('Authorization timed out'));
      }, 120000);
    });

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    saveToken(tokens);
    log.info('Google Drive authentication successful!');
    log.info(`Token saved to: ${TOKEN_PATH}`);
  },

  async test() {
    const { google, oauth2Client } = await getAuthClient();
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const res = await drive.about.get({ fields: 'user' });
    const user = res.data.user;
    log.info(`Connected as: ${user.displayName} (${user.emailAddress})`);

    // Test folder access
    const folderName = 'webfetch';
    const folderId = await findOrCreateFolder(drive, folderName);
    log.info(`Drive folder ready: ${folderName} (${folderId})`);

    return { user: user.displayName, email: user.emailAddress, folderId };
  },

  async revoke() {
    try {
      const { oauth2Client } = await getAuthClient();
      await oauth2Client.revokeCredentials();
    } catch (e) {
      // Ignore errors - token might already be invalid
    }

    if (existsSync(TOKEN_PATH)) {
      unlinkSync(TOKEN_PATH);
    }

    log.info('Google Drive authentication revoked');
    log.info(`Removed: ${TOKEN_PATH}`);
  },
};
