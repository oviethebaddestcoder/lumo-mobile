import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { RoomCard } from '@/components/RoomCard';
import { Chip, Empty, ErrorView, Loading, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import type { LiveCategory, Room } from '@/lib/api/types';
import { compact } from '@/lib/format';
import { useRooms } from '@/lib/hooks';
import { qk } from '@/lib/query';
import { colors, fonts, radius, space } from '@/theme/tokens';

const label = (c: string) => c.charAt(0).toUpperCase() + c.slice(1);

export default function LiveDiscovery() {
  const [category, setCategory] = useState<LiveCategory | null>(null);
  const cats = useQuery({ queryKey: qk.categories, queryFn: api.live.categories, staleTime: Infinity });
  const rooms = useRooms(category);
  const items = useMemo(() => rooms.data?.pages.flatMap((p) => p.items) ?? [], [rooms.data]);
  const pk = items.find((r) => r.pk_id);

  return (
    <Screen>
      <View style={st.header}>
        <Text variant="title">Live</Text>
        <Pressable onPress={() => router.push('/create')} style={st.goLive} accessibilityRole="button">
          <View style={st.dot} />
          <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 13 }}>Go live</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chips}>
        <Chip label="For you" active={category === null} onPress={() => setCategory(null)} />
        {(cats.data?.items ?? []).map((c) => (
          <Chip key={c} label={label(c)} active={category === c} onPress={() => setCategory(c)} />
        ))}
      </ScrollView>

      {rooms.isPending ? (
        <Loading />
      ) : rooms.isError ? (
        <ErrorView error={rooms.error} onRetry={() => void rooms.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(r) => r.id}
          numColumns={2}
          columnWrapperStyle={{ gap: space.sm }}
          contentContainerStyle={{ padding: space.md, gap: space.sm }}
          ListHeaderComponent={pk ? <PkBanner room={pk} /> : undefined}
          renderItem={({ item }) => <RoomCard room={item} />}
          onEndReached={() => rooms.hasNextPage && !rooms.isFetchingNextPage && void rooms.fetchNextPage()}
          refreshControl={<RefreshControl refreshing={rooms.isRefetching} onRefresh={() => void rooms.refetch()} tintColor={colors.text} />}
          ListEmptyComponent={<Empty title="No one is live right now" hint="Be the first. Tap Go live." />}
        />
      )}
    </Screen>
  );
}

function PkBanner({ room }: { room: Room }) {
  return (
    <Pressable onPress={() => router.push(`/live/${room.id}`)} style={st.pk} accessibilityRole="button">
      <Icon name="swords" color={colors.coin} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bodySemibold }}>PK battle live now</Text>
        <Text variant="caption" numberOfLines={1}>
          {room.host?.display_name} · {compact(room.viewers)} watching
        </Text>
      </View>
      <Text style={{ color: colors.coin, fontFamily: fonts.bodySemibold }}>Watch</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingTop: space.sm },
  goLive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface2,
    paddingHorizontal: space.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.live },
  chips: { gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md },
  pk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.coin,
    padding: space.md,
    marginBottom: space.sm,
  },
});
