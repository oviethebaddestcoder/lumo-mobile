import type { ApiClient } from './http';
import type * as T from './types';

const enc = encodeURIComponent;

/**
 * Every gateway route the app uses, grouped by owning service. Each function
 * is a thin typed wrapper; retries, auth and refresh live in the client.
 */
export function endpoints(c: ApiClient, device: () => Promise<T.Device>) {
  const identity = {
    sendOtp: (channel: T.OtpChannel, target: string) =>
      c.post<{ target: string; expires_in: number }>('/v1/auth/otp/send', { channel, target }, { auth: 'none' }),
    verifyOtp: async (channel: T.OtpChannel, target: string, code: string, extras: T.SignUpExtras = {}) =>
      c.post<T.SignInResult>(
        '/v1/auth/otp/verify',
        { channel, target, code, device: await device(), ...extras },
        { auth: 'none' },
      ),
    oauth: async (provider: T.OAuthProvider, cred: T.ProviderCredential, extras: T.SignUpExtras = {}) =>
      c.post<T.SignInResult>(`/v1/auth/oauth/${provider}`, { ...cred, device: await device(), ...extras }, { auth: 'none' }),
    passwordLogin: async (login: string, password: string) =>
      c.post<T.SignInResult>('/v1/auth/password/login', { login, password, device: await device() }, { auth: 'none' }),
    logout: () => c.post<void>('/v1/auth/logout'),
    logoutAll: (keepCurrent: boolean) => c.post<void>('/v1/auth/logout-all', { keep_current: keepCurrent }),

    qrInfo: (id: string) => c.get<T.QrInfo>(`/v1/auth/qr/${enc(id)}/info`),
    qrApprove: (id: string) => c.post<void>(`/v1/auth/qr/${enc(id)}/approve`),

    me: () => c.get<T.Me>('/v1/me'),
    updateMe: (patch: T.MePatch) => c.patch<T.Me>('/v1/me', patch),
    deleteMe: () => c.del<void>('/v1/me'),
    setPassword: (current_password: string | undefined, new_password: string) =>
      c.put<void>('/v1/me/password', { current_password, new_password }),
    sessions: () => c.get<{ items: T.SessionView[] }>('/v1/me/sessions'),
    revokeSession: (id: string) => c.del<void>(`/v1/me/sessions/${enc(id)}`),
    linkIdentity: (provider: T.OAuthProvider, cred: T.ProviderCredential) =>
      c.post<T.Me>(`/v1/me/identities/${provider}`, cred),
    unlinkIdentity: (provider: T.OAuthProvider) => c.del<void>(`/v1/me/identities/${provider}`),

    user: (id: string) => c.get<T.UserPublic>(`/v1/users/${enc(id)}`, { auth: 'optional' }),
    userByHandle: (handle: string) =>
      c.get<T.UserPublic>(`/v1/users/by-handle/${enc(handle.replace(/^@/, ''))}`, { auth: 'optional' }),
    users: (ids: string[]) => c.get<{ items: T.UserPublic[] }>('/v1/users', { query: { ids: ids.join(',') }, auth: 'optional' }),
    searchUsers: (q: string) => c.get<{ items: T.UserPublic[] }>('/v1/users/search', { query: { q }, auth: 'optional' }),
  };

  const wallet = {
    balance: () => c.get<T.Balance>('/v1/wallet'),
    catalog: () => c.get<T.Catalog>('/v1/wallet/catalog', { auth: 'optional' }),
    history: (cursor?: string, limit = 30) => c.get<T.Page<T.LedgerEntry>>('/v1/wallet/history', { query: { cursor, limit } }),
    purchaseTag: () => c.get<T.PurchaseTag>('/v1/wallet/purchase-tag'),
    sendGift: (input: T.GiftSendInput, idempotencyKey: string) =>
      c.post<T.GiftSendResult>('/v1/wallet/gifts/send', input, { idempotencyKey }),
    verifyGoogle: (product_id: string, purchase_token: string) =>
      c.post<T.PurchaseResult>('/v1/wallet/purchases/google', { product_id, purchase_token }),
    verifyApple: (transaction_id: string) => c.post<T.PurchaseResult>('/v1/wallet/purchases/apple', { transaction_id }),
    payout: (diamonds: number, idempotencyKey: string) =>
      c.post<T.PayoutResult>('/v1/wallet/payouts', { diamonds }, { idempotencyKey }),
    payouts: () => c.get<{ items: T.Payout[] }>('/v1/wallet/payouts'),
    stats: () => c.get<T.WalletStats>('/v1/wallet/stats'),
    levels: (ids: string[]) => c.get<{ items: T.UserLevel[] }>('/v1/wallet/levels', { query: { ids: ids.join(',') }, auth: 'none' }),
    backpack: () => c.get<T.Backpack>('/v1/wallet/backpack'),
    checkin: () => c.post<T.CheckinResult>('/v1/wallet/checkin'),
    banks: () => c.get<{ items: T.Bank[] }>('/v1/wallet/banks'),
    payoutAccount: () => c.get<{ account: T.PayoutAccount | null }>('/v1/wallet/payout-account'),
    setPayoutAccount: (bank_code: string, account_number: string) =>
      c.put<{ account: T.PayoutAccount }>('/v1/wallet/payout-account', { bank_code, account_number }),
  };

  const live = {
    rooms: (category?: T.LiveCategory | null, cursor?: string, limit = 20) =>
      c.get<T.Page<T.Room>>('/v1/live/rooms', { query: { category, cursor, limit }, auth: 'optional' }),
    room: (id: string) => c.get<T.Room>(`/v1/live/rooms/${enc(id)}`, { auth: 'optional' }),
    create: (input: T.CreateRoomInput) => c.post<T.CreateRoomResult>('/v1/live/rooms', input),
    join: (id: string) => c.post<T.Connection>(`/v1/live/rooms/${enc(id)}/join`),
    end: (id: string) => c.post<void>(`/v1/live/rooms/${enc(id)}/end`),
    streamKey: () => c.get<T.StreamKey>('/v1/live/stream-key'),
    rotateStreamKey: () => c.post<T.StreamKey>('/v1/live/stream-key/rotate'),
    categories: () => c.get<{ items: T.LiveCategory[] }>('/v1/live/categories', { auth: 'none' }),
    pkInvite: (to_room_id: string) => c.post<T.PkBattle>('/v1/live/pk/invite', { to_room_id }),
    pkAccept: (id: string) => c.post<T.PkBattle>(`/v1/live/pk/${enc(id)}/accept`),
    pkDecline: (id: string) => c.post<T.PkBattle>(`/v1/live/pk/${enc(id)}/decline`),
    pk: (id: string) => c.get<T.PkBattle>(`/v1/live/pk/${enc(id)}`),
  };

  const social = {
    follow: (userId: string) => c.post<void>(`/v1/social/follows/${enc(userId)}`),
    unfollow: (userId: string) => c.del<void>(`/v1/social/follows/${enc(userId)}`),
    followers: (userId: string, cursor?: string) =>
      c.get<T.Page<T.Edge>>(`/v1/social/users/${enc(userId)}/followers`, { query: { cursor }, auth: 'optional' }),
    following: (userId: string, cursor?: string) =>
      c.get<T.Page<T.Edge>>(`/v1/social/users/${enc(userId)}/following`, { query: { cursor }, auth: 'optional' }),
    counts: (userId: string) => c.get<T.FollowCounts>(`/v1/social/users/${enc(userId)}/counts`, { auth: 'optional' }),
    relationship: (userId: string) => c.get<T.Relationship>(`/v1/social/users/${enc(userId)}/relationship`),
    like: (videoId: string) => c.post<void>(`/v1/social/videos/${enc(videoId)}/like`),
    unlike: (videoId: string) => c.del<void>(`/v1/social/videos/${enc(videoId)}/like`),
    videoCounts: (ids: string[]) =>
      c.get<{ items: T.VideoCounts[] }>('/v1/social/videos/counts', { query: { ids: ids.join(',') }, auth: 'optional' }),
    comments: (videoId: string, cursor?: string, parentId?: string) =>
      c.get<T.Page<T.Comment>>(`/v1/social/videos/${enc(videoId)}/comments`, {
        query: { cursor, parent_id: parentId },
        auth: 'optional',
      }),
    addComment: (videoId: string, text: string, parentId?: string) =>
      c.post<T.Comment>(`/v1/social/videos/${enc(videoId)}/comments`, { text, parent_id: parentId }),
    deleteComment: (id: string) => c.del<void>(`/v1/social/comments/${enc(id)}`),
    block: (userId: string) => c.post<void>(`/v1/social/blocks/${enc(userId)}`),
    unblock: (userId: string) => c.del<void>(`/v1/social/blocks/${enc(userId)}`),
    report: (target_type: T.ReportTarget, target_id: string, reason: T.ReportReason, details = '') =>
      c.post<void>('/v1/social/reports', { target_type, target_id, reason, details }),
  };

  const media = {
    startUpload: (input: T.UploadStartInput) => c.post<T.UploadStart>('/v1/media/uploads', input),
    partUrls: (videoId: string, from: number, to: number) =>
      c.post<{ from: number; part_urls: string[] }>(`/v1/media/uploads/${enc(videoId)}/parts`, { from, to }),
    completeUpload: (videoId: string, parts: T.UploadedPart[]) =>
      c.post<T.Video>(`/v1/media/uploads/${enc(videoId)}/complete`, { parts }),
    video: (id: string) => c.get<T.Video>(`/v1/media/videos/${enc(id)}`, { auth: 'optional' }),
    updateVideo: (id: string, patch: Partial<Pick<T.Video, 'title' | 'description' | 'visibility'>>) =>
      c.patch<T.Video>(`/v1/media/videos/${enc(id)}`, patch),
    deleteVideo: (id: string) => c.del<void>(`/v1/media/videos/${enc(id)}`),
    userVideos: (userId: string, kind?: T.VideoKind, cursor?: string) =>
      c.get<T.Page<T.Video>>(`/v1/media/users/${enc(userId)}/videos`, { query: { kind, cursor }, auth: 'optional' }),
    hashtagVideos: (tag: string, cursor?: string) =>
      c.get<T.Page<T.Video>>(`/v1/media/hashtags/${enc(tag.replace(/^#/, '').toLowerCase())}/videos`, { query: { cursor }, auth: 'optional' }),
    imageUpload: (purpose: 'avatar' | 'thumbnail', content_type: string, size_bytes: number) =>
      c.post<T.ImageUpload>('/v1/media/images', { purpose, content_type, size_bytes }),
  };

  const feed = {
    forYou: (limit = 10) => c.get<{ items: T.FeedItem[] }>('/v1/feed/foryou', { query: { limit }, auth: 'optional' }),
    watch: (limit = 20) => c.get<{ items: T.FeedItem[] }>('/v1/feed/watch', { query: { limit }, auth: 'optional' }),
    following: (cursor?: string) => c.get<T.Page<T.FeedItem>>('/v1/feed/following', { query: { cursor } }),
    impressions: (items: T.Impression[]) => c.post<void>('/v1/feed/impressions', { items }),
  };

  const notify = {
    registerDevice: (token: string, platform: T.Platform) => c.put<void>('/v1/notify/devices', { token, platform }),
    unregisterDevice: (token: string) => c.del<void>(`/v1/notify/devices/${enc(token)}`),
    prefs: () => c.get<T.NotifyPrefs>('/v1/notify/prefs'),
    setPrefs: (p: T.NotifyPrefs) => c.put<T.NotifyPrefs>('/v1/notify/prefs', p),
    inbox: (cursor?: string) => c.get<T.Page<T.InboxItem>>('/v1/notify/inbox', { query: { cursor } }),
    unread: () => c.get<{ count: number }>('/v1/notify/inbox/unread'),
    markRead: () => c.post<void>('/v1/notify/inbox/read'),
  };

  const dm = {
    conversations: (cursor?: string) => c.get<T.Page<T.Conversation>>('/v1/dm/conversations', { query: { cursor } }),
    open: (user_id: string) => c.post<T.Conversation>('/v1/dm/conversations', { user_id }),
    conversation: (id: string) => c.get<T.Conversation>(`/v1/dm/conversations/${enc(id)}`),
    hide: (id: string) => c.del<void>(`/v1/dm/conversations/${enc(id)}`),
    messages: (id: string, cursor?: string) =>
      c.get<T.Page<T.DirectMessage>>(`/v1/dm/conversations/${enc(id)}/messages`, { query: { cursor } }),
    // client_id makes retries safe: the server returns the original message.
    send: (id: string, text: string, client_id: string) =>
      c.post<T.DirectMessage>(`/v1/dm/conversations/${enc(id)}/messages`, { text, client_id }, { idempotencyKey: client_id }),
    read: (id: string) => c.post<void>(`/v1/dm/conversations/${enc(id)}/read`),
    unsend: (messageId: string) => c.del<void>(`/v1/dm/messages/${enc(messageId)}`),
    unread: () => c.get<{ count: number }>('/v1/dm/unread'),
  };

  return { identity, wallet, live, social, media, feed, notify, dm };
}

export type Endpoints = ReturnType<typeof endpoints>;
