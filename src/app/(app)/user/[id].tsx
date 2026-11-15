import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Share, View } from 'react-native';
import { ProfileView } from '@/components/ProfileView';
import { ReportSheet } from '@/components/ReportSheet';
import { toast, toastError } from '@/components/Toast';
import { Button, ErrorView, Header, IconButton, Loading, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { useSession } from '@/lib/auth/session';
import { config } from '@/lib/config';
import { useFollow, useRelationship, useUser } from '@/lib/hooks';
import { qk } from '@/lib/query';
import { space } from '@/theme/tokens';

export default function UserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useSession((s) => s.me);
  const user = useUser(id);
  const rel = useRelationship(id);
  const follow = useFollow(id);
  const qc = useQueryClient();
  const [sheet, setSheet] = useState<'report' | null>(null);

  const openChat = useMutation({
    mutationFn: () => api.dm.open(id),
    onSuccess: (c) => router.push(`/chat/${c.id}`),
    onError: toastError,
  });
  const block = useMutation({
    mutationFn: (on: boolean) => (on ? api.social.block(id) : api.social.unblock(id)),
    onSuccess: (_d, on) => {
      void qc.invalidateQueries({ queryKey: qk.relationship(id) });
      toast(on ? 'Blocked. They can no longer find or contact you.' : 'Unblocked.', 'success');
      setSheet(null);
    },
    onError: toastError,
  });

  if (user.isPending) return <Loading />;
  if (user.isError) return <ErrorView error={user.error} onRetry={() => void user.refetch()} />;
  const u = user.data;
  const isMe = me?.id === u.id;
  const following = rel.data?.following ?? false;
  const blocking = rel.data?.blocking ?? false;
  const guard = (fn: () => void) => () => (me ? fn() : router.push('/sign-in'));

  return (
    <Screen fullWidth>
      <Header
        title={`@${u.handle}`}
        right={
          !isMe && me ? <IconButton name="more" label="More" onPress={() => setSheet('report')} /> : (
            <IconButton
              name="share"
              label="Share profile"
              onPress={() => void Share.share({ message: `https://${config.webDomain}/@${u.handle}` })}
            />
          )
        }
      />
      <ProfileView
        user={u}
        actions={
          isMe ? null : blocking ? (
            <Button title="Unblock" kind="secondary" small onPress={() => block.mutate(false)} />
          ) : (
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button
                small
                title={following ? (rel.data?.followed_by ? 'Friends' : 'Following') : rel.data?.followed_by ? 'Follow back' : 'Follow'}
                kind={following ? 'secondary' : 'primary'}
                loading={follow.isPending}
                onPress={guard(() => follow.mutate(!following))}
              />
              <Button small title="Message" kind="secondary" loading={openChat.isPending} onPress={guard(() => openChat.mutate())} />
            </View>
          )
        }
      />
      {sheet === 'report' ? (
        <ReportSheet
          visible
          onClose={() => setSheet(null)}
          targetType="user"
          targetId={u.id}
          onBlock={() =>
            Alert.alert(`Block @${u.handle}?`, "They won't be able to follow you, comment, or join your LIVEs.", [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Block', style: 'destructive', onPress: () => block.mutate(true) },
            ])
          }
        />
      ) : null}
    </Screen>
  );
}
