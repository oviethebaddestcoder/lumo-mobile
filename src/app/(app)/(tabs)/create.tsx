import { useMutation, useQuery } from '@tanstack/react-query';
import { useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { toast, toastError } from '@/components/Toast';
import { Button, Chip, Empty, Field, ListRow, Screen, Text, ToggleRow } from '@/components/ui';
import { api } from '@/lib/api';
import type { LiveCategory } from '@/lib/api/types';
import { useSession } from '@/lib/auth/session';
import { hostHandoff, uploadHandoff } from '@/lib/handoff';
import { useSignedIn } from '@/lib/hooks';
import { qk } from '@/lib/query';
import { fonts, radius, space, makeStyles, darkScreen } from '@/theme';

type Mode = 'live' | 'short' | 'upload';

function Create() {
  const st = useSt();
  const signedIn = useSignedIn();
  const [mode, setMode] = useState<Mode>('live');
  if (!signedIn) {
    return (
      <Screen>
        <Empty
          title="Create on Lumo"
          hint="Sign in to go live and post videos."
          action={<Button title="Sign in" onPress={() => router.push('/sign-in')} />}
        />
      </Screen>
    );
  }
  return (
    <Screen>
      <View style={{ flex: 1 }}>{mode === 'live' ? <GoLive /> : <PickVideo mode={mode} />}</View>
      <View style={st.modes}>
        {(['live', 'short', 'upload'] as const).map((m) => (
          <Pressable key={m} onPress={() => setMode(m)} accessibilityRole="tab" accessibilityState={{ selected: mode === m }}>
            <Text style={[st.mode, mode === m && st.modeOn]}>{m === 'live' ? 'LIVE' : m === 'short' ? 'Short video' : 'Upload'}</Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

function GoLive() {
  const st = useSt();
  const me = useSession((s) => s.me);
  const cats = useQuery({ queryKey: qk.categories, queryFn: api.live.categories, staleTime: Infinity });
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<LiveCategory>('talk');
  const [allowPk, setAllowPk] = useState(true);
  const [allowGifts, setAllowGifts] = useState(true);
  const [replay, setReplay] = useState(true);
  const [goal, setGoal] = useState('');
  const [goalLabel, setGoalLabel] = useState('');
  const [source, setSource] = useState<'app' | 'rtmp'>('app');
  const [cam, requestCam] = useCameraPermissions();
  const [mic, requestMic] = useMicrophonePermissions();
  const key = useQuery({ queryKey: qk.streamKey, queryFn: api.live.streamKey, enabled: source === 'rtmp' });
  const rotate = useMutation({
    mutationFn: api.live.rotateStreamKey,
    onSuccess: () => {
      void key.refetch();
      toast('Stream key rotated. Update your encoder.', 'success');
    },
    onError: toastError,
  });

  const start = useMutation({
    mutationFn: async () => {
      if (source === 'app') {
        const c = cam?.granted || (await requestCam()).granted;
        const m = mic?.granted || (await requestMic()).granted;
        if (!c || !m) throw new Error('Allow camera and microphone to go live.');
      }
      return api.live.create({
        title: title.trim() || `${me?.display_name ?? 'My'} LIVE`,
        category,
        source,
        allow_pk: allowPk,
        allow_gifts: allowGifts && !!me?.adult,
        save_replay: replay,
        goal_coins: Math.max(0, parseInt(goal, 10) || 0),
        goal_label: goalLabel.trim(),
      });
    },
    onSuccess: (res) => {
      hostHandoff.put(res.room, res.connection);
      router.push(`/host/${res.room.id}`);
    },
    onError: toastError,
  });

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }} keyboardShouldPersistTaps="handled">
      <Text variant="title">Go LIVE</Text>
      <Field label="Title" value={title} onChangeText={setTitle} maxLength={80} placeholder="What's happening?" />
      <View style={{ gap: space.sm }}>
        <Text variant="label">Category</Text>
        <View style={st.wrap}>
          {(cats.data?.items ?? ['talk']).map((c) => (
            <Chip key={c} label={c.charAt(0).toUpperCase() + c.slice(1)} active={category === c} onPress={() => setCategory(c)} />
          ))}
        </View>
      </View>
      <View style={st.card}>
        <ToggleRow label="PK battles" hint="Other hosts can invite you" value={allowPk} onChange={setAllowPk} />
        <ToggleRow
          label="Gifts"
          hint={me?.adult ? 'Viewers can send gifts' : 'Available at 18+'}
          value={allowGifts && !!me?.adult}
          onChange={setAllowGifts}
          disabled={!me?.adult}
        />
        <ToggleRow label="Save replay" hint="Keep a recording on your profile" value={replay} onChange={setReplay} />
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Field label="Coin goal" value={goal} onChangeText={(t) => setGoal(t.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="0" />
        </View>
        <View style={{ flex: 1.6 }}>
          <Field label="Goal label" value={goalLabel} onChangeText={setGoalLabel} maxLength={40} placeholder="New mic" />
        </View>
      </View>
      <View style={{ gap: space.sm }}>
        <Text variant="label">Stream from</Text>
        <View style={st.wrap}>
          <Chip label="This phone" active={source === 'app'} onPress={() => setSource('app')} />
          <Chip label="OBS / encoder (RTMP)" active={source === 'rtmp'} onPress={() => setSource('rtmp')} />
        </View>
      </View>
      {source === 'rtmp' && key.data ? (
        <View style={st.card}>
          <ListRow
            label="Server URL"
            value={key.data.rtmp_url}
            onPress={() => void Clipboard.setStringAsync(key.data!.rtmp_url).then(() => toast('Copied server URL'))}
          />
          <ListRow
            label="Stream key"
            value="••••••••  Copy"
            onPress={() => void Clipboard.setStringAsync(key.data!.stream_key).then(() => toast('Copied stream key'))}
          />
          <ListRow label="Rotate key" icon="flip" onPress={() => rotate.mutate()} />
        </View>
      ) : null}
      <Button title="Go LIVE" loading={start.isPending} onPress={() => start.mutate()} />
    </ScrollView>
  );
}

function PickVideo({ mode }: { mode: 'short' | 'upload' }) {
  async function pick(fromCamera: boolean) {
    try {
      const opts: ImagePicker.ImagePickerOptions = {
        mediaTypes: 'videos',
        videoMaxDuration: mode === 'short' ? 180 : 0,
        quality: 1,
        allowsEditing: false,
      };
      if (fromCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) throw new Error('Allow camera access to record.');
      }
      const res = fromCamera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      const a = res.canceled ? null : res.assets[0];
      if (!a) return;
      uploadHandoff.put({
        uri: a.uri,
        mimeType: a.mimeType,
        fileSize: a.fileSize,
        durationMs: a.duration,
        width: a.width,
        height: a.height,
      });
      router.push({ pathname: '/upload', params: { kind: mode === 'short' ? 'short' : 'auto' } });
    } catch (e) {
      toastError(e);
    }
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: space.xl, gap: space.lg }}>
      <Text variant="title" style={{ textAlign: 'center' }}>
        {mode === 'short' ? 'Short video' : 'Upload a video'}
      </Text>
      <Text variant="bodyMuted" style={{ textAlign: 'center' }}>
        {mode === 'short'
          ? 'Record up to 3 minutes, vertical works best.'
          : 'Pick any video. Over 3 minutes goes to Watch as a long video.'}
      </Text>
      {mode === 'short' ? <Button title="Record" onPress={() => void pick(true)} /> : null}
      <Button title="Choose from library" kind={mode === 'short' ? 'secondary' : 'primary'} onPress={() => void pick(false)} />
    </View>
  );
}

const useSt = makeStyles((colors) => ({
  modes: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space.xl,
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  mode: { fontFamily: fonts.bodySemibold, color: colors.inactive },
  modeOn: { color: colors.text },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' },
}));

export default darkScreen(Create);
