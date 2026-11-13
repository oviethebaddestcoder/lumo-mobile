import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { toast, toastError } from '@/components/Toast';
import { Button, Header, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import type { OAuthProvider } from '@/lib/api/types';
import { availableProviders, isCancelled, providerCredential, providerLabels } from '@/lib/auth/providers';
import { useSession } from '@/lib/auth/session';
import { colors, space } from '@/theme/tokens';

export default function LinkedAccounts() {
  const me = useSession((s) => s.me);
  const refreshMe = useSession((s) => s.refreshMe);
  const [providers, setProviders] = useState<OAuthProvider[]>([]);
  const [busy, setBusy] = useState<OAuthProvider | null>(null);

  useEffect(() => {
    void availableProviders().then(setProviders);
  }, []);

  const linked = new Map((me?.identities ?? []).map((i) => [i.provider, i]));

  async function link(p: OAuthProvider) {
    setBusy(p);
    try {
      await api.identity.linkIdentity(p, await providerCredential(p));
      await refreshMe();
      toast(`${providerLabels[p]} linked`, 'success');
    } catch (e) {
      if (!isCancelled(e)) toastError(e);
    } finally {
      setBusy(null);
    }
  }

  async function unlink(p: OAuthProvider) {
    setBusy(p);
    try {
      await api.identity.unlinkIdentity(p);
      await refreshMe();
    } catch (e) {
      // last_login_method: the server refuses to strand the account.
      toastError(e);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <Header title="Sign-in methods" />
      <ScrollView>
        <View style={st.row}>
          <View style={{ flex: 1 }}>
            <Text>Phone</Text>
            <Text variant="caption">{me?.phone ?? 'Not added'}</Text>
          </View>
        </View>
        <View style={st.row}>
          <View style={{ flex: 1 }}>
            <Text>Email</Text>
            <Text variant="caption">{me?.email ?? 'Not added'}</Text>
          </View>
        </View>
        {providers.map((p) => {
          const id = linked.get(p);
          return (
            <View key={p} style={st.row}>
              <View style={{ flex: 1 }}>
                <Text>{providerLabels[p]}</Text>
                <Text variant="caption">{id ? id.email ?? 'Linked' : 'Not linked'}</Text>
              </View>
              <Button
                small
                kind={id ? 'ghost' : 'secondary'}
                title={id ? 'Unlink' : 'Link'}
                loading={busy === p}
                disabled={!!busy}
                onPress={() => void (id ? unlink(p) : link(p))}
              />
            </View>
          );
        })}
        <Text variant="caption" style={{ padding: space.lg }}>
          Keep at least one way to sign in. Linking lets you sign in with any of these and keeps the same account.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const st = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
