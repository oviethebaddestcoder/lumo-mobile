import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { QueryClientProvider, focusManager, onlineManager } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastHost } from '@/components/Toast';
import { Loading } from '@/components/ui';
import { useSession } from '@/lib/auth/session';
import { bootstrap } from '@/lib/bootstrap';
import { routeForPush } from '@/lib/format';
import { onPushOpened } from '@/lib/push';
import { queryClient } from '@/lib/query';
import { colors } from '@/theme/tokens';

bootstrap();

// React Query: refetch on foreground.
focusManager.setEventListener((handleFocus) => {
  const sub = AppState.addEventListener('change', (s) => handleFocus(s === 'active'));
  return () => sub.remove();
});
onlineManager.setOnline(true);

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });
  const status = useSession((s) => s.status);
  const guest = useSession((s) => s.guest);
  const restore = useSession((s) => s.restore);

  useEffect(() => {
    void restore();
  }, [restore]);

  // Push taps → deep link into the right screen.
  useEffect(() => {
    return onPushOpened((data) => {
      const href = routeForPush(data);
      if (href) router.push(href as never);
    });
  }, []);

  const ready = fontsLoaded && status !== 'loading';
  const canBrowse = status === 'signedIn' || (status === 'signedOut' && guest);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          {!ready ? (
            <View style={{ flex: 1, backgroundColor: colors.bg }}>
              <Loading />
            </View>
          ) : (
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
              <Stack.Protected guard={canBrowse}>
                <Stack.Screen name="(app)" />
              </Stack.Protected>
              <Stack.Protected guard={status === 'needsBirthDate'}>
                <Stack.Screen name="birthday" />
              </Stack.Protected>
              <Stack.Protected guard={status === 'signedOut'}>
                <Stack.Screen name="(auth)" options={{ presentation: guest ? 'modal' : 'card' }} />
              </Stack.Protected>
              <Stack.Screen name="oauth/x" />
            </Stack>
          )}
          <ToastHost />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
