#!/usr/bin/env node

import { Command } from 'commander';
import { writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getAdapter, listAdapters } from './adapters/index.js';
import { toMarkdown } from './formatters/markdown.js';
import { toPdf } from './formatters/pdf.js';
import { WebfetchError } from './utils/errors.js';
import { logger } from './utils/logger.js';
import { hasCache, getCache, setCache, clearAllCache, getCacheStats } from './utils/cache.js';
import { parseUrlFile, processBatch, saveBatchReport } from './batch.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'output');

/**
 * Generate filename from title
 * Format: YYYY-MM-DD_제목.ext
 */
function generateFilename(title, ext) {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Sanitize title for filename
  let safeName = (title || 'untitled')
    .replace(/[\/\\:*?"<>|]/g, '')  // Remove invalid chars
    .replace(/\s+/g, '_')            // Spaces to underscores
    .replace(/_+/g, '_')             // Multiple underscores to single
    .replace(/^_|_$/g, '')           // Trim underscores
    .slice(0, 80);                   // Max 80 chars

  return `${date}_${safeName}.${ext}`;
}

/**
 * Check if article already exists in output folder (for today)
 * Returns existing filename if found, null otherwise
 */
function checkExistingArticle(outputDir) {
  const today = new Date().toISOString().slice(0, 10);

  if (!existsSync(outputDir)) return null;

  const files = readdirSync(outputDir);
  // Find any file that starts with today's date
  const todayFiles = files.filter(f => f.startsWith(today));

  if (todayFiles.length > 0) {
    return todayFiles;
  }
  return null;
}

const program = new Command();

program
  .name('webfetch')
  .description('Web scraping CLI - LiveWiki & Longblack')
  .version('1.0.0');

// Single URL scrape (default command)
program
  .argument('<url>', 'URL to scrape (YouTube URL or content URL)')
  .option('-f, --format <type>', 'output format (markdown, json, pdf). Default: both md & pdf')
  .option('-o, --output <path>', 'save to file (auto-generated if not specified for pdf)')
  .option('-b, --browser <type>', 'browser (chrome, firefox)', 'chrome')
  .option('--headless', 'run headless (not recommended for login)', false)
  .option('--keep-open', 'keep browser open after scrape', false)
  .option('--no-cache', 'skip cache (always fetch fresh)')
  .option('--cache-max-age <hours>', 'cache max age in hours', '24')
  .option('--skip-existing', 'skip if today\'s article already scraped', false)
  .action(async (url, options) => {
    try {
      const adapter = getAdapter(url);

      if (!adapter) {
        console.error(`✖ No adapter found for: ${url}`);
        console.error('\nSupported URLs:');
        console.error('  - YouTube URLs (via LiveWiki)');
        console.error('  - https://livewiki.com/*/content/*');
        console.error('  - https://longblack.co/*');
        process.exit(1);
      }

      console.log(`\n📄 webfetch - ${adapter.name}\n`);

      // Check for existing article (skip-existing mode)
      if (options.skipExisting) {
        const existing = checkExistingArticle(OUTPUT_DIR);
        if (existing && existing.length > 0) {
          console.log(`⏭️  Skipping - today's article already exists:`);
          existing.forEach(f => console.log(`   ${f}`));
          return;
        }
      }

      let result;
      const cacheMaxAge = parseInt(options.cacheMaxAge) * 60 * 60 * 1000;

      // Check cache first (if enabled)
      if (options.cache && hasCache(url, cacheMaxAge)) {
        const cached = getCache(url);
        if (cached?.result) {
          console.log('📦 Using cached result');
          result = cached.result;
        }
      }

      // Scrape if not cached
      if (!result) {
        result = await adapter.scrape(url, {
          browser: options.browser,
          headless: options.headless,
          keepOpen: options.keepOpen,
        });

        // Save to cache (if enabled)
        if (options.cache) {
          setCache(url, result);
        }
      }

      // Ensure output directory exists
      if (!existsSync(OUTPUT_DIR)) {
        mkdirSync(OUTPUT_DIR, { recursive: true });
      }

      // Format output - default to both md & pdf if not specified
      const format = options.format?.toLowerCase();
      const savedFiles = [];

      if (options.output) {
        // Custom output path - use specified format or default to markdown
        const ext = format === 'pdf' ? 'pdf' : format === 'json' ? 'json' : 'md';
        let output;
        if (format === 'json') {
          output = JSON.stringify(result, null, 2);
        } else if (format === 'pdf') {
          output = await toPdf(result);
        } else {
          output = toMarkdown(result);
        }
        writeFileSync(options.output, output);
        savedFiles.push(options.output);
      } else if (!format) {
        // No format specified - output both markdown and PDF
        const mdPath = join(OUTPUT_DIR, generateFilename(result.title, 'md'));
        const pdfPath = join(OUTPUT_DIR, generateFilename(result.title, 'pdf'));

        // Save markdown
        writeFileSync(mdPath, toMarkdown(result));
        savedFiles.push(mdPath);

        // Save PDF
        const pdfOutput = await toPdf(result);
        writeFileSync(pdfPath, pdfOutput);
        savedFiles.push(pdfPath);
      } else {
        // Specific format requested
        const ext = format === 'pdf' ? 'pdf' : format === 'json' ? 'json' : 'md';
        let output;
        if (format === 'json') {
          output = JSON.stringify(result, null, 2);
        } else if (format === 'pdf') {
          output = await toPdf(result);
        } else {
          output = toMarkdown(result);
        }
        const outputPath = join(OUTPUT_DIR, generateFilename(result.title, ext));
        writeFileSync(outputPath, output);
        savedFiles.push(outputPath);
      }

      // Print saved files
      console.log();
      savedFiles.forEach(f => console.log(`✓ Saved to: ${f}`));

    } catch (error) {
      if (error instanceof WebfetchError) {
        logger.error(`[${error.code}] ${error.message}`);
        if (error.details && Object.keys(error.details).length > 0) {
          logger.debug(`Details: ${JSON.stringify(error.details)}`);
        }
      } else {
        logger.error(error.message);
      }
      process.exit(1);
    }
  });

// Batch processing command
program
  .command('batch <file>')
  .description('Process multiple URLs from a file')
  .option('-f, --format <type>', 'output format (markdown, json, pdf)', 'markdown')
  .option('-o, --output-dir <path>', 'output directory', OUTPUT_DIR)
  .option('-b, --browser <type>', 'browser (chrome, firefox)', 'chrome')
  .option('--headless', 'run headless (not recommended for login)', false)
  .option('--no-cache', 'skip cache (always fetch fresh)')
  .option('--cache-max-age <hours>', 'cache max age in hours', '24')
  .option('--stop-on-error', 'stop processing on first error', false)
  .option('--skip-existing', 'skip URLs if today\'s article exists', false)
  .option('--report <path>', 'save batch report to file')
  .action(async (file, options) => {
    try {
      // Parse URL file
      const urls = parseUrlFile(file);
      console.log(`\n📋 Batch mode: ${urls.length} URLs from ${file}\n`);

      if (urls.length === 0) {
        console.error('No URLs found in file');
        process.exit(1);
      }

      // Process batch
      const results = await processBatch(urls, {
        format: options.format,
        browser: options.browser,
        headless: options.headless,
        useCache: options.cache,
        cacheMaxAge: parseInt(options.cacheMaxAge) * 60 * 60 * 1000,
        outputDir: options.outputDir,
        stopOnError: options.stopOnError,
      });

      // Save report if requested
      if (options.report) {
        saveBatchReport(results, options.report);
      }

      // Exit with error code if any failed
      if (results.failed > 0) {
        process.exit(1);
      }

    } catch (error) {
      logger.error(error.message);
      process.exit(1);
    }
  });

// List supported sites
program
  .command('list')
  .description('List supported sites')
  .action(() => {
    console.log('\nSupported sites:\n');
    listAdapters().forEach(adapter => {
      console.log(`  ${adapter.name}`);
    });
    console.log('\nExamples:');
    console.log('  webfetch https://youtube.com/watch?v=xxx     # Extract via LiveWiki');
    console.log('  webfetch https://livewiki.com/ko/content/xxx # Scrape LiveWiki');
    console.log('  webfetch https://longblack.co/note/xxx       # Scrape Longblack');
    console.log('  webfetch <url> -f pdf                        # Save as PDF (auto filename)');
    console.log('  webfetch batch urls.txt                      # Process multiple URLs');
    console.log();
  });

// Cache management command
program
  .command('cache')
  .description('Manage cache')
  .option('--stats', 'show cache statistics')
  .option('--clear', 'clear all cache')
  .action((options) => {
    if (options.clear) {
      clearAllCache();
      console.log('✓ Cache cleared');
    } else if (options.stats) {
      const stats = getCacheStats();
      console.log('\n📦 Cache Statistics\n');
      console.log(`  Entries: ${stats.count}`);
      console.log(`  Size:    ${(stats.size / 1024).toFixed(2)} KB`);

      if (stats.entries.length > 0) {
        console.log('\n  Recent entries:');
        stats.entries.slice(0, 10).forEach(entry => {
          console.log(`    - ${entry.url}`);
          console.log(`      Cached: ${entry.cachedAt}`);
        });
      }
      console.log();
    } else {
      console.log('\nUsage:');
      console.log('  webfetch cache --stats   # Show cache statistics');
      console.log('  webfetch cache --clear   # Clear all cache');
      console.log();
    }
  });

program.parse();
