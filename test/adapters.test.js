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

  describe('TheMiilk URLs', () => {
    it('matches themiilk article URL', () => {
      const adapter = getAdapter('https://themiilk.com/articles/aa794cf5f');
      expect(adapter).toBeTruthy();
      expect(adapter.name).toBe('themiilk');
    });

    it('matches themiilk homepage', () => {
      const adapter = getAdapter('https://themiilk.com');
      expect(adapter).toBeTruthy();
      expect(adapter.name).toBe('themiilk');
    });

    it('matches themiilk with www', () => {
      const adapter = getAdapter('https://www.themiilk.com/articles/abc123');
      expect(adapter).toBeTruthy();
      expect(adapter.name).toBe('themiilk');
    });

    it('matches themiilk with trailing slash', () => {
      const adapter = getAdapter('https://themiilk.com/');
      expect(adapter).toBeTruthy();
      expect(adapter.name).toBe('themiilk');
    });

    it('matches themiilk http URL', () => {
      const adapter = getAdapter('http://themiilk.com/articles/xyz');
      expect(adapter).toBeTruthy();
      expect(adapter.name).toBe('themiilk');
    });
  });

  describe('Medium URLs', () => {
    it('matches medium.com article URL', () => {
      const adapter = getAdapter('https://medium.com/@user/article-title-abc123');
      expect(adapter).toBeTruthy();
      expect(adapter.name).toBe('medium');
    });

    it('matches subdomain.medium.com URL', () => {
      const adapter = getAdapter('https://blog.medium.com/some-post-abc123');
      expect(adapter).toBeTruthy();
      expect(adapter.name).toBe('medium');
    });
  });

  describe('Substack URLs', () => {
    it('matches substack post URL', () => {
      const adapter = getAdapter('https://newsletter.substack.com/p/some-post');
      expect(adapter).toBeTruthy();
      expect(adapter.name).toBe('substack');
    });

    it('matches substack homepage', () => {
      const adapter = getAdapter('https://mysubstack.substack.com');
      expect(adapter).toBeTruthy();
      expect(adapter.name).toBe('substack');
    });
  });

  describe('Naver Blog URLs', () => {
    it('matches naver blog post URL', () => {
      const adapter = getAdapter('https://blog.naver.com/user123/12345678');
      expect(adapter).toBeTruthy();
      expect(adapter.name).toBe('naver');
    });

    it('matches naver blog user page', () => {
      const adapter = getAdapter('https://blog.naver.com/user123');
      expect(adapter).toBeTruthy();
      expect(adapter.name).toBe('naver');
    });
  });

  describe('Generic URLs (catch-all)', () => {
    it('matches any http URL as generic', () => {
      const adapter = getAdapter('https://example.com');
      expect(adapter).toBeTruthy();
      expect(adapter.name).toBe('generic');
    });

    it('matches any https URL as generic', () => {
      const adapter = getAdapter('https://some-random-site.org/article');
      expect(adapter).toBeTruthy();
      expect(adapter.name).toBe('generic');
    });
  });

  describe('unsupported URLs', () => {
    it('returns undefined for empty string', () => {
      expect(getAdapter('')).toBeUndefined();
    });

    it('returns undefined for non-URL string', () => {
      expect(getAdapter('not-a-url')).toBeUndefined();
    });

    it('returns undefined for ftp URL', () => {
      expect(getAdapter('ftp://example.com')).toBeUndefined();
    });
  });
});

describe('listAdapters', () => {
  it('returns array of adapters', () => {
    const adapters = listAdapters();
    expect(Array.isArray(adapters)).toBe(true);
    expect(adapters.length).toBeGreaterThanOrEqual(3);
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
