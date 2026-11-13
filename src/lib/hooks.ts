import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { api } from './api';
import type { Impression, LiveCategory, Page, Relationship, VideoCounts, VideoKind } from './api/types';
import { useSession } from './auth/session';
import { qk } from './query';

const nextCursor = <T,>(p: Page<T>) => p.next_cursor || undefined;

export function useSignedIn() {
  return useSession((s) => s.status === 'signedIn' || s.status === 'needsBirthDate');
}

export function useBalance() {
  const signedIn = useSignedIn();
  return useQuery({ queryKey: qk.balance, queryFn: api.wallet.balance, enabled: signedIn });
}

export function useCatalog() {
  return useQuery({ queryKey: qk.catalog, queryFn: api.wallet.catalog, staleTime: 10 * 60_000 });
}

export function useUser(id: string | undefined) {
  return useQuery({ queryKey: qk.user(id ?? ''), queryFn: () => api.identity.user(id!), enabled: !!id });
}

export function useCounts(userId: string | undefined) {
  return useQuery({ queryKey: qk.counts(userId ?? ''), queryFn: () => api.social.counts(userId!), enabled: !!userId });
}

export function useRelationship(userId: string | undefined) {
  const me = useSession((s) => s.me?.id);
  return useQuery({
    queryKey: qk.relationship(userId ?? ''),
    queryFn: () => api.social.relationship(userId!),
    enabled: !!userId && !!me && me !== userId,
  });
}

/** Follow/unfollow with an optimistic relationship flip and counts update. */
export function useFollow(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (follow: boolean) => (follow ? api.social.follow(userId) : api.social.unfollow(userId)),
    onMutate: async (follow) => {
      await qc.cancelQueries({ queryKey: qk.relationship(userId) });
      const prev = qc.getQueryData<Relationship>(qk.relationship(userId));
      qc.setQueryData<Relationship>(qk.relationship(userId), (r) => ({
        following: follow,
        followed_by: r?.followed_by ?? false,
        blocking: r?.blocking ?? false,
      }));
      qc.setQueryData(qk.counts(userId), (c: { followers: number; following: number } | undefined) =>
        c ? { ...c, followers: Math.max(0, c.followers + (follow ? 1 : -1)) } : c,
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.relationship(userId), ctx.prev);
      void qc.invalidateQueries({ queryKey: qk.counts(userId) });
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.followingFeed });
    },
  });
}

/** Like/unlike with an optimistic count. Counts for a page of videos are fetched in one call. */
export function useVideoCounts(ids: string[]) {
  const key = ids.join(',');
  return useQuery({
    queryKey: qk.videoCounts(key),
    queryFn: async () => {
      const res = await api.social.videoCounts(ids);
      return Object.fromEntries(res.items.map((c) => [c.video_id, c])) as Record<string, VideoCounts>;
    },
    enabled: ids.length > 0,
    staleTime: 15_000,
  });
}

export function useLike(videoId: string, countsKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (like: boolean) => (like ? api.social.like(videoId) : api.social.unlike(videoId)),
    onMutate: (like) => {
      const key = qk.videoCounts(countsKey);
      const prev = qc.getQueryData<Record<string, VideoCounts>>(key);
      qc.setQueryData<Record<string, VideoCounts>>(key, (m) => {
        const cur = m?.[videoId] ?? { video_id: videoId, likes: 0, comments: 0, liked_by_me: false };
        if (cur.liked_by_me === like) return m;
        return { ...m, [videoId]: { ...cur, liked_by_me: like, likes: Math.max(0, cur.likes + (like ? 1 : -1)) } };
      });
      return { prev, key };
    },
    onError: (_e, _v, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.prev);
    },
  });
}

export function useComments(videoId: string, parentId?: string) {
  return useInfiniteQuery({
    queryKey: qk.comments(videoId, parentId),
    queryFn: ({ pageParam }) => api.social.comments(videoId, pageParam, parentId),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
  });
}

export function useUserVideos(userId: string | undefined, kind?: VideoKind) {
  return useInfiniteQuery({
    queryKey: qk.userVideos(userId ?? '', kind),
    queryFn: ({ pageParam }) => api.media.userVideos(userId!, kind, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    enabled: !!userId,
  });
}

export function useRooms(category: LiveCategory | null) {
  return useInfiniteQuery({
    queryKey: qk.rooms(category),
    queryFn: ({ pageParam }) => api.live.rooms(category, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    refetchInterval: 30_000,
  });
}

export function useFollowers(userId: string, which: 'followers' | 'following') {
  return useInfiniteQuery({
    queryKey: which === 'followers' ? qk.followers(userId) : qk.following(userId),
    queryFn: ({ pageParam }) =>
      which === 'followers' ? api.social.followers(userId, pageParam) : api.social.following(userId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
  });
}

/**
 * Collects watch time per video and flushes to /v1/feed/impressions in
 * batches (every 10 items, every 20 s, and when the app backgrounds).
 */
export function useImpressions() {
  const signedIn = useSignedIn();
  const buf = useRef<Impression[]>([]);
  const flush = useCallback(() => {
    if (!signedIn || buf.current.length === 0) return;
    const items = buf.current.splice(0, 100);
    api.feed.impressions(items).catch(() => {
      // Drop on failure; impressions are best-effort ranking signals.
    });
  }, [signedIn]);

  useEffect(() => {
    const t = setInterval(flush, 20_000);
    const sub = AppState.addEventListener('change', (s) => s !== 'active' && flush());
    return () => {
      clearInterval(t);
      sub.remove();
      flush();
    };
  }, [flush]);

  return useCallback(
    (video_id: string, watch_ms: number) => {
      if (watch_ms < 500) return;
      buf.current.push({ video_id, watch_ms: Math.round(watch_ms) });
      if (buf.current.length >= 10) flush();
    },
    [flush],
  );
}
