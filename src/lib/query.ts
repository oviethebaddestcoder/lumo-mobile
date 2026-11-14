import { QueryClient } from '@tanstack/react-query';
import { isApiError } from './api/http';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (count, e) => (isApiError(e) ? e.retryable && count < 2 : count < 2),
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  },
});

/** Central query keys so invalidation stays consistent. */
export const qk = {
  me: ['me'] as const,
  sessions: ['me', 'sessions'] as const,
  user: (id: string) => ['user', id] as const,
  userByHandle: (h: string) => ['user', 'handle', h] as const,
  counts: (id: string) => ['social', 'counts', id] as const,
  relationship: (id: string) => ['social', 'rel', id] as const,
  followers: (id: string) => ['social', 'followers', id] as const,
  following: (id: string) => ['social', 'following', id] as const,
  videoCounts: (ids: string) => ['social', 'videoCounts', ids] as const,
  comments: (videoId: string, parent?: string) => ['social', 'comments', videoId, parent ?? ''] as const,
  forYou: ['feed', 'foryou'] as const,
  followingFeed: ['feed', 'following'] as const,
  watchFeed: ['feed', 'watch'] as const,
  interests: ['feed', 'interests'] as const,
  userVideos: (id: string, kind?: string) => ['media', 'user', id, kind ?? 'all'] as const,
  video: (id: string) => ['media', 'video', id] as const,
  rooms: (cat?: string | null) => ['live', 'rooms', cat ?? 'all'] as const,
  room: (id: string) => ['live', 'room', id] as const,
  categories: ['live', 'categories'] as const,
  streamKey: ['live', 'streamKey'] as const,
  balance: ['wallet', 'balance'] as const,
  catalog: ['wallet', 'catalog'] as const,
  history: ['wallet', 'history'] as const,
  notifyPrefs: ['notify', 'prefs'] as const,
  inbox: ['notify', 'inbox'] as const,
  inboxUnread: ['notify', 'unread'] as const,
  stats: ['wallet', 'stats'] as const,
  levels: (ids: string) => ['wallet', 'levels', ids] as const,
  backpack: ['wallet', 'backpack'] as const,
  banks: ['wallet', 'banks'] as const,
  payoutAccount: ['wallet', 'payoutAccount'] as const,
  payouts: ['wallet', 'payouts'] as const,
  searchUsers: (q: string) => ['search', 'users', q] as const,
  hashtag: (tag: string) => ['media', 'hashtag', tag] as const,
  conversations: ['dm', 'conversations'] as const,
  dmMessages: (id: string) => ['dm', 'messages', id] as const,
  dmConversation: (id: string) => ['dm', 'conversation', id] as const,
  dmUnread: ['dm', 'unread'] as const,
};
