import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import type { Room } from '@/lib/api/types';
import { compact } from '@/lib/format';
import { fonts, radius, space, makeStyles, useTheme, ThemeScope } from '@/theme';
import { Icon } from './Icon';
import { Avatar, Text } from './ui';

const tint: Record<string, string> = {
  music: '#3B2A5C',
  talk: '#21384F',
  dance: '#4F2140',
  gaming: '#1E3D33',
  cooking: '#4A3420',
  sports: '#20354A',
  education: '#2E3A20',
  other: '#2A2A35',
};

/** LIVE tiles sit on a dark tint in both themes, so they use the dark palette. */
export function RoomCard(props: { room: Room }) {
  return (
    <ThemeScope scheme="dark">
      <RoomCardInner {...props} />
    </ThemeScope>
  );
}

function RoomCardInner({ room }: { room: Room }) {
  const { colors } = useTheme();
  const st = useSt();
  return (
    <Pressable
      onPress={() => router.push(`/live/${room.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${room.host?.display_name ?? 'Live'}: ${room.title}, ${room.viewers} watching`}
      style={({ pressed }) => [st.card, { backgroundColor: tint[room.category] ?? colors.surface2, opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={st.top}>
        <View style={st.live}>
          <Text style={st.liveText}>LIVE</Text>
        </View>
        {room.pk_id ? (
          <View style={[st.live, { backgroundColor: colors.coin }]}>
            <Text style={[st.liveText, { color: colors.onCoin }]}>PK</Text>
          </View>
        ) : null}
        <View style={{ flex: 1 }} />
        <View style={st.viewers}>
          <Icon name="eye" size={12} />
          <Text style={st.viewersText}>{compact(room.viewers)}</Text>
        </View>
      </View>
      <View style={st.center}>
        <Avatar uri={room.host?.avatar_url} name={room.host?.display_name} size={64} ring={colors.live} />
      </View>
      <View style={st.bottom}>
        <Text style={st.title} numberOfLines={2}>
          {room.title}
        </Text>
        <Text variant="caption" numberOfLines={1} style={{ color: colors.mutedStrong }}>
          {room.host?.display_name ?? ''}
        </Text>
      </View>
    </Pressable>
  );
}

const useSt = makeStyles((colors) => ({
  card: { flex: 1, aspectRatio: 3 / 4, borderRadius: radius.lg, padding: space.sm, overflow: 'hidden' },
  top: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  live: { backgroundColor: colors.live, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  liveText: { fontFamily: fonts.bodyBold, fontSize: 10 },
  viewers: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.overlay, borderRadius: 4, paddingHorizontal: 5 },
  viewersText: { fontSize: 11, fontFamily: fonts.bodySemibold },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bottom: { gap: 2 },
  title: { fontFamily: fonts.bodySemibold, fontSize: 13 },
}));
