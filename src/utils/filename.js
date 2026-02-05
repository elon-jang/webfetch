/**
 * Generate filename from title
 * Format: YYYY-MM-DD_제목.ext (default)
 * @param {string} title
 * @param {string} ext
 * @param {object} [options] - { template, source, author }
 */
export function generateFilename(title, ext, options) {
  const now = new Date();
  const date = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const year = now.getFullYear().toString();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  // Sanitize title for filename
  const safeTitle = sanitize(title || 'untitled');

  if (options?.template) {
    const vars = {
      date,
      title: safeTitle,
      source: sanitize(options.source || 'unknown'),
      author: sanitize(options.author || 'unknown'),
      year,
      month,
    };

    let filename = options.template;
    for (const [key, value] of Object.entries(vars)) {
      filename = filename.replaceAll(`{${key}}`, value);
    }

    return `${filename}.${ext}`;
  }

  return `${date}_${safeTitle}.${ext}`;
}

function sanitize(str) {
  return str
    .replace(/[\/\\:*?"<>|]/g, '')  // Remove invalid chars
    .replace(/\s+/g, '_')            // Spaces to underscores
    .replace(/_+/g, '_')             // Multiple underscores to single
    .replace(/^_|_$/g, '')           // Trim underscores
    .slice(0, 80);                   // Max 80 chars
}
