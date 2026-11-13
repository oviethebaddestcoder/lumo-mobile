import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { Device, Platform as ApiPlatform } from './api/types';
import type { RefreshStore } from './api/http';

// THIS_DEVICE_ONLY: a restored backup on a new phone must sign in again
// rather than inherit a session bound to the old device ID.
const secure: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

const DEVICE_ID_KEY = 'lumo.device_id';
const REFRESH_KEY = 'lumo.refresh_token';

let cachedDevice: Promise<Device> | null = null;

/** A stable per-install device descriptor the identity service binds sessions to. */
export function getDevice(): Promise<Device> {
  if (!cachedDevice) {
    cachedDevice = (async () => {
      let id = await SecureStore.getItemAsync(DEVICE_ID_KEY, secure);
      if (!id) {
        id = Crypto.randomUUID();
        await SecureStore.setItemAsync(DEVICE_ID_KEY, id, secure);
      }
      const platform: ApiPlatform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
      const name = Constants.deviceName ?? `${Platform.OS} device`;
      return { device_id: id, device_name: name.slice(0, 80), platform };
    })().catch((e) => {
      cachedDevice = null;
      throw e;
    });
  }
  return cachedDevice;
}

/** Refresh token in the Keychain / Android Keystore. Memory cache avoids a native hop per request. */
export function secureRefreshStore(): RefreshStore {
  let loaded = false;
  let value: string | null = null;
  return {
    async get() {
      if (!loaded) {
        value = await SecureStore.getItemAsync(REFRESH_KEY, secure);
        loaded = true;
      }
      return value;
    },
    async set(token) {
      value = token;
      loaded = true;
      if (token) await SecureStore.setItemAsync(REFRESH_KEY, token, secure);
      else await SecureStore.deleteItemAsync(REFRESH_KEY, secure);
    },
  };
}

/** A fresh Idempotency-Key for money-moving calls. Create once per user intent, reuse on retry. */
export const newIdempotencyKey = () => Crypto.randomUUID();

/** Random URL-safe string for OAuth nonces and PKCE verifiers. */
export function randomString(bytes = 32): string {
  const b = Crypto.getRandomBytes(bytes);
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return base64Url(s);
}

export async function sha256Hex(input: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input, { encoding: Crypto.CryptoEncoding.HEX });
}

function base64Url(binary: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let out = '';
  for (let i = 0; i < binary.length; i += 3) {
    const a = binary.charCodeAt(i);
    const b = i + 1 < binary.length ? binary.charCodeAt(i + 1) : NaN;
    const c = i + 2 < binary.length ? binary.charCodeAt(i + 2) : NaN;
    const n = (a << 16) | ((b || 0) << 8) | (c || 0);
    out += chars[(n >> 18) & 63]! + chars[(n >> 12) & 63]!;
    if (!Number.isNaN(b)) out += chars[(n >> 6) & 63]!;
    if (!Number.isNaN(c)) out += chars[n & 63]!;
  }
  return out;
}
