import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { colors, radius, space } from '@/theme/tokens';
import { Text } from './ui';

interface ToastState {
  message: string | null;
  tone: 'info' | 'error' | 'success';
  show(message: string, tone?: ToastState['tone']): void;
  hide(): void;
}

export const useToast = create<ToastState>((set) => ({
  message: null,
  tone: 'info',
  show: (message, tone = 'info') => set({ message, tone }),
  hide: () => set({ message: null }),
}));

/** Fire-and-forget toast from anywhere (mutations, IAP callbacks). */
export const toast = (message: string, tone: ToastState['tone'] = 'info') => useToast.getState().show(message, tone);
export const toastError = (e: unknown) => toast(e instanceof Error ? e.message : 'Something went wrong.', 'error');

export function ToastHost() {
  const { message, tone, hide } = useToast();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(hide, 3200);
    return () => clearTimeout(t);
  }, [message, hide]);
  if (!message) return null;
  return (
    <View pointerEvents="none" style={[st.wrap, { top: insets.top + space.sm }]}>
      <View
        accessibilityLiveRegion="polite"
        style={[st.toast, tone === 'error' && { borderColor: colors.danger }, tone === 'success' && { borderColor: colors.success }]}
      >
        <Text style={{ textAlign: 'center' }}>{message}</Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { position: 'absolute', left: space.lg, right: space.lg, alignItems: 'center', zIndex: 1000 },
  toast: {
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
});
