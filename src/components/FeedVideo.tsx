import { useEvent } from 'expo';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { memo, useEffect, useEffectEvent, useRef, useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import { config } from '@/lib/config';
import { api } from '@/lib/api';
import type { FeedItem, FeedSurface, Impression, VideoCounts } from '@/lib/api/types';
import { useSession } from '@/lib/auth/session';
import { compact } from '@/lib/format';
import { impressionFor, useFollow, useLike, useRelationship } from '@/lib/hooks';
import { colors, fonts, space } from '@/theme/tokens';
import { CommentsSheet } from './CommentsSheet';
import { GiftSheet } from './GiftSheet';
import { Icon } from './Icon';
import { ReportSheet } from './ReportSheet';
import { Sheet } from './Sheet';
import { toast, toastError } from './Toast';
import { Avatar, ListRow, Text } from './ui';

interface Props {
  item: FeedItem;
  height: number;
  /** This page is on screen: play. */
  active: boolean;
  /** Within the preload window: create the player so it buffers. */
  preload: boolean;
  counts?: VideoCounts;
  countsKey: string;
  onWatched: (imp: Impression) => void;
  /** Which feed this is, for ranking analytics. */
  surface: FeedSurface;
  /** "Not interested": the pager hides the video and moves on. */
  onHide?: (videoId: string) => void;
  /** Screen is focused and app in foreground. */
  focused: boolean;
}

function FeedVideoImpl({ item, height, active, preload, counts, countsKey, onWatched, surface, onHide, focused }: Props) {
  const me = useSession((s) => s.me);
  const signedIn = !!me;
  const player = useVideoPlayer(preload ? { uri: item.hls_url, contentType: 'hls' } : null, (p) => {
    p.loop = true;
    p.muted = false;
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const [paused, setPaused] = useState(false);
  const [sheet, setSheet] = useState<'comments' | 'gift' | 'report' | 'options' | null>(null);

  // Watch time for this visit, summed across pauses, reported once when the
  // viewer leaves the video (the recommender counts the first view only).
  const startedAt = useRef<number | null>(null);
  const watchedMs = useRef(0);
  const shared = useRef(false);
  const takeWatched = () => {
    let ms = watchedMs.current;
    if (startedAt.current) ms += Date.now() - startedAt.current;
    watchedMs.current = 0;
    startedAt.current = null;
    return ms;
  };
  const report = useEffectEvent(() => {
    onWatched(impressionFor(item, takeWatched(), surface, shared.current));
    shared.current = false;
  });
  useEffect(() => {
    if (!active) return;
    watchedMs.current = 0;
    shared.current = false;
    return () => report();
  }, [active, item.id]);

  const playing = active && focused && !paused && sheet !== 'gift';
  useEffect(() => {
    if (!preload) return;
    if (playing) {
      player.play();
      startedAt.current = Date.now();
    } else {
      player.pause();
      if (startedAt.current) {
        watchedMs.current += Date.now() - startedAt.current;
        startedAt.current = null;
      }
    }
  }, [playing, preload, player]);

  // Leaving the page: clear a manual pause and rewind (adjust-state-during-render pattern).
  const [wasActive, setWasActive] = useState(active);
  if (wasActive !== active) {
    setWasActive(active);
    if (!active) setPaused(false);
  }
  useEffect(() => {
    if (!active && preload) player.seekBy(-player.currentTime);
  }, [active, preload, player]);

  const liked = counts?.liked_by_me ?? false;
  const likes = counts?.likes ?? item.likes;
  const comments = counts?.comments ?? item.comments;
  const like = useLike(item.id, countsKey);
  // Only the page on screen asks for its relationship, not every preloaded one.
  const rel = useRelationship(active ? item.author.id : undefined);
  const follow = useFollow(item.author.id);
  const isMine = me?.id === item.author.id;

  const requireAuth = (fn: () => void) => () => {
    if (!signedIn) {
      router.push('/sign-in');
      return;
    }
    fn();
  };

  return (
    <View style={{ height, backgroundColor: '#000' }}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => setPaused((p) => !p)}
        onLongPress={signedIn && !isMine ? () => setSheet('options') : undefined}
        delayLongPress={350}
        accessibilityLabel={paused ? 'Play' : 'Pause'}
        accessibilityHint={signedIn && !isMine ? 'Long press for more options' : undefined}
      >
        {preload ? (
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit={item.height >= item.width ? 'cover' : 'contain'}
            nativeControls={false}
            allowsPictureInPicture={false}
          />
        ) : null}
        {(!preload || status !== 'readyToPlay') && item.thumbnail_url ? (
          <Image source={{ uri: item.thumbnail_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : null}
        {paused ? (
          <View style={st.pauseIcon}>
            <Icon name="play" size={56} color="rgba(255,255,255,0.8)" />
          </View>
        ) : null}
      </Pressable>

      {/* Caption */}
      <View style={st.caption} pointerEvents="box-none">
        <Pressable onPress={() => router.push(`/user/${item.author.id}`)}>
          <Text style={st.handle}>@{item.author.handle}</Text>
        </Pressable>
        {item.description || item.title ? (
          <Text style={st.desc} numberOfLines={3}>
            {item.description || item.title}
          </Text>
        ) : null}
      </View>

      {/* Action rail */}
      <View style={st.rail}>
        <View style={{ alignItems: 'center' }}>
          <Pressable onPress={() => router.push(`/user/${item.author.id}`)} accessibilityLabel={`${item.author.display_name}'s profile`}>
            <Avatar uri={item.author.avatar_url} name={item.author.display_name} size={46} ring={colors.text} />
          </Pressable>
          {!isMine && !rel.data?.following ? (
            <Pressable
              style={st.followDot}
              accessibilityLabel={`Follow ${item.author.display_name}`}
              onPress={requireAuth(() => follow.mutate(true))}
            >
              <Icon name="plus" size={14} strokeWidth={3} />
            </Pressable>
          ) : null}
        </View>
        <RailButton
          icon={liked ? 'heartFill' : 'heart'}
          color={liked ? colors.live : colors.text}
          label={compact(likes)}
          a11y={liked ? 'Unlike' : 'Like'}
          onPress={requireAuth(() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            like.mutate(!liked);
          })}
        />
        <RailButton icon="comment" label={compact(comments)} a11y="Comments" onPress={() => setSheet('comments')} />
        {!isMine ? <RailButton icon="gift" label="Gift" a11y="Send a gift" onPress={requireAuth(() => setSheet('gift'))} /> : null}
        <RailButton
          icon="share"
          label="Share"
          a11y="Share"
          onPress={() =>
            void Share.share({ message: `https://${config.webDomain}/v/${item.id}`, url: `https://${config.webDomain}/v/${item.id}` }).then(
              (r) => {
                if (r.action === Share.sharedAction) shared.current = true;
              },
              () => undefined,
            )
          }
        />
        {!isMine && signedIn ? <RailButton icon="more" label="" a11y="More" onPress={() => setSheet('options')} /> : null}
      </View>

      {sheet === 'comments' ? (
        <CommentsSheet videoId={item.id} visible onClose={() => setSheet(null)} count={comments} />
      ) : null}
      {sheet === 'gift' ? (
        <GiftSheet
          visible
          onClose={() => setSheet(null)}
          receiverId={item.author.id}
          videoId={item.id}
          onSent={(g, q) => toast(`Sent ${q}× ${g.name} to @${item.author.handle}`, 'success')}
        />
      ) : null}
      {sheet === 'report' ? (
        <ReportSheet visible onClose={() => setSheet(null)} targetType="video" targetId={item.id} />
      ) : null}
      {sheet === 'options' ? (
        <Sheet visible onClose={() => setSheet(null)} title="More">
          <ListRow
            label="Not interested"
            icon="eye"
            onPress={() => {
              setSheet(null);
              api.feed.notInterested(item.id).then(() => {
                toast("Got it. You'll see fewer videos like this.");
                onHide?.(item.id);
              }, toastError);
            }}
          />
          <ListRow label="Report" icon="flag" danger onPress={() => setSheet('report')} />
        </Sheet>
      ) : null}
    </View>
  );
}

export const FeedVideo = memo(FeedVideoImpl);

function RailButton({
  icon,
  label,
  onPress,
  color,
  a11y,
}: {
  icon: Parameters<typeof Icon>[0]['name'];
  label: string;
  onPress: () => void;
  color?: string;
  a11y: string;
}) {
  return (
    <Pressable onPress={onPress} style={{ alignItems: 'center', gap: 4 }} accessibilityRole="button" accessibilityLabel={a11y} hitSlop={6}>
      <Icon name={icon} size={32} color={color} />
      {label ? <Text style={st.railLabel}>{label}</Text> : null}
    </Pressable>
  );
}

const shadow = { textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } };

const st = StyleSheet.create({
  pauseIcon: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  caption: { position: 'absolute', left: space.lg, right: 90, bottom: space.xl, gap: 6 },
  handle: { fontFamily: fonts.bodyBold, fontSize: 16, ...shadow },
  desc: { fontSize: 14, ...shadow },
  rail: { position: 'absolute', right: space.md, bottom: space.xl, alignItems: 'center', gap: space.lg + 2 },
  railLabel: { fontFamily: fonts.bodySemibold, fontSize: 12, ...shadow },
  followDot: {
    position: 'absolute',
    bottom: -9,
    alignSelf: 'center',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.live,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
