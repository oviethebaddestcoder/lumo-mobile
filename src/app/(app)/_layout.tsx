import { Stack, router } from 'expo-router';
import { useEffect } from 'react';
import { useSession } from '@/lib/auth/session';
import { useTheme } from '@/theme';

export const unstable_settings = { initialRouteName: '(tabs)' };

export default function AppLayout() {
  const { colors } = useTheme();
  const pickTopics = useSession((s) => s.pickTopics && s.status === 'signedIn');
  // New accounts pick topics once, so the very first For You page fits them.
  useEffect(() => {
    if (pickTopics) router.push('/topics');
  }, [pickTopics]);
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="live/[id]" options={{ animation: 'fade' }} />
      <Stack.Screen name="host/[id]" options={{ gestureEnabled: false, animation: 'fade' }} />
      <Stack.Screen name="qr-scan" options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="upload" options={{ presentation: 'modal' }} />
      <Stack.Screen name="topics" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
    </Stack>
  );
}
