#!/usr/bin/env node

import { Command } from 'commander';
import { writeFileSync } from 'fs';
import { getAdapter, listAdapters } from './adapters/index.js';
import { toMarkdown } from './formatters/markdown.js';
import { toPdf } from './formatters/pdf.js';

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

const program = new Command();

program
  .name('webfetch')
  .description('Web scraping CLI - LiveWiki & Longblack')
  .version('1.0.0');

program
  .argument('<url>', 'URL to scrape (YouTube URL or content URL)')
  .option('-f, --format <type>', 'output format (markdown, json, pdf)', 'markdown')
  .option('-o, --output <path>', 'save to file (auto-generated if not specified for pdf)')
  .option('-b, --browser <type>', 'browser (chrome, firefox)', 'chrome')
  .option('--headless', 'run headless (not recommended for login)', false)
  .option('--keep-open', 'keep browser open after scrape', false)
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

      const result = await adapter.scrape(url, {
        browser: options.browser,
        headless: options.headless,
        keepOpen: options.keepOpen,
      });

      // Format output
      const format = options.format.toLowerCase();
      let output;
      let ext = format === 'pdf' ? 'pdf' : format === 'json' ? 'json' : 'md';

      if (format === 'json') {
        output = JSON.stringify(result, null, 2);
      } else if (format === 'pdf') {
        output = await toPdf(result);
      } else {
        output = toMarkdown(result);
      }

      // Determine output path
      const outputPath = options.output || (format === 'pdf' || options.output === undefined
        ? generateFilename(result.title, ext)
        : null);

      // Save or print
      if (outputPath) {
        writeFileSync(outputPath, output);
        console.log(`\n✓ Saved to: ${outputPath}`);
      } else {
        console.log('\n' + '─'.repeat(50) + '\n');
        console.log(output);
      }

    } catch (error) {
      console.error(`\n✖ Error: ${error.message}`);
      process.exit(1);
    }
  });

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
    console.log();
  });

program.parse();
