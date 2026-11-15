import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View, type TextInputInstance } from 'react-native';
import { toast, toastError } from '@/components/Toast';
import { Button, Header, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useSignIn } from '@/lib/auth/useSignIn';
import { fonts, radius, space, makeStyles } from '@/theme';

const LEN = 6;

export default function Verify() {
  const st = useSt();
  const { channel, target } = useLocalSearchParams<{ channel: 'sms' | 'email'; target: string }>();
  const { busy, withOtp } = useSignIn();
  const [code, setCode] = useState('');
  const [wait, setWait] = useState(60);
  const input = useRef<TextInputInstance>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  useEffect(() => {
    if (code.length === LEN && !busy) void withOtp(channel, target, code).then(() => setCode(''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function resend() {
    try {
      await api.identity.sendOtp(channel, target);
      setWait(60);
      toast('New code sent.');
    } catch (e) {
      toastError(e);
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Enter code" />
      <View style={{ padding: space.xl, gap: space.xl }}>
        <Text variant="bodyMuted">
          We sent a {LEN}-digit code to <Text>{target}</Text>
        </Text>
        <Pressable onPress={() => input.current?.focus()} style={st.boxes} accessibilityLabel="Verification code">
          {Array.from({ length: LEN }, (_, i) => (
            <View key={i} style={[st.box, i === code.length && st.boxActive]}>
              <Text style={st.digit}>{code[i] ?? ''}</Text>
            </View>
          ))}
        </Pressable>
        <TextInput
          ref={input}
          value={code}
          onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, LEN))}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          autoFocus
          maxLength={LEN}
          style={st.hidden}
        />
        <Button
          title="Verify"
          disabled={code.length !== LEN}
          loading={busy === 'otp'}
          onPress={() => withOtp(channel, target, code)}
        />
        <Pressable disabled={wait > 0} onPress={resend} style={{ alignSelf: 'center' }}>
          <Text variant="bodyMuted">{wait > 0 ? `Resend code in ${wait}s` : 'Resend code'}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const useSt = makeStyles((colors) => ({
  boxes: { flexDirection: 'row', justifyContent: 'space-between' },
  box: {
    width: 48,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: { borderColor: colors.live },
  digit: { fontFamily: fonts.heading, fontSize: 24 },
  hidden: { position: 'absolute', opacity: 0, height: 1, width: 1 },
}));
