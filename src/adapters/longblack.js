import { launch, getPage, close } from '../browser.js';
import { createLogger } from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';
import { AuthError, ContentError } from '../utils/errors.js';

const LONGBLACK_REGEX = /^https?:\/\/(www\.)?longblack\.co/;
const HOMEPAGE_REGEX = /^https?:\/\/(www\.)?longblack\.co\/?$/;
const log = createLogger('longblack');

// Configurable selectors for content extraction
const CONFIG = {
  // Selectors to find main content
  contentSelectors: [
    '[class*="note-content"]',
    '[class*="note-body"]',
    'article',
  ],

  // Elements to remove (extensible list)
  removeSelectors: [
    // Navigation & UI
    'header', 'footer', 'nav',
    '[class*="header"]', '[class*="footer"]', '[class*="nav"]',
    '[class*="sidebar"]', '[class*="menu"]',

    // Social & Interactive
    '[class*="share"]', '[class*="social"]',
    '[class*="comment"]', '[class*="related"]',
    '[class*="recommend"]', '[class*="subscribe"]',
    '[class*="banner"]', '[class*="ad-"]',

    // Audio/Video player
    'audio', 'video',
    '[class*="audio"]', '[class*="player"]',
    '[class*="playback"]', '[class*="speed"]',

    // Intro/Promo sections
    '[class*="intro"]', '[class*="promo"]',
    '[class*="tag"]', '[class*="badge"]',
    '[class*="category"]', '[class*="label"]',

    // Author/Meta info at top
    '[class*="author-info"]', '[class*="writer-info"]',
    '[class*="meta"]', '[class*="info-box"]',

    // Misc UI elements
    'style', 'script', 'noscript', 'svg',
    'button', 'input', 'form', 'select',
    '[class*="copyright"]', '[class*="rights"]',
    '[class*="stamp"]', '[class*="icon"]',

    // Reading time indicator
    '[class*="time"]', '[class*="duration"]',
  ],

  // Text patterns to identify and skip intro sections
  introPatterns: [
    /^오늘의 노트/,
    /지식 구독 서비스/,
    /소요 시간/,
    /프렌즈 [A-Z]/,
    /AI 성우/,
  ],
};

export const longblack = {
  name: 'longblack',

  match(url) {
    return LONGBLACK_REGEX.test(url);
  },

  async scrape(url, options = {}) {
    await launch(options);
    const page = await getPage();
    page.setDefaultTimeout(60000);

    try {
      return await withRetry(
        async () => {
          // Check if homepage - need to find today's article first
          const isHomepage = HOMEPAGE_REGEX.test(url);
          let targetUrl = url;

          if (isHomepage) {
            log.info('Homepage detected. Finding today\'s article...');
            targetUrl = await getTodayArticleUrl(page);
            log.info(`Today's article: ${targetUrl}`);
          }

          log.info(`Scraping: ${targetUrl}`);
          await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(2000);

          const needsLogin = await checkPaywall(page);

          if (needsLogin) {
            log.info('Login required. Please login in the browser...');
            await performLogin(page);
            log.info('Login successful!');
            await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2000);
          }

          return await extractContent(page, targetUrl);
        },
        {
          maxRetries: options.maxRetries ?? 3,
          onRetry: (error, attempt) => {
            log.warn(`Retry ${attempt}: ${error.message}`);
          },
        }
      );
    } finally {
      if (!options.keepOpen) await close();
    }
  },
};

async function checkPaywall(page) {
  if (page.url().includes('/login')) return true;
  const content = await page.$('article, [class*="note-content"], main');
  if (!content) return true;
  return false;
}

async function checkHomepageLogin(page) {
  // On homepage, check for login prompt or redirect
  if (page.url().includes('/login')) return true;

  // Check for note links - if present, we're logged in
  const hasNoteLinks = await page.$('a[href*="/note/"]');
  if (hasNoteLinks) return false;

  // Check for "로그인" button prominently displayed
  const loginPrompt = await page.$('button:has-text("로그인"), [href*="login"]:visible');
  if (loginPrompt) return true;

  return false;
}

