import { launch, getPage, close } from '../browser.js';

const BASE_URL = 'https://livewiki.com';
const YOUTUBE_REGEX = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//;
const LIVEWIKI_CONTENT_REGEX = /^https?:\/\/(www\.)?livewiki\.com\/\w+\/content\//;

// Configurable extraction settings
const CONFIG = {
  // Elements to remove
  removeSelectors: [
    'header', 'footer', 'nav',
    '[class*="header"]', '[class*="footer"]', '[class*="nav"]',
    '[class*="sidebar"]', '[class*="menu"]',
    '[class*="share"]', '[class*="social"]',
    '[class*="comment"]', '[class*="login"]',
    '[class*="avatar"]', '[class*="thumbnail"]',
    '[class*="channel"]', '[class*="subscribe"]',
    'button', 'input', 'form', 'select',
    'style', 'script', 'noscript', 'svg',
  ],

  // Text patterns to remove
  removePatterns: [
    /^컬렉션에 저장$/,
    /^공유$/,
    /^한국어$/,
    /^로그인/,
    /^회원가입/,
    /^새 메모$/,
    /^타임라인$/,
    /^아티클$/,
    /^AI 채팅$/,
    /조회수.*전$/,
  ],
};

export const livewiki = {
  name: 'livewiki',

  match(url) {
    return YOUTUBE_REGEX.test(url) || LIVEWIKI_CONTENT_REGEX.test(url);
  },

  async scrape(url, options = {}) {
    await launch(options);
    const page = await getPage();

    try {
      if (YOUTUBE_REGEX.test(url)) {
        return await extractYouTube(page, url);
      }
      return await scrapeContent(page, url);
    } finally {
      if (!options.keepOpen) await close();
    }
  },
};

