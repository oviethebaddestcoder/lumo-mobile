import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { toast, toastError } from '@/components/Toast';
import { Button, Empty, ErrorView, Header, Loading, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import type { Interest } from '@/lib/api/types';
import { qk } from '@/lib/query';
import { fonts, radius, space, makeStyles, useTheme } from '@/theme';

/**
 * Content preferences: the hashtags shaping For You (remove any), and
 * "Refresh your For You feed" to start over.
 */
export default function InterestsScreen() {
  const { colors } = useTheme();
  const st = useSt();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: qk.interests, queryFn: api.feed.interests });
  const refreshFeeds = () => {
    void qc.invalidateQueries({ queryKey: qk.forYou });
    void qc.invalidateQueries({ queryKey: qk.watchFeed });
  };
  const remove = useMutation({
    mutationFn: api.feed.removeInterest,
    onMutate: (tag) => {
      const prev = qc.getQueryData<{ items: Interest[] }>(qk.interests);
      if (prev) qc.setQueryData(qk.interests, { items: prev.items.filter((i) => i.tag !== tag) });
      return { prev };
    },
    onError: (e, _t, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.interests, ctx.prev);
      toastError(e);
    },
    onSuccess: refreshFeeds,
  });
  const reset = useMutation({
    mutationFn: api.feed.reset,
    onSuccess: () => {
      qc.setQueryData(qk.interests, { items: [] });
      refreshFeeds();
      toast('Your For You feed has been refreshed.', 'success');
    },
    onError: toastError,
  });

  return (
    <Screen>
      <Header title="Content preferences" />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <View style={{ gap: space.xs }}>
          <Text variant="h2">Your interests</Text>
          <Text variant="bodyMuted">Based on what you watch, like and share. Remove a topic to see less of it.</Text>
        </View>
        {q.isPending ? (
          <Loading />
        ) : q.isError ? (
          <ErrorView error={q.error} onRetry={() => void q.refetch()} />
        ) : q.data.items.length === 0 ? (
          <Empty title="Still learning" hint="Watch a few videos and your interests will show up here." />
        ) : (
          <View style={st.chips}>
            {q.data.items.map((i) => (
              <Pressable
                key={i.tag}
                style={st.chip}
                onPress={() => remove.mutate(i.tag)}
                accessibilityRole="button"
                accessibilityLabel={`Remove #${i.tag}`}
              >
                <Text style={st.chipText}>#{i.tag}</Text>
                <Icon name="close" size={14} color={colors.muted} />
              </Pressable>
            ))}
          </View>
        )}
        <View style={{ gap: space.sm, marginTop: space.lg }}>
          <Text variant="h2">Refresh your For You feed</Text>
          <Text variant="bodyMuted">
            Start over as if you were new. Your follows, likes and blocks stay; recommendations forget what you watched.
          </Text>
          <Button
            kind="ghost"
            title="Refresh For You"
            loading={reset.isPending}
            onPress={() =>
              Alert.alert('Refresh your For You feed?', 'Recommendations will start fresh. This can’t be undone.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Refresh', style: 'destructive', onPress: () => reset.mutate() },
              ])
            }
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const useSt = makeStyles((colors) => ({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chipText: { fontFamily: fonts.bodySemibold, fontSize: 14 },
}));
