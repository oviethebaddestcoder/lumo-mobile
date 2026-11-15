import { AudioSession, LiveKitRoom } from '@livekit/react-native';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GiftSheet } from '@/components/GiftSheet';
import { Icon } from '@/components/Icon';
import { HlsStage, LiveStage } from '@/components/LiveStage';
import { ChatInput, ChatList, GiftBanners, GoalBar, PkBar } from '@/components/LiveOverlay';
import { ReportSheet } from '@/components/ReportSheet';
import { toast } from '@/components/Toast';
import { Avatar, Button, ErrorView, Loading, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useSession } from '@/lib/auth/session';
import { compact } from '@/lib/format';
import { useFollow, useRelationship, useSignedIn } from '@/lib/hooks';
import { qk } from '@/lib/query';
import { useRoomEvents } from '@/lib/useRoomEvents';
import { fonts, radius, space, makeStyles, darkScreen } from '@/theme';

function LiveRoomScreen() {
  const st = useSt();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const me = useSession((s) => s.me);
  const signedIn = useSignedIn();
  const room = useQuery({ queryKey: qk.room(id), queryFn: () => api.live.room(id) });
  // Joining needs an account (the token carries the viewer identity); guests
  // still see the room card and are asked to sign in.
  const conn = useQuery({
    queryKey: ['live', 'join', id, me?.id ?? ''],
    queryFn: () => api.live.join(id),
    enabled: signedIn,
    staleTime: Infinity,
    gcTime: 0,
  });
  const live = useRoomEvents(signedIn ? id : undefined);
  const [sheet, setSheet] = useState<'gift' | 'report' | null>(null);

  const hostId = room.data?.host_id ?? '';
  const rel = useRelationship(hostId || undefined);
  const follow = useFollow(hostId);

  useEffect(() => {
    void AudioSession.startAudioSession();
    return () => void AudioSession.stopAudioSession();
  }, []);

  useEffect(() => {
    if (live.ended === 'kicked') toast('You were removed from this LIVE.', 'error');
  }, [live.ended]);

  if (room.isPending) return <Loading style={{ backgroundColor: '#000' }} />;
  if (room.isError) return <ErrorView error={room.error} onRetry={() => void room.refetch()} />;
  const r = room.data;
  const viewers = live.viewers ?? r.viewers;
  const goal = live.goal ?? (r.goal_coins > 0 ? { coins: r.gift_coins, target: r.goal_coins } : null);

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {conn.data?.mode === 'webrtc' && conn.data.token ? (
        <LiveKitRoom
          serverUrl={conn.data.url}
          token={conn.data.token}
          connect
          audio={false}
          video={false}
          options={{ adaptiveStream: { pixelDensity: 'screen' }, dynacast: false }}
          onError={(e) => __DEV__ && console.warn(e)}
        >
          <LiveStage hostId={hostId} />
        </LiveKitRoom>
      ) : conn.data?.mode === 'hls' ? (
        <HlsStage url={conn.data.url} />
      ) : conn.isError ? (
        <ErrorView error={conn.error} onRetry={() => void conn.refetch()} />
      ) : signedIn ? (
        <Loading />
      ) : null}

      {live.ended ? (
        <View style={[StyleSheet.absoluteFill, st.endedWrap]}>
          <Avatar uri={r.host?.avatar_url} name={r.host?.display_name} size={84} />
          <Text variant="h2">{live.ended === 'kicked' ? 'You were removed' : 'LIVE has ended'}</Text>
          <Button title="Back to Live" kind="secondary" onPress={() => router.back()} />
        </View>
      ) : null}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[StyleSheet.absoluteFill, { paddingTop: insets.top + 6, paddingBottom: insets.bottom + 8 }]}
        pointerEvents="box-none"
      >
        <View style={st.topRow}>
          <Pressable style={st.hostPill} onPress={() => router.push(`/user/${hostId}`)}>
            <Avatar uri={r.host?.avatar_url} name={r.host?.display_name} size={32} />
            <View style={{ maxWidth: 120 }}>
              <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 13 }} numberOfLines={1}>
                {r.host?.display_name}
              </Text>
              <Text variant="caption" style={{ fontSize: 11 }}>
                {compact(r.gift_coins)} coins
              </Text>
            </View>
            {me?.id !== hostId && !rel.data?.following ? (
              <Pressable
                style={st.follow}
                onPress={() => (signedIn ? follow.mutate(true) : router.push('/sign-in'))}
                accessibilityLabel="Follow host"
              >
                <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 12 }}>Follow</Text>
              </Pressable>
            ) : null}
          </Pressable>
          <View style={{ flex: 1 }} />
          <View style={st.viewers}>
            <Icon name="eye" size={14} />
            <Text style={{ fontSize: 12, fontFamily: fonts.bodySemibold }}>{compact(viewers)}</Text>
          </View>
          {signedIn ? (
            <Pressable onPress={() => setSheet('report')} hitSlop={8} accessibilityLabel="More">
              <Icon name="more" />
            </Pressable>
          ) : null}
          <Pressable onPress={() => router.back()} hitSlop={8} accessibilityLabel="Close">
            <Icon name="close" />
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: space.md, marginTop: space.sm, gap: space.sm }}>
          {live.pk ? <PkBar pk={live.pk} roomId={id} /> : null}
          {goal ? <GoalBar goal={goal} label={r.goal_label} /> : null}
          {live.state === 'reconnecting' ? <Text variant="caption">Reconnecting…</Text> : null}
        </View>

        <View style={{ flex: 1 }} pointerEvents="box-none" />

        <View style={{ paddingHorizontal: space.md, gap: space.sm }} pointerEvents="box-none">
          <GiftBanners gifts={live.gifts} onDone={live.dismissGift} />
          <ChatList lines={live.chat} />
          <ChatInput
            disabled={!signedIn}
            onSend={(t) => {
              if (!signedIn) {
                router.push('/sign-in');
                return false;
              }
              return live.send(t);
            }}
            onGift={r.allow_gifts && me?.id !== hostId ? () => (signedIn ? setSheet('gift') : router.push('/sign-in')) : undefined}
          />
        </View>
      </KeyboardAvoidingView>

      {sheet === 'gift' ? (
        <GiftSheet visible onClose={() => setSheet(null)} receiverId={hostId} roomId={id} />
      ) : null}
      {sheet === 'report' ? (
        <ReportSheet visible onClose={() => setSheet(null)} targetType="room" targetId={id} />
      ) : null}
    </View>
  );
}

const useSt = makeStyles((colors) => ({
  topRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md },
  hostPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: radius.pill,
    padding: 3,
    paddingRight: 4,
  },
  follow: { backgroundColor: colors.live, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  viewers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  endedWrap: { alignItems: 'center', justifyContent: 'center', gap: space.lg, backgroundColor: colors.scrim, zIndex: 5 },
}));

export default darkScreen(LiveRoomScreen);
