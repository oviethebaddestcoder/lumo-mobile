import { Stack } from 'expo-router';
import { colors } from '@/theme/tokens';

export const unstable_settings = { initialRouteName: '(tabs)' };

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="live/[id]" options={{ animation: 'fade' }} />
      <Stack.Screen name="host/[id]" options={{ gestureEnabled: false, animation: 'fade' }} />
      <Stack.Screen name="qr-scan" options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="upload" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
