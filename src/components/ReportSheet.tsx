import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { api } from '@/lib/api';
import type { ReportReason, ReportTarget } from '@/lib/api/types';
import { space } from '@/theme/tokens';
import { Sheet } from './Sheet';
import { toast, toastError } from './Toast';
import { Button, Field, ListRow, Text } from './ui';

const REASONS: [ReportReason, string][] = [
  ['spam', 'Spam'],
  ['nudity', 'Nudity or sexual content'],
  ['violence', 'Violence or dangerous acts'],
  ['harassment', 'Harassment or bullying'],
  ['hate', 'Hate speech'],
  ['minor_safety', 'Child safety'],
  ['scam', 'Scam or fraud'],
  ['self_harm', 'Suicide or self-harm'],
  ['other', 'Something else'],
];

export function ReportSheet({
  visible,
  onClose,
  targetType,
  targetId,
  onBlock,
}: {
  visible: boolean;
  onClose: () => void;
  targetType: ReportTarget;
  targetId: string;
  /** When reporting a user, offer to block them too. */
  onBlock?: () => void;
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const send = useMutation({
    mutationFn: () => api.social.report(targetType, targetId, reason!, details.trim()),
    onSuccess: () => {
      toast("Thanks. We'll review this report.", 'success');
      setReason(null);
      setDetails('');
      onClose();
    },
    onError: toastError,
  });

  return (
    <Sheet visible={visible} onClose={onClose} title="Report" height="75%">
      <ScrollView contentContainerStyle={{ paddingBottom: space.xl }} keyboardShouldPersistTaps="handled">
        {!reason ? (
          <>
            <Text variant="bodyMuted" style={{ paddingHorizontal: space.lg, marginBottom: space.sm }}>
              Why are you reporting this?
            </Text>
            {REASONS.map(([r, label]) => (
              <ListRow key={r} label={label} onPress={() => setReason(r)} />
            ))}
            {onBlock ? <ListRow label="Block this account" icon="close" danger onPress={onBlock} /> : null}
          </>
        ) : (
          <View style={{ padding: space.lg, gap: space.lg }}>
            <Text variant="h3">{REASONS.find(([r]) => r === reason)?.[1]}</Text>
            {reason === 'self_harm' ? (
              <Text variant="bodyMuted">
                If someone is in immediate danger, contact local emergency services. Our team reviews these reports first.
              </Text>
            ) : null}
            <Field
              label="Details (optional)"
              value={details}
              onChangeText={setDetails}
              multiline
              maxLength={1000}
              style={{ minHeight: 96, textAlignVertical: 'top' }}
            />
            <Button title="Submit report" loading={send.isPending} onPress={() => send.mutate()} />
            <Button title="Back" kind="ghost" onPress={() => setReason(null)} />
          </View>
        )}
      </ScrollView>
    </Sheet>
  );
}
