import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import type { FeedItem } from '@/lib/api/types';
import { duration, timeAgo } from '@/lib/format';
import { fonts, radius, space, makeStyles } from '@/theme';
import { Avatar, Text } from './ui';

/** A long-form video card for the Watch tab and "Up next". */
export function VideoRow({ item, compact: small }: { item: FeedItem; compact?: boolean }) {
  const st = useSt();
  return (
    <Pressable
      onPress={() => router.push(`/watch/${item.id}`)}
      style={({ pressed }) => [small ? st.rowSmall : st.row, pressed && { opacity: 0.85 }]}
      accessibilityRole="button"
      accessibilityLabel={item.title}
    >
      <View style={small ? st.thumbSmall : st.thumb}>
        {item.thumbnail_url ? (
          <Image source={{ uri: item.thumbnail_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
        ) : null}
        <View style={st.dur}>
          <Text style={{ fontSize: 11, fontFamily: fonts.bodySemibold, color: '#FFFFFF' }}>{duration(item.duration_ms)}</Text>
        </View>
      </View>
      <View style={small ? { flex: 1, gap: 4 } : st.meta}>
        {!small ? <Avatar uri={item.author.avatar_url} name={item.author.display_name} size={36} /> : null}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: fonts.bodySemibold }} numberOfLines={2}>
            {item.title || 'Untitled'}
          </Text>
          <Text variant="caption" numberOfLines={1}>
            {item.author.display_name} · {timeAgo(item.created_at)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const useSt = makeStyles((colors) => ({
  row: { gap: space.sm, marginBottom: space.lg },
  rowSmall: { flexDirection: 'row', gap: space.md, marginBottom: space.md },
  thumb: { aspectRatio: 16 / 9, backgroundColor: colors.surface2, overflow: 'hidden' },
  thumbSmall: { width: 160, aspectRatio: 16 / 9, backgroundColor: colors.surface2, borderRadius: radius.sm, overflow: 'hidden' },
  dur: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 4,
    paddingHorizontal: 4,
  },
  meta: { flexDirection: 'row', gap: space.md, paddingHorizontal: space.lg },
}));
