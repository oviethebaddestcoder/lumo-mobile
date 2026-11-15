import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { toast, toastError } from '@/components/Toast';
import { Button, ErrorView, Field, Header, ListRow, Loading, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { isApiError } from '@/lib/api/http';
import type { CoinPack } from '@/lib/api/types';
import { newIdempotencyKey } from '@/lib/device';
import { useBalance, useCatalog, useStats } from '@/lib/hooks';
import { buyPack, loadStoreProducts, onPurchaseOutcome, storeProductId } from '@/lib/iap';
import { qk } from '@/lib/query';
import { fonts, radius, space, makeStyles, useTheme } from '@/theme';

export default function Wallet() {
  const { colors } = useTheme();
  const st = useSt();
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
      void qc.invalidateQueries({ queryKey: qk.payouts });
      toast('Cash-out requested. We review payouts within 3 business days.', 'success');
    },
    onError: (e) => {
      if (isApiError(e) && e.code === 'payout_account_required') {
        toast('Add your bank account first.', 'error');
        router.push('/wallet/bank');
        return;
      }
      toastError(e);
    },
  });
  const diamonds = parseInt(cashout, 10) || 0;
  const stats = useStats();
  const bank = useQuery({ queryKey: qk.payoutAccount, queryFn: api.wallet.payoutAccount });
  // Display-only estimate from the server's real rate; finance approves the exact amount.
  const rate = bank.data?.kobo_per_diamond ?? 0;
  const minDiamonds = bank.data?.min_diamonds ?? 0;
  const payouts = useQuery({ queryKey: qk.payouts, queryFn: api.wallet.payouts });
  const lv = stats.data;
  const progress = lv ? Math.min(1, (lv.coins_spent - lv.level_start_coins) / Math.max(1, lv.next_level_coins - lv.level_start_coins)) : 0;

  return (
    <Screen>
      <Header title="Wallet" right={<Pressable onPress={() => router.push('/wallet/history')}><Text variant="bodyMuted">History</Text></Pressable>} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }} keyboardShouldPersistTaps="handled">
        <View style={st.balances}>
          <View style={[st.card, { borderColor: colors.coin }]}>
            <Icon name="coin" size={28} />
            <Text style={[st.big, { color: colors.coinText }]}>{(balance.data?.coins ?? 0).toLocaleString()}</Text>
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

        {lv ? (
          <View style={st.levelCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: fonts.bodySemibold }}>Level {lv.level}</Text>
              <Text variant="caption">
                {(lv.next_level_coins - lv.coins_spent).toLocaleString()} coins of gifts to Lv{lv.level + 1}
              </Text>
            </View>
            <View style={st.track}>
              <View style={[st.fill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
            <Text variant="caption">Diamonds this week: {lv.diamonds_week.toLocaleString()}</Text>
          </View>
        ) : null}

        <Text variant="h3" style={{ marginTop: space.md }}>
          Cash out diamonds
        </Text>
        <ListRow
          label={bank.data?.account ? `${bank.data.account.bank_name} ••${bank.data.account.account_last4}` : 'Add bank account'}
          value={bank.data?.account ? 'Change' : undefined}
          icon="bank"
          onPress={() => router.push('/wallet/bank')}
        />
        {diamonds > 0 && rate ? (
          <Text variant="caption">
            ≈ ₦{((diamonds * rate) / 100).toLocaleString()} before review (finance confirms the final amount)
          </Text>
        ) : minDiamonds ? (
          <Text variant="caption">Minimum cash-out is {minDiamonds.toLocaleString()} diamonds.</Text>
        ) : null}
        <View style={{ gap: space.md }}>
          <Field
            label="Diamonds"
            value={cashout}
            onChangeText={(t) => {
              setCashout(t.replace(/\D/g, ''));
              // A different amount is a different request: never replay the old one.
              setPayoutKey(newIdempotencyKey());
            }}
            keyboardType="number-pad"
            placeholder="e.g. 10000"
          />
          <Button
            title="Request cash-out"
            kind="secondary"
            disabled={diamonds <= 0 || diamonds > (balance.data?.diamonds ?? 0) || diamonds < minDiamonds}
            loading={payout.isPending}
            onPress={() =>
              Alert.alert('Cash out?', `Move ${diamonds.toLocaleString()} diamonds to payout. This can't be undone.`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Cash out', onPress: () => payout.mutate(diamonds) },
              ])
            }
          />
        </View>
        {(payouts.data?.items ?? []).length > 0 ? (
          <View style={{ gap: space.sm }}>
            <Text variant="h3">Cash-outs</Text>
            {payouts.data!.items.slice(0, 5).map((p) => (
              <View key={p.id} style={st.payoutRow}>
                <View style={{ flex: 1 }}>
                  <Text>
                    {p.diamonds.toLocaleString()} diamonds · ₦{(p.amount_kobo / 100).toLocaleString()}
                  </Text>
                  <Text variant="caption">
                    {new Date(p.created_at).toLocaleDateString()} {p.bank_label ? `· ${p.bank_label}` : ''}
                    {p.note ? ` · ${p.note}` : ''}
                  </Text>
                </View>
                <Text style={{ color: ({ paid: colors.success, rejected: colors.danger, failed: colors.danger } as Record<string, string>)[p.status] ?? colors.muted, fontFamily: fonts.bodySemibold, fontSize: 13 }}>
                  {statusLabel[p.status] ?? p.status}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        <ListRow label="Transaction history" icon="more" onPress={() => router.push('/wallet/history')} />
      </ScrollView>
    </Screen>
  );
}

const statusLabel: Record<string, string> = {
  pending_review: 'In review',
  processing: 'Sending',
  paid: 'Paid',
  rejected: 'Declined',
  failed: 'Failed',
};

const useSt = makeStyles((colors) => ({
  levelCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, gap: space.sm },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.surface2, overflow: 'hidden' },
  fill: { height: 8, backgroundColor: colors.coin },
  payoutRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md },
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
}));
