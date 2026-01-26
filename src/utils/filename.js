/**
 * Generate filename from title
 * Format: YYYY-MM-DD_제목.ext
 */
export function generateFilename(title, ext) {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Sanitize title for filename
  let safeName = (title || 'untitled')
    .replace(/[\/\\:*?"<>|]/g, '')  // Remove invalid chars
    .replace(/\s+/g, '_')            // Spaces to underscores
    .replace(/_+/g, '_')             // Multiple underscores to single
    .replace(/^_|_$/g, '')           // Trim underscores
    .slice(0, 80);                   // Max 80 chars

  return `${date}_${safeName}.${ext}`;
}
