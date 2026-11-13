import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { toast, toastError } from '@/components/Toast';
import { Button, ErrorView, Field, Header, ListRow, Loading, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import type { CoinPack } from '@/lib/api/types';
import { newIdempotencyKey } from '@/lib/device';
import { useBalance, useCatalog } from '@/lib/hooks';
import { buyPack, loadStoreProducts, onPurchaseOutcome, storeProductId } from '@/lib/iap';
import { qk } from '@/lib/query';
import { colors, fonts, radius, space } from '@/theme/tokens';

export default function Wallet() {
  const balance = useBalance();
  const catalog = useCatalog();
  const qc = useQueryClient();
  const packs = catalog.data?.packs ?? [];
  const products = useQuery({
    queryKey: ['iap', 'products', packs.map((p) => p.id).join(',')],
    queryFn: () => loadStoreProducts(packs),
    enabled: packs.length > 0,
    staleTime: 10 * 60_000,
  });
  const [buying, setBuying] = useState<string | null>(null);
  const [cashout, setCashout] = useState('');
  const [payoutKey, setPayoutKey] = useState(newIdempotencyKey);

  useEffect(() => {
    const off = onPurchaseOutcome((o) => {
        setBuying(null);
        if (o.kind === 'credited') toast(`+${o.result.coins_added.toLocaleString()} coins added`, 'success');
        else if (o.kind === 'pending') toast('Payment pending. Coins arrive once it clears.');
        else if (o.kind === 'error') toast(o.message, 'error');
    });
    return () => {
      off();
    };
  }, []);

  async function buy(p: CoinPack) {
    setBuying(p.id);
    try {
      await buyPack(p);
    } catch (e) {
      setBuying(null);
      toastError(e);
    }
  }

  const payout = useMutation({
    mutationFn: (diamonds: number) => api.wallet.payout(diamonds, payoutKey),
    onSuccess: (r) => {
      setCashout('');
      setPayoutKey(newIdempotencyKey());
      qc.setQueryData(qk.balance, (b: { coins: number; diamonds: number } | undefined) => (b ? { ...b, diamonds: r.diamonds_left } : b));
      void qc.invalidateQueries({ queryKey: qk.history });
      toast('Cash-out requested. We review payouts within 3 business days.', 'success');
    },
    onError: toastError,
  });
  const diamonds = parseInt(cashout, 10) || 0;

  return (
    <Screen>
      <Header title="Wallet" right={<Pressable onPress={() => router.push('/wallet/history')}><Text variant="bodyMuted">History</Text></Pressable>} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }} keyboardShouldPersistTaps="handled">
        <View style={st.balances}>
          <View style={[st.card, { borderColor: colors.coin }]}>
            <Icon name="coin" size={28} />
            <Text style={[st.big, { color: colors.coin }]}>{(balance.data?.coins ?? 0).toLocaleString()}</Text>
            <Text variant="caption">Coins · for sending gifts</Text>
          </View>
          <View style={[st.card, { borderColor: colors.diamond }]}>
            <Icon name="diamond" size={28} />
            <Text style={[st.big, { color: colors.diamond }]}>{(balance.data?.diamonds ?? 0).toLocaleString()}</Text>
            <Text variant="caption">Diamonds · from gifts</Text>
          </View>
        </View>

        <Text variant="h3">Get coins</Text>
        {catalog.isPending ? (
          <Loading />
        ) : catalog.isError ? (
          <ErrorView error={catalog.error} onRetry={() => void catalog.refetch()} />
        ) : (
          <View style={st.grid}>
            {packs.map((p) => {
              const product = products.data?.get(storeProductId(p));
              return (
                <Pressable
                  key={p.id}
                  style={({ pressed }) => [st.pack, pressed && { opacity: 0.8 }]}
                  onPress={() => void buy(p)}
                  disabled={!!buying || !product}
                  accessibilityRole="button"
                  accessibilityLabel={`${p.coins} coins for ${product?.displayPrice ?? 'price unavailable'}`}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Icon name="coin" size={20} />
                    <Text style={{ fontFamily: fonts.heading, fontSize: 18 }}>{p.coins.toLocaleString()}</Text>
                  </View>
                  <View style={st.price}>
                    {buying === p.id ? (
                      <Text style={st.priceText}>…</Text>
                    ) : (
                      <Text style={st.priceText}>{product?.displayPrice ?? (products.isPending ? '…' : 'Unavailable')}</Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
        <Text variant="caption">
          Purchases are processed by {process.env.EXPO_OS === 'ios' ? 'the App Store' : 'Google Play'}. Coins have no cash value and
          can’t be refunded or transferred.
        </Text>

        <Text variant="h3" style={{ marginTop: space.md }}>
          Cash out diamonds
        </Text>
        <View style={{ gap: space.md }}>
          <Field
            label="Diamonds"
            value={cashout}
            onChangeText={(t) => setCashout(t.replace(/\D/g, ''))}
            keyboardType="number-pad"
            placeholder="e.g. 10000"
          />
          <Button
            title="Request cash-out"
            kind="secondary"
            disabled={diamonds <= 0 || diamonds > (balance.data?.diamonds ?? 0)}
            loading={payout.isPending}
            onPress={() =>
              Alert.alert('Cash out?', `Move ${diamonds.toLocaleString()} diamonds to payout. This can't be undone.`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Cash out', onPress: () => payout.mutate(diamonds) },
              ])
            }
          />
        </View>
        <ListRow label="Transaction history" icon="more" onPress={() => router.push('/wallet/history')} />
      </ScrollView>
    </Screen>
  );
}

const st = StyleSheet.create({
  balances: { flexDirection: 'row', gap: space.md },
  card: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, padding: space.lg, gap: 4 },
  big: { fontFamily: fonts.heading, fontSize: 26 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pack: {
    width: '31.5%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: space.lg,
    alignItems: 'center',
    gap: space.sm,
  },
  price: { backgroundColor: colors.coin, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 4 },
  priceText: { color: colors.onCoin, fontFamily: fonts.bodySemibold, fontSize: 13 },
});
