import { useInfiniteQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { Avatar, Empty, ErrorView, Header, Loading, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import type { Conversation } from '@/lib/api/types';
import { timeAgo } from '@/lib/format';
import { onMeEvent, onMeReconnect } from '@/lib/meChannel';
import { qk } from '@/lib/query';
import { fonts, space, makeStyles, useTheme } from '@/theme';

export default function Messages() {
  const { colors } = useTheme();
  const q = useInfiniteQuery({
    queryKey: qk.conversations,
    queryFn: ({ pageParam }) => api.dm.conversations(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.next_cursor || undefined,
  });
  const items = useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data]);

  // New messages reorder the list: refetch on any DM event or reconnect.
  const { refetch } = q;
  useEffect(() => {
    const a = onMeEvent((e) => {
      if (e.type === 'dm' || e.type === 'dm_read') void refetch();
    });
    const b = onMeReconnect(() => void refetch());
    return () => {
      a();
      b();
    };
  }, [refetch]);

  return (
    <Screen>
      <Header title="Messages" />
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorView error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => <Row c={item} />}
          onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && void q.fetchNextPage()}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.text} />}
          ListEmptyComponent={<Empty title="No messages yet" hint="Open someone's profile and tap Message to start a chat." />}
        />
      )}
    </Screen>
  );
}

function Row({ c }: { c: Conversation }) {
  const { colors } = useTheme();
  const st = useSt();
  const unread = c.unread > 0;
  return (
    <Pressable
      style={({ pressed }) => [st.row, pressed && { opacity: 0.7 }]}
      onPress={() => router.push(`/chat/${c.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Chat with ${c.peer.display_name}${unread ? `, ${c.unread} unread` : ''}`}
    >
      <Avatar uri={c.peer.avatar_url} name={c.peer.display_name} size={52} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: unread ? fonts.bodyBold : fonts.bodySemibold, flex: 1 }} numberOfLines={1}>
            {c.peer.display_name || 'Lumo user'}
          </Text>
          {c.last_message_at ? <Text variant="caption">{timeAgo(c.last_message_at)}</Text> : null}
        </View>
        <Text style={{ color: unread ? colors.text : colors.muted, fontSize: 14 }} numberOfLines={1}>
          {c.last_from_me ? 'You: ' : ''}
          {c.last_preview}
        </Text>
      </View>
      {unread ? (
        <View style={st.count}>
          <Text style={{ fontSize: 11, fontFamily: fonts.bodyBold, color: colors.onLive }}>{c.unread > 99 ? '99+' : c.unread}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const useSt = makeStyles((colors) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  count: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: colors.live,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
