import { describe, it, expect } from 'vitest';
import { toMarkdown } from '../src/formatters/markdown.js';

describe('toMarkdown', () => {
  it('generates frontmatter with title and url', () => {
    const result = {
      title: 'Test Article',
      html: '<p>Hello world</p>',
      url: 'https://example.com/article',
    };

    const md = toMarkdown(result);

    expect(md).toContain('---');
    expect(md).toContain('title: "Test Article"');
    expect(md).toContain('url: https://example.com/article');
    expect(md).toContain('scraped_at:');
  });

  it('includes title as H1 heading', () => {
    const md = toMarkdown({
      title: 'My Title',
      html: '<p>Content</p>',
      url: 'https://example.com',
    });

    expect(md).toContain('# My Title');
  });

  it('converts HTML to markdown', () => {
    const md = toMarkdown({
      title: 'Test',
      html: '<h2>Subtitle</h2><p>Paragraph text</p><ul><li>Item 1</li><li>Item 2</li></ul>',
      url: 'https://example.com',
    });

    expect(md).toContain('## Subtitle');
    expect(md).toContain('Paragraph text');
    expect(md).toContain('Item 1');
    expect(md).toContain('Item 2');
  });

  it('includes metadata when provided', () => {
    const md = toMarkdown({
      title: 'Test',
      html: '<p>Content</p>',
      url: 'https://example.com',
      metadata: {
        author: 'John Doe',
        description: 'A test article about testing',
      },
    });

    expect(md).toContain('author: "John Doe"');
    expect(md).toContain('description: "A test article about testing"');
  });

  it('escapes quotes in title', () => {
    const md = toMarkdown({
      title: 'Title with "quotes"',
      html: '<p>Content</p>',
      url: 'https://example.com',
    });

    expect(md).toContain('title: "Title with \\"quotes\\""');
  });

  it('handles empty html', () => {
    const md = toMarkdown({
      title: 'Empty',
      html: '',
      url: 'https://example.com',
    });

    expect(md).toContain('# Empty');
  });

  it('handles null html', () => {
    const md = toMarkdown({
      title: 'Null HTML',
      html: null,
      url: 'https://example.com',
    });

    expect(md).toContain('# Null HTML');
  });

  it('handles missing title', () => {
    const md = toMarkdown({
      html: '<p>Content</p>',
      url: 'https://example.com',
    });

    expect(md).toContain('# Untitled');
  });

  it('truncates long description to 200 chars', () => {
    const longDesc = 'a'.repeat(300);
    const md = toMarkdown({
      title: 'Test',
      html: '<p>Content</p>',
      url: 'https://example.com',
      metadata: { description: longDesc },
    });

    const descLine = md.split('\n').find(l => l.startsWith('description:'));
    // description: "..." = 15 + 200 + 1 = 216 chars max
    expect(descLine.length).toBeLessThanOrEqual(220);
  });

  it('removes script and style elements', () => {
    const md = toMarkdown({
      title: 'Test',
      html: '<p>Visible</p><script>alert("xss")</script><style>.hidden{}</style><p>Also visible</p>',
      url: 'https://example.com',
    });

    expect(md).toContain('Visible');
    expect(md).toContain('Also visible');
    expect(md).not.toContain('alert');
    expect(md).not.toContain('.hidden');
  });
});
