import { createLogger } from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';
import { AuthError, ContentError } from '../utils/errors.js';

const GENERIC_REGEX = /^https?:\/\//;
const log = createLogger('generic');

const MIN_CONTENT_LENGTH = 200;

const REMOVE_SELECTORS = [
  'header', 'footer', 'nav',
  'script', 'style', 'noscript', 'svg',
  'button', 'input', 'form', 'select',
  '[class*="share"]', '[class*="social"]',
  '[class*="comment"]', '[class*="sidebar"]',
  '[class*="ad-"]', '[class*="banner"]',
  '[class*="cookie"]', '[class*="popup"]',
  '[class*="modal"]', '[class*="overlay"]',
  '[role="navigation"]', '[role="complementary"]',
];

export const generic = {
  name: 'generic',

  match(url) {
    return GENERIC_REGEX.test(url);
  },

  async scrape(url, options = {}) {
    return await withRetry(
      async () => {
        // Strategy 1: Lightweight fetch + Readability (no browser)
        log.info(`Trying lightweight extraction: ${url}`);
        const result = await lightweightScrape(url);

        if (result && result.html && result.html.length >= MIN_CONTENT_LENGTH) {
          log.info(`Lightweight extraction succeeded (${result.html.length} chars)`);
          return result;
        }

        // Strategy 2: Playwright + Readability (heavy)
        log.info('Lightweight extraction insufficient, falling back to browser...');
        return await browserScrape(url, options);
      },
      {
        maxRetries: options.maxRetries ?? 2,
        onRetry: (error, attempt) => {
          log.warn(`Retry ${attempt}: ${error.message}`);
        },
      }
    );
  },
};

async function lightweightScrape(url) {
  const { Readability } = await import('@mozilla/readability');
  const { parseHTML } = await import('linkedom');

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new AuthError(`Access denied (${response.status})`, {
        url,
        hint: '로그인이 필요한 사이트일 수 있습니다. --keep-open으로 브라우저에서 직접 확인하세요',
      });
    }
    throw new ContentError(`HTTP ${response.status}: ${response.statusText}`, { url });
  }

  const html = await response.text();
  const { document } = parseHTML(html);

  // Set document URL for Readability
  const baseEl = document.createElement('base');
  baseEl.href = url;
  document.head.appendChild(baseEl);

  const reader = new Readability(document);
  const article = reader.parse();

  if (!article) return null;

  const date = document.querySelector('meta[property="article:published_time"]')?.content
    || document.querySelector('meta[property="og:article:published_time"]')?.content
    || document.querySelector('meta[name="DC.date"]')?.content
    || document.querySelector('time[datetime]')?.getAttribute('datetime');

  return {
    title: article.title || 'Untitled',
    html: article.content || '',
    url,
    metadata: {
      author: article.byline || undefined,
      description: article.excerpt || undefined,
      siteName: article.siteName || undefined,
      date: date || undefined,
    },
  };
}

async function browserScrape(url, options) {
  const { launch, getPage, close } = await import('../browser.js');
  const { Readability } = await import('@mozilla/readability');
  const { parseHTML } = await import('linkedom');

  await launch(options);
  const page = await getPage();
  page.setDefaultTimeout(60000);

  try {
    log.info(`Browser scraping: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Check for common paywall indicators
    const paywallDetected = await page.evaluate(() => {
      const indicators = [
        '[class*="paywall"]', '[class*="subscribe"]',
        '[class*="premium"]', '[data-paywall]',
      ];
      return indicators.some(sel => document.querySelector(sel));
    });

    if (paywallDetected) {
      throw new AuthError('Paywall detected', {
        url,
        hint: '유료 구독이 필요한 콘텐츠입니다. --keep-open으로 브라우저에서 로그인하세요',
      });
    }

    const pageHtml = await page.content();
    const { document } = parseHTML(pageHtml);

    const baseEl = document.createElement('base');
    baseEl.href = url;
    document.head.appendChild(baseEl);

    const reader = new Readability(document);
    const article = reader.parse();

    // Extract metadata from page
    const metadata = await page.evaluate(() => {
      const author = document.querySelector('meta[name="author"]')?.content
        || document.querySelector('[rel="author"]')?.textContent?.trim();
      const description = document.querySelector('meta[property="og:description"]')?.content
        || document.querySelector('meta[name="description"]')?.content;
      const siteName = document.querySelector('meta[property="og:site_name"]')?.content;
      const date = document.querySelector('meta[property="article:published_time"]')?.content
        || document.querySelector('meta[property="og:article:published_time"]')?.content
        || document.querySelector('meta[name="DC.date"]')?.content
        || document.querySelector('time[datetime]')?.getAttribute('datetime')
        || undefined;
      return { author, description, siteName, date };
    });

    if (!article || !article.content || article.content.length < MIN_CONTENT_LENGTH) {
      // Last resort: raw DOM extraction
      const rawHtml = await page.evaluate((selectors) => {
        const main = document.querySelector('main, article, [role="main"], .content, #content');
        if (!main) return document.body.innerHTML;

        const clone = main.cloneNode(true);
        selectors.forEach(sel => {
          clone.querySelectorAll(sel).forEach(el => el.remove());
        });
        return clone.innerHTML;
      }, REMOVE_SELECTORS);

      if (!rawHtml || rawHtml.length < 100) {
        throw new ContentError('Could not extract meaningful content', {
          url,
          hint: '사이트 구조가 복잡하거나 JavaScript 렌더링이 필요할 수 있습니다. --keep-open으로 페이지 확인',
        });
      }

      const title = await page.$eval('h1', el => el.textContent?.trim()).catch(() => page.title());

      return { title, html: rawHtml, url, metadata };
    }

    return {
      title: article.title || 'Untitled',
      html: article.content,
      url,
      metadata: {
        author: metadata.author || article.byline || undefined,
        description: metadata.description || article.excerpt || undefined,
        siteName: metadata.siteName || article.siteName || undefined,
        date: metadata.date || undefined,
      },
    };
  } finally {
    if (!options.keepOpen) await close();
  }
}

export default generic;
