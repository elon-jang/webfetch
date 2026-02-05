/**
 * Common business logic shared by CLI, Web UI, and MCP server.
 * Provides scrape queue, history, cache management, downloads, and GDrive upload.
 */

import { existsSync, readdirSync, statSync, readFileSync, mkdirSync } from 'fs';
import { join, dirname, extname, basename, resolve } from 'path';
import { fileURLToPath } from 'url';
import { createReadStream } from 'fs';
import { getAdapter, listAdapters } from './adapters/index.js';
import { toMarkdown } from './formatters/markdown.js';
import { toPdf } from './formatters/pdf.js';
import { generateFilename } from './utils/filename.js';
import { resolveOutputs } from './outputs/index.js';
import { hasCache, getCache, setCache, clearAllCache, getCacheStats } from './utils/cache.js';
import { DEFAULT_DRIVE_FOLDER_ID } from './outputs/gdrive.js';
import { routeOutputOptions } from './utils/routing.js';
import { createLogger } from './utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'output');
const log = createLogger('handler');

// ─── Job Queue (FIFO) ───────────────────────────────────────────────
// Browser singleton can only run one scrape at a time.

const jobs = new Map();    // jobId -> { status, result, error, listeners }
const queue = [];
let processing = false;
let jobCounter = 0;

function createJob() {
  const id = `job_${++jobCounter}_${Date.now()}`;
  const job = { id, status: 'queued', result: null, error: null, listeners: new Set() };
  jobs.set(id, job);
  return job;
}

function notifyListeners(job, event, data) {
  for (const listener of job.listeners) {
    try { listener(event, data); } catch { /* ignore */ }
  }
}

async function processQueue() {
  if (processing || queue.length === 0) return;
  processing = true;

  while (queue.length > 0) {
    const { job, fn } = queue.shift();
    job.status = 'processing';
    notifyListeners(job, 'status', { phase: 'starting', message: 'Processing...' });

    try {
      job.result = await fn(job);
      job.status = 'done';
      notifyListeners(job, 'result', job.result);
    } catch (error) {
      job.status = 'error';
      job.error = error.message || String(error);
      notifyListeners(job, 'error', { message: job.error });
    }
  }

  processing = false;
}

// ─── Scrape ─────────────────────────────────────────────────────────

/**
 * Enqueue a scrape job.
 * @param {string} url
 * @param {object} options - { format?, saveTo?, driveFolder?, driveOverwrite?, noCache? }
 * @returns {{ jobId: string, position: number }}
 */
