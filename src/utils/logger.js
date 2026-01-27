/**
 * Simple logger with levels and timestamps
 */

const LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const COLORS = {
  error: '\x1b[31m', // red
  warn: '\x1b[33m',  // yellow
  info: '\x1b[36m',  // cyan
  debug: '\x1b[90m', // gray
  reset: '\x1b[0m',
};

class Logger {
  constructor(options = {}) {
    this.level = LEVELS[options.level] ?? LEVELS.info;
    this.prefix = options.prefix || '';
  }

  _log(level, ...args) {
    if (LEVELS[level] > this.level) return;

    const timestamp = new Date().toISOString().slice(11, 19);
    const color = COLORS[level];
    const prefix = this.prefix ? `[${this.prefix}] ` : '';
    const levelTag = level.toUpperCase().padEnd(5);

    console.error(
      `${COLORS.debug}${timestamp}${COLORS.reset} ${color}${levelTag}${COLORS.reset} ${prefix}${args.join(' ')}`
    );
  }

  error(...args) { this._log('error', ...args); }
  warn(...args) { this._log('warn', ...args); }
  info(...args) { this._log('info', ...args); }
  debug(...args) { this._log('debug', ...args); }

  // Simple progress indicator
  progress(message) {
    process.stderr.write(`\r→ ${message}`);
  }

  // Clear progress line
  clearProgress() {
    process.stderr.write('\r\x1b[K');
  }
}

// Default logger instance
export const logger = new Logger({ level: 'info' });

// Create logger with prefix
export function createLogger(prefix, level = 'info') {
  return new Logger({ prefix, level });
}

export default logger;
