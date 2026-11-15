import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Avatar, Empty, Field, Header, Loading, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { qk } from '@/lib/query';
import { fonts, space, makeStyles, useTheme } from '@/theme';

type Tab = 'people' | 'hashtags';

/** People (handle / name prefix) and hashtags. */
export default function Search() {
  const { colors } = useTheme();
  const st = useSt();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<Tab>('people');
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);

  const people = useQuery({
    queryKey: qk.searchUsers(q.toLowerCase()),
    queryFn: () => api.identity.searchUsers(q),
    enabled: tab === 'people' && q.replace(/^@/, '').length >= 2,
    staleTime: 30_000,
  });
  const tag = q.replace(/^#/, '').toLowerCase().replace(/[^\p{L}\p{N}_]/gu, '');

  return (
    <Screen>
      <Header title="Search" />
      <View style={{ paddingHorizontal: space.lg, gap: space.md }}>
        <Field
          value={text}
          onChangeText={(t) => {
            setText(t);
            if (t.trim().startsWith('#')) setTab('hashtags');
          }}
          placeholder="Search people or #hashtags" autoCapitalize="none" autoCorrect={false} autoFocus />
        <View style={st.tabs}>
          {(['people', 'hashtags'] as const).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={[st.tab, tab === t && st.on]} accessibilityRole="tab">
              <Text style={{ fontFamily: fonts.bodySemibold, color: tab === t ? colors.text : colors.inactive }}>
                {t === 'people' ? 'People' : 'Hashtags'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      {tab === 'people' ? (
        people.isFetching && !people.data ? (
          <Loading />
        ) : (
          <FlatList
            data={people.data?.items ?? []}
            keyExtractor={(u) => u.id}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={q.length >= 2 ? <Empty title="No one found" hint="Try a different name or @username." /> : undefined}
            renderItem={({ item }) => (
              <Pressable style={st.row} onPress={() => router.push(`/user/${item.id}`)}>
                <Avatar uri={item.avatar_url} name={item.display_name} size={46} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bodySemibold }}>{item.display_name}</Text>
                  <Text variant="caption">@{item.handle}</Text>
                </View>
                {item.verified ? <Icon name="check" size={16} color={colors.diamond} strokeWidth={3} /> : null}
              </Pressable>
            )}
          />
        )
      ) : tag ? (
        <Pressable style={st.row} onPress={() => router.push(`/tag/${encodeURIComponent(tag)}`)}>
          <View style={st.hash}>
            <Icon name="hash" size={22} />
          </View>
          <Text style={{ fontFamily: fonts.bodySemibold, flex: 1 }}>#{tag}</Text>
          <Text variant="caption">See videos</Text>
        </Pressable>
      ) : (
        <Empty title="Find a hashtag" hint="Type a tag like #afrodance." />
      )}
    </Screen>
  );
}

const useSt = makeStyles((colors) => ({
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: space.sm },
  on: { borderBottomWidth: 2, borderBottomColor: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm },
  hash: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
}));
