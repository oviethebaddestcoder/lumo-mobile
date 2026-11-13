import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { api } from '@/lib/api';
import type { Comment, Page } from '@/lib/api/types';
import { useSession } from '@/lib/auth/session';
import { timeAgo } from '@/lib/format';
import { useComments } from '@/lib/hooks';
import { qk } from '@/lib/query';
import { colors, fonts, radius, space } from '@/theme/tokens';
import { Icon } from './Icon';
import { ReportSheet } from './ReportSheet';
import { Sheet } from './Sheet';
import { toastError } from './Toast';
import { Avatar, ErrorView, Loading, Text } from './ui';

export function CommentsSheet({
  videoId,
  visible,
  onClose,
  count,
}: {
  videoId: string;
  visible: boolean;
  onClose: () => void;
  count?: number;
}) {
  const me = useSession((s) => s.me);
  const qc = useQueryClient();
  const q = useComments(videoId);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [reporting, setReporting] = useState<Comment | null>(null);

  const add = useMutation({
    mutationFn: () => api.social.addComment(videoId, text.trim(), replyTo?.id),
    onSuccess: (c) => {
      setText('');
      setReplyTo(null);
      qc.setQueryData<InfiniteData<Page<Comment>>>(qk.comments(videoId), (d) =>
        d && d.pages[0] ? { ...d, pages: [{ ...d.pages[0], items: [c, ...d.pages[0].items] }, ...d.pages.slice(1)] } : d,
      );
      void qc.invalidateQueries({ queryKey: ['social', 'videoCounts'] });
    },
    onError: toastError,
  });

  const del = useMutation({
    mutationFn: (id: string) => api.social.deleteComment(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.comments(videoId) }),
    onError: toastError,
  });

  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <Sheet visible={visible} onClose={onClose} title={count != null ? `${count.toLocaleString()} comments` : 'Comments'} height="72%">
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorView error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(c) => c.id}
          onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && void q.fetchNextPage()}
          ListEmptyComponent={<Text variant="bodyMuted" style={{ textAlign: 'center', padding: space.xl }}>Be the first to comment.</Text>}
          renderItem={({ item }) => (
            <View style={[st.row, item.parent_id ? { paddingLeft: space.xxl + space.lg } : null]}>
              <Avatar uri={item.user.avatar_url} name={item.user.display_name} size={32} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="caption">
                  {item.user.display_name} · {timeAgo(item.created_at)}
                </Text>
                <Text>{item.text}</Text>
                <View style={{ flexDirection: 'row', gap: space.lg, marginTop: 2 }}>
                  {!item.parent_id && me ? (
                    <Pressable onPress={() => setReplyTo(item)}>
                      <Text variant="caption">Reply</Text>
                    </Pressable>
                  ) : null}
                  {me?.id === item.user.id ? (
                    <Pressable onPress={() => del.mutate(item.id)}>
                      <Text variant="caption">Delete</Text>
                    </Pressable>
                  ) : me ? (
                    <Pressable onPress={() => setReporting(item)}>
                      <Text variant="caption">Report</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </View>
          )}
        />
      )}

      {me ? (
        <View style={st.composer}>
          {replyTo ? (
            <Pressable onPress={() => setReplyTo(null)} style={st.replying}>
              <Text variant="caption">Replying to {replyTo.user.display_name} ✕</Text>
            </Pressable>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Add a comment…"
              placeholderTextColor={colors.inactive}
              maxLength={500}
              style={st.input}
              returnKeyType="send"
              onSubmitEditing={() => text.trim() && add.mutate()}
            />
            <Pressable
              onPress={() => text.trim() && add.mutate()}
              disabled={!text.trim() || add.isPending}
              accessibilityLabel="Post comment"
              style={{ opacity: text.trim() ? 1 : 0.4 }}
            >
              <Icon name="send" color={colors.live} />
            </Pressable>
          </View>
        </View>
      ) : (
        <Text variant="bodyMuted" style={{ textAlign: 'center', padding: space.md }}>
          Sign in to comment.
        </Text>
      )}
      {reporting ? (
        <ReportSheet
          visible
          onClose={() => setReporting(null)}
          targetType="comment"
          targetId={reporting.id}
        />
      ) : null}
    </Sheet>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, padding: space.md, gap: 6 },
  replying: { alignSelf: 'flex-start' },
  input: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: 10,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 15,
  },
});
