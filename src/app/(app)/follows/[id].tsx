import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Avatar, Empty, ErrorView, Header, Loading, Screen, Text } from '@/components/ui';
import { useFollowers } from '@/lib/hooks';
import { fonts, space, makeStyles, useTheme } from '@/theme';

export default function Follows() {
  const { colors } = useTheme();
  const st = useSt();
  const { id, tab: initial } = useLocalSearchParams<{ id: string; tab?: 'followers' | 'following' }>();
  const [tab, setTab] = useState<'followers' | 'following'>(initial === 'following' ? 'following' : 'followers');
  const q = useFollowers(id, tab);
  const items = useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data]);

  return (
    <Screen>
      <Header title={tab === 'followers' ? 'Followers' : 'Following'} />
      <View style={st.tabs}>
        {(['following', 'followers'] as const).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[st.tab, tab === t && st.on]} accessibilityRole="tab">
            <Text style={{ fontFamily: fonts.bodySemibold, color: tab === t ? colors.text : colors.inactive }}>
              {t === 'followers' ? 'Followers' : 'Following'}
            </Text>
          </Pressable>
        ))}
      </View>
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorView error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(e) => e.user.id}
          onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && void q.fetchNextPage()}
          ListEmptyComponent={<Empty title={tab === 'followers' ? 'No followers yet' : 'Not following anyone yet'} />}
          renderItem={({ item }) => (
            <Pressable style={st.row} onPress={() => router.push(`/user/${item.user.id}`)}>
              <Avatar uri={item.user.avatar_url} name={item.user.display_name} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bodySemibold }}>{item.user.display_name}</Text>
                <Text variant="caption">@{item.user.handle}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

const useSt = makeStyles((colors) => ({
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: space.md },
  on: { borderBottomWidth: 2, borderBottomColor: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm },
}));
