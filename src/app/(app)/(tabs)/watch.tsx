import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { FlatList, RefreshControl } from 'react-native';
import { VideoRow } from '@/components/VideoRow';
import { Empty, ErrorView, Loading, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import type { FeedItem } from '@/lib/api/types';
import { qk } from '@/lib/query';
import { colors, space } from '@/theme/tokens';

export default function Watch() {
  const q = useInfiniteQuery({
    queryKey: qk.watchFeed,
    queryFn: () => api.feed.watch(20),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.items.length ? all.length : undefined),
  });
  const items = useMemo(() => {
    const seen = new Set<string>();
    return (q.data?.pages.flatMap((p) => p.items) ?? []).filter((i: FeedItem) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
  }, [q.data]);

  return (
    <Screen>
      <Text variant="title" style={{ paddingHorizontal: space.lg, paddingVertical: space.sm }}>
        Watch
      </Text>
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorView error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => <VideoRow item={item} />}
          onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && void q.fetchNextPage()}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.text} />}
          ListEmptyComponent={<Empty title="No long videos yet" hint="Creators' longer uploads show up here." />}
        />
      )}
    </Screen>
  );
}
