import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { toastError } from '@/components/Toast';
import { Button, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useSession } from '@/lib/auth/session';
import { qk } from '@/lib/query';
import { colors, fonts, radius, space } from '@/theme/tokens';

/** Shown until the catalogue has enough tagged videos to suggest its own. */
const STARTER = ['comedy', 'music', 'dance', 'cooking', 'football', 'fashion', 'beauty', 'tech', 'gaming', 'skits', 'afrobeats', 'education', 'travel', 'fitness', 'cars', 'pets'];

/**
 * "What do you like?" — shown once to new accounts. The picks seed the For
 * You feed so the first page already fits (in simulation this more than
 * doubled how often new viewers finish videos on their first pages).
 */
export default function TopicsScreen() {
  const qc = useQueryClient();
  const done = useSession((s) => s.topicsDone);
  const topics = useQuery({ queryKey: ['feed', 'topics'], queryFn: api.feed.topics, staleTime: 5 * 60_000 });
  const suggested = topics.data?.items.map((t) => t.tag) ?? [];
  const tags = suggested.length >= 8 ? suggested : [...new Set([...suggested, ...STARTER])];
  const [picked, setPicked] = useState<string[]>([]);
  const finish = () => {
    done();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };
  const save = useMutation({
    mutationFn: () => api.feed.setInterests(picked),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.forYou });
      void qc.invalidateQueries({ queryKey: qk.interests });
      finish();
    },
    onError: toastError,
  });
  const toggle = (t: string) => setPicked((p) => (p.includes(t) ? p.filter((x) => x !== t) : p.length < 10 ? [...p, t] : p));

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={st.body}>
        <Text variant="title">What do you like?</Text>
        <Text variant="bodyMuted">Pick a few topics so your first videos fit you. You can change this any time in Settings.</Text>
        <View style={st.chips}>
          {tags.map((t) => {
            const on = picked.includes(t);
            return (
              <Pressable
                key={t}
                onPress={() => toggle(t)}
                style={[st.chip, on && st.chipOn]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={t}
              >
                <Text style={[st.chipText, on && st.chipTextOn]}>#{t}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <View style={st.footer}>
        <Button
          title={picked.length ? `Continue (${picked.length})` : 'Pick at least one'}
          disabled={picked.length === 0}
          loading={save.isPending}
          onPress={() => save.mutate()}
        />
        <Button kind="ghost" title="Skip" onPress={finish} />
      </View>
    </Screen>
  );
}

const st = StyleSheet.create({
  body: { padding: space.lg, gap: space.md, paddingTop: space.xl },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.live, borderColor: colors.live },
  chipText: { fontFamily: fonts.bodySemibold, fontSize: 15 },
  chipTextOn: { color: '#fff' },
  footer: { padding: space.lg, gap: space.sm },
});
