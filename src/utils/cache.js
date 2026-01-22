import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { createLogger } from './logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, '..', '..', '.cache');
const log = createLogger('cache');

/**
 * Generate cache key from URL
 */
function getCacheKey(url) {
  return createHash('md5').update(url).digest('hex');
}

/**
 * Get cache file path for URL
 */
function getCachePath(url) {
  const key = getCacheKey(url);
  return join(CACHE_DIR, `${key}.json`);
}

/**
 * Ensure cache directory exists
 */
function ensureCacheDir() {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * Check if cache exists and is valid
 * @param {string} url - URL to check
 * @param {number} maxAge - Max cache age in milliseconds (default: 24 hours)
 */
export function hasCache(url, maxAge = 24 * 60 * 60 * 1000) {
  const cachePath = getCachePath(url);

  if (!existsSync(cachePath)) {
    return false;
  }

  try {
    const stat = statSync(cachePath);
    const age = Date.now() - stat.mtimeMs;
    return age < maxAge;
  } catch {
    return false;
  }
}

/**
 * Get cached result
 * @param {string} url - URL to get cache for
 */
export function getCache(url) {
  const cachePath = getCachePath(url);

  if (!existsSync(cachePath)) {
    return null;
  }

  try {
    const data = JSON.parse(readFileSync(cachePath, 'utf-8'));
    log.debug(`Cache hit: ${url}`);
    return data;
  } catch (error) {
    log.warn(`Cache read error: ${error.message}`);
    return null;
  }
}

/**
 * Save result to cache
 * @param {string} url - URL to cache
 * @param {object} result - Scrape result to cache
 */
export function setCache(url, result) {
  ensureCacheDir();
  const cachePath = getCachePath(url);

  try {
    const data = {
      url,
      cachedAt: new Date().toISOString(),
      result,
    };
    writeFileSync(cachePath, JSON.stringify(data, null, 2));
    log.debug(`Cached: ${url}`);
  } catch (error) {
    log.warn(`Cache write error: ${error.message}`);
  }
}

/**
 * Clear cache for specific URL
 */
export function clearCache(url) {
  const cachePath = getCachePath(url);

  if (existsSync(cachePath)) {
    try {
      unlinkSync(cachePath);
      log.info(`Cache cleared: ${url}`);
    } catch (error) {
      log.warn(`Cache clear error: ${error.message}`);
    }
  }
}

/**
 * Clear all cache
 */
export function clearAllCache() {
  if (!existsSync(CACHE_DIR)) {
    return;
  }

  try {
    const files = readdirSync(CACHE_DIR);
    let count = 0;

    for (const file of files) {
      if (file.endsWith('.json')) {
        unlinkSync(join(CACHE_DIR, file));
        count++;
      }
    }

    log.info(`Cleared ${count} cache entries`);
  } catch (error) {
    log.warn(`Cache clear all error: ${error.message}`);
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  if (!existsSync(CACHE_DIR)) {
    return { count: 0, size: 0, entries: [] };
  }

  try {
    const files = readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'));
    let totalSize = 0;
    const entries = [];

    for (const file of files) {
      const filePath = join(CACHE_DIR, file);
      const stat = statSync(filePath);
      totalSize += stat.size;

      try {
        const data = JSON.parse(readFileSync(filePath, 'utf-8'));
        entries.push({
          url: data.url,
          cachedAt: data.cachedAt,
          size: stat.size,
        });
      } catch {
        // Skip invalid cache files
      }
    }

    return {
      count: files.length,
      size: totalSize,
      entries,
    };
  } catch (error) {
    return { count: 0, size: 0, entries: [], error: error.message };
  }
}

export default {
  hasCache,
  getCache,
  setCache,
  clearCache,
  clearAllCache,
  getCacheStats,
};
