import { chromium, firefox } from 'playwright';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from './utils/logger.js';
import { NetworkError } from './utils/errors.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = join(__dirname, '../auth');

const BROWSERS = { chrome: chromium, firefox };
const log = createLogger('browser');

let context = null;

/**
 * Launch browser with persistent profile (for OAuth login)
 */
export async function launch(options = {}) {
  if (context) return context;

  const browserType = options.browser || 'chrome';
  const launcher = BROWSERS[browserType];

  if (!launcher) {
    throw new NetworkError(`Unsupported browser: ${browserType}`, { browserType });
  }

  const profileDir = join(AUTH_DIR, `${browserType}-profile`);

  log.info(`Launching ${browserType}...`);

  try {
    const launchOptions = {
      headless: options.headless ?? false,
      viewport: { width: 1280, height: 800 },
      args: browserType === 'chrome'
        ? ['--disable-blink-features=AutomationControlled']
        : [],
    };

    if (options.proxy) {
      launchOptions.proxy = { server: options.proxy };
    }

    context = await launcher.launchPersistentContext(profileDir, launchOptions);

    log.debug('Browser launched successfully');
    return context;
  } catch (error) {
    log.error(`Failed to launch browser: ${error.message}`);
    throw new NetworkError(`Failed to launch ${browserType}: ${error.message}`, {
      browserType,
      originalError: error.name,
    });
  }
}

/**
 * Get current page or create new one
 */
export async function getPage() {
  if (!context) throw new Error('Browser not launched');
  return context.pages()[0] || await context.newPage();
}

/**
 * Close browser
 */
export async function close() {
  if (context) {
    await context.close();
    context = null;
  }
}

// Cleanup on exit
process.on('SIGINT', async () => { await close(); process.exit(0); });
process.on('SIGTERM', async () => { await close(); process.exit(0); });
