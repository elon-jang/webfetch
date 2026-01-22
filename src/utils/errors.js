/**
 * Custom error classes for webfetch
 */

export class WebfetchError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'WebfetchError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
    };
  }
}

export class NetworkError extends WebfetchError {
  constructor(message, details = {}) {
    super(message, 'NETWORK_ERROR', details);
    this.name = 'NetworkError';
    this.retryable = true;
  }
}

export class TimeoutError extends WebfetchError {
  constructor(message, details = {}) {
    super(message, 'TIMEOUT_ERROR', details);
    this.name = 'TimeoutError';
    this.retryable = true;
  }
}

export class AuthError extends WebfetchError {
  constructor(message, details = {}) {
    super(message, 'AUTH_ERROR', details);
    this.name = 'AuthError';
    this.retryable = false;
  }
}

export class ContentError extends WebfetchError {
  constructor(message, details = {}) {
    super(message, 'CONTENT_ERROR', details);
    this.name = 'ContentError';
    this.retryable = false;
  }
}

export class AdapterError extends WebfetchError {
  constructor(message, details = {}) {
    super(message, 'ADAPTER_ERROR', details);
    this.name = 'AdapterError';
    this.retryable = false;
  }
}

/**
 * Check if error is retryable
 */
export function isRetryable(error) {
  if (error instanceof WebfetchError) {
    return error.retryable;
  }
  // Playwright errors that are retryable
  const retryableMessages = [
    'net::ERR_',
    'Navigation timeout',
    'Timeout',
    'Protocol error',
    'Connection refused',
    'ECONNRESET',
    'ETIMEDOUT',
  ];
  return retryableMessages.some(msg => error.message?.includes(msg));
}

/**
 * Wrap error with more context
 */
export function wrapError(error, context = {}) {
  if (error instanceof WebfetchError) {
    error.details = { ...error.details, ...context };
    return error;
  }

  // Determine error type from message
  const message = error.message || String(error);

  if (message.includes('Timeout') || message.includes('timeout')) {
    return new TimeoutError(message, { originalError: error.name, ...context });
  }

  if (message.includes('net::') || message.includes('ECONNR') || message.includes('ETIMEDOUT')) {
    return new NetworkError(message, { originalError: error.name, ...context });
  }

  if (message.includes('login') || message.includes('auth') || message.includes('Login')) {
    return new AuthError(message, { originalError: error.name, ...context });
  }

  return new WebfetchError(message, 'UNKNOWN_ERROR', { originalError: error.name, ...context });
}
