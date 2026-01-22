/**
 * Retry utility with exponential backoff
 */

import { isRetryable, wrapError } from './errors.js';
import { logger } from './logger.js';

const DEFAULT_OPTIONS = {
  maxRetries: 3,
  initialDelay: 1000,  // 1 second
  maxDelay: 10000,     // 10 seconds
  backoffFactor: 2,
  onRetry: null,       // callback(error, attempt)
};

/**
 * Execute function with retry logic
 * @param {Function} fn - Async function to execute
 * @param {Object} options - Retry options
 * @returns {Promise<any>} - Result of fn
 */
export async function withRetry(fn, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError;

  for (let attempt = 1; attempt <= opts.maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = wrapError(error, { attempt });

      // Don't retry if not retryable or last attempt
      if (!isRetryable(lastError) || attempt > opts.maxRetries) {
        throw lastError;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.initialDelay * Math.pow(opts.backoffFactor, attempt - 1),
        opts.maxDelay
      );

      logger.warn(`Attempt ${attempt}/${opts.maxRetries} failed: ${error.message}`);
      logger.info(`Retrying in ${delay / 1000}s...`);

      // Call onRetry callback if provided
      if (opts.onRetry) {
        opts.onRetry(lastError, attempt);
      }

      // Wait before retry
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a retryable version of a function
 */
export function makeRetryable(fn, options = {}) {
  return (...args) => withRetry(() => fn(...args), options);
}

export default withRetry;
