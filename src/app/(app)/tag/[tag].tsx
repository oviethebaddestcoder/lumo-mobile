import { useInfiniteQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Empty, ErrorView, Header, Loading, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { compact } from '@/lib/format';
import { qk } from '@/lib/query';
import { fonts, useTheme, useLayout } from '@/theme';

export default function HashtagPage() {
  const { colors } = useTheme();
  const { tag } = useLocalSearchParams<{ tag: string }>();
  const { width, gridColumns: cols } = useLayout();
  const q = useInfiniteQuery({
    queryKey: qk.hashtag(tag),
    queryFn: ({ pageParam }) => api.media.hashtagVideos(tag, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.next_cursor || undefined,
  });
  const items = useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data]);
  const cell = (width - (cols - 1)) / cols;

  return (
    <Screen fullWidth>
      <Header title={`#${tag}`} />
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorView error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <FlatList
          data={items}
          key={cols}
          numColumns={cols}
          keyExtractor={(v) => v.id}
          columnWrapperStyle={{ gap: 1 }}
          contentContainerStyle={{ gap: 1 }}
          onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && void q.fetchNextPage()}
          ListEmptyComponent={<Empty title={`No videos with #${tag} yet`} hint="Add it to your next video's description." />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/watch/${item.id}`)}
              style={{ width: cell, height: cell * 1.33, backgroundColor: colors.surface2 }}
              accessibilityLabel={item.title || 'Video'}
            >
              {item.thumbnail_url ? <Image source={{ uri: item.thumbnail_url }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
              <View style={st.badge}>
                <Icon name="play" size={10} color={colors.onMedia} />
                <Text style={{ fontSize: 11, fontFamily: fonts.bodySemibold, color: colors.onMedia, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3 }}>{compact(item.views ?? 0)}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  badge: { position: 'absolute', left: 4, bottom: 4, flexDirection: 'row', alignItems: 'center', gap: 3 },
});
