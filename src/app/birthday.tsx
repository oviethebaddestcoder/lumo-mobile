import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { toastError } from '@/components/Toast';
import { Button, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useSession } from '@/lib/auth/session';
import { ageOn } from '@/lib/format';
import { colors, fonts, radius, space } from '@/theme/tokens';

/**
 * New accounts must give a birth date before using the app. Under-13s are
 * refused by the identity service; 13–17 get a restricted (non-adult) account.
 */
export default function Birthday() {
  const setMe = useSession((s) => s.setMe);
  const signOut = useSession((s) => s.signOut);
  const [d, setD] = useState('');
  const [m, setM] = useState('');
  const [y, setY] = useState('');
  const [busy, setBusy] = useState(false);

  const iso = `${y.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  const date = new Date(`${iso}T00:00:00`);
  const valid =
    y.length === 4 &&
    !Number.isNaN(date.getTime()) &&
    date.getDate() === Number(d) &&
    date.getMonth() + 1 === Number(m) &&
    date < new Date() &&
    Number(y) > 1900;
  const age = valid ? ageOn(iso) : null;

  async function save() {
    setBusy(true);
    try {
      setMe(await api.identity.updateMe({ birth_date: iso }));
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ padding: space.xl, gap: space.xl, flex: 1 }}>
        <Text variant="title">When’s your birthday?</Text>
        <Text variant="bodyMuted">
          This won’t be shown on your profile. It keeps Lumo age-appropriate: gifting and some live features are for 18+.
        </Text>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Part label="DD" value={d} onChange={setD} max={2} />
          <Part label="MM" value={m} onChange={setM} max={2} />
          <Part label="YYYY" value={y} onChange={setY} max={4} flex={1.6} />
        </View>
        {age !== null && age < 13 ? (
          <Text style={{ color: colors.danger }}>You need to be 13 or older to use Lumo.</Text>
        ) : null}
        <Button title="Continue" disabled={!valid || (age ?? 0) < 13} loading={busy} onPress={save} />
        <View style={{ flex: 1 }} />
        <Button title="Use a different account" kind="ghost" onPress={() => void signOut()} />
      </View>
    </Screen>
  );
}

function Part({
  label,
  value,
  onChange,
  max,
  flex = 1,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
  flex?: number;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, max))}
      placeholder={label}
      placeholderTextColor={colors.inactive}
      keyboardType="number-pad"
      accessibilityLabel={label}
      style={[st.part, { flex }]}
    />
  );
}

const st = StyleSheet.create({
  part: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 14,
    textAlign: 'center',
    color: colors.text,
    fontFamily: fonts.headingMedium,
    fontSize: 20,
  },
});
