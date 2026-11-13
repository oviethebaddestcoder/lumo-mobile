import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { ProfileView } from '@/components/ProfileView';
import { Button, CoinAmount, Empty, Screen, Text } from '@/components/ui';
import { useSession } from '@/lib/auth/session';
import { compact } from '@/lib/format';
import { useBalance } from '@/lib/hooks';
import { colors, fonts, radius, space } from '@/theme/tokens';

export default function MeTab() {
  const me = useSession((s) => s.me);
  const balance = useBalance();

  if (!me) {
    return (
      <Screen>
        <Empty
          title="Your profile"
          hint="Sign in to post, go live and keep your coins and diamonds."
          action={<Button title="Sign in" onPress={() => router.push('/sign-in')} />}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ProfileView
        user={me}
        header={
          <View style={st.top}>
            <Pressable onPress={() => router.push('/qr-scan')} accessibilityLabel="Scan QR to sign in on another device" hitSlop={10}>
              <Icon name="qr" />
            </Pressable>
            <Text variant="h3">@{me.handle}</Text>
            <Pressable onPress={() => router.push('/settings')} accessibilityLabel="Settings" hitSlop={10}>
              <Icon name="settings" />
            </Pressable>
          </View>
        }
        actions={
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button title="Edit profile" kind="secondary" small onPress={() => router.push('/settings/profile')} />
            <Button title="Share" kind="secondary" small onPress={() => router.push(`/user/${me.id}`)} />
          </View>
        }
        extra={
          <Pressable style={st.wallet} onPress={() => router.push('/wallet')} accessibilityRole="button" accessibilityLabel="Wallet">
            <View style={st.walletCol}>
              <CoinAmount value={compact(balance.data?.coins ?? 0)} size={16} />
              <Text variant="caption">Coins</Text>
            </View>
            <View style={st.sep} />
            <View style={st.walletCol}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon name="diamond" size={16} />
                <Text style={{ color: colors.diamond, fontFamily: fonts.bodySemibold, fontSize: 16 }}>
                  {compact(balance.data?.diamonds ?? 0)}
                </Text>
              </View>
              <Text variant="caption">Diamonds · Cash out</Text>
            </View>
          </Pressable>
        }
      />
    </Screen>
  );
}

const st = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingTop: space.sm },
  wallet: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginHorizontal: space.lg,
    marginTop: space.sm,
    paddingVertical: space.md,
    alignSelf: 'stretch',
  },
  walletCol: { flex: 1, alignItems: 'center', gap: 2 },
  sep: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: colors.border },
});
