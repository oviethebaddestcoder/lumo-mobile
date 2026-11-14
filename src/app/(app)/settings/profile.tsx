import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Pressable, ScrollView } from 'react-native';
import { toast, toastError } from '@/components/Toast';
import { Avatar, Button, Field, Header, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { isApiError } from '@/lib/api/http';
import type { MePatch } from '@/lib/api/types';
import { useSession } from '@/lib/auth/session';
import { colors, fonts, space } from '@/theme/tokens';

export default function EditProfile() {
  const me = useSession((s) => s.me);
  const setMe = useSession((s) => s.setMe);
  const [handle, setHandle] = useState(me?.handle ?? '');
  const [name, setName] = useState(me?.display_name ?? '');
  const [bio, setBio] = useState(me?.bio ?? '');
  const [avatar, setAvatar] = useState(me?.avatar_url ?? '');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [uploading, setUploading] = useState(false);

  // Square-crop a photo, upload it straight to storage with a presigned URL,
  // then keep the public URL to save with the profile.
  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast('Allow photo access to change your picture.', 'error');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    const a = res.canceled ? null : res.assets[0];
    if (!a) return;
    const type = a.mimeType === 'image/png' || a.mimeType === 'image/webp' ? a.mimeType : 'image/jpeg';
    setUploading(true);
    try {
      const blob = await (await fetch(a.uri)).blob();
      if (blob.size > 5 * 1024 * 1024) throw new Error('That photo is over 5 MB. Pick a smaller one.');
      const up = await api.media.imageUpload('avatar', type, blob.size);
      const put = await fetch(up.upload_url, { method: 'PUT', body: blob, headers: { 'Content-Type': type } });
      if (!put.ok) throw new Error('Upload failed. Try again.');
      setAvatar(up.url);
    } catch (e) {
      toastError(e);
    } finally {
      setUploading(false);
    }
  }

  const save = useMutation({
    mutationFn: () => {
      const patch: MePatch = {};
      if (handle !== me?.handle) patch.handle = handle.trim().replace(/^@/, '');
      if (name !== me?.display_name) patch.display_name = name.trim();
      if (bio !== me?.bio) patch.bio = bio.trim();
      if (avatar !== (me?.avatar_url ?? '')) patch.avatar_url = avatar.trim();
      return api.identity.updateMe(patch);
    },
    onSuccess: (m) => {
      setMe(m);
      toast('Profile saved', 'success');
      router.back();
    },
    onError: (e) => {
      if (isApiError(e) && e.fields) setFieldErrors(e.fields);
      else if (isApiError(e) && e.code === 'handle_taken') setFieldErrors({ handle: e.message });
      else toast(e instanceof Error ? e.message : 'Could not save.', 'error');
    },
  });

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Edit profile" />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, alignItems: 'stretch' }} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => void pickPhoto()} style={{ alignSelf: 'center', alignItems: 'center', gap: space.sm }} accessibilityRole="button" accessibilityLabel="Change photo">
          <Avatar uri={avatar || null} name={name} size={96} />
          <Text style={{ color: colors.live, fontFamily: fonts.bodySemibold }}>{uploading ? 'Uploading…' : 'Change photo'}</Text>
        </Pressable>
        <Field label="Name" value={name} onChangeText={setName} maxLength={50} error={fieldErrors.display_name} />
        <Field
          label="Username"
          value={handle}
          onChangeText={setHandle}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={24}
          error={fieldErrors.handle}
        />
        <Field label="Bio" value={bio} onChangeText={setBio} maxLength={160} multiline error={fieldErrors.bio} />
        {fieldErrors.avatar_url ? <Text style={{ color: colors.danger }}>{fieldErrors.avatar_url}</Text> : null}
        <Button title="Save" loading={save.isPending} disabled={uploading} onPress={() => save.mutate()} />
      </ScrollView>
    </Screen>
  );
}
