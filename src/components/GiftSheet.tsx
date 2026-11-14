import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { api } from '@/lib/api';
import { isApiError } from '@/lib/api/http';
import type { Gift } from '@/lib/api/types';
import { useSession } from '@/lib/auth/session';
import { newIdempotencyKey } from '@/lib/device';
import { useBackpack, useBalance, useCatalog } from '@/lib/hooks';
import { qk } from '@/lib/query';
import { colors, fonts, radius, space } from '@/theme/tokens';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { toast, toastError } from './Toast';
import { Button, CoinAmount, ErrorView, Loading, Text } from './ui';

const QTYS = [1, 10, 99] as const;
const TABS = ['Gifts', 'Backpack'] as const;

const giftEmoji: Record<string, string> = {
  heart: '💖',
  rose: '🌹',
  star: '⭐',
  mic_drop: '🎤',
  flame: '🔥',
  diamond: '💎',
  crown: '👑',
  rocket: '🚀',
};
export const emojiFor = (g: Pick<Gift, 'id' | 'name'>) =>
  giftEmoji[g.id] ?? giftEmoji[g.name.toLowerCase()] ?? '🎁';

interface Props {
  visible: boolean;
  onClose: () => void;
  receiverId: string;
  roomId?: string;
  videoId?: string;
  onSent?: (gift: Gift, qty: number) => void;
}

