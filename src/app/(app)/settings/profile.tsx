import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { toast } from '@/components/Toast';
import { Avatar, Button, Field, Header, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { isApiError } from '@/lib/api/http';
import type { MePatch } from '@/lib/api/types';
import { useSession } from '@/lib/auth/session';
import { space } from '@/theme/tokens';

export default function EditProfile() {
  const me = useSession((s) => s.me);
  const setMe = useSession((s) => s.setMe);
  const [handle, setHandle] = useState(me?.handle ?? '');
  const [name, setName] = useState(me?.display_name ?? '');
  const [bio, setBio] = useState(me?.bio ?? '');
  const [avatar, setAvatar] = useState(me?.avatar_url ?? '');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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
        <Avatar uri={avatar || null} name={name} size={88} />
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
        <Field
          label="Photo URL (https)"
          value={avatar}
          onChangeText={setAvatar}
          autoCapitalize="none"
          keyboardType="url"
          error={fieldErrors.avatar_url}
        />
        <Button title="Save" loading={save.isPending} onPress={() => save.mutate()} />
      </ScrollView>
    </Screen>
  );
}
