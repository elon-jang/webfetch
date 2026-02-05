import { livewiki } from './livewiki.js';
import { longblack } from './longblack.js';
import { themiilk } from './themiilk.js';
import { medium } from './medium.js';
import { substack } from './substack.js';
import { naver } from './naver.js';
import { generic } from './generic.js';

const adapters = [livewiki, longblack, themiilk, medium, substack, naver, generic];

/**
 * Find adapter that matches the URL
 */
export function getAdapter(url) {
  return adapters.find(adapter => adapter.match(url));
}

/**
 * List all adapters
 */
export function listAdapters() {
  return adapters;
}

/**
 * Check health of all adapter target sites via HEAD requests.
 * Returns array of { name, url, ok, status, error }.
 */
export async function checkHealth() {
  const checks = {
    livewiki: 'https://livewiki.com',
    longblack: 'https://longblack.co',
    themiilk: 'https://themiilk.com',
    medium: 'https://medium.com',
    substack: 'https://substack.com',
    naver: 'https://blog.naver.com',
  };

  const results = [];
  for (const [name, url] of Object.entries(checks)) {
    try {
      const res = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(10000),
        redirect: 'follow',
      });
      results.push({ name, url, ok: res.ok, status: res.status });
    } catch (error) {
      results.push({ name, url, ok: false, status: 0, error: error.message });
    }
  }
  return results;
}
