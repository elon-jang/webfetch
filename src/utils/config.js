import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { createLogger } from './logger.js';

const log = createLogger('config');

const CONFIG_FILENAMES = [
  'webfetch.config.js',
  'webfetch.config.json',
  '.webfetchrc.json',
];

/**
 * Load config from file.
 * Search order: cwd → home directory.
 * JS config uses dynamic import; JSON uses readFileSync.
 */
export async function loadConfig() {
  const searchDirs = [
    process.cwd(),
    process.env.HOME || process.env.USERPROFILE,
  ].filter(Boolean);

  for (const dir of searchDirs) {
    for (const filename of CONFIG_FILENAMES) {
      const filepath = join(dir, filename);
      if (!existsSync(filepath)) continue;

      try {
        let config;
        if (filename.endsWith('.js')) {
          const mod = await import(pathToFileURL(filepath).href);
          config = mod.default || mod;
        } else {
          config = JSON.parse(readFileSync(filepath, 'utf-8'));
        }
        log.info(`Config loaded: ${filepath}`);
        return config;
      } catch (err) {
        log.warn(`Failed to load config ${filepath}: ${err.message}`);
      }
    }
  }

  return {};
}

/**
 * Merge config with CLI options.
 * CLI options take precedence over config file values.
 * Only applies config values for keys that are at CLI default.
 */
export function mergeConfig(cliOptions, config, defaults) {
  if (!config || Object.keys(config).length === 0) return cliOptions;

  const merged = { ...cliOptions };

  for (const [key, value] of Object.entries(config)) {
    // camelCase config key → check if CLI option is still at default
    if (merged[key] === undefined || merged[key] === defaults[key]) {
      merged[key] = value;
    }
  }

  return merged;
}

/**
 * Default config template content
 */
export const CONFIG_TEMPLATE = `export default {
  // browser: 'chrome',
  // format: 'markdown',       // markdown, pdf, json (or omit for both md+pdf)
  // saveTo: 'local',          // local, gdrive, local,gdrive
  // driveFolder: '1NrzlShHPwlsvxMAKgmGqIBK6C8tnDioa',  // Drive folder name, path, or ID
  // driveOverwrite: false,    // overwrite existing Drive files
  // cacheMaxAge: '24',        // cache TTL in hours
  // headless: false,
  // serve: {
  //   authToken: 'your-secret-token',  // Bearer token for MCP endpoint auth
  // },
};
`;
