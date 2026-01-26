import { describe, it, expect } from 'vitest';
import { getAdapter, listAdapters } from '../src/adapters/index.js';

describe('getAdapter', () => {
  describe('YouTube URLs', () => {
    it('matches youtu.be short URL', () => {
      const adapter = getAdapter('https://youtu.be/2z9JsnMDWHE');
      expect(adapter).toBeTruthy();
      expect(adapter.name).toBe('livewiki');
    });

    it('matches youtube.com watch URL', () => {
      const adapter = getAdapter('https://www.youtube.com/watch?v=2z9JsnMDWHE');
      expect(adapter).toBeTruthy();
      expect(adapter.name).toBe('livewiki');
    });

    it('matches youtube.com without www', () => {
      const adapter = getAdapter('https://youtube.com/watch?v=abc');
      expect(adapter).toBeTruthy();
      expect(adapter.name).toBe('livewiki');
    });

    it('matches http YouTube URL', () => {
      const adapter = getAdapter('http://youtu.be/abc');
      expect(adapter).toBeTruthy();
      expect(adapter.name).toBe('livewiki');
    });
  });

  describe('LiveWiki URLs', () => {
    it('matches livewiki content URL', () => {
      const adapter = getAdapter('https://livewiki.com/ko/content/article-slug');
      expect(adapter).toBeTruthy();
      expect(adapter.name).toBe('livewiki');
    });

    it('matches livewiki with www', () => {
      const adapter = getAdapter('https://www.livewiki.com/ko/content/article');
      expect(adapter).toBeTruthy();
      expect(adapter.name).toBe('livewiki');
    });
  });

  describe('Longblack URLs', () => {
    it('matches longblack note URL', () => {
      const adapter = getAdapter('https://longblack.co/note/1872');
      expect(adapter).toBeTruthy();
      expect(adapter.name).toBe('longblack');
    });

    it('matches longblack homepage', () => {
      const adapter = getAdapter('https://longblack.co');
      expect(adapter).toBeTruthy();
      expect(adapter.name).toBe('longblack');
    });

    it('matches longblack with www', () => {
      const adapter = getAdapter('https://www.longblack.co/note/123');
      expect(adapter).toBeTruthy();
      expect(adapter.name).toBe('longblack');
    });

    it('matches longblack with trailing slash', () => {
      const adapter = getAdapter('https://longblack.co/');
      expect(adapter).toBeTruthy();
      expect(adapter.name).toBe('longblack');
    });
  });

  describe('unsupported URLs', () => {
    it('returns undefined for unsupported URL', () => {
      expect(getAdapter('https://example.com')).toBeUndefined();
    });

    it('returns undefined for empty string', () => {
      expect(getAdapter('')).toBeUndefined();
    });

    it('returns undefined for Medium URL', () => {
      expect(getAdapter('https://medium.com/article')).toBeUndefined();
    });
  });
});

describe('listAdapters', () => {
  it('returns array of adapters', () => {
    const adapters = listAdapters();
    expect(Array.isArray(adapters)).toBe(true);
    expect(adapters.length).toBeGreaterThanOrEqual(2);
  });

  it('each adapter has name and match function', () => {
    const adapters = listAdapters();
    adapters.forEach(adapter => {
      expect(adapter.name).toBeTruthy();
      expect(typeof adapter.match).toBe('function');
      expect(typeof adapter.scrape).toBe('function');
    });
  });
});