export function GiftSheet({ visible, onClose, receiverId, roomId, videoId, onSent }: Props) {
  const me = useSession((s) => s.me);
  const catalog = useCatalog();
  const balance = useBalance();
  const qc = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Gifts');
  const [selected, setSelected] = useState<Gift | null>(null);
  const [qty, setQty] = useState<(typeof QTYS)[number]>(1);
  const backpack = useBackpack();
  const fromBackpack = tab === 'Backpack';
  const checkin = useMutation({
    mutationFn: api.wallet.checkin,
    onSuccess: (r) => {
      if (!r.already_checked_in) toast(`Day ${r.streak}: +${r.reward.qty} ${r.reward.gift_id.replace(/_/g, ' ')} in your backpack`, 'success');
      void qc.invalidateQueries({ queryKey: qk.backpack });
    },
    onError: toastError,
  });

  const send = useMutation({
    mutationFn: async (v: { gift: Gift; qty: number; key: string; backpack: boolean }) =>
      api.wallet.sendGift(
        {
          receiver_id: receiverId,
          gift_id: v.gift.id,
          qty: v.qty,
          room_id: roomId,
          video_id: roomId ? undefined : videoId,
          from_backpack: v.backpack || undefined,
        },
        v.key,
      ),
    onSuccess: (res, v) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (v.backpack) void qc.invalidateQueries({ queryKey: qk.backpack });
      else qc.setQueryData(qk.balance, (b: { coins: number; diamonds: number } | undefined) => (b ? { ...b, coins: res.balance } : b));
      void qc.invalidateQueries({ queryKey: qk.stats });
      onSent?.(v.gift, v.qty);
    },
    onError: (e) => {
      if (isApiError(e) && e.code === 'insufficient_coins') {
        toast('Not enough coins. Top up to send this gift.', 'error');
        onClose();
        router.push('/wallet');
        return;
      }
      toastError(e);
    },
  });

  const coins = balance.data?.coins ?? 0;
  const total = selected ? selected.coins * qty : 0;
  const owned = fromBackpack && selected ? (backpack.data?.items.find((i) => i.id === selected.id)?.qty ?? 0) : 0;
  const canSend = !!selected && !isSelfCheck(me?.id, receiverId) && (fromBackpack ? qty <= owned : total <= coins);
  const isSelf = me?.id === receiverId;

  return (
    <Sheet visible={visible} onClose={onClose} height="58%">
      <View style={st.tabs}>
        {TABS.map((t) => (
          <Pressable
            key={t}
            onPress={() => {
              setTab(t);
              setSelected(null);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t }}
          >
            <Text style={[st.tab, tab === t && st.tabActive]}>{t}</Text>
          </Pressable>
        ))}
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => (onClose(), router.push('/wallet'))} style={st.balance} accessibilityLabel="Top up coins">
          <CoinAmount value={coins.toLocaleString()} />
          <Icon name="plus" size={14} color={colors.coin} />
        </Pressable>
      </View>

      {!me?.adult ? (
        <View style={{ padding: space.xl, gap: space.md }}>
          <Text variant="bodyMuted" style={{ textAlign: 'center' }}>
            Sending gifts is only available to users 18 and older.
          </Text>
        </View>
      ) : fromBackpack ? (
        backpack.isPending ? (
          <Loading />
        ) : (
          <FlatList
            data={backpack.data?.items ?? []}
            numColumns={4}
            keyExtractor={(g) => g.id}
            contentContainerStyle={{ paddingHorizontal: space.sm }}
            ListHeaderComponent={
              <View style={st.checkin}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bodySemibold }}>
                    {backpack.data?.checked_in_today ? `Checked in · ${backpack.data.streak}-day streak` : 'Daily check-in'}
                  </Text>
                  <Text variant="caption">
                    {backpack.data?.checked_in_today ? 'Come back tomorrow for' : 'Today:'} {backpack.data?.next_reward.qty}×{' '}
                    {backpack.data?.next_reward.gift_id.replace(/_/g, ' ')} · free gifts count for PK and goals
                  </Text>
                </View>
                {!backpack.data?.checked_in_today ? (
                  <Button small kind="coin" title="Claim" loading={checkin.isPending} onPress={() => checkin.mutate()} />
                ) : null}
              </View>
            }
            ListEmptyComponent={
              <Text variant="bodyMuted" style={{ textAlign: 'center', padding: space.lg }}>
                Your backpack is empty. Check in daily for free gifts.
              </Text>
            }
            renderItem={({ item }) => {
              const on = selected?.id === item.id;
              return (
                <Pressable
                  onPress={() => setSelected(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name}, ${item.qty} in backpack`}
                  accessibilityState={{ selected: on }}
                  style={[st.cell, on && st.cellOn]}
                >
                  <Text style={{ fontSize: 30 }}>{emojiFor(item)}</Text>
                  <Text variant="caption" numberOfLines={1} style={{ color: colors.text }}>
                    {item.name}
                  </Text>
                  <Text variant="caption">×{item.qty}</Text>
                </Pressable>
              );
            }}
          />
        )
      ) : catalog.isPending ? (
        <Loading />
      ) : catalog.isError ? (
        <ErrorView error={catalog.error} onRetry={() => void catalog.refetch()} />
      ) : (
        <FlatList
          data={catalog.data.gifts}
          numColumns={4}
          keyExtractor={(g) => g.id}
          contentContainerStyle={{ paddingHorizontal: space.sm }}
          renderItem={({ item }) => {
            const on = selected?.id === item.id;
            return (
              <Pressable
                onPress={() => setSelected(item)}
                accessibilityRole="button"
                accessibilityLabel={`${item.name}, ${item.coins} coins`}
                accessibilityState={{ selected: on }}
                style={[st.cell, on && st.cellOn]}
              >
                <Text style={{ fontSize: 30 }}>{emojiFor(item)}</Text>
                <Text variant="caption" numberOfLines={1} style={{ color: colors.text }}>
                  {item.name}
                </Text>
                <CoinAmount value={item.coins} size={11} />
              </Pressable>
            );
          }}
        />
      )}

      {me?.adult ? (
        <View style={st.footer}>
          <View style={st.qtys}>
            {QTYS.map((q) => (
              <Pressable key={q} onPress={() => setQty(q)} style={[st.qty, qty === q && st.qtyOn]} accessibilityRole="button">
                <Text style={{ fontFamily: fonts.bodySemibold, color: qty === q ? colors.bg : colors.text }}>×{q}</Text>
              </Pressable>
            ))}
          </View>
          <Button
            kind="primary"
            small
            title={selected ? (fromBackpack ? `Send ×${qty}` : `Send · ${total.toLocaleString()}`) : 'Send'}
            disabled={!canSend}
            loading={send.isPending}
            onPress={() => selected && send.mutate({ gift: selected, qty, key: newIdempotencyKey(), backpack: fromBackpack })}
          />
        </View>
      ) : null}
      {isSelf ? (
        <Text variant="caption" style={{ textAlign: 'center' }}>
          You can’t send gifts to yourself.
        </Text>
      ) : null}
    </Sheet>
  );
}

const st = StyleSheet.create({
  tabs: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingHorizontal: space.lg, marginBottom: space.md },
  tab: { color: colors.muted, fontFamily: fonts.bodySemibold },
  tabActive: { color: colors.text },
  balance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface2,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  cell: {
    flex: 1 / 4,
    alignItems: 'center',
    gap: 2,
    paddingVertical: space.sm,
    margin: 3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cellOn: { borderColor: colors.coin, backgroundColor: colors.surface2 },
  checkin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    padding: space.md,
    margin: 3,
    marginBottom: space.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  qtys: { flexDirection: 'row', gap: space.sm },
  qty: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surface2 },
  qtyOn: { backgroundColor: colors.text },
});

const isSelfCheck = (me: string | undefined, receiver: string) => !!me && me === receiver;
