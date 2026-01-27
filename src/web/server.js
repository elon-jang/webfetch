/**
 * HTTP server for webfetch Web UI.
 * Uses built-in http module — no Express dependency.
 */

import { createServer } from 'http';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from '../utils/logger.js';
import {
  enqueueScrape,
  subscribeJob,
  getJobStatus,
  getHistory,
  getFileStream,
  getCacheInfo,
  clearCache,
  uploadToGdrive,
  getSupportedSites,
} from '../handler.js';
import { handleMcpRequest, getSessionCount, closeAllSessions } from '../mcp/http-transport.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const log = createLogger('web');

let cachedHtml = null;

function getIndexHtml() {
  if (!cachedHtml) {
    cachedHtml = readFileSync(join(__dirname, 'index.html'), 'utf-8');
  }
  return cachedHtml;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function json(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id');
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
}

function validateBearerToken(req, authToken) {
  if (!authToken) return true;
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return false;
  return header.slice(7) === authToken;
}

// Server-level options (set by startServer)
let serverOptions = {};

/**
 * Route matching helper.
 * Returns params object or null.
 */
function matchRoute(method, url, pattern, reqMethod) {
  if (method !== reqMethod) return null;

  const patternParts = pattern.split('/');
  const urlParts = url.split('?')[0].split('/');

  if (patternParts.length !== urlParts.length) return null;

  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = decodeURIComponent(urlParts[i]);
    } else if (patternParts[i] !== urlParts[i]) {
      return null;
    }
  }
  return params;
}

async function handleRequest(req, res) {
  const url = req.url;
  const method = req.method;

  cors(res);

  // Preflight
  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    // ─── Static ───
    if (method === 'GET' && (url === '/' || url === '/index.html')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(getIndexHtml());
      return;
    }

    // ─── POST /api/scrape ───
    if (method === 'POST' && url === '/api/scrape') {
      const body = await parseBody(req);
      if (!body.url) {
        json(res, { error: 'url is required' }, 400);
        return;
      }
      const { jobId, position } = enqueueScrape(body.url, {
        format: body.format,
        saveTo: body.saveTo,
        driveFolder: body.driveFolder,
        noCache: body.noCache,
      });
      json(res, { jobId, position });
      return;
    }

    // ─── GET /api/scrape/:jobId (SSE) ───
    let params;
    if ((params = matchRoute('GET', url, '/api/scrape/:jobId', method))) {
      const { jobId } = params;
      const status = getJobStatus(jobId);
      if (!status) {
        json(res, { error: 'Job not found' }, 404);
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });

      const send = (event, data) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      const unsub = subscribeJob(jobId, (event, data) => {
        send(event, data);
        if (event === 'result' || event === 'error') {
          res.end();
        }
      });

      if (!unsub) {
        // Job doesn't exist
        send('error', { message: 'Job not found' });
        res.end();
        return;
      }

      // If already finished, subscribeJob sends immediately and res.end() is called above.
      // Handle client disconnect.
      req.on('close', () => {
        if (unsub) unsub();
      });
      return;
    }

    // ─── GET /api/history ───
    if (method === 'GET' && url === '/api/history') {
      json(res, { files: getHistory() });
      return;
    }

    // ─── GET /api/download/:filename ───
    if ((params = matchRoute('GET', url, '/api/download/:filename', method))) {
      const { filename } = params;
      const fileData = getFileStream(filename);
      if (!fileData) {
        json(res, { error: 'File not found' }, 404);
        return;
      }

      res.writeHead(200, {
        'Content-Type': fileData.mimeType,
        'Content-Length': fileData.size,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Access-Control-Allow-Origin': '*',
      });
      fileData.stream.pipe(res);
      return;
    }

    // ─── GET /api/cache ───
    if (method === 'GET' && url === '/api/cache') {
      json(res, getCacheInfo());
      return;
    }

    // ─── DELETE /api/cache ───
    if (method === 'DELETE' && url === '/api/cache') {
      json(res, clearCache());
      return;
    }

    // ─── POST /api/gdrive/:filename ───
    if ((params = matchRoute('POST', url, '/api/gdrive/:filename', method))) {
      const { filename } = params;
      try {
        const body = await parseBody(req).catch(() => ({}));
        const result = await uploadToGdrive(filename, body);
        json(res, result);
      } catch (error) {
        json(res, { error: error.message }, 500);
      }
      return;
    }

    // ─── GET /api/sites ───
    if (method === 'GET' && url === '/api/sites') {
      json(res, { sites: getSupportedSites() });
      return;
    }

    // ─── GET /health ───
    if (method === 'GET' && url === '/health') {
      const data = { status: 'ok' };
      if (serverOptions.mcp !== false) {
        data.mcpSessions = getSessionCount();
      }
      json(res, data);
      return;
    }

    // ─── MCP endpoint (POST/GET/DELETE /mcp) ───
    if (url.split('?')[0] === '/mcp') {
      if (serverOptions.mcp === false) {
        json(res, { error: 'MCP endpoint disabled' }, 404);
        return;
      }

      if (!validateBearerToken(req, serverOptions.authToken)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }

      try {
        const body = (method === 'POST') ? await parseBody(req) : undefined;
        await handleMcpRequest(req, res, body);
      } catch (error) {
        log.error(`MCP error: ${error.message}`);
        if (!res.headersSent) {
          json(res, { error: error.message }, 500);
        }
      }
      return;
    }

    // 404
    json(res, { error: 'Not found' }, 404);

  } catch (error) {
    log.error(`Request error: ${error.message}`);
    json(res, { error: error.message }, 500);
  }
}

export async function startServer(options = {}) {
  const port = options.port || 3000;
  const host = options.host || '0.0.0.0';

  serverOptions = {
    authToken: options.authToken,
    mcp: options.mcp,
  };

  const server = createServer(handleRequest);

  return new Promise((resolve) => {
    server.listen(port, host, () => {
      log.info(`Web UI server running at http://${host}:${port}`);
      log.info(`Local access: http://localhost:${port}`);
      if (serverOptions.mcp !== false) {
        log.info(`MCP endpoint: http://${host}:${port}/mcp`);
        if (serverOptions.authToken) {
          log.info('MCP authentication: Bearer token enabled');
        }
      }
      log.info('Press Ctrl+C to stop');
      resolve(server);
    });
  });
}
