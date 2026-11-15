import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { ProfileView } from '@/components/ProfileView';
import { Button, CoinAmount, Empty, Screen, Text } from '@/components/ui';
import { useSession } from '@/lib/auth/session';
import { compact } from '@/lib/format';
import { useBadges, useBalance, useStats } from '@/lib/hooks';
import { fonts, radius, space, makeStyles, useTheme } from '@/theme';

export default function MeTab() {
  const { colors } = useTheme();
  const st = useSt();
  const me = useSession((s) => s.me);
  const balance = useBalance();
  const stats = useStats();
  const badges = useBadges();

  if (!me) {
    return (
      <Screen fullWidth>
        <Empty
          title="Your profile"
          hint="Sign in to post, go live and keep your coins and diamonds."
          action={<Button title="Sign in" onPress={() => router.push('/sign-in')} />}
        />
      </Screen>
    );
  }

  return (
    <Screen fullWidth>
      <ProfileView
        user={me}
        header={
          <View style={st.top}>
            <Pressable onPress={() => router.push('/qr-scan')} accessibilityLabel="Scan QR to sign in on another device" hitSlop={10}>
              <Icon name="qr" />
            </Pressable>
            <Text variant="h3">@{me.handle}</Text>
            <View style={{ flexDirection: 'row', gap: space.lg }}>
              <BadgeIcon icon="chat" count={badges.messages} label="Messages" onPress={() => router.push('/messages')} />
              <BadgeIcon icon="bell" count={badges.inbox} label="Notifications" onPress={() => router.push('/inbox')} />
              <Pressable onPress={() => router.push('/settings')} accessibilityLabel="Settings" hitSlop={10}>
                <Icon name="settings" />
              </Pressable>
            </View>
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
                  {compact(stats.data?.diamonds_week ?? 0)}
                </Text>
              </View>
              <Text variant="caption">Diamonds this week</Text>
            </View>
            <View style={st.sep} />
            <View style={st.walletCol}>
              <Text style={{ color: colors.text, fontFamily: fonts.bodySemibold, fontSize: 16 }}>
                {compact(balance.data?.diamonds ?? 0)}
              </Text>
              <Text variant="caption">Cash out</Text>
            </View>
          </Pressable>
        }
      />
    </Screen>
  );
}

const useSt = makeStyles((colors) => ({
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
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.live,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 10, fontFamily: fonts.bodyBold, color: colors.onLive },
}));

function BadgeIcon({ icon, count, label, onPress }: { icon: 'bell' | 'chat'; count: number; label: string; onPress: () => void }) {
  const st = useSt();
  return (
    <Pressable onPress={onPress} accessibilityLabel={count ? `${label}, ${count} unread` : label} hitSlop={10}>
      <Icon name={icon} />
      {count > 0 ? (
        <View style={st.badge}>
          <Text style={st.badgeText}>{count > 99 ? '99+' : count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
