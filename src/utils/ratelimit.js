/**
 * Domain-based rate limiter for batch/sequential requests.
 * Ensures minimum delay between requests to the same domain.
 */

const domainTimestamps = new Map();

/**
 * Create a rate limiter with the given delay.
 * @param {number} delayMs - Minimum delay between requests to same domain (default: 2000)
 */
export function createRateLimiter(delayMs = 2000) {
  return { delayMs, timestamps: new Map() };
}

/**
 * Wait until the rate limit allows a request to the given URL's domain.
 * @param {object} limiter - Rate limiter from createRateLimiter
 * @param {string} url - URL to rate-limit by domain
 */
export async function waitForSlot(limiter, url) {
  if (!limiter || limiter.delayMs <= 0) return;

  let domain;
  try {
    domain = new URL(url).hostname;
  } catch {
    return; // Invalid URL, skip rate limiting
  }

  const timestamps = limiter.timestamps;
  const lastRequest = timestamps.get(domain) || 0;
  const now = Date.now();
  const elapsed = now - lastRequest;

  if (elapsed < limiter.delayMs) {
    const waitTime = limiter.delayMs - elapsed;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  timestamps.set(domain, Date.now());
}
