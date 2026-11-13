import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommentsSheet } from '@/components/CommentsSheet';
import { GiftSheet } from '@/components/GiftSheet';
import { Icon } from '@/components/Icon';
import { ReportSheet } from '@/components/ReportSheet';
import { toast } from '@/components/Toast';
import { VideoRow } from '@/components/VideoRow';
import { Avatar, Button, ErrorView, Loading, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useSession } from '@/lib/auth/session';
import { config } from '@/lib/config';
import { compact, timeAgo } from '@/lib/format';
import { useCounts, useFollow, useImpressions, useLike, useRelationship, useUser, useVideoCounts } from '@/lib/hooks';
import { qk } from '@/lib/query';
import { colors, fonts, radius, space } from '@/theme/tokens';

export default function WatchVideo() {
  const { id, comments } = useLocalSearchParams<{ id: string; comments?: string }>();
  const insets = useSafeAreaInsets();
  const me = useSession((s) => s.me);
  const video = useQuery({ queryKey: qk.video(id), queryFn: () => api.media.video(id) });
  const author = useUser(video.data?.owner_id);
  const counts = useVideoCounts([id]);
  const like = useLike(id, id);
  const followers = useCounts(video.data?.owner_id);
  const rel = useRelationship(video.data?.owner_id);
  const follow = useFollow(video.data?.owner_id ?? '');
  const upNext = useQuery({ queryKey: [...qk.watchFeed, 'next', id], queryFn: () => api.feed.watch(10) });
  const [sheet, setSheet] = useState<'comments' | 'gift' | 'report' | null>(comments ? 'comments' : null);
  const onWatched = useImpressions();
  const started = useRef(0);

  const ready = video.data?.status === 'ready' && !!video.data.hls_url;
  const player = useVideoPlayer(ready ? { uri: video.data!.hls_url!, contentType: 'hls' } : null, (p) => p.play());

  useEffect(() => {
    started.current = Date.now();
    return () => onWatched(id, Date.now() - started.current);
  }, [id, onWatched]);

  if (video.isPending) return <Loading />;
  if (video.isError) return <ErrorView error={video.error} onRetry={() => void video.refetch()} />;
  const v = video.data;
  const c = counts.data?.[id];
  const liked = c?.liked_by_me ?? false;
  const isMine = me?.id === v.owner_id;
  const guard = (fn: () => void) => () => (me ? fn() : router.push('/sign-in'));
  const portrait = v.height > v.width;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={[st.player, portrait && { aspectRatio: 9 / 12 }]}>
        {ready ? (
          <VideoView player={player} style={StyleSheet.absoluteFill} nativeControls contentFit="contain" allowsPictureInPicture />
        ) : (
          <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
            <Text variant="bodyMuted">{v.status === 'failed' ? 'This video could not be processed.' : 'Processing…'}</Text>
          </View>
        )}
        <Pressable style={st.back} onPress={() => router.back()} accessibilityLabel="Back" hitSlop={10}>
          <Icon name="back" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: insets.bottom + space.xl }}>
        <Text variant="h2">{v.title || 'Untitled'}</Text>
        <Text variant="caption">
          {timeAgo(v.created_at)}
          {v.hashtags.length ? ' · ' + v.hashtags.map((h) => `#${h}`).join(' ') : ''}
        </Text>

        <View style={st.authorRow}>
          <Pressable onPress={() => router.push(`/user/${v.owner_id}`)} style={{ flexDirection: 'row', gap: space.md, alignItems: 'center', flex: 1 }}>
            <Avatar uri={author.data?.avatar_url} name={author.data?.display_name} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bodySemibold }} numberOfLines={1}>
                {author.data?.display_name ?? ''}
              </Text>
              <Text variant="caption">{compact(followers.data?.followers ?? 0)} followers</Text>
            </View>
          </Pressable>
          {!isMine ? (
            <Button
              small
              title={rel.data?.following ? 'Subscribed' : 'Subscribe'}
              kind={rel.data?.following ? 'secondary' : 'primary'}
              onPress={guard(() => follow.mutate(!rel.data?.following))}
            />
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          <Pill icon={liked ? 'heartFill' : 'heart'} label={compact(c?.likes ?? 0)} onPress={guard(() => like.mutate(!liked))} active={liked} />
          <Pill icon="comment" label={compact(c?.comments ?? 0)} onPress={() => setSheet('comments')} />
          {!isMine ? <Pill icon="coin" label="Tip" onPress={guard(() => setSheet('gift'))} /> : null}
          <Pill
            icon="share"
            label="Share"
            onPress={() => void Share.share({ message: `https://${config.webDomain}/watch/${v.id}` })}
          />
          {!isMine && me ? <Pill icon="flag" label="Report" onPress={() => setSheet('report')} /> : null}
        </ScrollView>

        {v.description ? (
          <View style={st.desc}>
            <Text>{v.description}</Text>
          </View>
        ) : null}

        <Text variant="h3" style={{ marginTop: space.sm }}>
          Up next
        </Text>
        {(upNext.data?.items ?? [])
          .filter((i) => i.id !== id)
          .map((i) => (
            <VideoRow key={i.id} item={i} compact />
          ))}
      </ScrollView>

      {sheet === 'comments' ? <CommentsSheet videoId={id} visible onClose={() => setSheet(null)} count={c?.comments} /> : null}
      {sheet === 'gift' ? (
        <GiftSheet
          visible
          onClose={() => setSheet(null)}
          receiverId={v.owner_id}
          videoId={v.id}
          onSent={(g, q) => toast(`Tipped ${q}× ${g.name}`, 'success')}
        />
      ) : null}
      {sheet === 'report' ? <ReportSheet visible onClose={() => setSheet(null)} targetType="video" targetId={v.id} /> : null}
    </View>
  );
}

function Pill({
  icon,
  label,
  onPress,
  active,
}: {
  icon: Parameters<typeof Icon>[0]['name'];
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={st.pill} accessibilityRole="button" accessibilityLabel={label}>
      <Icon name={icon} size={18} color={active ? colors.live : colors.text} />
      <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  player: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  back: { position: 'absolute', top: space.sm, left: space.sm, padding: 4 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface2,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 8,
  },
  desc: { backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md },
});
