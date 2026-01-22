import { launch, getPage, close } from '../browser.js';

const BASE_URL = 'https://livewiki.com';
const YOUTUBE_REGEX = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//;
const LIVEWIKI_CONTENT_REGEX = /^https?:\/\/(www\.)?livewiki\.com\/\w+\/content\//;

export const livewiki = {
  name: 'livewiki',

  match(url) {
    return YOUTUBE_REGEX.test(url) || LIVEWIKI_CONTENT_REGEX.test(url);
  },

  async scrape(url, options = {}) {
    await launch(options);
    const page = await getPage();

    try {
      // Mode 1: YouTube URL → Extract via LiveWiki
      if (YOUTUBE_REGEX.test(url)) {
        return await extractYouTube(page, url);
      }

      // Mode 2: LiveWiki content URL → Direct scrape
      return await scrapeContent(page, url);
    } finally {
      if (!options.keepOpen) await close();
    }
  },
};

/**
 * Mode 1: YouTube URL extraction
 */
async function extractYouTube(page, youtubeUrl) {
  console.log('→ YouTube extraction mode');

  // Go to LiveWiki
  await page.goto(`${BASE_URL}/ko`);
  await page.waitForLoadState('networkidle');

  // Check if logged in, if not wait for manual login
  const isLoggedIn = await checkLogin(page);
  if (!isLoggedIn) {
    console.log('→ Login required. Please login in the browser...');
    await waitForLogin(page);
    console.log('→ Login successful!');
  }

  // Input YouTube URL
  console.log(`→ Inputting YouTube URL: ${youtubeUrl}`);
  const input = await page.waitForSelector('input[type="text"], input[type="url"], textarea');
  await input.fill(youtubeUrl);

  // Submit and wait for processing
  await page.keyboard.press('Enter');
  console.log('→ Processing video... (this may take a while)');

  // Wait for result page (content URL)
  await page.waitForURL(/\/content\//, { timeout: 300000 }); // 5 min timeout

  const resultUrl = page.url();
  console.log(`→ Extraction complete: ${resultUrl}`);

  // Scrape the result
  return await scrapeContent(page, resultUrl);
}

/**
 * Mode 2: Scrape LiveWiki content page
 */
async function scrapeContent(page, url) {
  console.log(`→ Scraping: ${url}`);

  await page.goto(url);
  await page.waitForLoadState('networkidle');

  // Extract title
  const title = await page.$eval('h1', el => el.textContent?.trim()).catch(() => null)
    || await page.title();

  // Extract main content
  const html = await page.$eval(
    'article, .content, main, .prose',
    el => el.innerHTML
  ).catch(() => page.$eval('body', el => el.innerHTML));

  // Extract metadata
  const metadata = await page.evaluate(() => ({
    description: document.querySelector('meta[name="description"]')?.content,
    author: document.querySelector('.author, [class*="author"]')?.textContent?.trim(),
  }));

  return { title, html, url, metadata };
}

/**
 * Check if user is logged in
 */
async function checkLogin(page) {
  // Look for login indicators (adjust selectors based on actual site)
  const loginButton = await page.$('button:has-text("로그인"), a:has-text("로그인"), [href*="login"]');
  return !loginButton;
}

/**
 * Wait for user to complete login
 */
async function waitForLogin(page) {
  // Wait until login button disappears or user avatar appears
  await page.waitForFunction(() => {
    const loginBtn = document.querySelector('button:has-text("로그인"), a:has-text("로그인")');
    const userAvatar = document.querySelector('[class*="avatar"], [class*="profile"]');
    return !loginBtn || userAvatar;
  }, { timeout: 300000 }); // 5 min timeout
}

export default livewiki;
