import { launch, getPage, close } from '../browser.js';
import { createLogger } from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';
import { AuthError, ContentError } from '../utils/errors.js';

const THEMIILK_REGEX = /^https?:\/\/(www\.)?themiilk\.com/;
const log = createLogger('themiilk');

const CONFIG = {
  contentSelectors: [
    '.article-detail-content',
    '.article-body',
    'article',
  ],

  removeSelectors: [
    // Navigation & UI
    'header', 'footer', 'nav',
    'script', 'style', 'noscript', 'svg',

    // TheMiilk-specific
    '.article-detail-cta',     // 페이월 CTA
    '.free-article-list',      // 관련 기사
    '#tolon',                  // 댓글
    '.reporter-profile',       // 저자 정보 (메타데이터로 추출)
    '.notification-btn',       // 북마크 버튼
    '.collections', '.tags',   // 카테고리/태그

    // Interactive elements
    'button', 'input', 'form',

    // Generic patterns
    '[class*="share"]', '[class*="social"]',
    '[class*="ad"]', '[class*="banner"]',
    '[class*="sidebar"]',
  ],
};

export const themiilk = {
  name: 'themiilk',

  match(url) {
    return THEMIILK_REGEX.test(url);
  },

  async scrape(url, options = {}) {
    await launch(options);
    const page = await getPage();
    page.setDefaultTimeout(60000);

    try {
      return await withRetry(
        async () => {
          log.info(`Scraping: ${url}`);
          await page.goto(url, { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(3000);

          const needsLogin = await checkPaywall(page);

          if (needsLogin) {
            log.info('Login required. Please login in the browser...');
            await performLogin(page);
            log.info('Login successful!');
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2000);

            // Check paywall again after login
            const stillBlocked = await checkPaywall(page);
            if (stillBlocked) {
              throw new AuthError('Content still blocked after login', { url });
            }
          }

          return await extractContent(page, url);
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
  // Redirected to auth page
  if (page.url().includes('auth.themiilk.com')) return true;
  if (page.url().includes('/login')) return true;

  // No content found at all
  const content = await page.$('.article-detail-content, .article-body, article');
  if (!content) return true;

  // Paywall CTA present (partial content shown, rest hidden)
  const paywallCta = await page.$('.article-detail-cta');
  if (paywallCta) return true;

  return false;
}

async function performLogin(page) {
  // Navigate directly to login page
  await page.goto('https://themiilk.com/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  log.info('Complete login in the browser window...');
  await page.waitForURL(
    url => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      return urlStr.includes('themiilk.com') &&
        !urlStr.includes('/login') &&
        !urlStr.includes('auth.themiilk.com');
    },
    { timeout: 300000 }
  );
}

async function scrollToBottom(page) {
  log.info('Scrolling to load full article...');
  let prevHeight = 0;
  let stableCount = 0;

  while (stableCount < 3) {
    const currentHeight = await page.evaluate(() => document.body.scrollHeight);
    if (currentHeight === prevHeight) {
      stableCount++;
    } else {
      stableCount = 0;
    }
    prevHeight = currentHeight;
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
  }

  // Scroll back to top for consistent state
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
}

async function extractContent(page, url) {
  await scrollToBottom(page);

  const title = await page.$eval('h1', el => el.textContent?.trim()).catch(() => page.title());

  const html = await page.evaluate((config) => {
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

    // Remove class attributes
    clone.querySelectorAll('[class]').forEach(el => el.removeAttribute('class'));

    // Remove empty elements (preserve those containing images)
    clone.querySelectorAll('p, div, span').forEach(el => {
      const text = el.textContent?.trim() || '';
      if ((!text || text.length < 2) && !el.querySelector('img, picture, figure')) {
        el.remove();
      }
    });

    // Remove icon-like images
    clone.querySelectorAll('img').forEach(img => {
      const src = img.src || '';
      if (src.includes('icon') || src.includes('avatar') || src.includes('logo')) {
        img.remove();
      }
    });

    return clone.innerHTML;
  }, CONFIG);

  const metadata = await page.evaluate(() => {
    const author = document.querySelector('.reporter-profile')?.textContent?.trim();
    const description = document.querySelector('meta[property="og:description"]')?.content;
    return { author, description };
  });

  if (!html || html.trim().length < 100) {
    throw new ContentError('Extracted content too short, page may not have loaded correctly', {
      url,
      contentLength: html?.length || 0,
    });
  }

  log.info(`Extracted: ${title} (${html?.length || 0} chars)`);

  return { title, html, url, metadata };
}

export default themiilk;
