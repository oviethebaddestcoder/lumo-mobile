import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Avatar, Empty, ErrorView, Header, Loading, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import type { InboxItem } from '@/lib/api/types';
import { routeForPush, timeAgo } from '@/lib/format';
import { qk } from '@/lib/query';
import { colors, fonts, space } from '@/theme/tokens';

/** Activity: new followers, comments, like milestones, cash-out updates. */
export default function Inbox() {
  const qc = useQueryClient();
  const q = useInfiniteQuery({
    queryKey: qk.inbox,
    queryFn: ({ pageParam }) => api.notify.inbox(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.next_cursor || undefined,
  });
  const items = useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data]);

  // Opening the inbox marks everything read (the dots stay until next visit).
  useFocusEffect(
    useCallback(() => {
      api.notify
        .markRead()
        .then(() => qc.setQueryData(qk.inboxUnread, { count: 0 }))
        .catch(() => undefined);
    }, [qc]),
  );

  return (
    <Screen>
      <Header title="Activity" />
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorView error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => String(i.id)}
          renderItem={({ item }) => <Row item={item} />}
          onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && void q.fetchNextPage()}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.text} />}
          ListEmptyComponent={<Empty title="No activity yet" hint="Follows, comments and milestones show up here." />}
        />
      )}
    </Screen>
  );
}

function Row({ item }: { item: InboxItem }) {
  const href = routeForPush({ ...item.data, type: item.data.type ?? item.kind });
  return (
    <Pressable
      style={({ pressed }) => [st.row, pressed && { opacity: 0.7 }]}
      onPress={() => href && router.push(href as never)}
      accessibilityRole="button"
    >
      {item.actor_id ? (
        <Avatar uri={item.actor_avatar} name={item.actor_name} size={44} />
      ) : (
        <View style={st.iconWrap}>
          <Icon name={item.kind === 'payout' ? 'bank' : 'heartFill'} size={22} color={item.kind === 'payout' ? colors.diamond : colors.live} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fonts.bodySemibold }} numberOfLines={1}>
          {item.title}
        </Text>
        {item.body ? (
          <Text variant="bodyMuted" numberOfLines={2}>
            {item.body}
          </Text>
        ) : null}
        <Text variant="caption">{timeAgo(item.created_at)}</Text>
      </View>
      {!item.read ? <View style={st.dot} /> : null}
    </Pressable>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  iconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.live },
});
