import { Platform } from 'react-native';
import {
  AuthorizationStatus,
  getInitialNotification,
  getMessaging,
  getToken,
  onNotificationOpenedApp,
  onMessage,
  onTokenRefresh,
  registerDeviceForRemoteMessages,
  requestPermission,
} from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';
import { api } from './api';
import type { Platform as ApiPlatform } from './api/types';

/**
 * svc-notifier sends through FCM on both platforms, so iOS registers an FCM
 * token too (Firebase maps it to the APNs token).
 */
let current: string | null = null;
let unsub: (() => void)[] = [];

const platform = (): ApiPlatform => (Platform.OS === 'ios' ? 'ios' : 'android');

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function registerPush(): Promise<void> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  try {
    const m = getMessaging();
    const status = await requestPermission(m);
    if (status !== AuthorizationStatus.AUTHORIZED && status !== AuthorizationStatus.PROVISIONAL) return;
    if (Platform.OS === 'android') await Notifications.requestPermissionsAsync();
    if (Platform.OS === 'ios') await registerDeviceForRemoteMessages(m);
    const token = await getToken(m);
    await upsert(token);

    unsub.forEach((u) => u());
    unsub = [
      onTokenRefresh(m, (t) => void upsert(t)),
      // Foreground messages: FCM does not show them on its own.
      onMessage(m, async (msg) => {
        const n = msg.notification;
        if (!n) return;
        await Notifications.scheduleNotificationAsync({
          content: { title: n.title ?? 'Lumo', body: n.body ?? '', data: msg.data ?? {} },
          trigger: null,
        });
      }),
    ];
  } catch (e) {
    if (__DEV__) console.warn('push registration failed', e);
  }
}

async function upsert(token: string) {
  if (!token || token === current) return;
  await api.notify.registerDevice(token, platform());
  current = token;
}

/** Called before sign-out so the old account stops getting this phone's pushes. */
export async function unregisterPush(): Promise<void> {
  unsub.forEach((u) => u());
  unsub = [];
  if (!current) return;
  const t = current;
  current = null;
  await api.notify.unregisterDevice(t).catch(() => undefined);
}

/**
 * Taps on notifications. FCM shows background notifications itself, so its
 * open events are needed alongside expo-notifications' (foreground ones).
 */
export function onPushOpened(open: (data: Record<string, unknown> | undefined) => void): () => void {
  const subs: (() => void)[] = [];
  const last = Notifications.getLastNotificationResponse();
  if (last) open(last.notification.request.content.data);
  const s = Notifications.addNotificationResponseReceivedListener((r) => open(r.notification.request.content.data));
  subs.push(() => s.remove());
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    try {
      const m = getMessaging();
      void getInitialNotification(m).then((msg) => msg && open(msg.data));
      subs.push(onNotificationOpenedApp(m, (msg) => open(msg.data)));
    } catch {
      /* Firebase not configured in this build */
    }
  }
  return () => subs.forEach((u) => u());
}
