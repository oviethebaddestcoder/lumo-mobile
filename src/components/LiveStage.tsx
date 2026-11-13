import { VideoTrack, isTrackReference, useLocalParticipant, useRoomContext, useTracks, type TrackReference } from '@livekit/react-native';
import { useEvent } from 'expo';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Room, Track } from 'livekit-client';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '@/theme/tokens';
import { Loading, Text } from './ui';

/**
 * Renders the room's camera tracks. One track fills the screen; during a PK
 * battle the opponent host cross-publishes into this room, so two tracks
 * render side by side with this room's host on the left.
 */
export function LiveStage({ hostId }: { hostId: string }) {
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: false }).filter(isTrackReference);
  const sorted = [...tracks].sort((a, b) => rank(a, hostId) - rank(b, hostId)).slice(0, 2);

  if (sorted.length === 0) {
    return (
      <View style={[StyleSheet.absoluteFill, st.center]}>
        <Loading />
        <Text variant="caption">Waiting for the host’s camera…</Text>
      </View>
    );
  }
  if (sorted.length === 1) {
    return <Tile trackRef={sorted[0]!} style={StyleSheet.absoluteFill} />;
  }
  return (
    <View style={[StyleSheet.absoluteFill, st.split]}>
      <Tile trackRef={sorted[0]!} style={st.half} />
      <Tile trackRef={sorted[1]!} style={st.half} />
    </View>
  );
}

function Tile({ trackRef, style }: { trackRef: TrackReference; style: object }) {
  return (
    <VideoTrack
      trackRef={trackRef}
      style={style}
      objectFit="cover"
      mirror={trackRef.participant.isLocal}
    />
  );
}

const rank = (t: TrackReference, hostId: string) => (t.participant.identity === hostId ? 0 : 1);

/** Viewers at very large scale get LL-HLS instead of WebRTC. */
export function HlsStage({ url }: { url: string }) {
  const player = useVideoPlayer({ uri: url, contentType: 'hls' }, (p) => {
    p.play();
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  return (
    <View style={StyleSheet.absoluteFill}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
      {status !== 'readyToPlay' ? (
        <View style={[StyleSheet.absoluteFill, st.center]}>
          <Loading />
        </View>
      ) : null}
    </View>
  );
}

/**
 * PK: while a battle is active the host also publishes their camera and mic
 * into the opponent's room using the cross token from svc-live.
 */
export function useCrossPublish(cross: { url: string; token: string } | null) {
  const { localParticipant } = useLocalParticipant();
  const mainRoom = useRoomContext();
  useEffect(() => {
    if (!cross) return;
    const room = new Room({ adaptiveStream: false, dynacast: true });
    let cancelled = false;
    const clones: MediaStreamTrack[] = [];
    (async () => {
      await room.connect(cross.url, cross.token, { autoSubscribe: false });
      if (cancelled) return;
      for (const source of [Track.Source.Camera, Track.Source.Microphone]) {
        const pub = localParticipant.getTrackPublication(source);
        const t = pub?.track?.mediaStreamTrack;
        if (!t) continue;
        const clone = t.clone();
        clones.push(clone);
        await room.localParticipant.publishTrack(clone, { source });
      }
    })().catch((e) => {
      if (__DEV__) console.warn('cross publish failed', e);
    });
    return () => {
      cancelled = true;
      void room.disconnect();
      clones.forEach((c) => c.stop());
    };
  }, [cross, localParticipant, mainRoom]);
}

const st = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, gap: 8 },
  split: { flexDirection: 'row', top: 110, bottom: undefined, height: '45%' },
  half: { flex: 1 },
});
