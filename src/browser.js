import { chromium, firefox } from 'playwright';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = join(__dirname, '../auth');

const BROWSERS = { chrome: chromium, firefox };

let context = null;

/**
 * Launch browser with persistent profile (for OAuth login)
 */
export async function launch(options = {}) {
  if (context) return context;

  const browserType = options.browser || 'chrome';
  const launcher = BROWSERS[browserType];

  if (!launcher) {
    throw new Error(`Unsupported browser: ${browserType}`);
  }

  const profileDir = join(AUTH_DIR, `${browserType}-profile`);

  console.log(`→ Launching ${browserType}...`);

  context = await launcher.launchPersistentContext(profileDir, {
    headless: options.headless ?? false,
    viewport: { width: 1280, height: 800 },
    args: browserType === 'chrome'
      ? ['--disable-blink-features=AutomationControlled']
      : [],
  });

  return context;
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
