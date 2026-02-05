/**
 * Normalize various date formats to YYYY-MM-DD.
 * Returns null if parsing fails.
 * @param {string} dateStr
 * @returns {string|null}
 */
export function normalizeDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;

  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  // ISO 8601 (e.g. 2026-01-15T09:00:00Z, 2026-01-15T09:00:00+09:00)
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }

  // Korean format: 2026년 1월 15일 or 2026.01.15
  const koreanMatch = trimmed.match(/(\d{4})[년.\-/]\s*(\d{1,2})[월.\-/]\s*(\d{1,2})/);
  if (koreanMatch) {
    const [, y, m, d] = koreanMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Try Date.parse as last resort
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

/**
 * Generate filename from title
 * Format: YYYY-MM-DD_제목.ext (default)
 * Uses publishDate (article publish date) if available, falls back to current date.
 * @param {string} title
 * @param {string} ext
 * @param {object} [options] - { template, source, author, publishDate }
 */
export function generateFilename(title, ext, options) {
  const now = new Date();
  const publishDate = options?.publishDate ? normalizeDate(options.publishDate) : null;
  const date = publishDate || now.toISOString().slice(0, 10); // YYYY-MM-DD
  const [yearStr] = date.split('-');
  const year = yearStr;
  const month = date.split('-')[1];

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
