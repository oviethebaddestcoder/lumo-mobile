import { AppState } from 'react-native';
import { client } from './api';
import { config } from './config';
import { RoomSocket, type RoomEvent } from './realtime';

/**
 * The signed-in user's personal realtime channel (/v1/rt/me): direct
 * messages and read receipts arrive here on every device. One socket per
 * app; screens subscribe with onMeEvent. It closes in the background and
 * reconnects on foreground; screens refetch on reconnect to catch up.
 */
type Listener = (e: RoomEvent) => void;
const listeners = new Set<Listener>();
const reconnectListeners = new Set<() => void>();
let socket: RoomSocket | null = null;
let appSub: { remove(): void } | null = null;

export function onMeEvent(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Called after every (re)connect so screens can refetch what they missed. */
export function onMeReconnect(fn: () => void): () => void {
  reconnectListeners.add(fn);
  return () => reconnectListeners.delete(fn);
}

function open() {
  if (socket) return;
  let wasOpen = false;
  socket = new RoomSocket({
    wsUrl: config.wsUrl,
    path: '/v1/rt/me',
    getToken: () => client.getAccessToken(),
    onEvent: (e) => listeners.forEach((fn) => fn(e)),
    onState: (s) => {
      if (s === 'open') {
        if (wasOpen) reconnectListeners.forEach((fn) => fn());
        wasOpen = true;
      }
    },
  });
  socket.connect();
}

function close() {
  socket?.close();
  socket = null;
}

export function startMeChannel() {
  open();
  appSub?.remove();
  appSub = AppState.addEventListener('change', (st) => {
    if (st === 'active') {
      open();
      reconnectListeners.forEach((fn) => fn());
    } else if (st === 'background') {
      close();
    }
  });
}

export function stopMeChannel() {
  appSub?.remove();
  appSub = null;
  close();
}
