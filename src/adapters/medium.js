import { createLogger } from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';
import { AuthError, ContentError } from '../utils/errors.js';

const MEDIUM_REGEX = /^https?:\/\/(www\.)?medium\.com\//;
const CUSTOM_DOMAIN_REGEX = /^https?:\/\/[^/]+\/[a-f0-9]+-[a-f0-9]+$/;
const SUBDOMAIN_REGEX = /^https?:\/\/\w+\.medium\.com\//;
const log = createLogger('medium');

const REMOVE_SELECTORS = [
  'header', 'footer', 'nav',
  'script', 'style', 'noscript', 'svg',
  'button', 'input', 'form', 'select',
  '[class*="share"]', '[class*="social"]',
  '[class*="sidebar"]', '[class*="metabar"]',
  '[class*="related"]', '[class*="recommend"]',
  '[class*="response"]', '[class*="postActions"]',
  '[class*="ad"]', '[class*="banner"]',
  '[role="navigation"]',
];

export const medium = {
  name: 'medium',

  match(url) {
    return MEDIUM_REGEX.test(url) || SUBDOMAIN_REGEX.test(url);
  },

  async scrape(url, options = {}) {
    return await withRetry(
      async () => {
        // Medium articles are SSR - try lightweight first
        log.info(`Trying lightweight extraction: ${url}`);
        const result = await lightweightScrape(url);

        if (result && result.html && result.html.length >= 200) {
          log.info(`Lightweight extraction succeeded (${result.html.length} chars)`);
          return result;
        }

        // Fallback to browser
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
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new AuthError('Medium member-only content', {
        url,
        hint: 'Medium 유료 회원 전용 콘텐츠입니다. 브라우저에서 로그인 후 다시 시도하세요',
      });
    }
    return null;
  }

  const html = await response.text();

  // Detect member-only paywall
  if (html.includes('meteredContent') || html.includes('paywall')) {
    throw new AuthError('Medium member-only content detected', {
      url,
      hint: 'Medium 유료 회원 전용 콘텐츠입니다',
    });
  }

  const { document } = parseHTML(html);

  const baseEl = document.createElement('base');
  baseEl.href = url;
  document.head.appendChild(baseEl);

  const reader = new Readability(document);
  const article = reader.parse();

  if (!article) return null;

  // Extract Medium-specific metadata
  const author = article.byline
    || document.querySelector('meta[name="author"]')?.content;
  const publication = document.querySelector('meta[property="og:site_name"]')?.content;
  const readingTime = document.querySelector('[class*="readingTime"]')?.textContent?.trim();
  const date = document.querySelector('meta[property="article:published_time"]')?.content
    || document.querySelector('time[datetime]')?.getAttribute('datetime');

  return {
    title: article.title || 'Untitled',
    html: article.content || '',
    url,
    metadata: {
      author: author || undefined,
      description: article.excerpt || undefined,
      publication: publication || undefined,
      readingTime: readingTime || undefined,
      date: date || undefined,
    },
  };
}

async function browserScrape(url, options) {
  const { launch, getPage, close } = await import('../browser.js');

  await launch(options);
  const page = await getPage();
  page.setDefaultTimeout(60000);

  try {
    log.info(`Browser scraping: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Check for member-only wall
    const isMemberOnly = await page.evaluate(() => {
      return !!document.querySelector('[data-testid="paywall"]')
        || document.body.textContent?.includes('Member-only story');
    });

    if (isMemberOnly) {
      throw new AuthError('Medium member-only content', {
        url,
        hint: 'Medium 유료 회원 전용 콘텐츠입니다. --keep-open으로 브라우저에서 로그인하세요',
      });
    }

    const title = await page.$eval('h1', el => el.textContent?.trim()).catch(() => page.title());

    const html = await page.evaluate((selectors) => {
      const article = document.querySelector('article') || document.querySelector('main');
      if (!article) return '';

      const clone = article.cloneNode(true);
      selectors.forEach(sel => {
        clone.querySelectorAll(sel).forEach(el => el.remove());
      });

      clone.querySelectorAll('[style]').forEach(el => el.removeAttribute('style'));
      clone.querySelectorAll('[class]').forEach(el => el.removeAttribute('class'));

      return clone.innerHTML;
    }, REMOVE_SELECTORS);

    const metadata = await page.evaluate(() => {
      const author = document.querySelector('meta[name="author"]')?.content;
      const description = document.querySelector('meta[property="og:description"]')?.content;
      const publication = document.querySelector('meta[property="og:site_name"]')?.content;
      const date = document.querySelector('meta[property="article:published_time"]')?.content
        || document.querySelector('time[datetime]')?.getAttribute('datetime')
        || undefined;
      return { author, description, publication, date };
    });

    if (!html || html.length < 100) {
      throw new ContentError('Could not extract Medium article content', {
        url,
        hint: '사이트 구조 변경 가능성. --keep-open으로 페이지 확인',
      });
    }

    return { title, html, url, metadata };
  } finally {
    if (!options.keepOpen) await close();
  }
}

export default medium;
