import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Sheet } from '@/components/Sheet';
import { toast, toastError } from '@/components/Toast';
import { Button, ErrorView, Field, Header, Loading, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import type { Bank } from '@/lib/api/types';
import { qk } from '@/lib/query';
import { fonts, radius, space, makeStyles, useTheme } from '@/theme';

/**
 * Add or change the bank account for cash-outs. The bank confirms the
 * account name before it's saved; only the last 4 digits are shown later.
 */
export default function BankAccount() {
  const { colors } = useTheme();
  const st = useSt();
  const qc = useQueryClient();
  const current = useQuery({ queryKey: qk.payoutAccount, queryFn: api.wallet.payoutAccount });
  const banks = useQuery({ queryKey: qk.banks, queryFn: api.wallet.banks, staleTime: 60 * 60_000 });
  const [bank, setBank] = useState<Bank | null>(null);
  const [number, setNumber] = useState('');
  const [picking, setPicking] = useState(false);
  const [filter, setFilter] = useState('');

  const save = useMutation({
    mutationFn: () => api.wallet.setPayoutAccount(bank!.code, number),
    onSuccess: (r) => {
      qc.setQueryData(qk.payoutAccount, r);
      toast(`Saved: ${r.account.account_name}`, 'success');
      router.back();
    },
    onError: toastError,
  });

  const list = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return (banks.data?.items ?? []).filter((b) => !f || b.name.toLowerCase().includes(f));
  }, [banks.data, filter]);

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Bank account" />
      <View style={{ padding: space.lg, gap: space.lg }}>
        {current.data?.account ? (
          <View style={st.card}>
            <Text variant="caption">Current account</Text>
            <Text style={{ fontFamily: fonts.bodySemibold }}>{current.data.account.account_name}</Text>
            <Text variant="bodyMuted">
              {current.data.account.bank_name} ••{current.data.account.account_last4}
            </Text>
          </View>
        ) : (
          <Text variant="bodyMuted">Cash-outs are paid in naira to a Nigerian bank account in your name.</Text>
        )}
        <View style={{ gap: 6 }}>
          <Text variant="label">Bank</Text>
          <Pressable style={st.picker} onPress={() => setPicking(true)} accessibilityRole="button">
            <Text style={{ color: bank ? colors.text : colors.inactive }}>{bank?.name ?? 'Choose your bank'}</Text>
          </Pressable>
        </View>
        <Field
          label="Account number"
          value={number}
          onChangeText={(t) => setNumber(t.replace(/\D/g, '').slice(0, 10))}
          keyboardType="number-pad"
          placeholder="10 digits"
        />
        <Button
          title={current.data?.account ? 'Replace account' : 'Verify and save'}
          disabled={!bank || number.length !== 10}
          loading={save.isPending}
          onPress={() => save.mutate()}
        />
      </View>

      <Sheet visible={picking} onClose={() => setPicking(false)} title="Choose your bank" height="80%">
        <View style={{ paddingHorizontal: space.lg }}>
          <Field value={filter} onChangeText={setFilter} placeholder="Search banks" autoCorrect={false} />
        </View>
        {banks.isPending ? (
          <Loading />
        ) : banks.isError ? (
          <ErrorView error={banks.error} onRetry={() => void banks.refetch()} />
        ) : (
          <FlatList
            data={list}
            keyExtractor={(b) => b.code}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                style={st.bankRow}
                onPress={() => {
                  setBank(item);
                  setPicking(false);
                }}
              >
                <Text>{item.name}</Text>
              </Pressable>
            )}
          />
        )}
      </Sheet>
    </Screen>
  );
}

const useSt = makeStyles((colors) => ({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, gap: 2 },
  picker: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: 15,
  },
  bankRow: { paddingHorizontal: space.lg, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
}));
