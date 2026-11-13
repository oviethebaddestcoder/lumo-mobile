import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { toast, toastError } from '@/components/Toast';
import { Button, Field, Header, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useSession } from '@/lib/auth/session';
import { space } from '@/theme/tokens';

export default function PasswordSettings() {
  const me = useSession((s) => s.me);
  const refreshMe = useSession((s) => s.refreshMe);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const has = !!me?.has_password;

  const save = useMutation({
    mutationFn: () => api.identity.setPassword(has ? current : undefined, next),
    onSuccess: async () => {
      await refreshMe();
      toast(has ? 'Password changed. Other devices were signed out.' : 'Password set.', 'success');
      router.back();
    },
    onError: toastError,
  });

  const valid = next.length >= 8 && next === confirm && (!has || current.length > 0);

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title={has ? 'Change password' : 'Set a password'} />
      <View style={{ padding: space.lg, gap: space.lg }}>
        {!has ? <Text variant="bodyMuted">Add a password to sign in with your username, email or phone.</Text> : null}
        {has ? (
          <Field label="Current password" value={current} onChangeText={setCurrent} secureTextEntry autoComplete="current-password" />
        ) : null}
        <Field label="New password" value={next} onChangeText={setNext} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
        <Field
          label="Confirm new password"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          error={confirm && confirm !== next ? "Passwords don't match" : undefined}
        />
        <Text variant="caption">At least 8 characters.</Text>
        <Button title="Save" disabled={!valid} loading={save.isPending} onPress={() => save.mutate()} />
      </View>
    </Screen>
  );
}
