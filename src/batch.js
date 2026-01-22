import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getAdapter } from './adapters/index.js';
import { toMarkdown } from './formatters/markdown.js';
import { toPdf } from './formatters/pdf.js';
import { hasCache, getCache, setCache } from './utils/cache.js';
import { createLogger } from './utils/logger.js';
import { WebfetchError } from './utils/errors.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'output');
const log = createLogger('batch');

/**
 * Generate filename from title
 */
function generateFilename(title, ext) {
  const date = new Date().toISOString().slice(0, 10);
  let safeName = (title || 'untitled')
    .replace(/[\/\\:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80);
  return `${date}_${safeName}.${ext}`;
}

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
 * Format and save result
 */
async function saveResult(result, options) {
  const { format, outputDir } = options;
  const ext = format === 'pdf' ? 'pdf' : format === 'json' ? 'json' : 'md';

  let output;
  if (format === 'json') {
    output = JSON.stringify(result, null, 2);
  } else if (format === 'pdf') {
    output = await toPdf(result);
  } else {
    output = toMarkdown(result);
  }

  const outputPath = join(outputDir, generateFilename(result.title, ext));
  writeFileSync(outputPath, output);
  return outputPath;
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
    ...options,
  };

  // Ensure output directory exists
  if (!existsSync(opts.outputDir)) {
    mkdirSync(opts.outputDir, { recursive: true });
  }

  const results = {
    total: urls.length,
    success: 0,
    failed: 0,
    skipped: 0,
    fromCache: 0,
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
      outputPath: null,
      error: null,
      fromCache: false,
    };

    try {
      // Process URL
      const result = await processUrl(url, opts);
      itemResult.title = result.title;
      itemResult.fromCache = result.fromCache || false;

      // Save result
      const outputPath = await saveResult(result, opts);
      itemResult.outputPath = outputPath;
      itemResult.status = 'success';

      results.success++;
      if (itemResult.fromCache) {
        results.fromCache++;
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
  console.log('\n' + '='.repeat(50));
  console.log('📊 Batch Summary');
  console.log('='.repeat(50));
  console.log(`Total:      ${results.total}`);
  console.log(`Success:    ${results.success} (${results.fromCache} from cache)`);
  console.log(`Failed:     ${results.failed}`);
  console.log(`Skipped:    ${results.skipped}`);
  console.log('='.repeat(50));

  if (results.failed > 0) {
    console.log('\nFailed URLs:');
    results.items
      .filter(item => item.status === 'failed')
      .forEach(item => {
        console.log(`  - ${item.url}`);
        console.log(`    Error: ${item.error}`);
      });
  }

  console.log();
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
