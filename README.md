# lumo-mobile

The Lumo app for iOS and Android: short videos, live streaming with PK battles and gifts, and long-form Watch.
It is built with Expo SDK 58, React Native 0.88, TypeScript and Expo Router, and talks to the Go microservices only through `svc-gateway`.

## Run it

You need a **development build**. Expo Go won't work, because the app uses native modules: LiveKit/WebRTC, in-app purchases, Firebase and the native sign-in SDKs.

```bash
npm install --legacy-peer-deps
cp .env.example .env           # fill in the values below
# put google-services.json and GoogleService-Info.plist in ./firebase

npx expo run:android           # or: npx expo run:ios   (local native build)
# or in the cloud:
eas build --profile development --platform android
npm start                      # Metro for the dev client
```

Checks to run before merging:

```bash
npm run typecheck   # tsc --noEmit
npm test            # jest: API client, uploader, realtime, formatting
npm run lint        # expo lint
```

## Configuration (`.env`, or EAS secrets)

| Variable | Used for |
|---|---|
| `EXPO_PUBLIC_API_URL` | Gateway base URL. Realtime uses the same host over `wss`. |
| `EXPO_PUBLIC_WEB_DOMAIN` | Share links and Android/iOS universal links |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `GOOGLE_IOS_URL_SCHEME` | Google sign-in. The web client ID must be in the identity service's `GOOGLE_CLIENT_IDS`. |
| `FACEBOOK_APP_ID`, `FACEBOOK_CLIENT_TOKEN` | Facebook (Limited Login on iOS, access token on Android) |
| `EXPO_PUBLIC_X_CLIENT_ID` | X (OAuth 2.0 PKCE). Redirect URI: `lumo://oauth/x`. The backend exchanges the code. |
| `EXPO_PUBLIC_LINE_CHANNEL_ID` | LINE (turn on OpenID Connect for the channel) |
| `KAKAO_NATIVE_APP_KEY` | Kakao (turn on OpenID Connect) |
| `GOOGLE_SERVICES_JSON`, `GOOGLE_SERVICE_INFO_PLIST` | Firebase Cloud Messaging. svc-notifier sends through FCM on both platforms. |
| `APP_ENV`, `APP_BUNDLE_ID`, `EAS_PROJECT_ID` | Build variants (`development`, `staging`, `production`) |

In-app products: create consumable products in Play Console and App Store Connect whose IDs match `google_product_id` and `apple_product_id` in the wallet's coin-pack catalog.

## Layout

```
src/
  app/                    Expo Router routes
    _layout.tsx           providers, fonts, auth guards (Stack.Protected), push deep links
    (auth)/               sign-in (phone OTP + 6 providers), email OTP, verify, password
    birthday.tsx          required for new accounts (age gate: 13+, gifting 18+)
    (app)/(tabs)/         Home feed · Live · Create · Watch · Me
    (app)/live/[id]       viewer room (LiveKit WebRTC, or LL-HLS at very large scale)
    (app)/host/[id]       broadcaster: camera/mic, PK invite/accept, cross-publish, end
    (app)/watch/[id]      long video player, subscribe, tip, comments, up next
    (app)/user/[id]       profiles, follow, block/report
    (app)/wallet/         coins (store billing), diamonds cash-out, history
    (app)/upload          multipart upload with progress
    (app)/settings/       profile, linked sign-ins, password, sessions, notifications
    (app)/qr-scan, qr-login   approve sign-in on web/TV
    (app)/inbox           activity (follows, comments, milestones, cash-outs)
    (app)/messages, chat/[id]   direct messages, live over /v1/rt/me, read receipts, unsend
    (app)/search, tag/[tag]     people search and hashtag pages
    (app)/wallet/bank     Nigerian bank account for cash-outs (verified by the bank)
  lib/
    api/http.ts           fetch client: bearer auth, single-flight refresh, error envelope, safe retries
    api/endpoints.ts      every gateway route, typed, grouped by service
    api/types.ts          wire types matching the Go structs
    realtime.ts           room WebSocket with jittered backoff and a fresh token per reconnect
    meChannel.ts          the user's personal socket (DMs, read receipts)
    uploader.ts           S3 multipart through presigned URLs (16 MiB parts, ETags, re-signing)
    iap.ts                Play/App Store purchase → server verify → finish, with crash recovery
    push.ts               FCM token registration and tap routing
    auth/                 session store and native provider flows
  components/             feed pager, live overlay, gift/comment/report sheets, UI kit
  theme/tokens.ts         design tokens from the Lumo canvas
```

## How the important parts work

- **Tokens.** The refresh token is stored in Keychain/Keystore (`THIS_DEVICE_ONLY`). The access token is kept only in memory and refreshed 30 seconds before it expires.
  - Concurrent requests share one refresh.
  - A 401 response triggers one refresh, then the request is replayed once.
  - `refresh_invalid` signs the user out.
  - `refresh_in_progress` keeps the session.
- **Retries.** Network failures are retried only for GET, PUT and DELETE, or for a POST that carries an `Idempotency-Key`. Gift sends and payouts create one key per tap, so a retry can never charge the user twice.
- **Feed.**
  - The pager runs one playing player, buffers the next two items and the previous one, and shows posters for the rest.
  - Like and comment counts come from one batched call for the visible window.
  - Watch time is batched to `/v1/feed/impressions`.
- **Live.**
  - Viewers subscribe only.
  - The host publishes 720p at 30 fps.
  - During a PK battle each host also publishes into the opponent's room using the cross token, so viewers see a split screen.
  - Chat, gifts, viewer count, goal progress and PK scores arrive over the realtime socket.
- **Purchases.** Coins are credited only after svc-wallet verifies the receipt with Google or Apple. The transaction is finished afterwards. Any unfinished purchases are replayed on the next launch; the server is idempotent, so this is safe.
- **Store policy.** Digital coins use store billing inside the app. The Paystack web checkout must never be linked from the app.

## Known gaps

- Lucky gifts are intentionally not built (random prizes bought with money count as gambling in many countries and app stores restrict them).
- Gifts from the Backpack (free daily check-in rewards) count toward PK scores and room goals but pay the receiver no diamonds, so free gifts can't be farmed into cash.
- The cash-out estimate in the app uses ₦0.50 per diamond for display; the server's `PAYOUT_KOBO_PER_DIAMOND` sets the real rate.