export function enqueueScrape(url, options = {}) {
  const job = createJob();

  const fn = async (j) => {
    const notify = (phase, message) => notifyListeners(j, 'status', { phase, message });

    const adapter = getAdapter(url);
    if (!adapter) {
      throw new Error(`No adapter found for: ${url}`);
    }

    notify('launching', 'Launching browser...');

    let result;
    const cacheMaxAge = 24 * 60 * 60 * 1000;

    // Check cache
    if (!options.noCache && hasCache(url, cacheMaxAge)) {
      const cached = getCache(url);
      if (cached?.result) {
        notify('cache', 'Using cached result');
        result = cached.result;
      }
    }

    // Scrape if not cached
    if (!result) {
      notify('scraping', 'Extracting content...');
      result = await adapter.scrape(url, {
        browser: 'chrome',
        headless: true,
        keepOpen: false,
      });

      if (!options.noCache) {
        setCache(url, result);
      }
    }

    // Format & save
    const format = options.format?.toLowerCase();
    const outputs = resolveOutputs(options.saveTo || 'local');
    const outputOptions = routeOutputOptions({
      outputDir: OUTPUT_DIR,
      driveFolder: options.driveFolder || DEFAULT_DRIVE_FOLDER_ID,
      driveOverwrite: options.driveOverwrite || false,
    }, adapter.name);

    const savedFiles = [];

    if (!format || format === 'both') {
      notify('formatting', 'Generating markdown...');
      const mdFilename = generateFilename(result.title, 'md');
      const mdContent = toMarkdown(result);
      await saveToOutputs(outputs, mdContent, mdFilename, outputOptions);
      savedFiles.push({ name: mdFilename, format: 'md' });

      notify('formatting', 'Generating PDF...');
      const pdfFilename = generateFilename(result.title, 'pdf');
      const pdfContent = await toPdf(result);
      await saveToOutputs(outputs, pdfContent, pdfFilename, outputOptions);
      savedFiles.push({ name: pdfFilename, format: 'pdf' });
    } else if (format === 'md' || format === 'markdown') {
      notify('formatting', 'Generating markdown...');
      const mdFilename = generateFilename(result.title, 'md');
      const mdContent = toMarkdown(result);
      await saveToOutputs(outputs, mdContent, mdFilename, outputOptions);
      savedFiles.push({ name: mdFilename, format: 'md' });
    } else if (format === 'pdf') {
      notify('formatting', 'Generating PDF...');
      const pdfFilename = generateFilename(result.title, 'pdf');
      const pdfContent = await toPdf(result);
      await saveToOutputs(outputs, pdfContent, pdfFilename, outputOptions);
      savedFiles.push({ name: pdfFilename, format: 'pdf' });
    }

    // Extract a text preview from HTML
    const preview = (result.html || '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 300);

    return { title: result.title, url, files: savedFiles, preview };
  };

  queue.push({ job, fn });
  const position = queue.length;

  // Notify if queued behind others
  if (position > 1) {
    notifyListeners(job, 'status', { phase: 'queued', message: `Waiting (${position} in queue)` });
  }

  // Start processing (non-blocking)
  processQueue();

  return { jobId: job.id, position };
}

/**
 * Subscribe to job events. Returns unsubscribe function.
 */
export function subscribeJob(jobId, listener) {
  const job = jobs.get(jobId);
  if (!job) return null;

  job.listeners.add(listener);

  // If job is already done, notify immediately
  if (job.status === 'done') {
    listener('result', job.result);
  } else if (job.status === 'error') {
    listener('error', { message: job.error });
  }

  return () => job.listeners.delete(listener);
}

/**
 * Get job status (for polling fallback).
 */
export function getJobStatus(jobId) {
  const job = jobs.get(jobId);
  if (!job) return null;
  return { status: job.status, result: job.result, error: job.error };
}

/**
 * Direct scrape (blocking, for MCP/CLI use).
 */
export async function scrape(url, options = {}) {
  const adapter = getAdapter(url);
  if (!adapter) throw new Error(`No adapter found for: ${url}`);

  let result;
  const cacheMaxAge = 24 * 60 * 60 * 1000;

  if (!options.noCache && hasCache(url, cacheMaxAge)) {
    const cached = getCache(url);
    if (cached?.result) result = cached.result;
  }

  if (!result) {
    result = await adapter.scrape(url, {
      browser: 'chrome',
      headless: true,
      keepOpen: false,
    });
    if (!options.noCache) setCache(url, result);
  }

  const format = options.format?.toLowerCase();
  const outputs = resolveOutputs(options.saveTo || 'local');
  const outputOptions = routeOutputOptions({
    outputDir: OUTPUT_DIR,
    driveFolder: options.driveFolder || DEFAULT_DRIVE_FOLDER_ID,
    driveOverwrite: options.driveOverwrite || false,
  }, adapter.name);

  const savedFiles = [];

  if (!format || format === 'both') {
    const mdFilename = generateFilename(result.title, 'md');
    await saveToOutputs(outputs, toMarkdown(result), mdFilename, outputOptions);
    savedFiles.push({ name: mdFilename, format: 'md' });

    const pdfFilename = generateFilename(result.title, 'pdf');
    await saveToOutputs(outputs, await toPdf(result), pdfFilename, outputOptions);
    savedFiles.push({ name: pdfFilename, format: 'pdf' });
  } else if (format === 'md' || format === 'markdown') {
    const mdFilename = generateFilename(result.title, 'md');
    await saveToOutputs(outputs, toMarkdown(result), mdFilename, outputOptions);
    savedFiles.push({ name: mdFilename, format: 'md' });
  } else if (format === 'pdf') {
    const pdfFilename = generateFilename(result.title, 'pdf');
    await saveToOutputs(outputs, await toPdf(result), pdfFilename, outputOptions);
    savedFiles.push({ name: pdfFilename, format: 'pdf' });
  }

  const preview = (result.html || '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);

  return { title: result.title, url, files: savedFiles, preview };
}

// ─── History ────────────────────────────────────────────────────────

export function getHistory() {
  if (!existsSync(OUTPUT_DIR)) return [];

  const files = [];

  function scanDir(dir, prefix) {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        scanDir(fullPath, prefix ? `${prefix}/${entry}` : entry);
      } else if (/\.(md|pdf|json)$/.test(entry)) {
        const ext = extname(entry).slice(1);
        files.push({
          name: prefix ? `${prefix}/${entry}` : entry,
          format: ext,
          size: stat.size,
          createdAt: stat.birthtime.toISOString(),
          modifiedAt: stat.mtime.toISOString(),
        });
      }
    }
  }

  scanDir(OUTPUT_DIR, '');
  files.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  return files;
}

