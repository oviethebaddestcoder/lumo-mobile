import { config } from '../config';
import { getDevice, secureRefreshStore } from '../device';
import { endpoints } from './endpoints';
import { createApiClient } from './http';

type Listener = (reason: string) => void;
const sessionEndedListeners = new Set<Listener>();

/** Subscribe to "the refresh token is dead" (revoked, expired, reused). */
export function onSessionEnded(fn: Listener): () => void {
  sessionEndedListeners.add(fn);
  return () => sessionEndedListeners.delete(fn);
}

export const client = createApiClient({
  baseUrl: config.apiUrl,
  store: secureRefreshStore(),
  device: getDevice,
  onSessionEnded: (reason) => sessionEndedListeners.forEach((fn) => fn(reason)),
});

export const api = endpoints(client, getDevice);

export * from './http';
export type * from './types';
