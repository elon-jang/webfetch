/**
 * MCP tool definitions for webfetch.
 * Wraps handler.js functions with zod schemas.
 */

import { z } from 'zod';
import {
  scrape,
  getHistory,
  readFile,
  getCacheInfo,
  clearCache,
  uploadToGdrive,
} from '../handler.js';

/**
 * Register all webfetch tools on the MCP server.
 */
export function registerTools(server) {
  // ─── webfetch_scrape ───
  server.registerTool(
    'webfetch_scrape',
    {
      title: 'Scrape URL',
      description: 'Scrape a URL (YouTube, Longblack, TheMiilk, Medium, Substack, Naver Blog, or any URL) and save as Markdown/PDF/EPUB',
      inputSchema: {
        url: z.string().describe('URL to scrape'),
        format: z.enum(['md', 'pdf', 'epub', 'both']).optional().describe('Output format (default: both md+pdf)'),
        downloadImages: z.boolean().optional().describe('Download images locally'),
      },
    },
    async ({ url, format, downloadImages }) => {
      const result = await scrape(url, { format: format || 'both', downloadImages });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  // ─── webfetch_history ───
  server.registerTool(
    'webfetch_history',
    {
      title: 'List History',
      description: 'List scraped files in the output directory',
      inputSchema: {},
    },
    async () => {
      const files = getHistory();
      return {
        content: [{ type: 'text', text: JSON.stringify({ files }, null, 2) }],
      };
    }
  );

  // ─── webfetch_download ───
  server.registerTool(
    'webfetch_download',
    {
      title: 'Download File',
      description: 'Get content of a scraped file (text files only; returns path for PDFs)',
      inputSchema: {
        filename: z.string().describe('Filename from history'),
      },
    },
    async ({ filename }) => {
      const data = readFile(filename);
      if (!data) {
        return { content: [{ type: 'text', text: `File not found: ${filename}` }], isError: true };
      }
      if (data.type === 'binary') {
        return {
          content: [{ type: 'text', text: `Binary file (${data.size} bytes): ${data.path}` }],
        };
      }
      return {
        content: [{ type: 'text', text: data.content }],
      };
    }
  );

  // ─── webfetch_cache ───
  server.registerTool(
    'webfetch_cache',
    {
      title: 'Manage Cache',
      description: 'View cache statistics or clear the cache',
      inputSchema: {
        action: z.enum(['stats', 'clear']).describe('"stats" to view, "clear" to delete all'),
      },
    },
    async ({ action }) => {
      if (action === 'clear') {
        const result = clearCache();
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      }
      const stats = getCacheInfo();
      return { content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }] };
    }
  );

  // ─── webfetch_search ───
  server.registerTool(
    'webfetch_search',
    {
      title: 'Search Output Files',
      description: 'Search through scraped files for matching content',
      inputSchema: {
        query: z.string().describe('Search query (case-insensitive substring match)'),
      },
    },
    async ({ query }) => {
      const files = getHistory();
      const matches = [];

      for (const file of files) {
        if (file.format !== 'md' && file.format !== 'json') continue;

        const data = readFile(file.name);
        if (!data || data.type !== 'text') continue;

        if (data.content.toLowerCase().includes(query.toLowerCase())) {
          const lines = data.content.split('\n');
          const matchingLines = lines
            .filter(l => l.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 3)
            .map(l => l.trim().slice(0, 200));

          matches.push({
            file: file.name,
            format: file.format,
            preview: matchingLines,
          });
        }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ query, totalMatches: matches.length, matches }, null, 2),
        }],
      };
    }
  );

  // ─── webfetch_gdrive_upload ───
  server.registerTool(
    'webfetch_gdrive_upload',
    {
      title: 'Upload to Google Drive',
      description: 'Upload a previously scraped file to Google Drive',
      inputSchema: {
        filename: z.string().describe('Filename from history to upload'),
        driveFolder: z.string().optional().describe('Drive folder name or ID (default: web_fetch)'),
      },
    },
    async ({ filename, driveFolder }) => {
      try {
        const result = await uploadToGdrive(filename, { driveFolder });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Upload failed: ${error.message}` }], isError: true };
      }
    }
  );
}
