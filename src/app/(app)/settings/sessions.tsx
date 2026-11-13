import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FlatList, StyleSheet, View } from 'react-native';
import { toastError } from '@/components/Toast';
import { Button, ErrorView, Header, Loading, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { qk } from '@/lib/query';
import { colors, space } from '@/theme/tokens';

export default function Sessions() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: qk.sessions, queryFn: api.identity.sessions });
  const revoke = useMutation({
    mutationFn: api.identity.revokeSession,
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.sessions }),
    onError: toastError,
  });
  const others = useMutation({
    mutationFn: () => api.identity.logoutAll(true),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.sessions }),
    onError: toastError,
  });

  return (
    <Screen>
      <Header title="Devices & sessions" />
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorView error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <FlatList
          data={q.data.items}
          keyExtractor={(s) => s.id}
          ListFooterComponent={
            q.data.items.length > 1 ? (
              <View style={{ padding: space.lg }}>
                <Button title="Sign out all other devices" kind="danger" loading={others.isPending} onPress={() => others.mutate()} />
              </View>
            ) : undefined
          }
          renderItem={({ item }) => (
            <View style={st.row}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text>
                  {item.device_name || item.platform}
                  {item.current ? <Text style={{ color: colors.success }}>  · This device</Text> : null}
                </Text>
                <Text variant="caption">
                  {item.platform} · via {item.method} · active {timeAgo(item.last_used_at)}
                </Text>
              </View>
              {!item.current ? (
                <Button title="Sign out" small kind="ghost" onPress={() => revoke.mutate(item.id)} loading={revoke.isPending && revoke.variables === item.id} />
              ) : null}
            </View>
          )}
        />
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
