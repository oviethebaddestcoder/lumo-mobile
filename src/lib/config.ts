// Runtime configuration. EXPO_PUBLIC_* vars are inlined at bundle time.
const apiUrl = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080').replace(/\/+$/, '');

export const config = {
  apiUrl,
  wsUrl: apiUrl.replace(/^http/, 'ws'),
  webDomain: process.env.EXPO_PUBLIC_WEB_DOMAIN ?? 'lumo.app',
  google: {
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
  },
  xClientId: process.env.EXPO_PUBLIC_X_CLIENT_ID ?? '',
  lineChannelId: process.env.EXPO_PUBLIC_LINE_CHANNEL_ID ?? '',
} as const;
