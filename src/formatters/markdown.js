import TurndownService from 'turndown';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});

// Remove unwanted elements
turndown.remove(['script', 'style', 'noscript', 'iframe', 'nav', 'footer']);

/**
 * Convert HTML to Markdown with frontmatter
 */
export function toMarkdown(result) {
  const { title, html, url, metadata = {} } = result;

  const content = turndown.turndown(html || '');

  const frontmatter = [
    '---',
    `title: "${(title || '').replace(/"/g, '\\"')}"`,
    `url: ${url}`,
    `scraped_at: ${new Date().toISOString()}`,
  ];

  if (metadata.author) frontmatter.push(`author: "${metadata.author}"`);
  if (metadata.description) {
    frontmatter.push(`description: "${metadata.description.slice(0, 200).replace(/"/g, '\\"')}"`);
  }

  frontmatter.push('---');

  return `${frontmatter.join('\n')}\n\n# ${title || 'Untitled'}\n\n${content}`;
}
