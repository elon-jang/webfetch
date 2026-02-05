/**
 * Download images from HTML and replace src URLs with local paths.
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, basename, extname } from 'path';
import { createHash } from 'crypto';
import { createLogger } from './logger.js';

const log = createLogger('images');

/**
 * Extract image URLs from HTML, download them, and replace src with local paths.
 * @param {string} html - Input HTML
 * @param {string} baseUrl - Base URL for resolving relative paths
 * @param {string} outputDir - Directory to save images
 * @returns {Promise<string>} HTML with local image paths
 */
export async function downloadImages(html, baseUrl, outputDir) {
  const imgDir = join(outputDir, 'images');
  if (!existsSync(imgDir)) {
    mkdirSync(imgDir, { recursive: true });
  }

  // Extract all img src URLs
  const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
  const urls = new Map();
  let match;

  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1];
    if (!urls.has(src)) {
      urls.set(src, null);
    }
  }

  if (urls.size === 0) return html;

  log.info(`Downloading ${urls.size} images...`);

  // Download each image
  for (const [src] of urls) {
    try {
      const absoluteUrl = resolveUrl(src, baseUrl);
      if (!absoluteUrl) continue;

      const response = await fetch(absoluteUrl, {
        signal: AbortSignal.timeout(15000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });

      if (!response.ok) continue;

      const buffer = Buffer.from(await response.arrayBuffer());
      const ext = guessExtension(response.headers.get('content-type'), absoluteUrl);
      const hash = createHash('md5').update(absoluteUrl).digest('hex').slice(0, 8);
      const filename = `${hash}${ext}`;
      const localPath = join(imgDir, filename);

      writeFileSync(localPath, buffer);
      urls.set(src, `images/${filename}`);

      log.debug(`Downloaded: ${filename}`);
    } catch (error) {
      log.debug(`Failed to download image: ${src} - ${error.message}`);
    }
  }

  // Replace src URLs in HTML
  let result = html;
  for (const [originalSrc, localPath] of urls) {
    if (localPath) {
      result = result.replaceAll(originalSrc, localPath);
    }
  }

  const downloaded = [...urls.values()].filter(Boolean).length;
  log.info(`Downloaded ${downloaded}/${urls.size} images`);

  return result;
}

function resolveUrl(src, baseUrl) {
  try {
    if (src.startsWith('data:')) return null;
    return new URL(src, baseUrl).href;
  } catch {
    return null;
  }
}

function guessExtension(contentType, url) {
  if (contentType?.includes('png')) return '.png';
  if (contentType?.includes('gif')) return '.gif';
  if (contentType?.includes('webp')) return '.webp';
  if (contentType?.includes('svg')) return '.svg';

  const ext = extname(new URL(url).pathname).split('?')[0];
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) return ext;

  return '.jpg'; // default
}
