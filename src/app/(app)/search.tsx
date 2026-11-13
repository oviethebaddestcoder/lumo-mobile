import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Avatar, Field, Header, Loading, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { isApiError } from '@/lib/api/http';
import { qk } from '@/lib/query';
import { fonts, space } from '@/theme/tokens';

/** Find a creator by @username (the gateway exposes exact handle lookup). */
export default function Search() {
  const [text, setText] = useState('');
  const [handle, setHandle] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setHandle(text.trim().replace(/^@/, '').toLowerCase()), 350);
    return () => clearTimeout(t);
  }, [text]);
  const q = useQuery({
    queryKey: qk.userByHandle(handle),
    queryFn: () => api.identity.userByHandle(handle),
    enabled: handle.length >= 2,
    retry: false,
  });

  return (
    <Screen>
      <Header title="Search" />
      <View style={{ padding: space.lg, gap: space.lg }}>
        <Field value={text} onChangeText={setText} placeholder="@username" autoCapitalize="none" autoCorrect={false} autoFocus />
        {q.isFetching ? <Loading style={{ flex: 0 }} /> : null}
        {q.data ? (
          <Pressable
            onPress={() => router.push(`/user/${q.data.id}`)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}
          >
            <Avatar uri={q.data.avatar_url} name={q.data.display_name} size={48} />
            <View>
              <Text style={{ fontFamily: fonts.bodySemibold }}>{q.data.display_name}</Text>
              <Text variant="caption">@{q.data.handle}</Text>
            </View>
          </Pressable>
        ) : q.isError && handle ? (
          <Text variant="bodyMuted">{isApiError(q.error) && q.error.status === 404 ? `No one is @${handle}.` : q.error.message}</Text>
        ) : null}
      </View>
    </Screen>
  );
}
