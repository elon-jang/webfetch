import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateFilename, normalizeDate } from '../src/utils/filename.js';

describe('generateFilename', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-26T09:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('generates YYYY-MM-DD_title.ext format', () => {
    expect(generateFilename('Hello World', 'md')).toBe('2026-01-26_Hello_World.md');
  });

  it('handles PDF extension', () => {
    expect(generateFilename('My Article', 'pdf')).toBe('2026-01-26_My_Article.pdf');
  });

  it('sanitizes invalid filename characters', () => {
    expect(generateFilename('Title: with/slashes\\and*special?chars', 'md'))
      .toBe('2026-01-26_Title_withslashesandspecialchars.md');
  });

  it('replaces spaces with underscores', () => {
    expect(generateFilename('multiple   spaces   here', 'md'))
      .toBe('2026-01-26_multiple_spaces_here.md');
  });

  it('collapses multiple underscores', () => {
    expect(generateFilename('test___multiple___underscores', 'md'))
      .toBe('2026-01-26_test_multiple_underscores.md');
  });

  it('trims leading and trailing underscores', () => {
    expect(generateFilename('_leading_and_trailing_', 'md'))
      .toBe('2026-01-26_leading_and_trailing.md');
  });

  it('truncates title to 80 characters', () => {
    const longTitle = 'a'.repeat(100);
    const result = generateFilename(longTitle, 'md');
    // date (10) + _ (1) + title (80) + . (1) + ext (2) = 94
    expect(result).toBe(`2026-01-26_${'a'.repeat(80)}.md`);
  });

  it('handles null title', () => {
    expect(generateFilename(null, 'md')).toBe('2026-01-26_untitled.md');
  });

  it('handles undefined title', () => {
    expect(generateFilename(undefined, 'md')).toBe('2026-01-26_untitled.md');
  });

  it('handles empty string title', () => {
    expect(generateFilename('', 'md')).toBe('2026-01-26_untitled.md');
  });

  it('preserves Korean characters', () => {
    const result = generateFilename('예술 그게 돈이 돼', 'md');
    expect(result).toBe('2026-01-26_예술_그게_돈이_돼.md');
  });

  it('preserves emojis', () => {
    const result = generateFilename('🖼️ Art Title', 'md');
    expect(result).toContain('🖼️');
  });

  it('handles JSON extension', () => {
    expect(generateFilename('data', 'json')).toBe('2026-01-26_data.json');
  });

  it('uses publishDate when provided (ISO 8601)', () => {
    expect(generateFilename('Article', 'md', { publishDate: '2025-12-01T09:00:00Z' }))
      .toBe('2025-12-01_Article.md');
  });

  it('uses publishDate when provided (YYYY-MM-DD)', () => {
    expect(generateFilename('Article', 'md', { publishDate: '2025-11-15' }))
      .toBe('2025-11-15_Article.md');
  });

  it('falls back to current date when publishDate is null', () => {
    expect(generateFilename('Article', 'md', { publishDate: null }))
      .toBe('2026-01-26_Article.md');
  });

  it('falls back to current date when publishDate is invalid', () => {
    expect(generateFilename('Article', 'md', { publishDate: 'not-a-date' }))
      .toBe('2026-01-26_Article.md');
  });

  it('uses publishDate in template mode', () => {
    const opts = {
      publishDate: '2025-06-15T12:00:00Z',
      template: '{date}_{title}',
      source: 'medium',
      author: 'John',
    };
    expect(generateFilename('Test', 'md', opts)).toBe('2025-06-15_Test.md');
  });

  it('derives year/month from publishDate in template', () => {
    const opts = {
      publishDate: '2025-03-20',
      template: '{year}/{month}/{date}_{title}',
      source: 'blog',
    };
    expect(generateFilename('Post', 'md', opts)).toBe('2025/03/2025-03-20_Post.md');
  });
});

describe('normalizeDate', () => {
  it('returns YYYY-MM-DD as-is', () => {
    expect(normalizeDate('2026-01-15')).toBe('2026-01-15');
  });

  it('extracts date from ISO 8601', () => {
    expect(normalizeDate('2026-01-15T09:00:00Z')).toBe('2026-01-15');
  });

  it('extracts date from ISO 8601 with timezone offset', () => {
    expect(normalizeDate('2026-01-15T09:00:00+09:00')).toBe('2026-01-15');
  });

  it('parses Korean date format (년/월/일)', () => {
    expect(normalizeDate('2026년 1월 5일')).toBe('2026-01-05');
  });

  it('parses dot-separated format', () => {
    expect(normalizeDate('2026.01.15')).toBe('2026-01-15');
  });

  it('parses slash-separated format', () => {
    expect(normalizeDate('2026/1/5')).toBe('2026-01-05');
  });

  it('returns null for null input', () => {
    expect(normalizeDate(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(normalizeDate(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(normalizeDate('')).toBeNull();
  });

  it('returns null for non-string input', () => {
    expect(normalizeDate(12345)).toBeNull();
  });

  it('trims whitespace', () => {
    expect(normalizeDate('  2026-01-15  ')).toBe('2026-01-15');
  });

  it('handles "January 15, 2026" via Date.parse fallback', () => {
    const result = normalizeDate('January 15, 2026');
    // Date.parse may shift by timezone; just verify it produces a valid date
    expect(result).toMatch(/^2026-01-1[45]$/);
  });

  it('returns null for unparseable string', () => {
    expect(normalizeDate('not-a-date')).toBeNull();
  });
});
