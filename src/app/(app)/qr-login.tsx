import { useMutation, useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Icon } from '@/components/Icon';
import { toast, toastError } from '@/components/Toast';
import { Button, ErrorView, Header, Loading, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { space, useTheme } from '@/theme';

/**
 * Approve a sign-in on another device. Reached from the scanner or the
 * lumo://qr-login?id=… deep link. Shows what is asking before approving.
 */
export default function QrLogin() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const info = useQuery({ queryKey: ['qr', id], queryFn: () => api.identity.qrInfo(id), retry: false, gcTime: 0 });
  const approve = useMutation({
    mutationFn: () => api.identity.qrApprove(id),
    onSuccess: () => {
      toast('Signed in on the other device.', 'success');
      router.back();
    },
    onError: toastError,
  });

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Sign in on another device" />
      {info.isPending ? (
        <Loading />
      ) : info.isError ? (
        <ErrorView error={info.error} />
      ) : (
        <View style={{ padding: space.xl, gap: space.lg, alignItems: 'center' }}>
          <Icon name="qr" size={56} color={colors.mutedStrong} />
          <Text variant="h2" style={{ textAlign: 'center' }}>
            Sign in to {info.data.device || 'a new device'}?
          </Text>
          <Text variant="bodyMuted" style={{ textAlign: 'center' }}>
            {info.data.platform}
            {info.data.ip ? ` · ${info.data.ip}` : ''}
          </Text>
          <Text variant="bodyMuted" style={{ textAlign: 'center' }}>
            Only approve if you scanned this code yourself. Anyone with this sign-in can use your account.
          </Text>
          <Button title="Approve sign-in" loading={approve.isPending} onPress={() => approve.mutate()} style={{ alignSelf: 'stretch' }} />
          <Button title="Cancel" kind="ghost" onPress={() => router.back()} style={{ alignSelf: 'stretch' }} />
        </View>
      )}
    </Screen>
  );
}
