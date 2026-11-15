import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Empty, ErrorView, Header, Loading, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import type { LedgerEntry } from '@/lib/api/types';
import { qk } from '@/lib/query';
import { fonts, space, makeStyles, useTheme } from '@/theme';

const kindLabel: Record<string, string> = {
  purchase: 'Bought coins',
  gift_sent: 'Sent a gift',
  gift_received: 'Received a gift',
  payout: 'Cash-out',
  payout_reversed: 'Cash-out returned',
  refund: 'Refund',
  adjustment: 'Adjustment',
};

export default function History() {
  const q = useInfiniteQuery({
    queryKey: qk.history,
    queryFn: ({ pageParam }) => api.wallet.history(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.next_cursor || undefined,
  });
  const items = useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data]);

  return (
    <Screen>
      <Header title="History" />
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorView error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(e) => String(e.id)}
          renderItem={({ item }) => <Row e={item} />}
          onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && void q.fetchNextPage()}
          ListEmptyComponent={<Empty title="No transactions yet" />}
        />
      )}
    </Screen>
  );
}

function Row({ e }: { e: LedgerEntry }) {
  const { colors } = useTheme();
  const st = useSt();
  const positive = e.amount > 0;
  const coin = e.currency === 'coins';
  return (
    <View style={st.row}>
      <Icon name={coin ? 'coin' : 'diamond'} size={22} />
      <View style={{ flex: 1 }}>
        <Text>{kindLabel[e.kind] ?? e.kind.replace(/_/g, ' ')}</Text>
        <Text variant="caption">{new Date(e.created_at).toLocaleString()}</Text>
      </View>
      <Text style={{ fontFamily: fonts.bodySemibold, color: positive ? colors.success : colors.text }}>
        {positive ? '+' : ''}
        {e.amount.toLocaleString()}
      </Text>
    </View>
  );
}

const useSt = makeStyles((colors) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
}));
