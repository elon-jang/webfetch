import { launch, getPage, close } from '../browser.js';
import { createLogger } from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';
import { ContentError } from '../utils/errors.js';

const NAVER_BLOG_REGEX = /^https?:\/\/blog\.naver\.com\//;
const log = createLogger('naver');

const REMOVE_SELECTORS = [
  'header', 'footer', 'nav',
  'script', 'style', 'noscript', 'svg',
  'button', 'input', 'form', 'select',
  '[class*="share"]', '[class*="social"]',
  '[class*="sidebar"]', '[class*="comment"]',
  '[class*="ad"]', '[class*="banner"]',
  '[class*="related"]', '[class*="recommend"]',
  '[class*="profile"]', '[class*="writer"]',
  '.blog-category', '.post-tag',
  '[class*="btn"]', '[class*="tool"]',
  '[class*="menu"]', '[class*="search"]',
];

export const naver = {
  name: 'naver',

  match(url) {
    return NAVER_BLOG_REGEX.test(url);
  },

  async scrape(url, options = {}) {
    // Naver Blog uses iframes - always requires Playwright
    await launch(options);
    const page = await getPage();
    page.setDefaultTimeout(60000);

    try {
      return await withRetry(
        async () => {
          log.info(`Scraping: ${url}`);
          await page.goto(url, { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(3000);

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

async function extractContent(page, url) {
  // Naver Blog content is inside #mainFrame iframe
  let contentFrame = null;

  // Wait for iframe to load
  try {
    const frameElement = await page.waitForSelector('#mainFrame', { timeout: 10000 });
    contentFrame = await frameElement.contentFrame();
  } catch {
    // Some newer Naver Blog posts may not use iframes
    log.info('No iframe found, trying direct extraction...');
  }

  const targetFrame = contentFrame || page;

  // Wait for content to render
  await targetFrame.waitForSelector(
    '.se-main-container, .post-view, #postViewArea, .post_ct',
    { timeout: 15000 }
  ).catch(() => {
    log.info('Content selector not found, trying fallback...');
  });

  const title = await targetFrame.$eval(
    '.se-title-text, .pcol1, .htitle, h3.se_textarea',
    el => el.textContent?.trim()
  ).catch(async () => {
    // Fallback: page title
    return await page.title();
  });

  const html = await targetFrame.evaluate((selectors) => {
    // Try multiple content selectors
    const contentSelectors = [
      '.se-main-container',  // Smart Editor 3
      '#postViewArea',       // Old editor
      '.post-view',          // Another variant
      '.post_ct',            // Yet another variant
      'article',
    ];

    let article = null;
    for (const sel of contentSelectors) {
      article = document.querySelector(sel);
      if (article) break;
    }

    if (!article) article = document.querySelector('main') || document.body;

    const clone = article.cloneNode(true);

    selectors.forEach(sel => {
      clone.querySelectorAll(sel).forEach(el => el.remove());
    });

    // Remove inline styles
    clone.querySelectorAll('[style]').forEach(el => el.removeAttribute('style'));
    clone.querySelectorAll('[class]').forEach(el => el.removeAttribute('class'));

    // Remove empty elements
    clone.querySelectorAll('p, div, span').forEach(el => {
      const text = el.textContent?.trim() || '';
      if ((!text || text.length < 2) && !el.querySelector('img, picture, figure')) {
        el.remove();
      }
    });

    return clone.innerHTML;
  }, REMOVE_SELECTORS);

  const metadata = await targetFrame.evaluate(() => {
    const author = document.querySelector('.nick, .blog_author, .nickname')?.textContent?.trim();
    const category = document.querySelector('.category, .blog-category, .pcol2')?.textContent?.trim();
    const dateEl = document.querySelector('.se_publishDate, .date, .blog_date, .pcol1');
    const date = dateEl?.textContent?.trim();
    return { author, category, date };
  }).catch(() => ({}));

  if (!html || html.trim().length < 100) {
    throw new ContentError('Extracted content too short', {
      url,
      contentLength: html?.length || 0,
      hint: '네이버 블로그 구조가 변경되었을 수 있습니다. --keep-open으로 페이지 확인',
    });
  }

  log.info(`Extracted: ${title} (${html?.length || 0} chars)`);

  return { title, html, url, metadata };
}

export default naver;
