import localHandler from './local.js';
import gdriveHandler from './gdrive.js';

const handlers = {
  local: localHandler,
  gdrive: gdriveHandler,
};

export function getOutputHandler(name) {
  const handler = handlers[name];
  if (!handler) {
    throw new Error(`Unknown output handler: ${name}. Available: ${Object.keys(handlers).join(', ')}`);
  }
  return handler;
}

export function resolveOutputs(saveToString) {
  if (!saveToString) return [handlers.local];

  const names = saveToString.split(',').map(s => s.trim()).filter(Boolean);
  return names.map(name => getOutputHandler(name));
}
