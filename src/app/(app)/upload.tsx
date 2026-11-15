import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { toast, toastError } from '@/components/Toast';
import { Button, Chip, Empty, Field, Header, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { isApiError } from '@/lib/api/http';
import type { Visibility } from '@/lib/api/types';
import { useSession } from '@/lib/auth/session';
import { fileChunkSource } from '@/lib/fileSource';
import { duration } from '@/lib/format';
import { uploadHandoff } from '@/lib/handoff';
import { qk } from '@/lib/query';
import { contentTypeFor, uploadVideo, type UploadProgress } from '@/lib/uploader';
import { radius, space, makeStyles, fill } from '@/theme';

const SHORT_MAX_MS = 180_000;

export default function Upload() {
  const st = useSt();
  const { kind: requested } = useLocalSearchParams<{ kind?: 'short' | 'auto' }>();
  const picked = useMemo(() => uploadHandoff.take(), []);
  const me = useSession((s) => s.me);
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const preview = useVideoPlayer(picked ? { uri: picked.uri } : null, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  useEffect(() => () => abort.current?.abort(), []);

  if (!picked) {
    return (
      <Screen>
        <Header title="Upload" />
        <Empty title="No video selected" action={<Button title="Back" kind="secondary" onPress={() => router.back()} />} />
      </Screen>
    );
  }

  const kind = requested === 'short' || (picked.durationMs ?? 0) <= SHORT_MAX_MS ? 'short' : 'long';

  async function start() {
    if (!picked) return;
    setBusy(true);
    abort.current = new AbortController();
    try {
      const video = await uploadVideo({
        media: api.media,
        source: fileChunkSource(picked.uri),
        input: {
          kind,
          content_type: contentTypeFor(picked.mimeType, picked.uri),
          title: title.trim(),
          description: description.trim(),
          visibility,
        },
        onProgress: setProgress,
        signal: abort.current.signal,
      });
      if (me) void qc.invalidateQueries({ queryKey: qk.userVideos(me.id) });
      toast("Uploaded. We'll let you know when it's ready.", 'success');
      router.replace(`/watch/${video.id}`);
    } catch (e) {
      if (isApiError(e) && e.code === 'aborted') return;
      toastError(e);
    } finally {
      setBusy(false);
    }
  }

  const pct = progress && progress.totalBytes > 0 ? progress.sentBytes / progress.totalBytes : 0;

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title={kind === 'short' ? 'Post video' : 'Post long video'} onBack={() => (abort.current?.abort(), router.back())} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <View style={st.preview}>
            <VideoView player={preview} style={fill} contentFit="cover" nativeControls={false} />
          </View>
          <View style={{ flex: 1, gap: space.sm }}>
            <Text variant="caption">
              {kind === 'short' ? 'Short video' : 'Long video (Watch)'}
              {picked.durationMs ? ` · ${duration(picked.durationMs)}` : ''}
            </Text>
            {picked.fileSize ? <Text variant="caption">{(picked.fileSize / 1024 / 1024).toFixed(1)} MB</Text> : null}
          </View>
        </View>
        <Field label="Title" value={title} onChangeText={setTitle} maxLength={120} editable={!busy} />
        <Field
          label="Description"
          value={description}
          onChangeText={setDescription}
          maxLength={2000}
          multiline
          editable={!busy}
          placeholder="Add #hashtags to reach more people"
          style={{ minHeight: 90, textAlignVertical: 'top' }}
        />
        <View style={{ gap: space.sm }}>
          <Text variant="label">Who can watch</Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {(['public', 'followers', 'private'] as const).map((v) => (
              <Chip key={v} label={v === 'public' ? 'Everyone' : v === 'followers' ? 'Followers' : 'Only me'} active={visibility === v} onPress={() => !busy && setVisibility(v)} />
            ))}
          </View>
        </View>

        {busy ? (
          <View style={{ gap: space.sm }}>
            <View style={st.track}>
              <View style={[st.fill, { width: `${Math.round(pct * 100)}%` }]} />
            </View>
            <Text variant="caption">
              Uploading {Math.round(pct * 100)}% · part {progress?.partsDone ?? 0} of {progress?.parts ?? '…'}
            </Text>
            <Button title="Cancel" kind="ghost" onPress={() => abort.current?.abort()} />
          </View>
        ) : (
          <Button title="Post" onPress={() => void start()} />
        )}
      </ScrollView>
    </Screen>
  );
}

const useSt = makeStyles((colors) => ({
  preview: { width: 96, height: 128, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surface2 },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.surface2, overflow: 'hidden' },
  fill: { height: 8, backgroundColor: colors.live },
}));
