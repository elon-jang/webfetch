import { launch, getPage, close } from '../browser.js';

const LONGBLACK_REGEX = /^https?:\/\/(www\.)?longblack\.co/;

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
      console.log(`→ Scraping: ${url}`);
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);

      const needsLogin = await checkPaywall(page);

      if (needsLogin) {
        console.log('→ Login required. Please login in the browser...');
        await performLogin(page);
        console.log('→ Login successful!');
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2000);
      }

      return await extractContent(page, url);
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

async function performLogin(page) {
  const loginBtn = await page.$('button:has-text("로그인"), a:has-text("로그인"), [href*="login"]');
  if (loginBtn) await loginBtn.click();
  if (!page.url().includes('login')) {
    await page.goto('https://www.longblack.co/login', { waitUntil: 'domcontentloaded' });
  }
  console.log('→ Complete login in the browser window...');
  await page.waitForURL(
    url => new URL(url).hostname.includes('longblack.co') && !url.includes('login'),
    { timeout: 300000 }
  );
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

  console.log(`→ Extracted: ${title} (${html?.length || 0} chars)`);

  return { title, html, url, metadata };
}

export default longblack;
