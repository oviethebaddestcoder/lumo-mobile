import { AudioSession, LiveKitRoom, useLocalParticipant } from '@livekit/react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { LocalVideoTrack, Track } from 'livekit-client';
import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { LiveStage, useCrossPublish } from '@/components/LiveStage';
import { ChatInput, ChatList, GiftBanners, GoalBar, PkBar } from '@/components/LiveOverlay';
import { Sheet } from '@/components/Sheet';
import { toast, toastError } from '@/components/Toast';
import { Avatar, Button, ErrorView, ListRow, Loading, Text } from '@/components/ui';
import { api } from '@/lib/api';
import type { Connection, Room } from '@/lib/api/types';
import { useSession } from '@/lib/auth/session';
import { compact } from '@/lib/format';
import { hostHandoff } from '@/lib/handoff';
import { useRooms } from '@/lib/hooks';
import { useRoomEvents } from '@/lib/useRoomEvents';
import { colors, fonts, radius, space } from '@/theme/tokens';

export default function HostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const handoff = useMemo(() => hostHandoff.take(id), [id]);
  const room = useQuery({ queryKey: ['live', 'room', id], queryFn: () => api.live.room(id), initialData: handoff?.room });
  // After an app restart there is no hand-off: rejoining as the host returns a publish token.
  const conn = useQuery({
    queryKey: ['live', 'host-conn', id],
    queryFn: () => api.live.join(id),
    initialData: handoff?.connection,
    staleTime: Infinity,
    gcTime: 0,
  });

  useEffect(() => {
    void AudioSession.startAudioSession();
    return () => void AudioSession.stopAudioSession();
  }, []);

  if (room.isPending || conn.isPending) return <Loading style={{ backgroundColor: '#000' }} />;
  if (room.isError) return <ErrorView error={room.error} onRetry={() => void room.refetch()} />;
  if (conn.isError) return <ErrorView error={conn.error} onRetry={() => void conn.refetch()} />;

  const c = conn.data;
  if (c.mode === 'rtmp') return <HostOverlay room={room.data} connection={c} />;
  return (
    <LiveKitRoom
      serverUrl={c.url}
      token={c.token}
      connect
      audio
      video={{ facingMode: 'user', resolution: { width: 720, height: 1280, frameRate: 30 } }}
      options={{ dynacast: true, adaptiveStream: false }}
      onError={(e) => toast(e.message, 'error')}
    >
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <LiveStage hostId={room.data.host_id} />
        <HostOverlay room={room.data} connection={c} inRoom />
      </View>
    </LiveKitRoom>
  );
}

