import { useMutation } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Alert, ScrollView, View } from 'react-native';
import { toastError } from '@/components/Toast';
import { Chip, Header, ListRow, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useSession } from '@/lib/auth/session';
import { space, useTheme, useThemePref, type ThemePref } from '@/theme';

export default function Settings() {
  const { colors } = useTheme();
  const me = useSession((s) => s.me);
  const signOut = useSession((s) => s.signOut);
  const ended = useSession((s) => s.ended);

  const del = useMutation({
    mutationFn: api.identity.deleteMe,
    onSuccess: async () => {
      await signOut().catch(() => ended());
    },
    onError: toastError,
  });

  return (
    <Screen>
      <Header title="Settings" />
      <ScrollView>
        <Section title="Account" />
        <ListRow label="Edit profile" icon="user" onPress={() => router.push('/settings/profile')} />
        <ListRow label="Sign-in methods" icon="check" onPress={() => router.push('/settings/accounts')} />
        <ListRow
          label={me?.has_password ? 'Change password' : 'Set a password'}
          icon="settings"
          onPress={() => router.push('/settings/password')}
        />
        <ListRow label="Devices & sessions" icon="eye" onPress={() => router.push('/settings/sessions')} />
        <ListRow label="Sign in on a computer (scan QR)" icon="qr" onPress={() => router.push('/qr-scan')} />

        <Section title="Preferences" />
        <ListRow label="Notifications" icon="send" onPress={() => router.push('/settings/notifications')} />
        <ListRow label="Content preferences" icon="hash" onPress={() => router.push('/settings/interests')} />
        <ListRow label="Wallet" icon="coin" onPress={() => router.push('/wallet')} />

        <Section title="Appearance" />
        <Appearance />

        <Section title="" />
        <ListRow
          label="Sign out"
          onPress={() =>
            Alert.alert('Sign out?', undefined, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', onPress: () => void signOut() },
            ])
          }
        />
        <ListRow
          label="Sign out of all devices"
          onPress={() =>
            Alert.alert('Sign out everywhere?', 'Every device signed in to this account will be signed out.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out all', style: 'destructive', onPress: () => void signOut({ everywhere: true }) },
            ])
          }
        />
        <ListRow
          label="Delete account"
          danger
          onPress={() =>
            Alert.alert(
              'Delete your account?',
              'Your profile, videos and remaining coins will be removed. Diamonds not yet cashed out are lost. This cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => del.mutate() },
              ],
            )
          }
        />
        <View style={{ padding: space.xl }}>
          <Text variant="caption" style={{ textAlign: 'center', color: colors.inactive }}>
            Lumo {Constants.expoConfig?.version ?? ''}
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

function Section({ title }: { title: string }) {
  return (
    <Text variant="caption" style={{ paddingHorizontal: space.lg, paddingTop: space.xl, paddingBottom: space.sm, textTransform: 'uppercase' }}>
      {title}
    </Text>
  );
}

const APPEARANCE: [ThemePref, string][] = [
  ['system', 'Same as phone'],
  ['light', 'Light'],
  ['dark', 'Dark'],
];

/** Light, dark or follow the phone. Videos and LIVE always stay dark. */
function Appearance() {
  const pref = useThemePref((s) => s.pref);
  const set = useThemePref((s) => s.set);
  return (
    <View style={{ paddingHorizontal: space.lg, gap: space.sm }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {APPEARANCE.map(([v, label]) => (
          <Chip key={v} label={label} active={pref === v} onPress={() => set(v)} />
        ))}
      </View>
      <Text variant="caption">Videos and LIVE always play on a dark background.</Text>
    </View>
  );
}
