import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { normalizeDate } from '../utils/filename.js';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});

// Enable GFM tables, strikethrough, etc.
turndown.use(gfm);

// Remove unwanted elements
turndown.remove(['script', 'style', 'noscript', 'iframe', 'nav', 'footer']);

/**
 * Convert HTML to Markdown with frontmatter
 * @param {object} result - { title, html, url, metadata }
 * @param {object} options - { obsidian: boolean }
 */
export function toMarkdown(result, options = {}) {
  const { title, html, url, metadata = {} } = result;

  const content = turndown.turndown(html || '');

  const frontmatter = [
    '---',
    `title: "${(title || '').replace(/"/g, '\\"')}"`,
    `url: ${url}`,
    `scraped_at: ${new Date().toISOString()}`,
  ];

  const publishDate = metadata.date ? normalizeDate(metadata.date) : null;
  if (publishDate) frontmatter.push(`date: ${publishDate}`);

  if (metadata.author) frontmatter.push(`author: "${metadata.author}"`);
  if (metadata.description) {
    frontmatter.push(`description: "${metadata.description.slice(0, 200).replace(/"/g, '\\"')}"`);
  }

  // Obsidian-compatible tags
  if (options.obsidian) {
    const tags = ['webfetch'];
    if (metadata.source) tags.push(metadata.source);
    if (metadata.publication) tags.push(metadata.publication.toLowerCase().replace(/\s+/g, '-'));
    frontmatter.push(`tags: [${tags.join(', ')}]`);
    frontmatter.push(`aliases: ["${(title || '').replace(/"/g, '\\"')}"]`);
  }

  frontmatter.push('---');

  return `${frontmatter.join('\n')}\n\n# ${title || 'Untitled'}\n\n${content}`;
}
