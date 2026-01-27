import { readFileSync, existsSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { join } from 'path';
import { getAdapter } from './adapters/index.js';
import { toMarkdown } from './formatters/markdown.js';
import { toPdf } from './formatters/pdf.js';
import { hasCache, getCache, setCache } from './utils/cache.js';
import { createLogger } from './utils/logger.js';
import { WebfetchError } from './utils/errors.js';
import { generateFilename } from './utils/filename.js';
import { resolveOutputs } from './outputs/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'output');
const log = createLogger('batch');

/**
 * Parse URL list from file
 * - One URL per line
 * - Lines starting with # are comments
 * - Empty lines are ignored
 */
export function parseUrlFile(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`URL file not found: ${filePath}`);
  }

  const content = readFileSync(filePath, 'utf-8');
  const urls = content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));

  return urls;
}

/**
 * Process a single URL
 */
async function processUrl(url, options) {
  const { format, useCache, cacheMaxAge } = options;

  // Check cache first
  if (useCache && hasCache(url, cacheMaxAge)) {
    const cached = getCache(url);
    if (cached?.result) {
      log.info(`Using cached: ${url}`);
      return { ...cached.result, fromCache: true };
    }
  }

  // Get adapter
  const adapter = getAdapter(url);
  if (!adapter) {
    throw new Error(`No adapter found for: ${url}`);
  }

  // Scrape
  log.info(`Scraping: ${url}`);
  const result = await adapter.scrape(url, {
    browser: options.browser,
    headless: options.headless,
    keepOpen: false, // Never keep open in batch mode
  });

  // Cache the result
  if (useCache) {
    setCache(url, result);
  }

  return result;
}

/**
 * Format and save result through output handlers
 */
async function saveResult(result, options) {
  const { format, outputDir, saveTo, driveFolder, driveOverwrite } = options;
  const ext = format === 'pdf' ? 'pdf' : format === 'json' ? 'json' : 'md';

  let output;
  if (format === 'json') {
    output = JSON.stringify(result, null, 2);
  } else if (format === 'pdf') {
    output = await toPdf(result);
  } else {
    output = toMarkdown(result);
  }

  const filename = generateFilename(result.title, ext);
  const outputs = resolveOutputs(saveTo);
  const outputOptions = { outputDir, driveFolder, driveOverwrite };
  const savedResults = [];

  const hasLocal = outputs.some(h => h.name === 'local');

  for (const handler of outputs) {
    try {
      const res = await handler.save(output, filename, outputOptions);
      log.info(`Saved (${handler.name}): ${res.path || res.url}`);
      savedResults.push({ handler: handler.name, ...res });
    } catch (error) {
      if (handler.name !== 'local' && hasLocal) {
        log.warn(`${handler.name} save failed: ${error.message}`);
      } else if (handler.name !== 'local') {
        log.warn(`${handler.name} save failed, falling back to local: ${error.message}`);
        const localHandler = (await import('./outputs/local.js')).default;
        const res = await localHandler.save(output, filename, outputOptions);
        log.info(`Saved (local fallback): ${res.path}`);
        savedResults.push({ handler: 'local', fallback: true, ...res });
      } else {
        throw error;
      }
    }
  }

  return savedResults;
}

/**
 * Process batch of URLs
 * @param {string[]} urls - List of URLs to process
 * @param {object} options - Batch options
 * @returns {object} Batch result summary
 */
export async function processBatch(urls, options = {}) {
  const opts = {
    format: 'markdown',
    browser: 'chrome',
    headless: false,
    useCache: true,
    cacheMaxAge: 24 * 60 * 60 * 1000, // 24 hours
    outputDir: OUTPUT_DIR,
    concurrency: 1, // Sequential by default (browser limitation)
    stopOnError: false,
    saveTo: 'local',
    driveFolder: '1NrzlShHPwlsvxMAKgmGqIBK6C8tnDioa',
    driveOverwrite: false,
    ...options,
  };

  const results = {
    total: urls.length,
    success: 0,
    failed: 0,
    skipped: 0,
    fromCache: 0,
    outputSummary: {},  // per-handler: { local: { success: N, failed: N }, gdrive: { ... } }
    items: [],
    startTime: new Date().toISOString(),
    endTime: null,
  };

  log.info(`Starting batch: ${urls.length} URLs`);

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const itemResult = {
      index: i + 1,
      url,
      status: 'pending',
      title: null,
      outputs: [],
      error: null,
      fromCache: false,
    };

    try {
      // Process URL
      const result = await processUrl(url, opts);
      itemResult.title = result.title;
      itemResult.fromCache = result.fromCache || false;

      // Save result
      const saveResults = await saveResult(result, opts);
      itemResult.outputs = saveResults;
      itemResult.status = 'success';

      results.success++;
      if (itemResult.fromCache) {
        results.fromCache++;
      }

      // Aggregate per-handler stats
      for (const sr of saveResults) {
        const name = sr.handler;
        if (!results.outputSummary[name]) {
          results.outputSummary[name] = { success: 0, failed: 0 };
        }
        results.outputSummary[name].success++;
        if (sr.fallback) {
          if (!results.outputSummary[name].fallback) results.outputSummary[name].fallback = 0;
          results.outputSummary[name].fallback++;
        }
      }

      log.info(`[${i + 1}/${urls.length}] ✓ ${result.title}`);

    } catch (error) {
      itemResult.status = 'failed';
      itemResult.error = error.message;
      results.failed++;

      log.error(`[${i + 1}/${urls.length}] ✗ ${url}: ${error.message}`);

      if (opts.stopOnError) {
        log.warn('Stopping batch due to error (--stop-on-error)');
        break;
      }
    }

    results.items.push(itemResult);
  }

  results.endTime = new Date().toISOString();

  // Print summary
  printSummary(results);

  return results;
}

/**
 * Print batch summary
 */
function printSummary(results) {
  log.info('='.repeat(50));
  log.info('Batch Summary');
  log.info('='.repeat(50));
  log.info(`Total:      ${results.total}`);
  log.info(`Success:    ${results.success} (${results.fromCache} from cache)`);
  log.info(`Failed:     ${results.failed}`);
  log.info(`Skipped:    ${results.skipped}`);

  // Per-handler output summary
  const handlers = Object.entries(results.outputSummary);
  if (handlers.length > 0) {
    log.info('Outputs:');
    for (const [name, stats] of handlers) {
      const parts = [`${stats.success} saved`];
      if (stats.failed) parts.push(`${stats.failed} failed`);
      if (stats.fallback) parts.push(`${stats.fallback} fallback`);
      log.info(`  ${name}: ${parts.join(', ')}`);
    }
  }

  log.info('='.repeat(50));

  if (results.failed > 0) {
    log.warn('Failed URLs:');
    results.items
      .filter(item => item.status === 'failed')
      .forEach(item => {
        log.warn(`  - ${item.url}`);
        log.warn(`    Error: ${item.error}`);
      });
  }
}

/**
 * Save batch report to file
 */
export function saveBatchReport(results, outputPath) {
  const report = {
    ...results,
    generatedAt: new Date().toISOString(),
  };

  writeFileSync(outputPath, JSON.stringify(report, null, 2));
  log.info(`Batch report saved: ${outputPath}`);
}

export default {
  parseUrlFile,
  processBatch,
  saveBatchReport,
};
