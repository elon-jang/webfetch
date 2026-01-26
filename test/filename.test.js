import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateFilename } from '../src/utils/filename.js';

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
});
