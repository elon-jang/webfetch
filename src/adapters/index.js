import { livewiki } from './livewiki.js';
import { longblack } from './longblack.js';
import { themiilk } from './themiilk.js';

const adapters = [livewiki, longblack, themiilk];

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
