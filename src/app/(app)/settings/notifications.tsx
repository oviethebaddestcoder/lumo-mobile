import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ScrollView } from 'react-native';
import { toastError } from '@/components/Toast';
import { ErrorView, Header, Loading, Screen, ToggleRow } from '@/components/ui';
import { api } from '@/lib/api';
import type { NotifyPrefs } from '@/lib/api/types';
import { qk } from '@/lib/query';

const ROWS: [keyof NotifyPrefs, string, string][] = [
  ['live', 'LIVE', 'When people you follow go live'],
  ['new_follower', 'New followers', 'When someone follows you'],
  ['comments', 'Comments', 'Comments and replies on your videos'],
  ['likes', 'Likes', 'Likes on your videos (batched)'],
  ['messages', 'Messages', 'New direct messages'],
];

export default function NotificationSettings() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: qk.notifyPrefs, queryFn: api.notify.prefs });
  const save = useMutation({
    mutationFn: api.notify.setPrefs,
    onMutate: (p) => {
      const prev = qc.getQueryData<NotifyPrefs>(qk.notifyPrefs);
      qc.setQueryData(qk.notifyPrefs, p);
      return { prev };
    },
    onError: (e, _p, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.notifyPrefs, ctx.prev);
      toastError(e);
    },
  });

  return (
    <Screen>
      <Header title="Notifications" />
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorView error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <ScrollView>
          {ROWS.map(([key, label, hint]) => (
            <ToggleRow key={key} label={label} hint={hint} value={q.data[key]} onChange={(v) => save.mutate({ ...q.data, [key]: v })} />
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}
