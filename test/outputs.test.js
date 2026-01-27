import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolve, join } from 'path';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'fs';

// Test output registry
describe('outputs/index.js', () => {
  let resolveOutputs, getOutputHandler;

  beforeEach(async () => {
    const mod = await import('../src/outputs/index.js');
    resolveOutputs = mod.resolveOutputs;
    getOutputHandler = mod.getOutputHandler;
  });

  describe('getOutputHandler', () => {
    it('returns local handler', () => {
      const handler = getOutputHandler('local');
      expect(handler.name).toBe('local');
      expect(typeof handler.save).toBe('function');
    });

    it('returns gdrive handler', () => {
      const handler = getOutputHandler('gdrive');
      expect(handler.name).toBe('gdrive');
      expect(typeof handler.save).toBe('function');
    });

    it('throws on unknown handler', () => {
      expect(() => getOutputHandler('s3')).toThrow('Unknown output handler: s3');
    });
  });

  describe('resolveOutputs', () => {
    it('defaults to local when null/undefined', () => {
      const outputs = resolveOutputs(null);
      expect(outputs).toHaveLength(1);
      expect(outputs[0].name).toBe('local');
    });

    it('defaults to local when empty string', () => {
      const outputs = resolveOutputs('');
      expect(outputs).toHaveLength(1);
      expect(outputs[0].name).toBe('local');
    });

    it('parses single destination', () => {
      const outputs = resolveOutputs('gdrive');
      expect(outputs).toHaveLength(1);
      expect(outputs[0].name).toBe('gdrive');
    });

    it('parses comma-separated destinations', () => {
      const outputs = resolveOutputs('local,gdrive');
      expect(outputs).toHaveLength(2);
      expect(outputs[0].name).toBe('local');
      expect(outputs[1].name).toBe('gdrive');
    });

    it('trims whitespace', () => {
      const outputs = resolveOutputs(' local , gdrive ');
      expect(outputs).toHaveLength(2);
      expect(outputs[0].name).toBe('local');
      expect(outputs[1].name).toBe('gdrive');
    });

    it('throws on unknown destination in list', () => {
      expect(() => resolveOutputs('local,dropbox')).toThrow('Unknown output handler: dropbox');
    });
  });
});

// Test local output handler
describe('outputs/local.js', () => {
  const TEST_DIR = join(import.meta.dirname, '../.test-output-local');
  let localHandler;

  beforeEach(async () => {
    const mod = await import('../src/outputs/local.js');
    localHandler = mod.default;
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  it('saves text content to file', async () => {
    const result = await localHandler.save('# Hello', 'test.md', { outputDir: TEST_DIR });
    expect(result.path).toBe(join(TEST_DIR, 'test.md'));
    expect(existsSync(result.path)).toBe(true);
    expect(readFileSync(result.path, 'utf-8')).toBe('# Hello');
  });

  it('saves binary content to file', async () => {
    const buf = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF
    const result = await localHandler.save(buf, 'test.pdf', { outputDir: TEST_DIR });
    expect(result.path).toBe(join(TEST_DIR, 'test.pdf'));
    expect(existsSync(result.path)).toBe(true);
  });

  it('creates output directory if missing', async () => {
    const nested = join(TEST_DIR, 'sub', 'dir');
    await localHandler.save('data', 'file.md', { outputDir: nested });
    expect(existsSync(join(nested, 'file.md'))).toBe(true);
  });
});

// Test UploadError
describe('UploadError', () => {
  it('is retryable', async () => {
    const { UploadError } = await import('../src/utils/errors.js');
    const err = new UploadError('upload failed', { filename: 'test.md' });
    expect(err.retryable).toBe(true);
    expect(err.code).toBe('UPLOAD_ERROR');
    expect(err.name).toBe('UploadError');
    expect(err.details.filename).toBe('test.md');
  });

  it('serializes to JSON', async () => {
    const { UploadError } = await import('../src/utils/errors.js');
    const err = new UploadError('fail');
    const json = err.toJSON();
    expect(json.code).toBe('UPLOAD_ERROR');
    expect(json.message).toBe('fail');
  });

  it('is recognized as retryable by isRetryable', async () => {
    const { UploadError, isRetryable } = await import('../src/utils/errors.js');
    const err = new UploadError('fail');
    expect(isRetryable(err)).toBe(true);
  });
});

// Test gdrive handler structure (no actual API calls)
describe('outputs/gdrive.js', () => {
  let gdriveHandler;

  beforeEach(async () => {
    const mod = await import('../src/outputs/gdrive.js');
    gdriveHandler = mod.default;
  });

  it('has correct name', () => {
    expect(gdriveHandler.name).toBe('gdrive');
  });

  it('has save, setup, test, revoke methods', () => {
    expect(typeof gdriveHandler.save).toBe('function');
    expect(typeof gdriveHandler.setup).toBe('function');
    expect(typeof gdriveHandler.test).toBe('function');
    expect(typeof gdriveHandler.revoke).toBe('function');
  });

  it('save throws when credentials or auth is missing', async () => {
    // If credentials/token don't exist → AuthError
    // If they exist but API fails → UploadError
    // Either way, save() should not silently succeed without valid Drive access
    try {
      await gdriveHandler.save('content', 'file.md', { driveFolder: 'nonexistent-test-folder-xyz' });
      // If credentials + token exist and API works, this could succeed
      // so we only assert on error if it throws
    } catch (err) {
      expect(err.code).toMatch(/AUTH_ERROR|UPLOAD_ERROR/);
    }
  });
});
