import { useInfiniteQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FeedPager } from '@/components/FeedPager';
import { Icon } from '@/components/Icon';
import { Button, Empty, ErrorView, Loading, Text } from '@/components/ui';
import { api } from '@/lib/api';
import type { FeedItem } from '@/lib/api/types';
import { useSignedIn } from '@/lib/hooks';
import { qk } from '@/lib/query';
import { fonts, space, makeStyles, darkScreen } from '@/theme';

type Tab = 'following' | 'foryou';

function Home() {
  const st = useSt();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('foryou');
  const signedIn = useSignedIn();

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {tab === 'foryou' ? <ForYou /> : signedIn ? <Following /> : <SignInPrompt />}
      <View style={[st.top, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
        <Pressable onPress={() => router.push('/live')} accessibilityRole="link" accessibilityLabel="Live">
          <View style={st.liveBadge}>
            <Text style={st.liveText}>LIVE</Text>
          </View>
        </Pressable>
        <View style={st.tabs}>
          {(['following', 'foryou'] as const).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} accessibilityRole="tab" accessibilityState={{ selected: tab === t }}>
              <Text style={[st.tab, tab === t && st.tabOn]}>{t === 'foryou' ? 'For You' : 'Following'}</Text>
              {tab === t ? <View style={st.underline} /> : null}
            </Pressable>
          ))}
        </View>
        <Pressable onPress={() => router.push('/search')} accessibilityLabel="Search" hitSlop={10}>
          <Icon name="search" />
        </Pressable>
      </View>
    </View>
  );
}

/**
 * For You is a ranked stream with no cursor: each call returns the next
 * unseen batch from the feed projection. Pages are de-duplicated client-side.
 */
function ForYou() {
  const q = useInfiniteQuery({
    queryKey: qk.forYou,
    queryFn: () => api.feed.forYou(10),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.items.length ? all.length : undefined),
    staleTime: Infinity,
  });
  const items = useMemo(() => dedupe(q.data?.pages.flatMap((p) => p.items) ?? []), [q.data]);
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;
  return (
    <FeedPager
      items={items}
      surface="foryou"
      refreshing={q.isRefetching && !q.isFetchingNextPage}
      onRefresh={() => void q.refetch()}
      onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && void q.fetchNextPage()}
      ListEmptyComponent={<Empty title="Nothing here yet" hint="Check back soon for new videos." />}
    />
  );
}

function Following() {
  const q = useInfiniteQuery({
    queryKey: qk.followingFeed,
    queryFn: ({ pageParam }) => api.feed.following(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.next_cursor || undefined,
  });
  const items = useMemo(() => dedupe(q.data?.pages.flatMap((p) => p.items) ?? []), [q.data]);
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;
  return (
    <FeedPager
      items={items}
      surface="following"
      refreshing={q.isRefetching && !q.isFetchingNextPage}
      onRefresh={() => void q.refetch()}
      onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && void q.fetchNextPage()}
      ListEmptyComponent={
        <View style={{ paddingTop: 160 }}>
          <Empty title="No videos from people you follow" hint="Follow creators from For You to see their posts here." />
        </View>
      }
    />
  );
}

function SignInPrompt() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: space.xl }}>
      <Empty
        title="See videos from people you follow"
        hint="Sign in to follow creators."
        action={<Button title="Sign in" onPress={() => router.push('/sign-in')} />}
      />
    </View>
  );
}

function dedupe(items: FeedItem[]): FeedItem[] {
  const seen = new Set<string>();
  return items.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
}

const useSt = makeStyles((colors) => ({
  top: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
  },
  liveBadge: { borderWidth: 1.5, borderColor: colors.text, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  liveText: { fontFamily: fonts.bodyBold, fontSize: 11 },
  tabs: { flexDirection: 'row', gap: space.xl },
  tab: { fontFamily: fonts.bodySemibold, fontSize: 16, color: 'rgba(255,255,255,0.65)' },
  tabOn: { color: colors.text },
  underline: { height: 2, width: 24, backgroundColor: colors.text, alignSelf: 'center', marginTop: 4, borderRadius: 1 },
}));

export default darkScreen(Home);
