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
      description: 'Scrape a URL (YouTube via LiveWiki, Longblack) and save as Markdown/PDF',
      inputSchema: {
        url: z.string().describe('URL to scrape'),
        format: z.enum(['md', 'pdf', 'both']).optional().describe('Output format (default: both)'),
      },
    },
    async ({ url, format }) => {
      const result = await scrape(url, { format: format || 'both' });
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

  // ─── webfetch_gdrive_upload ───
  server.registerTool(
    'webfetch_gdrive_upload',
    {
      title: 'Upload to Google Drive',
      description: 'Upload a previously scraped file to Google Drive',
      inputSchema: {
        filename: z.string().describe('Filename from history to upload'),
        driveFolder: z.string().optional().describe('Drive folder name (default: webfetch)'),
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
