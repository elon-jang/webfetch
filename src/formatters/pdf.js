import { chromium } from 'playwright';

/**
 * Generate PDF from scraped content
 * @param {Object} result - Scraped content
 * @param {Object} options - PDF options
 * @param {boolean} options.showHeader - Show header with metadata (default: false)
 */
export async function toPdf(result, options = {}) {
  const { title, html, url } = result;
  const showHeader = options.showHeader ?? false;

  const headerHtml = showHeader ? `
    <div class="header">
      <div class="meta">
        <p>Source: <a href="${url}">${url}</a></p>
      </div>
    </div>
  ` : '';

  const styledHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title || 'Document'}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans KR', sans-serif;
      line-height: 1.8;
      color: #333;
      max-width: 700px;
      margin: 0 auto;
      padding: 40px 20px;
      font-size: 15px;
    }
    .header {
      border-bottom: 1px solid #eee;
      padding-bottom: 15px;
      margin-bottom: 25px;
    }
    .meta { font-size: 11px; color: #888; }
    .meta a { color: #666; }
    h1 { font-size: 26px; margin: 0 0 30px; color: #1a1a1a; font-weight: 700; }
    h2 { font-size: 20px; margin: 35px 0 15px; color: #222; }
    h3 { font-size: 17px; margin: 25px 0 10px; color: #333; }
    p { margin: 0 0 18px; }
    img { max-width: 100%; height: auto; margin: 20px 0; border-radius: 4px; }
    blockquote {
      border-left: 3px solid #ddd;
      margin: 25px 0;
      padding: 10px 20px;
      color: #555;
      background: #fafafa;
    }
    a { color: #0066cc; text-decoration: none; }
    strong { font-weight: 600; }
    ul, ol { margin: 15px 0; padding-left: 25px; }
    li { margin: 8px 0; }
  </style>
</head>
<body>
  ${headerHtml}
  <h1>${title || ''}</h1>
  <div class="content">${html || ''}</div>
</body>
</html>`;

  console.log('→ Generating PDF...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.setContent(styledHtml, { waitUntil: 'networkidle' });

  const pdfBuffer = await page.pdf({
    format: 'A4',
    margin: { top: '25mm', right: '20mm', bottom: '25mm', left: '20mm' },
    printBackground: true,
  });

  await browser.close();

  return pdfBuffer;
}
