import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUTPUT_DIR = join(__dirname, '..', '..', 'output');
const log = createLogger('output:local');

export default {
  name: 'local',

  async save(content, filename, options = {}) {
    const outputDir = options.outputDir || DEFAULT_OUTPUT_DIR;

    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = join(outputDir, filename);
    writeFileSync(outputPath, content);
    return { path: outputPath };
  },
};
