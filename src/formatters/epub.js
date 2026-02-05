/**
 * Convert scrape result to EPUB format.
 * Uses epub-gen-memory for in-memory EPUB generation.
 */

import EPub from 'epub-gen-memory';

/**
 * Generate EPUB buffer from scrape result.
 * @param {object} result - { title, html, url, metadata }
 * @returns {Promise<Buffer>}
 */
export async function toEpub(result) {
  const { title, html, url, metadata = {} } = result;

  const options = {
    title: title || 'Untitled',
    author: metadata.author || 'webfetch',
    publisher: metadata.siteName || metadata.publication || 'webfetch',
    description: metadata.description || '',
    css: `
      body { font-family: serif; line-height: 1.6; }
      h1, h2, h3 { margin-top: 1em; }
      img { max-width: 100%; }
      blockquote { margin-left: 1em; border-left: 3px solid #ccc; padding-left: 1em; }
    `,
    content: [
      {
        title: title || 'Untitled',
        data: `
          <div>
            <p><small>Source: <a href="${url}">${url}</a></small></p>
            <p><small>Scraped at: ${new Date().toISOString()}</small></p>
            <hr/>
            ${html || '<p>No content</p>'}
          </div>
        `,
      },
    ],
  };

  const buffer = await EPub.default(options);
  return Buffer.from(buffer);
}
