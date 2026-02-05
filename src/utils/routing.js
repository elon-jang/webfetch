/**
 * Output path routing: {source}/{YYYY} folder structure.
 *
 * Maps adapter names to display folder names and appends
 * the current year so files land in organized subdirectories.
 *
 *   Local:  output/LongBlack/2026/YYYY-MM-DD_title.md
 *   Drive:  Webfetch/LongBlack/2026/YYYY-MM-DD_title.md
 */

import { join } from 'path';

export const SOURCE_FOLDER_NAMES = {
  longblack: 'LongBlack',
  livewiki: 'YouTube',
  themiilk: 'TheMiilk',
  medium: 'Medium',
  substack: 'Substack',
  naver: 'NaverBlog',
  generic: 'General',
};

/**
 * Get display folder name for an adapter.
 * Returns null if adapter is unknown.
 */
export function getSourceFolder(adapterName) {
  return SOURCE_FOLDER_NAMES[adapterName] || null;
}

/**
 * Check if a string looks like a Google Drive folder ID
 * (10+ alphanumeric/dash/underscore chars, no slashes).
 */
function isDriveFolderId(value) {
  return /^[a-zA-Z0-9_-]{10,}$/.test(value);
}

/**
 * Wrap outputOptions to add {source}/{YYYY} routing.
 *
 * - outputDir:    always routed (append source/year)
 * - driveFolder:  routed only when it's a folder name (not a Drive ID)
 *
 * If adapterName is missing or unknown, returns options unchanged.
 */
export function routeOutputOptions(baseOptions, adapterName) {
  const sourceFolder = getSourceFolder(adapterName);
  if (!sourceFolder) return baseOptions;

  const year = new Date().getFullYear().toString();
  const subPath = `${sourceFolder}/${year}`;

  const routed = { ...baseOptions };

  // Local: always append subpath
  if (routed.outputDir) {
    routed.outputDir = join(routed.outputDir, subPath);
  }

  // Drive: only append when driveFolder is a human-readable name (not an ID)
  if (routed.driveFolder && !isDriveFolderId(routed.driveFolder)) {
    routed.driveFolder = `${routed.driveFolder}/${subPath}`;
  }

  return routed;
}