async function extractYouTube(page, youtubeUrl) {
  console.log('→ YouTube extraction mode');

  await page.goto(`${BASE_URL}/ko`);
  await page.waitForLoadState('networkidle');

  const isLoggedIn = await checkLogin(page);
  if (!isLoggedIn) {
    console.log('→ Login required. Please login in the browser...');
    await waitForLogin(page);
    console.log('→ Login successful!');
  }

  console.log(`→ Inputting YouTube URL: ${youtubeUrl}`);
  const input = await page.waitForSelector('input[type="text"], input[type="url"], textarea');
  await input.fill(youtubeUrl);

  await page.keyboard.press('Enter');
  console.log('→ Processing video... (this may take a while)');

  // Wait for either content page or login modal
  await page.waitForTimeout(3000);

  // Check if login modal appeared
  const currentUrl = page.url();
  if (currentUrl.includes('login-modal') || currentUrl.includes('login')) {
    console.log('→ Login modal detected. Please login in the browser...');
    await page.waitForURL(/\/content\//, { timeout: 300000 });
  } else if (!currentUrl.includes('/content/')) {
    // Wait for content page
    await page.waitForURL(/\/content\//, { timeout: 300000 });
  }

  const resultUrl = page.url();
  console.log(`→ Extraction complete: ${resultUrl}`);

  return await scrapeContent(page, resultUrl);
}

async function scrapeContent(page, url) {
  console.log(`→ Scraping: ${url}`);

  await page.goto(url);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Extract 핵심요약 and 타임라인 from default view
  const result = await page.evaluate((config) => {
    // Get title
    const titleEl = document.querySelector('h1');
    const title = titleEl?.textContent?.trim() || document.title;

    // Helper: clean text
    const cleanText = (text) => {
      if (!text) return '';
      return text.trim().replace(/\s+/g, ' ');
    };

    // Helper: check if text should be removed
    const shouldRemove = (text) => {
      const patterns = config.removePatterns.map(p => new RegExp(p));
      return patterns.some(p => p.test(text));
    };

    // Extract 핵심요약
    let summaryHtml = '';
    const summarySection = document.querySelector('[class*="summary"], [class*="핵심"]');
    if (summarySection) {
      const items = summarySection.querySelectorAll('h5, p, li');
      const summaryItems = [];
      items.forEach(item => {
        const text = cleanText(item.textContent);
        if (text && text.length > 10 && !shouldRemove(text)) {
          summaryItems.push(text);
        }
      });
      if (summaryItems.length > 0) {
        summaryHtml = '<h2>핵심 요약</h2><ol>' +
          summaryItems.map(s => `<li>${s}</li>`).join('') + '</ol>';
      }
    }

    // If no summary section found, try to find by text content
    if (!summaryHtml) {
      const allElements = document.querySelectorAll('h3, h4, h5');
      allElements.forEach(el => {
        if (el.textContent?.includes('핵심 요약') || el.textContent?.includes('핵심요약')) {
          let container = el.parentElement;
          const items = [];
          let sibling = el.nextElementSibling;
          while (sibling && !sibling.matches('h2, h3')) {
            const text = cleanText(sibling.textContent);
            if (text && text.length > 10 && !shouldRemove(text)) {
              // Extract just the content, skip numbers
              const content = text.replace(/^\d+\s*/, '');
              if (content.length > 10) items.push(content);
            }
            sibling = sibling.nextElementSibling;
          }
          if (items.length > 0) {
            summaryHtml = '<h2>핵심 요약</h2><ol>' +
              items.map(s => `<li>${s}</li>`).join('') + '</ol>';
          }
        }
      });
    }

    // Extract 타임라인 (timestamps with content)
    let timelineHtml = '';
    const timelineItems = [];
    const allText = document.body.querySelectorAll('*');

    allText.forEach(el => {
      const text = el.textContent?.trim() || '';
      // Match timestamp pattern like "00:00", "01:25", "12:51"
      if (/^\d{1,2}:\d{2}$/.test(text) && el.tagName !== 'SCRIPT') {
        // Get the content after timestamp
        let content = '';
        let next = el.nextElementSibling;

        // Try to find content in next siblings
        while (next && !(/^\d{1,2}:\d{2}$/.test(next.textContent?.trim()))) {
          const nextText = cleanText(next.textContent);
          if (nextText && nextText.length > 5 && !shouldRemove(nextText)) {
            // Check if it's a heading (section title)
            if (next.matches('h2, h3, h4') || next.querySelector('h2, h3, h4')) {
              content = `<strong>${nextText}</strong>`;
              break;
            } else if (next.matches('h5, p, span, div')) {
              content = nextText;
              break;
            }
          }
          next = next.nextElementSibling;
        }

        // Also check parent's next sibling
        if (!content) {
          const parent = el.parentElement;
          if (parent) {
            let nextParent = parent.nextElementSibling;
            if (nextParent) {
              const nextText = cleanText(nextParent.textContent);
              if (nextText && nextText.length > 5 && !shouldRemove(nextText)) {
                content = nextText;
              }
            }
          }
        }

        if (content && content.length > 5) {
          timelineItems.push({ time: text, content });
        }
      }
    });

    // Deduplicate timeline items and merge same timestamps
    const timeMap = new Map();
    timelineItems.forEach(item => {
      const existing = timeMap.get(item.time);
      // Keep the longer/better content, prefer non-bold headings
      if (!existing ||
          (item.content.length > existing.content.length && !item.content.startsWith('**'))) {
        timeMap.set(item.time, item);
      }
    });
    const uniqueTimeline = Array.from(timeMap.values());

    if (uniqueTimeline.length > 0) {
      timelineHtml = '<h2>타임라인</h2><ul>' +
        uniqueTimeline.map(item =>
          `<li><strong>${item.time}</strong> ${item.content}</li>`
        ).join('') + '</ul>';
    }

    // Combine summary and timeline
    let html = '';
    if (summaryHtml) html += summaryHtml;
    if (timelineHtml) html += timelineHtml;

    // Extract metadata
    const description = document.querySelector('meta[name="description"]')?.content || '';

    return { title, html, description, summaryHtml, timelineHtml };
  }, CONFIG);

  // Click on 아티클 tab to extract article content
  let articleHtml = '';
  try {
    let articleTab = null;

    // Try multiple selectors to find the 아티클 tab
    const selectors = [
      'text="아티클"',
      ':text("아티클")',
      '[data-state] >> text="아티클"',
    ];

    for (const selector of selectors) {
      try {
        articleTab = await page.$(selector);
        if (articleTab) {
          const isVisible = await articleTab.isVisible();
          if (isVisible) break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    // Fallback: search through all elements
    if (!articleTab) {
      const candidates = await page.$$('button, [role="tab"], div, span');
      for (const el of candidates) {
        try {
          const text = await el.textContent();
          const isVisible = await el.isVisible();
          if (text && text.trim() === '아티클' && isVisible) {
            articleTab = el;
            break;
          }
        } catch (e) {
          // Skip
        }
      }
    }

    if (articleTab) {
      console.log('→ Clicking 아티클 tab...');
      await articleTab.click();
      await page.waitForTimeout(3000);

      // Get the summary texts to exclude duplicates
      const summaryTexts = result.summaryHtml
        ? result.summaryHtml.match(/<li>(.*?)<\/li>/g)?.map(m => m.replace(/<\/?li>/g, '').substring(0, 40)) || []
        : [];

      articleHtml = await page.evaluate((data) => {
        const { config, summaryPrefixes } = data;

        const cleanText = (text) => {
          if (!text) return '';
          return text.trim().replace(/\s+/g, ' ');
        };

        const shouldRemove = (text) => {
          const patterns = config.removePatterns.map(p => new RegExp(p));
          return patterns.some(p => p.test(text));
        };

        const isDuplicate = (text) => {
          return summaryPrefixes.some(prefix => text.startsWith(prefix));
        };

        // Get all text lines from body
        const body = document.body.innerText;
        const lines = body.split('\n')
          .map(l => l.trim())
          .filter(l => l.length > 60)  // Only substantial paragraphs
          .filter(l => !shouldRemove(l))
          .filter(l => !isDuplicate(l))
          // Exclude title, menu items, timestamps
          .filter(l => !l.startsWith('['))  // Skip title
          .filter(l => !/^\d{1,2}:\d{2}$/.test(l))  // Skip standalone timestamps
          .filter(l => !l.includes('로그인'))
          .filter(l => !l.includes('컬렉션'));

        // Deduplicate
        const seen = new Set();
        const uniqueLines = lines.filter(l => {
          const key = l.substring(0, 50);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        // Skip summary items (first 3 are usually summary)
        const articleLines = uniqueLines.slice(3);

        if (articleLines.length > 0) {
          return articleLines.map(p => `<p>${p}</p>`).join('');
        }

        return '';
      }, { config: CONFIG, summaryPrefixes: summaryTexts });

      if (articleHtml && articleHtml.length > 100) {
        articleHtml = '<h2>아티클</h2>' + articleHtml;
      } else {
        articleHtml = '';
        console.log('→ 아티클 content not found or too short');
      }
    } else {
      console.log('→ 아티클 tab not found');
    }
  } catch (e) {
    console.log('→ 아티클 tab error:', e.message);
  }

  // Combine all sections
  let finalHtml = result.html;
  if (articleHtml) {
    finalHtml += articleHtml;
  }

  // If no structured content found, fall back to basic extraction
  if (!finalHtml) {
    finalHtml = await page.evaluate((config) => {
      const main = document.querySelector('main, article, .content');
      if (main) {
        const clone = main.cloneNode(true);
        config.removeSelectors.forEach(sel => {
          clone.querySelectorAll(sel).forEach(el => el.remove());
        });
        return clone.innerHTML;
      }
      return '';
    }, CONFIG);
  }

  console.log(`→ Extracted: ${result.title}`);

  return {
    title: result.title,
    html: finalHtml,
    url,
    metadata: { description: result.description },
  };
}

async function checkLogin(page) {
  // Check if login button exists
  const hasLoginButton = await page.evaluate(() => {
    const elements = document.querySelectorAll('button, a, span');
    for (const el of elements) {
      if (el.textContent?.trim() === '로그인') return true;
    }
    return false;
  });
  return !hasLoginButton;
}

async function waitForLogin(page) {
  console.log('→ Waiting for login (5 min timeout)...');
  await page.waitForFunction(() => {
    // Check if login button still exists
    const elements = document.querySelectorAll('button, a, span');
    let hasLoginBtn = false;
    for (const el of elements) {
      if (el.textContent?.trim() === '로그인') {
        hasLoginBtn = true;
        break;
      }
    }

    // Check if user is logged in (avatar or profile element exists)
    const userAvatar = document.querySelector('[class*="avatar"], [class*="profile"], [class*="user-menu"]');

    // Return true when logged in (no login button OR avatar exists)
    return !hasLoginBtn || userAvatar;
  }, { timeout: 300000, polling: 1000 });
}

export default livewiki;