async function performLogin(page) {
  const loginBtn = await page.$('button:has-text("로그인"), a:has-text("로그인"), [href*="login"]');
  if (loginBtn) await loginBtn.click();
  if (!page.url().includes('login')) {
    await page.goto('https://www.longblack.co/login', { waitUntil: 'domcontentloaded' });
  }
  log.info('Complete login in the browser window...');
  await page.waitForURL(
    url => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      return urlStr.includes('longblack.co') && !urlStr.includes('login');
    },
    { timeout: 300000 }
  );
}

async function getTodayArticleUrl(page) {
  log.info('Navigating to Longblack homepage...');
  await page.goto('https://longblack.co', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Check if login needed on homepage (different check than article page)
  const needsLogin = await checkHomepageLogin(page);
  if (needsLogin) {
    log.info('Login required to access homepage...');
    await performLogin(page);
    await page.goto('https://longblack.co', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
  }

  // Find today's article URL
  // Strategy 1: Look for first article link in note section
  const articleUrl = await page.evaluate(() => {
    // Try data-tab="note" container first (from screenshot)
    const noteSection = document.querySelector('[data-tab="note"]');
    if (noteSection) {
      const link = noteSection.querySelector('a[href*="/note/"]');
      if (link) return link.href;
    }

    // Strategy 2: First article card with /note/ link
    const articleLink = document.querySelector('a[href*="/note/"]');
    if (articleLink) return articleLink.href;

    // Strategy 3: Any link containing note path
    const allLinks = Array.from(document.querySelectorAll('a[href]'));
    const noteLink = allLinks.find(a => /\/note\/\d+/.test(a.href));
    if (noteLink) return noteLink.href;

    return null;
  });

  if (!articleUrl) {
    throw new ContentError('Could not find today\'s article on homepage', {
      url: 'https://longblack.co',
      hint: 'Homepage structure may have changed',
    });
  }

  return articleUrl;
}

async function extractContent(page, url) {
  const title = await page.$eval('h1', el => el.textContent?.trim()).catch(() => page.title());

  const html = await page.evaluate((config) => {
    // Find main content container
    let article = null;
    for (const sel of config.contentSelectors) {
      article = document.querySelector(sel);
      if (article) break;
    }
    if (!article) article = document.querySelector('main') || document.body;

    const clone = article.cloneNode(true);

    // Remove unwanted elements
    config.removeSelectors.forEach(sel => {
      clone.querySelectorAll(sel).forEach(el => el.remove());
    });

    // Remove inline styles
    clone.querySelectorAll('[style]').forEach(el => el.removeAttribute('style'));

    // Remove class attributes (cleaner output)
    clone.querySelectorAll('[class]').forEach(el => el.removeAttribute('class'));

    // Get all text nodes and filter intro content
    const introPatterns = config.introPatterns.map(p => new RegExp(p));

    // Find and remove intro paragraphs
    const paragraphs = clone.querySelectorAll('p, div, span, li');
    paragraphs.forEach(p => {
      const text = p.textContent?.trim() || '';
      // Remove if matches intro pattern or is very short metadata-like text
      if (introPatterns.some(pattern => pattern.test(text))) {
        p.remove();
      }
      // Remove empty or whitespace-only elements
      if (!text || text.length < 2) {
        p.remove();
      }
    });

    // Remove links that are just navigation (short text, no context)
    clone.querySelectorAll('a').forEach(a => {
      const text = a.textContent?.trim() || '';
      if (text.length < 10 && !a.querySelector('img')) {
        // Keep if parent has more content
        const parentText = a.parentElement?.textContent?.trim() || '';
        if (parentText.length < 20) {
          a.parentElement?.remove();
        }
      }
    });

    // Remove images that look like icons (small or placeholder)
    clone.querySelectorAll('img').forEach(img => {
      const src = img.src || '';
      if (src.includes('icon') || src.includes('avatar') || src.includes('logo')) {
        img.remove();
      }
    });

    return clone.innerHTML;
  }, CONFIG);

  const metadata = await page.evaluate(() => ({
    description: document.querySelector('meta[property="og:description"]')?.content,
  }));

  log.info(`Extracted: ${title} (${html?.length || 0} chars)`);

  return { title, html, url, metadata };
}

export default longblack;
