#!/usr/bin/env node

import { Command } from 'commander';
import { existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getAdapter, listAdapters } from './adapters/index.js';
import { toMarkdown } from './formatters/markdown.js';
import { toPdf } from './formatters/pdf.js';
import { WebfetchError, UploadError } from './utils/errors.js';
import { logger, createLogger } from './utils/logger.js';
const log = createLogger('cli');
import { hasCache, getCache, setCache, clearAllCache, getCacheStats } from './utils/cache.js';
import { parseUrlFile, processBatch, saveBatchReport } from './batch.js';
import { generateFilename } from './utils/filename.js';
import { resolveOutputs } from './outputs/index.js';
import gdriveHandler from './outputs/gdrive.js';
import { loadConfig, mergeConfig, CONFIG_TEMPLATE } from './utils/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'output');

// CLI option defaults (used for config merge detection)
const CLI_DEFAULTS = {
  browser: 'chrome',
  headless: false,
  keepOpen: false,
  cacheMaxAge: '24',
  skipExisting: false,
  saveTo: 'local',
  driveFolder: 'webfetch',
  driveOverwrite: false,
};

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

/**
 * Save content through output handlers
 * Non-fatal for remote handlers when local is also present
 */
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
        // Non-fatal for remote handlers when local is also saving
        log.warn(`${handler.name} save failed: ${error.message}`);
      } else if (handler.name !== 'local') {
        // Remote-only mode: warn and fallback to local
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
  .option('--save-to <dest>', 'save destination: local, gdrive, or local,gdrive', 'local')
  .option('--drive-folder <name>', 'Google Drive folder name or ID', 'webfetch')
  .option('--drive-overwrite', 'overwrite existing file in Drive instead of creating duplicate', false)
  .action(async (url, options) => {
    try {
      // Merge config file with CLI options
      const config = await loadConfig();
      options = mergeConfig(options, config, CLI_DEFAULTS);

      const adapter = getAdapter(url);

      if (!adapter) {
        log.error(`No adapter found for: ${url}`);
        log.error('Supported URLs:');
        log.error('  - YouTube URLs (via LiveWiki)');
        log.error('  - https://livewiki.com/*/content/*');
        log.error('  - https://longblack.co/*');
        process.exit(1);
      }

      log.info(`webfetch - ${adapter.name}`);

      // Check for existing article (skip-existing mode)
      if (options.skipExisting) {
        const existing = checkExistingArticle(OUTPUT_DIR);
        if (existing && existing.length > 0) {
          log.info(`Skipping - today's article already exists:`);
          existing.forEach(f => log.info(`  ${f}`));
          return;
        }
      }

      let result;
      const cacheMaxAge = parseInt(options.cacheMaxAge) * 60 * 60 * 1000;

      // Check cache first (if enabled)
      if (options.cache && hasCache(url, cacheMaxAge)) {
        const cached = getCache(url);
        if (cached?.result) {
          log.info('Using cached result');
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

      // Resolve output handlers
      const outputs = resolveOutputs(options.saveTo);
      const outputOptions = {
        outputDir: OUTPUT_DIR,
        driveFolder: options.driveFolder,
        driveOverwrite: options.driveOverwrite,
      };

      // Format output - default to both md & pdf if not specified
      const format = options.format?.toLowerCase();

      if (options.output) {
        // Custom output path - use specified format or default to markdown
        let output;
        if (format === 'json') {
          output = JSON.stringify(result, null, 2);
        } else if (format === 'pdf') {
          output = await toPdf(result);
        } else {
          output = toMarkdown(result);
        }
        // Custom output path uses local handler directly
        const { writeFileSync } = await import('fs');
        writeFileSync(options.output, output);
        log.info(`Saved to: ${options.output}`);
      } else if (!format) {
        // No format specified - output both markdown and PDF
        const mdFilename = generateFilename(result.title, 'md');
        const pdfFilename = generateFilename(result.title, 'pdf');

        const mdContent = toMarkdown(result);
        const pdfContent = await toPdf(result);

        await saveToOutputs(outputs, mdContent, mdFilename, outputOptions);
        await saveToOutputs(outputs, pdfContent, pdfFilename, outputOptions);
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
        const filename = generateFilename(result.title, ext);
        await saveToOutputs(outputs, output, filename, outputOptions);
      }

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
  .option('--save-to <dest>', 'save destination: local, gdrive, or local,gdrive', 'local')
  .option('--drive-folder <name>', 'Google Drive folder name or ID', 'webfetch')
  .option('--drive-overwrite', 'overwrite existing file in Drive instead of creating duplicate', false)
  .action(async (file, options) => {
    try {
      // Merge config file with CLI options
      const config = await loadConfig();
      options = mergeConfig(options, config, CLI_DEFAULTS);

      // Parse URL file
      const urls = parseUrlFile(file);
      log.info(`Batch mode: ${urls.length} URLs from ${file}`);

      if (urls.length === 0) {
        log.error('No URLs found in file');
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
        saveTo: options.saveTo,
        driveFolder: options.driveFolder,
        driveOverwrite: options.driveOverwrite,
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

// Google Drive management command
program
  .command('gdrive')
  .description('Manage Google Drive integration')
  .option('--setup', 'set up Google Drive OAuth authentication')
  .option('--test', 'test Google Drive connection')
  .option('--revoke', 'revoke Google Drive authentication')
  .action(async (options) => {
    try {
      if (options.setup) {
        await gdriveHandler.setup();
      } else if (options.test) {
        await gdriveHandler.test();
      } else if (options.revoke) {
        await gdriveHandler.revoke();
      } else {
        log.info('Usage:');
        log.info('  webfetch gdrive --setup    # Set up OAuth authentication');
        log.info('  webfetch gdrive --test     # Test connection');
        log.info('  webfetch gdrive --revoke   # Revoke authentication');
      }
    } catch (error) {
      if (error instanceof WebfetchError) {
        logger.error(`[${error.code}] ${error.message}`);
      } else {
        logger.error(error.message);
      }
      process.exit(1);
    }
  });

// List supported sites
program
  .command('list')
  .description('List supported sites')
  .action(() => {
    log.info('Supported sites:');
    listAdapters().forEach(adapter => {
      log.info(`  ${adapter.name}`);
    });
    log.info('Examples:');
    log.info('  webfetch https://youtube.com/watch?v=xxx     # Extract via LiveWiki');
    log.info('  webfetch https://livewiki.com/ko/content/xxx # Scrape LiveWiki');
    log.info('  webfetch https://longblack.co/note/xxx       # Scrape Longblack');
    log.info('  webfetch <url> -f pdf                        # Save as PDF (auto filename)');
    log.info('  webfetch batch urls.txt                      # Process multiple URLs');
    log.info('  webfetch <url> --save-to gdrive              # Save to Google Drive');
  });

// Config management command
program
  .command('config')
  .description('Manage configuration')
  .option('--init', 'create webfetch.config.js template in current directory')
  .option('--show', 'show loaded config')
  .action(async (options) => {
    if (options.init) {
      const configPath = join(process.cwd(), 'webfetch.config.js');
      if (existsSync(configPath)) {
        log.warn(`Config already exists: ${configPath}`);
        return;
      }
      const { writeFileSync } = await import('fs');
      writeFileSync(configPath, CONFIG_TEMPLATE);
      log.info(`Config created: ${configPath}`);
    } else if (options.show) {
      const config = await loadConfig();
      if (Object.keys(config).length === 0) {
        log.info('No config file found');
        log.info('Run: webfetch config --init');
      } else {
        log.info('Loaded config:');
        for (const [key, value] of Object.entries(config)) {
          log.info(`  ${key}: ${JSON.stringify(value)}`);
        }
      }
    } else {
      log.info('Usage:');
      log.info('  webfetch config --init   # Create config template');
      log.info('  webfetch config --show   # Show loaded config');
    }
  });

// Web UI server
program
  .command('serve')
  .description('Start web UI server')
  .option('-p, --port <number>', 'port number', '3000')
  .option('--host <addr>', 'host address', '0.0.0.0')
  .action(async (options) => {
    const { startServer } = await import('./web/server.js');
    await startServer({ port: parseInt(options.port), host: options.host });
  });

// MCP server (stdio)
program
  .command('mcp')
  .description('Start MCP server (stdio transport)')
  .action(async () => {
    const { startMcpServer } = await import('./mcp/server.js');
    await startMcpServer();
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
      log.info('Cache cleared');
    } else if (options.stats) {
      const stats = getCacheStats();
      log.info('Cache Statistics');
      log.info(`  Entries: ${stats.count}`);
      log.info(`  Size:    ${(stats.size / 1024).toFixed(2)} KB`);

      if (stats.entries.length > 0) {
        log.info('  Recent entries:');
        stats.entries.slice(0, 10).forEach(entry => {
          log.info(`    - ${entry.url}`);
          log.info(`      Cached: ${entry.cachedAt}`);
        });
      }
    } else {
      log.info('Usage:');
      log.info('  webfetch cache --stats   # Show cache statistics');
      log.info('  webfetch cache --clear   # Clear all cache');
    }
  });

program.parse();
