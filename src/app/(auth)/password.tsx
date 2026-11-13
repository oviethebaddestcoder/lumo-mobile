import { useState } from 'react';
import { View } from 'react-native';
import { Button, Field, Header, Screen, Text } from '@/components/ui';
import { useSignIn } from '@/lib/auth/useSignIn';
import { space } from '@/theme/tokens';

export default function PasswordSignIn() {
  const { busy, withPassword } = useSignIn();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Password" />
      <View style={{ padding: space.xl, gap: space.lg }}>
        <Text variant="bodyMuted">Sign in with your username, email or phone and the password you set in Settings.</Text>
        <Field
          label="Username, email or phone"
          value={login}
          onChangeText={setLogin}
          autoCapitalize="none"
          autoComplete="username"
          textContentType="username"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          onSubmitEditing={() => login && password && withPassword(login.trim(), password)}
        />
        <Button
          title="Sign in"
          disabled={!login.trim() || password.length < 8}
          loading={busy === 'password'}
          onPress={() => withPassword(login.trim(), password)}
        />
      </View>
    </Screen>
  );
}
