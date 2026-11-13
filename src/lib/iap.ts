import { Platform } from 'react-native';
import {
  endConnection,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  ErrorCode,
  type Product,
  type Purchase,
} from 'react-native-iap';
import { api } from './api';
import { isApiError } from './api/http';
import type { CoinPack, PurchaseResult } from './api/types';
import { qk, queryClient } from './query';

/**
 * Coin packs are consumable in-app products. Money is only credited by the
 * wallet service after it verifies the receipt with Google/Apple; the app
 * finishes (consumes) the transaction only after that succeeds, so a crash in
 * between is recovered on the next launch.
 */

type Outcome =
  | { kind: 'credited'; result: PurchaseResult }
  | { kind: 'pending' }
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string };

type Listener = (o: Outcome) => void;

let connected: Promise<boolean> | null = null;
let subs: { remove(): void }[] = [];
const listeners = new Set<Listener>();
const inFlight = new Set<string>();

export function onPurchaseOutcome(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const emit = (o: Outcome) => listeners.forEach((fn) => fn(o));

export const storeProductId = (p: CoinPack) => (Platform.OS === 'ios' ? p.apple_product_id : p.google_product_id);

/** Connect to the store and attach listeners. Safe to call repeatedly. */
export function startIap(): Promise<boolean> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return Promise.resolve(false);
  if (!connected) {
    connected = initConnection()
      .then((ok) => {
        subs.push(purchaseUpdatedListener((p) => void handlePurchase(p)));
        subs.push(
          purchaseErrorListener((e) => {
            if (e.code === ErrorCode.UserCancelled) emit({ kind: 'cancelled' });
            else emit({ kind: 'error', message: e.message || 'The purchase did not go through.' });
          }),
        );
        void recoverUnfinished();
        return ok;
      })
      .catch((e) => {
        connected = null;
        if (__DEV__) console.warn('IAP init failed', e);
        return false;
      });
  }
  return connected;
}

export async function stopIap() {
  subs.forEach((s) => s.remove());
  subs = [];
  if (connected) {
    connected = null;
    await endConnection().catch(() => undefined);
  }
}

export async function loadStoreProducts(packs: CoinPack[]): Promise<Map<string, Product>> {
  const ok = await startIap();
  const out = new Map<string, Product>();
  if (!ok) return out;
  const skus = packs.map(storeProductId).filter(Boolean);
  if (!skus.length) return out;
  const products = (await fetchProducts({ skus, type: 'in-app' })) ?? [];
  for (const p of products as Product[]) out.set(p.id, p);
  return out;
}

/** Opens the store sheet. The outcome arrives via onPurchaseOutcome. */
export async function buyPack(pack: CoinPack): Promise<void> {
  const ok = await startIap();
  if (!ok) throw new Error('In-app purchases are not available on this device.');
  // Bind the purchase to this Lumo account so a receipt can't be replayed onto another.
  const tag = await api.wallet.purchaseTag();
  const sku = storeProductId(pack);
  await requestPurchase({
    type: 'in-app',
    request: {
      apple: { sku, appAccountToken: tag.apple_app_account_token, quantity: 1 },
      google: { skus: [sku], obfuscatedAccountId: tag.google_obfuscated_account_id },
    },
  });
}

async function handlePurchase(p: Purchase) {
  const key = p.purchaseToken ?? p.id;
  if (inFlight.has(key)) return;
  if (p.purchaseState === 'pending') {
    emit({ kind: 'pending' });
    return;
  }
  inFlight.add(key);
  try {
    const result = await verify(p);
    await finishTransaction({ purchase: p, isConsumable: true });
    queryClient.setQueryData(qk.balance, (b: { coins: number; diamonds: number } | undefined) =>
      b ? { ...b, coins: result.balance } : b,
    );
    void queryClient.invalidateQueries({ queryKey: qk.balance });
    void queryClient.invalidateQueries({ queryKey: qk.history });
    emit({ kind: 'credited', result });
  } catch (e) {
    // A 4xx means the receipt is bad (refunded, fake, wrong account): finish it
    // so it stops reappearing. Anything else stays unfinished for a retry.
    if (isApiError(e) && !e.retryable && e.status !== 401) {
      await finishTransaction({ purchase: p, isConsumable: true }).catch(() => undefined);
    }
    emit({ kind: 'error', message: isApiError(e) ? e.message : 'Could not confirm the purchase. We will retry.' });
  } finally {
    inFlight.delete(key);
  }
}

function verify(p: Purchase): Promise<PurchaseResult> {
  if (Platform.OS === 'ios') {
    const txId = ('transactionId' in p && p.transactionId) || p.id;
    return api.wallet.verifyApple(txId);
  }
  if (!p.purchaseToken) throw new Error('Missing purchase token.');
  return api.wallet.verifyGoogle(p.productId, p.purchaseToken);
}

/** Purchases paid for but never verified (app killed mid-flow). */
async function recoverUnfinished() {
  try {
    const list = await getAvailablePurchases();
    for (const p of list) await handlePurchase(p);
  } catch (e) {
    if (__DEV__) console.warn('IAP recovery failed', e);
  }
}
