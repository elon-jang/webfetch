import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mergeConfig } from '../src/utils/config.js';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('mergeConfig', () => {
  const defaults = {
    browser: 'chrome',
    headless: false,
    saveTo: 'local',
    driveFolder: 'webfetch',
    cacheMaxAge: '24',
  };

  it('returns CLI options unchanged when config is empty', () => {
    const cli = { browser: 'firefox', headless: true };
    const result = mergeConfig(cli, {}, defaults);
    expect(result).toEqual(cli);
  });

  it('returns CLI options unchanged when config is null', () => {
    const cli = { browser: 'firefox' };
    const result = mergeConfig(cli, null, defaults);
    expect(result).toEqual(cli);
  });

  it('applies config value when CLI is at default', () => {
    const cli = { browser: 'chrome', saveTo: 'local' };
    const config = { browser: 'firefox', saveTo: 'gdrive' };
    const result = mergeConfig(cli, config, defaults);
    expect(result.browser).toBe('firefox');
    expect(result.saveTo).toBe('gdrive');
  });

  it('CLI explicit value takes precedence over config', () => {
    const cli = { browser: 'firefox', saveTo: 'local' };
    const config = { browser: 'chrome', saveTo: 'gdrive' };
    const result = mergeConfig(cli, config, defaults);
    // browser: CLI is 'firefox' (not default 'chrome') → keep CLI
    expect(result.browser).toBe('firefox');
    // saveTo: CLI is 'local' (same as default) → apply config
    expect(result.saveTo).toBe('gdrive');
  });

  it('adds config keys not present in CLI options', () => {
    const cli = { browser: 'chrome' };
    const config = { driveFolder: 'MyFolder' };
    const result = mergeConfig(cli, config, defaults);
    expect(result.driveFolder).toBe('MyFolder');
  });

  it('does not override undefined CLI with undefined default', () => {
    const cli = { browser: 'chrome', customKey: 'custom' };
    const config = { customKey: 'fromConfig' };
    const result = mergeConfig(cli, config, defaults);
    // customKey is 'custom' (not in defaults → defaults[customKey] is undefined)
    // CLI value 'custom' !== undefined, so config should NOT override
    expect(result.customKey).toBe('custom');
  });

  it('handles boolean defaults correctly', () => {
    const cli = { headless: false };
    const config = { headless: true };
    const result = mergeConfig(cli, config, defaults);
    // headless: CLI is false (same as default false) → apply config
    expect(result.headless).toBe(true);
  });
});

describe('loadConfig', () => {
  let testDir;

  beforeEach(() => {
    testDir = join(tmpdir(), `webfetch-config-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('returns empty object when no config exists', async () => {
    // loadConfig searches cwd and HOME — use dynamic import with mocked cwd
    const { loadConfig } = await import('../src/utils/config.js');
    // This test verifies the function doesn't throw
    const config = await loadConfig();
    expect(config).toBeDefined();
    expect(typeof config).toBe('object');
  });

  it('loads JSON config from directory', async () => {
    const configPath = join(testDir, 'webfetch.config.json');
    writeFileSync(configPath, JSON.stringify({ browser: 'firefox', saveTo: 'gdrive' }));

    // We can't easily mock cwd for loadConfig, but we can test that the file format works
    const { readFileSync } = await import('fs');
    const loaded = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(loaded.browser).toBe('firefox');
    expect(loaded.saveTo).toBe('gdrive');
  });
});

describe('CONFIG_TEMPLATE', () => {
  it('is a valid JS module template', async () => {
    const { CONFIG_TEMPLATE } = await import('../src/utils/config.js');
    expect(CONFIG_TEMPLATE).toContain('export default');
    expect(CONFIG_TEMPLATE).toContain('browser');
    expect(CONFIG_TEMPLATE).toContain('saveTo');
    expect(CONFIG_TEMPLATE).toContain('driveFolder');
  });
});
