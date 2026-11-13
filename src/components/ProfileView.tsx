import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { UserPublic, Video, VideoKind } from '@/lib/api/types';
import { compact, duration } from '@/lib/format';
import { useCounts, useUserVideos } from '@/lib/hooks';
import { colors, fonts, space } from '@/theme/tokens';
import { Icon } from './Icon';
import { Avatar, Empty, Loading, Text } from './ui';

const TABS: { kind: VideoKind; label: string }[] = [
  { kind: 'short', label: 'Videos' },
  { kind: 'replay', label: 'Replays' },
  { kind: 'long', label: 'Long' },
];

/** Shared by the Me tab and other users' profiles. */
export function ProfileView({
  user,
  header,
  actions,
  extra,
}: {
  user: UserPublic;
  header?: ReactNode;
  actions?: ReactNode;
  extra?: ReactNode;
}) {
  const [kind, setKind] = useState<VideoKind>('short');
  const counts = useCounts(user.id);
  const videos = useUserVideos(user.id, kind);
  const items = useMemo(() => videos.data?.pages.flatMap((p) => p.items) ?? [], [videos.data]);
  const { width } = useWindowDimensions();
  const cell = (width - 2) / 3;

  const top = (
    <View>
      {header}
      <View style={st.head}>
        <Avatar uri={user.avatar_url} name={user.display_name} size={92} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text variant="h2">{user.display_name}</Text>
          {user.verified ? <Icon name="check" size={16} color={colors.diamond} strokeWidth={3} /> : null}
        </View>
        <Text variant="bodyMuted">@{user.handle}</Text>
        <View style={st.stats}>
          <Stat
            value={counts.data?.following}
            label="Following"
            onPress={() => router.push({ pathname: '/follows/[id]', params: { id: user.id, tab: 'following' } })}
          />
          <Stat
            value={counts.data?.followers}
            label="Followers"
            onPress={() => router.push({ pathname: '/follows/[id]', params: { id: user.id, tab: 'followers' } })}
          />
        </View>
        {actions}
        {user.bio ? (
          <Text style={{ textAlign: 'center', paddingHorizontal: space.xl }}>{user.bio}</Text>
        ) : null}
        {extra}
      </View>
      <View style={st.tabs}>
        {TABS.map((t) => (
          <Pressable
            key={t.kind}
            onPress={() => setKind(t.kind)}
            style={[st.tab, kind === t.kind && st.tabOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: kind === t.kind }}
          >
            <Text style={{ fontFamily: fonts.bodySemibold, color: kind === t.kind ? colors.text : colors.inactive }}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <FlatList
      data={items}
      keyExtractor={(v) => v.id}
      numColumns={3}
      ListHeaderComponent={top}
      columnWrapperStyle={{ gap: 1 }}
      contentContainerStyle={{ gap: 1, paddingBottom: space.xxl }}
      renderItem={({ item }) => <Thumb v={item} size={cell} />}
      onEndReached={() => videos.hasNextPage && !videos.isFetchingNextPage && void videos.fetchNextPage()}
      refreshControl={
        <RefreshControl
          refreshing={videos.isRefetching}
          onRefresh={() => {
            void videos.refetch();
            void counts.refetch();
          }}
          tintColor={colors.text}
        />
      }
      ListEmptyComponent={videos.isPending ? <Loading /> : <Empty title="No videos yet" />}
    />
  );
}

function Thumb({ v, size }: { v: Video; size: number }) {
  return (
    <Pressable
      onPress={() => router.push(`/watch/${v.id}`)}
      style={{ width: size, height: v.kind === 'short' ? size * 1.33 : size * 0.75, backgroundColor: colors.surface2 }}
      accessibilityLabel={v.title || 'Video'}
    >
      {v.thumbnail_url ? <Image source={{ uri: v.thumbnail_url }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
      <View style={st.badge}>
        {v.status !== 'ready' ? (
          <Text style={st.badgeText}>{v.status === 'failed' ? 'Failed' : 'Processing'}</Text>
        ) : (
          <>
            <Icon name="play" size={10} />
            <Text style={st.badgeText}>{duration(v.duration_ms)}</Text>
          </>
        )}
      </View>
      {v.visibility !== 'public' ? (
        <View style={[st.badge, { top: 4, bottom: undefined }]}>
          <Text style={st.badgeText}>{v.visibility === 'private' ? 'Private' : 'Followers'}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function Stat({ value, label, onPress }: { value?: number; label: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ alignItems: 'center', minWidth: 80 }} accessibilityRole="button">
      <Text style={{ fontFamily: fonts.heading, fontSize: 18 }}>{value == null ? '–' : compact(value)}</Text>
      <Text variant="caption">{label}</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  head: { alignItems: 'center', gap: space.sm, paddingVertical: space.lg },
  stats: { flexDirection: 'row', gap: space.xl, marginVertical: space.sm },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: space.md },
  tabOn: { borderBottomWidth: 2, borderBottomColor: colors.text },
  badge: { position: 'absolute', left: 4, bottom: 4, flexDirection: 'row', alignItems: 'center', gap: 3 },
  badgeText: { fontSize: 11, fontFamily: fonts.bodySemibold },
});
