import { createRequire } from 'node:module';
import { setNetworkId, getNetworkId } from '@midnight-ntwrk/midnight-js-network-id';

const require = createRequire(import.meta.url);
const setNetworkIdCjs = require('@midnight-ntwrk/midnight-js-network-id').setNetworkId;

/**
 * Ensures the network ID is set globally for both ESM and CJS modules.
 * This is necessary because some dependencies may use require() while others use import,
 * and they might end up with different instances of the network-id state.
 */
export function setAllNetworkIds(id: string) {
  setNetworkId(id);
  if (typeof setNetworkIdCjs === 'function') {
    setNetworkIdCjs(id);
  }
}

export { getNetworkId };
