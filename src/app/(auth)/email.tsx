import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { toastError } from '@/components/Toast';
import { Button, Field, Header, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { space } from '@/theme/tokens';

export default function EmailSignIn() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  async function send() {
    setBusy(true);
    try {
      const target = email.trim().toLowerCase();
      await api.identity.sendOtp('email', target);
      router.push({ pathname: '/verify', params: { channel: 'email', target } });
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Email" />
      <View style={{ padding: space.xl, gap: space.lg }}>
        <Text variant="bodyMuted">We’ll email you a 6-digit code. New here? This creates your account.</Text>
        <Field
          label="Email address"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          autoFocus
        />
        <Button title="Send code" disabled={!valid} loading={busy} onPress={send} />
      </View>
    </Screen>
  );
}
