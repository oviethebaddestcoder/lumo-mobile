import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { toastError } from '@/components/Toast';
import { Avatar, ErrorView, Header, Loading, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import type { DirectMessage, Page } from '@/lib/api/types';
import { useSession } from '@/lib/auth/session';
import { newIdempotencyKey } from '@/lib/device';
import { onMeEvent, onMeReconnect } from '@/lib/meChannel';
import { qk } from '@/lib/query';
import { fonts, radius, space, makeStyles, useTheme } from '@/theme';

type Pending = DirectMessage & { pending?: boolean; failed?: boolean };

export default function Chat() {
  const { colors, scheme } = useTheme();
  const st = useSt();
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useSession((s) => s.me);
  const qc = useQueryClient();
  const conv = useQuery({ queryKey: qk.dmConversation(id), queryFn: () => api.dm.conversation(id) });
  const msgs = useInfiniteQuery({
    queryKey: qk.dmMessages(id),
    queryFn: ({ pageParam }) => api.dm.messages(id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.next_cursor || undefined,
  });
  const { refetch } = msgs;
  const [outbox, setOutbox] = useState<Pending[]>([]);
  const [text, setText] = useState('');
  const [peerReadAt, setPeerReadAt] = useState<string | undefined>();

  const server = useMemo(() => msgs.data?.pages.flatMap((p) => p.items) ?? [], [msgs.data]);
  // Newest first (inverted list). Pending sends show until the server copy arrives.
  const items: Pending[] = useMemo(() => {
    const known = new Set(server.map((m) => m.client_id).filter(Boolean));
    return [...outbox.filter((m) => !known.has(m.client_id)).reverse(), ...server];
  }, [server, outbox]);

  const markRead = useCallback(() => {
    api.dm
      .read(id)
      .then(() => {
        void qc.invalidateQueries({ queryKey: qk.dmUnread });
        void qc.invalidateQueries({ queryKey: qk.conversations });
      })
      .catch(() => undefined);
  }, [id, qc]);

  useEffect(() => {
    markRead();
  }, [markRead]);

  // Live: append incoming messages for this chat, track read receipts.
  useEffect(() => {
    const prepend = (m: DirectMessage) =>
      qc.setQueryData<InfiniteData<Page<DirectMessage>>>(qk.dmMessages(id), (d) => {
        if (!d || d.pages.some((p) => p.items.some((x) => x.id === m.id))) return d;
        const [first, ...rest] = d.pages;
        return { ...d, pages: [{ ...first!, items: [m, ...(first?.items ?? [])] }, ...rest] };
      });
    const off = onMeEvent((e) => {
      if (e.type === 'dm' && e.data.conversation_id === id) {
        prepend({ ...e.data });
        if (e.data.sender_id !== me?.id) markRead();
      }
      if (e.type === 'dm_read' && e.data.conversation_id === id && e.data.user_id !== me?.id) {
        setPeerReadAt(e.data.read_at);
      }
    });
    const off2 = onMeReconnect(() => void refetch());
    return () => {
      off();
      off2();
    };
  }, [id, me?.id, qc, markRead, refetch]);

  async function deliver(m: Pending) {
    try {
      const saved = await api.dm.send(id, m.text, m.client_id!);
      qc.setQueryData<InfiniteData<Page<DirectMessage>>>(qk.dmMessages(id), (d) => {
        if (!d || d.pages.some((p) => p.items.some((x) => x.id === saved.id))) return d;
        const [first, ...rest] = d.pages;
        return { ...d, pages: [{ ...first!, items: [saved, ...(first?.items ?? [])] }, ...rest] };
      });
      setOutbox((o) => o.filter((x) => x.client_id !== m.client_id));
    } catch (e) {
      setOutbox((o) => o.map((x) => (x.client_id === m.client_id ? { ...x, pending: false, failed: true } : x)));
      toastError(e);
    }
  }

  function send() {
    const t = text.trim();
    if (!t || !me) return;
    const m: Pending = {
      id: `local-${Date.now()}`,
      conversation_id: id,
      sender_id: me.id,
      client_id: newIdempotencyKey(),
      text: t,
      created_at: new Date().toISOString(),
      pending: true,
    };
    setText('');
    setOutbox((o) => [...o, m]);
    void deliver(m);
  }

  function onLongPress(m: Pending) {
    if (m.sender_id !== me?.id || m.pending || m.deleted) return;
    if (m.failed) {
      setOutbox((o) => o.map((x) => (x.client_id === m.client_id ? { ...x, failed: false, pending: true } : x)));
      void deliver(m);
      return;
    }
    Alert.alert('Unsend message?', 'It will be removed for both of you.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unsend',
        style: 'destructive',
        onPress: () =>
          api.dm
            .unsend(m.id)
            .then(() => refetch())
            .catch(toastError),
      },
    ]);
  }

  const peer = conv.data?.peer;
  const readAt = peerReadAt ?? conv.data?.peer_read_at;
  const lastMine = items.find((m) => m.sender_id === me?.id && !m.pending);
  // "Seen" belongs under your own message, so show it only when that is the newest one.
  const seen = !!(lastMine && items[0] === lastMine && readAt && Date.parse(readAt) >= Date.parse(lastMine.created_at));

  return (
    <Screen edges={['top', 'bottom']}>
      <Header
        title={peer?.display_name ?? 'Chat'}
        right={peer ? (
          <Pressable onPress={() => router.push(`/user/${peer.id}`)} accessibilityLabel="View profile">
            <Avatar uri={peer.avatar_url} name={peer.display_name} size={28} />
          </Pressable>
        ) : null}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {msgs.isPending ? (
          <Loading />
        ) : msgs.isError ? (
          <ErrorView error={msgs.error} onRetry={() => void msgs.refetch()} />
        ) : (
          <FlatList
            inverted
            data={items}
            keyExtractor={(m) => m.client_id || m.id}
            contentContainerStyle={{ padding: space.md, gap: 6 }}
            onEndReached={() => msgs.hasNextPage && !msgs.isFetchingNextPage && void msgs.fetchNextPage()}
            ListHeaderComponent={seen ? <Text variant="caption" style={{ alignSelf: 'flex-end' }}>Seen</Text> : undefined}
            renderItem={({ item }) => {
              const mine = item.sender_id === me?.id;
              return (
                <Pressable
                  onLongPress={() => onLongPress(item)}
                  style={[st.bubble, mine ? st.mine : st.theirs, item.pending && { opacity: 0.6 }]}
                  accessibilityHint={mine ? 'Long press to unsend' : undefined}
                >
                  <Text style={item.deleted ? { color: mine ? colors.onLive : colors.muted, opacity: mine ? 0.8 : 1, fontStyle: 'italic' } : mine ? { color: colors.onLive } : undefined}>
                    {item.deleted ? 'Message unsent' : item.text}
                  </Text>
                  {item.failed ? <Text style={{ color: mine ? colors.onLive : colors.danger, fontSize: 11, fontFamily: fonts.bodySemibold }}>Not sent. Long press to retry.</Text> : null}
                </Pressable>
              );
            }}
          />
        )}
        <View style={st.composer}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Message…"
            placeholderTextColor={colors.inactive}
            maxLength={1000}
            multiline
            keyboardAppearance={scheme}
            style={st.input}
          />
          <Pressable onPress={send} disabled={!text.trim()} style={[st.send, !text.trim() && { opacity: 0.4 }]} accessibilityLabel="Send">
            <Icon name="send" size={20} color={colors.onLive} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const useSt = makeStyles((colors) => ({
  bubble: { maxWidth: '78%', borderRadius: radius.lg, paddingHorizontal: space.md, paddingVertical: 9 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.live, borderBottomRightRadius: 4 },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surface2, borderBottomLeftRadius: 4 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    padding: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    backgroundColor: colors.surface2,
    borderRadius: radius.xl,
    paddingHorizontal: space.lg,
    paddingTop: 10,
    paddingBottom: 10,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  send: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.live, alignItems: 'center', justifyContent: 'center' },
}));