// ─── Download ───────────────────────────────────────────────────────

/**
 * Get file path for download. Returns null if file not found or path traversal detected.
 * Supports nested paths like "LongBlack/2026/file.md".
 */
export function getFilePath(filename) {
  // Path traversal protection
  if (filename.includes('..')) return null;

  const filePath = join(OUTPUT_DIR, filename);

  // Ensure resolved path is still under OUTPUT_DIR
  const resolved = resolve(filePath);
  if (!resolved.startsWith(resolve(OUTPUT_DIR))) return null;

  if (!existsSync(filePath)) return null;

  return filePath;
}

/**
 * Read file content (for text files like .md).
 */
export function readFile(filename) {
  const filePath = getFilePath(filename);
  if (!filePath) return null;

  const ext = extname(filename).toLowerCase();
  if (ext === '.pdf') {
    // Return path for binary files
    return { type: 'binary', path: filePath, size: statSync(filePath).size };
  }

  return { type: 'text', content: readFileSync(filePath, 'utf-8') };
}

/**
 * Create a read stream for file download.
 */
export function getFileStream(filename) {
  const filePath = getFilePath(filename);
  if (!filePath) return null;

  const stat = statSync(filePath);
  const ext = extname(filename).toLowerCase();

  const mimeTypes = {
    '.md': 'text/markdown',
    '.pdf': 'application/pdf',
    '.json': 'application/json',
  };

  return {
    stream: createReadStream(filePath),
    size: stat.size,
    mimeType: mimeTypes[ext] || 'application/octet-stream',
  };
}

// ─── Cache ──────────────────────────────────────────────────────────

export function getCacheInfo() {
  return getCacheStats();
}

export function clearCache() {
  clearAllCache();
  return { cleared: true };
}

// ─── GDrive ─────────────────────────────────────────────────────────

export async function uploadToGdrive(filename, options = {}) {
  const filePath = getFilePath(filename);
  if (!filePath) throw new Error(`File not found: ${filename}`);

  const content = readFileSync(filePath);
  const gdriveHandler = (await import('./outputs/gdrive.js')).default;

  const result = await gdriveHandler.save(content, filename, {
    driveFolder: options.driveFolder || DEFAULT_DRIVE_FOLDER_ID,
    driveOverwrite: options.driveOverwrite || false,
  });

  return result;
}

// ─── Info ───────────────────────────────────────────────────────────

export function getSupportedSites() {
  return listAdapters().map(a => ({
    name: a.name,
    patterns: a.patterns || [],
  }));
}

// ─── Internal helpers ───────────────────────────────────────────────

async function saveToOutputs(outputs, content, filename, options) {
  const results = [];
  const hasLocal = outputs.some(h => h.name === 'local');

  for (const handler of outputs) {
    try {
      const res = await handler.save(content, filename, options);
      log.info(`Saved (${handler.name}): ${res.path || res.url}`);
      results.push({ handler: handler.name, ...res });
    } catch (error) {
      if (handler.name !== 'local' && hasLocal) {
        log.warn(`${handler.name} save failed: ${error.message}`);
      } else if (handler.name !== 'local') {
        log.warn(`${handler.name} save failed, falling back to local: ${error.message}`);
        const localHandler = (await import('./outputs/local.js')).default;
        const res = await localHandler.save(content, filename, options);
        log.info(`Saved (local fallback): ${res.path}`);
        results.push({ handler: 'local', fallback: true, ...res });
      } else {
        throw error;
      }
    }
  }
  return results;
}

export const OUTPUT_PATH = OUTPUT_DIR;