function HostOverlay({ room, connection, inRoom }: { room: Room; connection: Connection; inRoom?: boolean }) {
  const insets = useSafeAreaInsets();
  const me = useSession((s) => s.me);
  const live = useRoomEvents(room.id);
  const [pkSheet, setPkSheet] = useState(false);
  const [crossFor, setCrossFor] = useState<{ pkId: string; url: string; token: string } | null>(null);
  // Only publish into the opponent's room while that battle is running.
  const activePk = live.pk && !live.pk.ended ? live.pk.pk_id : null;
  const cross = useMemo(
    () => (crossFor && crossFor.pkId === activePk ? { url: crossFor.url, token: crossFor.token } : null),
    [crossFor, activePk],
  );

  // Host A learns the battle started from the realtime channel and fetches its cross token.
  useEffect(() => {
    if (!activePk || crossFor?.pkId === activePk) return;
    api.live
      .pk(activePk)
      .then((v) => v.cross_token && v.cross_url && setCrossFor({ pkId: activePk, url: v.cross_url, token: v.cross_token }))
      .catch(() => undefined);
  }, [activePk, crossFor]);

  const end = useMutation({
    mutationFn: () => api.live.end(room.id),
    onSettled: () => router.replace('/live'),
  });

  const accept = useMutation({
    mutationFn: (pkId: string) => api.live.pkAccept(pkId),
    onSuccess: (v) => {
      live.clearInvite();
      if (v.cross_token && v.cross_url) setCrossFor({ pkId: v.pk_id, url: v.cross_url, token: v.cross_token });
    },
    onError: toastError,
  });
  const decline = useMutation({
    mutationFn: (pkId: string) => api.live.pkDecline(pkId),
    onSettled: () => live.clearInvite(),
  });

  const confirmEnd = () =>
    Alert.alert('End LIVE?', 'Viewers will be disconnected.', [
      { text: 'Keep going', style: 'cancel' },
      { text: 'End', style: 'destructive', onPress: () => end.mutate() },
    ]);

  const goal = live.goal ?? (room.goal_coins > 0 ? { coins: room.gift_coins, target: room.goal_coins } : null);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[StyleSheet.absoluteFill, { paddingTop: insets.top + 6, paddingBottom: insets.bottom + 8 }]}
      pointerEvents="box-none"
    >
      {inRoom ? <CrossPublisher cross={cross} /> : null}
      <View style={st.topRow}>
        <View style={st.pill}>
          <Avatar uri={me?.avatar_url} name={me?.display_name} size={30} />
          <View>
            <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 13 }}>{me?.display_name}</Text>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <View style={st.liveDot} />
              <Text variant="caption" style={{ fontSize: 11 }}>
                {live.state === 'open' ? 'LIVE' : 'Connecting…'} · {compact(live.viewers ?? room.viewers)} watching
              </Text>
            </View>
          </View>
        </View>
        <View style={{ flex: 1 }} />
        <Pressable onPress={confirmEnd} style={st.end} accessibilityRole="button">
          <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 13 }}>End</Text>
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: space.md, marginTop: space.sm, gap: space.sm }}>
        {live.pk ? <PkBar pk={live.pk} roomId={room.id} /> : null}
        {goal ? <GoalBar goal={goal} label={room.goal_label} /> : null}
      </View>

      {connection.mode === 'rtmp' ? (
        <View style={st.rtmp}>
          <Text variant="h3">Streaming from your encoder</Text>
          <Text variant="bodyMuted">Start OBS (or any RTMP encoder) with these settings.</Text>
          <ListRow
            label="Server"
            value={connection.rtmp_url}
            onPress={() => void Clipboard.setStringAsync(connection.rtmp_url ?? '').then(() => toast('Copied'))}
          />
          <ListRow
            label="Stream key"
            value="Tap to copy"
            onPress={() => void Clipboard.setStringAsync(connection.rtmp_stream_key ?? '').then(() => toast('Copied'))}
          />
        </View>
      ) : null}

      <View style={{ flex: 1 }} pointerEvents="box-none" />

      <View style={{ paddingHorizontal: space.md, gap: space.sm }} pointerEvents="box-none">
        <GiftBanners gifts={live.gifts} onDone={live.dismissGift} />
        <ChatList lines={live.chat} />
        <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <ChatInput onSend={live.send} extra={inRoom ? <HostControls /> : null} />
          </View>
          {room.pk_id == null ? (
            <Pressable onPress={() => setPkSheet(true)} style={st.circle} accessibilityLabel="Start a PK battle" disabled={!!live.pk}>
              <Icon name="swords" size={20} color={live.pk ? colors.inactive : colors.coin} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {pkSheet ? <PkInviteSheet roomId={room.id} onClose={() => setPkSheet(false)} /> : null}

      {live.pkInvite ? (
        <Sheet visible onClose={() => decline.mutate(live.pkInvite!.pk_id)} title="PK battle invite" height={260}>
          <View style={{ padding: space.lg, gap: space.md }}>
            <Text style={{ textAlign: 'center' }}>{live.pkInvite.from_host} wants to battle. 5 minutes, most gifts wins.</Text>
            <Button title="Accept" loading={accept.isPending} onPress={() => accept.mutate(live.pkInvite!.pk_id)} />
            <Button title="Decline" kind="ghost" onPress={() => decline.mutate(live.pkInvite!.pk_id)} />
          </View>
        </Sheet>
      ) : null}

      {live.ended ? (
        <View style={[StyleSheet.absoluteFill, st.ended]}>
          <Text variant="h2">{live.ended === 'kicked' ? 'Your LIVE was stopped by moderation' : 'LIVE ended'}</Text>
          <Button title="Done" onPress={() => router.replace('/live')} />
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

function CrossPublisher({ cross }: { cross: { url: string; token: string } | null }) {
  useCrossPublish(cross);
  return null;
}

function HostControls() {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const [front, setFront] = useState(true);
  const flip = async () => {
    const t = localParticipant.getTrackPublication(Track.Source.Camera)?.track;
    if (t instanceof LocalVideoTrack) {
      await t.restartTrack({ facingMode: front ? 'environment' : 'user' });
      setFront((f) => !f);
    }
  };
  return (
    <>
      <Pressable onPress={() => void flip()} style={st.circle} accessibilityLabel="Flip camera">
        <Icon name="flip" size={20} />
      </Pressable>
      <Pressable
        onPress={() => void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
        style={st.circle}
        accessibilityLabel={isMicrophoneEnabled ? 'Mute' : 'Unmute'}
      >
        <Icon name={isMicrophoneEnabled ? 'mic' : 'micOff'} size={20} />
      </Pressable>
    </>
  );
}

function PkInviteSheet({ roomId, onClose }: { roomId: string; onClose: () => void }) {
  const rooms = useRooms(null);
  const invite = useMutation({
    mutationFn: (to: string) => api.live.pkInvite(to),
    onSuccess: () => {
      toast('Invite sent. Waiting for them to accept…', 'success');
      onClose();
    },
    onError: toastError,
  });
  const items = (rooms.data?.pages.flatMap((p) => p.items) ?? []).filter((r) => r.id !== roomId && !r.pk_id);
  return (
    <Sheet visible onClose={onClose} title="Invite to PK battle" height="60%">
      {rooms.isPending ? (
        <Loading />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(r) => r.id}
          ListEmptyComponent={<Text variant="bodyMuted" style={{ textAlign: 'center', padding: space.xl }}>No other hosts are live.</Text>}
          renderItem={({ item }) => (
            <View style={st.inviteRow}>
              <Avatar uri={item.host?.avatar_url} name={item.host?.display_name} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bodySemibold }}>{item.host?.display_name}</Text>
                <Text variant="caption">{compact(item.viewers)} watching</Text>
              </View>
              <Button title="Invite" small onPress={() => invite.mutate(item.id)} loading={invite.isPending && invite.variables === item.id} />
            </View>
          )}
        />
      )}
    </Sheet>
  );
}

const st = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: radius.pill,
    padding: 3,
    paddingRight: space.md,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.live },
  end: { backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: radius.pill, paddingHorizontal: space.lg, paddingVertical: 8 },
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rtmp: { margin: space.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, gap: space.sm },
  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm },
  ended: { alignItems: 'center', justifyContent: 'center', gap: space.lg, backgroundColor: colors.scrim },
});
