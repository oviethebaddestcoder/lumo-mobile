import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import { emojiFor } from './GiftSheet';
import type { ChatLine, PkState, RoomLive } from '@/lib/useRoomEvents';
import { compact } from '@/lib/format';
import { fonts, radius, space, makeStyles, useTheme } from '@/theme';
import { Icon } from './Icon';
import { Avatar, Text } from './ui';

export function ChatList({ lines }: { lines: ChatLine[] }) {
  const { colors } = useTheme();
  const st = useSt();
  const ref = useRef<FlatList<ChatLine>>(null);
  return (
    <FlatList
      ref={ref}
      data={lines}
      keyExtractor={(l) => l.id}
      style={st.chat}
      contentContainerStyle={{ gap: 6, justifyContent: 'flex-end', flexGrow: 1 }}
      onContentSizeChange={() => ref.current?.scrollToEnd({ animated: true })}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => (
        <View style={[st.line, item.kind === 'gift' && { backgroundColor: 'rgba(255,178,36,0.18)' }]}>
          <Text style={st.lineText}>
            {item.display_name ? (
              <Text style={[st.lineName, item.kind === 'gift' && { color: colors.coin }]}>{item.display_name} </Text>
            ) : null}
            <Text style={item.kind === 'system' ? { color: colors.muted } : undefined}>{item.text}</Text>
          </Text>
        </View>
      )}
    />
  );
}

export function GiftBanners({ gifts, onDone }: { gifts: RoomLive['gifts']; onDone: (key: string) => void }) {
  const st = useSt();
  return (
    <View style={st.banners} pointerEvents="none">
      {gifts.slice(-2).map((g) => (
        <GiftBanner key={g.key} g={g} onDone={() => onDone(g.key)} />
      ))}
    </View>
  );
}

function GiftBanner({ g, onDone }: { g: RoomLive['gifts'][number]; onDone: () => void }) {
  const st = useSt();
  useEffect(() => {
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <View style={st.banner}>
      <Avatar uri={g.sender.avatar_url} name={g.sender.display_name} size={28} />
      <View style={{ flexShrink: 1 }}>
        <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 13 }} numberOfLines={1}>
          {g.sender.display_name}
        </Text>
        <Text variant="caption" numberOfLines={1}>
          sent {g.gift.gift_id.replace(/_/g, ' ')}
        </Text>
      </View>
      <Text style={{ fontSize: 26 }}>{emojiFor({ id: g.gift.gift_id, name: g.gift.gift_id })}</Text>
      {g.gift.qty > 1 ? <Text style={st.combo}>×{g.gift.qty}</Text> : null}
    </View>
  );
}

export function GoalBar({ goal, label }: { goal: { coins: number; target: number }; label?: string }) {
  const { colors } = useTheme();
  const st = useSt();
  const pct = goal.target > 0 ? Math.min(1, goal.coins / goal.target) : 0;
  return (
    <View style={st.goal}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 12, fontFamily: fonts.bodySemibold }} numberOfLines={1}>
          {label || 'Goal'}
        </Text>
        <Text style={{ fontSize: 12, color: colors.coin }}>
          {compact(goal.coins)}/{compact(goal.target)}
        </Text>
      </View>
      <View style={st.track}>
        <View style={[st.fill, { width: `${pct * 100}%` }]} />
      </View>
    </View>
  );
}

export function PkBar({ pk, roomId }: { pk: PkState; roomId: string }) {
  const { colors } = useTheme();
  const st = useSt();
  const now = useNow();
  const mineIsA = pk.room_a === roomId;
  const mine = mineIsA ? pk.score_a : pk.score_b;
  const theirs = mineIsA ? pk.score_b : pk.score_a;
  const total = mine + theirs;
  const share = total === 0 ? 0.5 : mine / total;
  const left = Math.max(0, pk.ends_at_unix - Math.floor(now / 1000));
  const result = pk.ended
    ? !pk.ended.winner_room
      ? 'Draw'
      : pk.ended.winner_room === roomId
        ? 'Victory!'
        : 'Defeat'
    : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  return (
    <View style={st.pk}>
      <View style={st.pkTrack}>
        <View style={[st.pkMine, { flex: Math.max(share, 0.04) }]}>
          <Text style={st.pkScore}>{compact(mine)}</Text>
        </View>
        <View style={[st.pkTheirs, { flex: Math.max(1 - share, 0.04) }]}>
          <Text style={[st.pkScore, { textAlign: 'right' }]}>{compact(theirs)}</Text>
        </View>
      </View>
      <View style={st.pkTimer}>
        <Icon name="swords" size={12} color={colors.coin} />
        <Text style={{ fontSize: 12, fontFamily: fonts.bodySemibold }}>{result}</Text>
      </View>
    </View>
  );
}

export function ChatInput({
  onSend,
  onGift,
  disabled,
  extra,
}: {
  onSend: (t: string) => boolean;
  onGift?: () => void;
  disabled?: boolean;
  extra?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const st = useSt();
  const [text, setText] = useState('');
  const submit = () => {
    if (onSend(text)) setText('');
  };
  return (
    <View style={st.inputRow}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={disabled ? 'Sign in to chat' : 'Say something…'}
        placeholderTextColor="rgba(255,255,255,0.6)"
        editable={!disabled}
        maxLength={200}
        returnKeyType="send"
        onSubmitEditing={submit}
        blurOnSubmit={false}
        style={st.input}
      />
      {text.trim() ? (
        <Pressable onPress={submit} style={st.circle} accessibilityLabel="Send">
          <Icon name="send" size={20} />
        </Pressable>
      ) : null}
      {extra}
      {onGift ? (
        <Pressable onPress={onGift} style={[st.circle, { backgroundColor: colors.live }]} accessibilityLabel="Send a gift">
          <Icon name="gift" size={20} />
        </Pressable>
      ) : null}
    </View>
  );
}

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

const useSt = makeStyles((colors) => ({
  chat: { maxHeight: 240, width: '78%' },
  line: { alignSelf: 'flex-start', backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 5 },
  lineText: { fontSize: 13 },
  lineName: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.mutedStrong },
  banners: { gap: 6, marginBottom: space.sm },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(214,31,82,0.85)',
    borderRadius: radius.pill,
    paddingLeft: 4,
    paddingRight: space.md,
    paddingVertical: 4,
    maxWidth: '80%',
  },
  combo: { fontFamily: fonts.heading, fontSize: 20, color: colors.coin },
  goal: { backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: radius.md, padding: space.sm, gap: 4, width: 170 },
  track: { height: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: colors.coin, borderRadius: 3 },
  pk: { gap: 4 },
  pkTrack: { flexDirection: 'row', height: 22, borderRadius: radius.pill, overflow: 'hidden' },
  pkMine: { backgroundColor: colors.live, justifyContent: 'center', paddingHorizontal: 8 },
  pkTheirs: { backgroundColor: '#2F6BFF', justifyContent: 'center', paddingHorizontal: 8 },
  pkScore: { fontFamily: fonts.bodyBold, fontSize: 12 },
  pkTimer: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: 10,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
