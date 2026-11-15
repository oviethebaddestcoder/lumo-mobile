import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Button, Screen, Text } from '@/components/ui';
import { toastError } from '@/components/Toast';
import { api } from '@/lib/api';
import type { OAuthProvider } from '@/lib/api/types';
import { availableProviders, providerLabels } from '@/lib/auth/providers';
import { useSession } from '@/lib/auth/session';
import { useSignIn } from '@/lib/auth/useSignIn';
import { fonts, radius, space, makeStyles, useTheme } from '@/theme';

const providerGlyph: Record<OAuthProvider, string> = { google: 'G', apple: '', facebook: 'f', x: '𝕏', line: 'L', kakao: 'K' };

export default function SignIn() {
  const { colors } = useTheme();
  const st = useSt();
  const { busy, withProvider } = useSignIn();
  const guest = useSession((s) => s.guest);
  const browseAsGuest = useSession((s) => s.browseAsGuest);
  const [providers, setProviders] = useState<OAuthProvider[]>(['google']);
  const [country, setCountry] = useState('+234');
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [more, setMore] = useState(false);

  useEffect(() => {
    void availableProviders().then(setProviders);
  }, []);

  const digits = phone.replace(/\D/g, '').replace(/^0+/, '');
  const e164 = `${country}${digits}`;
  const valid = /^\+\d{8,15}$/.test(e164) && digits.length >= 7;

  async function sendCode() {
    setSending(true);
    try {
      await api.identity.sendOtp('sms', e164);
      router.push({ pathname: '/verify', params: { channel: 'sms', target: e164 } });
    } catch (e) {
      toastError(e);
    } finally {
      setSending(false);
    }
  }

  const primary = providers.filter((p) => p === 'google' || p === 'apple');
  const secondary = providers.filter((p) => p !== 'google' && p !== 'apple');

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={st.body} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'flex-end' }}>
          <Pressable
            onPress={() => (guest && router.canGoBack() ? router.back() : browseAsGuest())}
            accessibilityRole="button"
            hitSlop={10}
          >
            <Text variant="bodyMuted">Not now</Text>
          </Pressable>
        </View>
        <View style={st.logo}>
          <View style={st.logoDot} />
          <Text style={st.logoText}>lumo</Text>
        </View>
        <Text variant="title" style={{ textAlign: 'center' }}>
          Sign in to Lumo
        </Text>
        <Text variant="bodyMuted" style={{ textAlign: 'center', marginBottom: space.lg }}>
          Watch, go live and support creators.
        </Text>

        <View style={st.phoneRow}>
          <TextInput
            value={country}
            onChangeText={(t) => setCountry('+' + t.replace(/\D/g, '').slice(0, 4))}
            keyboardType="phone-pad"
            style={[st.input, { width: 76, textAlign: 'center' }]}
            accessibilityLabel="Country code"
          />
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="Phone number"
            placeholderTextColor={colors.inactive}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
            style={[st.input, { flex: 1 }]}
            accessibilityLabel="Phone number"
          />
        </View>
        <Button title="Continue" disabled={!valid} loading={sending} onPress={sendCode} />

        <View style={st.divider}>
          <View style={st.line} />
          <Text variant="caption">or</Text>
          <View style={st.line} />
        </View>

        {primary.map((p) => (
          <ProviderButton key={p} provider={p} busy={busy === p} disabled={!!busy} onPress={() => withProvider(p)} />
        ))}
        {more ? (
          secondary.map((p) => (
            <ProviderButton key={p} provider={p} busy={busy === p} disabled={!!busy} onPress={() => withProvider(p)} />
          ))
        ) : (
          <Button title="More options" kind="ghost" onPress={() => setMore(true)} />
        )}

        <View style={st.links}>
          <Pressable onPress={() => router.push('/email')} accessibilityRole="link">
            <Text style={st.link}>Use email</Text>
          </Pressable>
          <Text variant="caption">·</Text>
          <Pressable onPress={() => router.push('/password')} accessibilityRole="link">
            <Text style={st.link}>Password</Text>
          </Pressable>
        </View>

        <Text variant="caption" style={{ textAlign: 'center', marginTop: space.lg }}>
          By continuing you agree to our Terms and acknowledge our Privacy Policy. You must be 13 or older.
        </Text>
      </ScrollView>
    </Screen>
  );
}

function ProviderButton({
  provider,
  busy,
  disabled,
  onPress,
}: {
  provider: OAuthProvider;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const st = useSt();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`Continue with ${providerLabels[provider]}`}
      style={({ pressed }) => [st.provider, { opacity: disabled && !busy ? 0.5 : pressed ? 0.8 : 1 }]}
    >
      <View style={st.glyph}>
        {provider === 'apple' ? <Icon name="user" size={16} /> : <Text style={{ fontFamily: fonts.bodyBold }}>{providerGlyph[provider]}</Text>}
      </View>
      <Text style={{ fontFamily: fonts.bodySemibold, flex: 1, textAlign: 'center', marginRight: 28 }}>
        Continue with {providerLabels[provider]}
      </Text>
      {busy ? <ActivityIndicator color={colors.text} style={{ position: 'absolute', right: 16 }} /> : null}
    </Pressable>
  );
}

const useSt = makeStyles((colors) => ({
  body: { padding: space.xl, gap: space.md, flexGrow: 1 },
  logo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: space.xl, marginBottom: space.lg },
  logoDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.live },
  logoText: { fontFamily: fonts.heading, fontSize: 34, color: colors.text, letterSpacing: -1 },
  phoneRow: { flexDirection: 'row', gap: space.sm },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 16,
  },
  divider: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginVertical: space.sm },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  provider: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 50,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: space.lg,
  },
  glyph: { width: 28, alignItems: 'center' },
  links: { flexDirection: 'row', justifyContent: 'center', gap: space.md, marginTop: space.sm },
  link: { color: colors.mutedStrong, fontFamily: fonts.bodySemibold },
}));
