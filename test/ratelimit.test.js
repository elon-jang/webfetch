import { describe, it, expect } from 'vitest';
import { createRateLimiter, waitForSlot } from '../src/utils/ratelimit.js';

describe('createRateLimiter', () => {
  it('creates a limiter with default delay', () => {
    const limiter = createRateLimiter();
    expect(limiter.delayMs).toBe(2000);
    expect(limiter.timestamps).toBeInstanceOf(Map);
  });

  it('creates a limiter with custom delay', () => {
    const limiter = createRateLimiter(500);
    expect(limiter.delayMs).toBe(500);
  });
});

describe('waitForSlot', () => {
  it('returns immediately on first call', async () => {
    const limiter = createRateLimiter(100);
    const start = Date.now();
    await waitForSlot(limiter, 'https://example.com/page1');
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(50);
  });

  it('delays subsequent calls to same domain', async () => {
    const limiter = createRateLimiter(100);
    await waitForSlot(limiter, 'https://example.com/page1');
    const start = Date.now();
    await waitForSlot(limiter, 'https://example.com/page2');
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(80); // allow some tolerance
  });

  it('isolates different domains', async () => {
    const limiter = createRateLimiter(200);
    await waitForSlot(limiter, 'https://example.com/page1');
    const start = Date.now();
    await waitForSlot(limiter, 'https://other.com/page1');
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(50); // different domain, no delay
  });

  it('handles null limiter gracefully', async () => {
    await waitForSlot(null, 'https://example.com');
    // should not throw
  });

  it('handles zero delay', async () => {
    const limiter = createRateLimiter(0);
    await waitForSlot(limiter, 'https://example.com/page1');
    await waitForSlot(limiter, 'https://example.com/page2');
    // should not throw or delay
  });

  it('handles invalid URL gracefully', async () => {
    const limiter = createRateLimiter(100);
    await waitForSlot(limiter, 'not-a-url');
    // should not throw
  });
});
