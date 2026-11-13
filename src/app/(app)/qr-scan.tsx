import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Empty, IconButton, Screen, Text } from '@/components/ui';
import { toast } from '@/components/Toast';
import { parseQrPayload } from '@/lib/qr';
import { colors, radius, space } from '@/theme/tokens';

export default function QrScan() {
  const [perm, request] = useCameraPermissions();
  const insets = useSafeAreaInsets();
  const handled = useRef(false);

  if (!perm) return <Screen>{null}</Screen>;
  if (!perm.granted) {
    return (
      <Screen>
        <Empty
          title="Scan to sign in"
          hint="Allow camera access to scan the QR code shown on lumo web or TV."
          action={<Button title="Allow camera" onPress={() => void request()} />}
        />
        <Button title="Close" kind="ghost" onPress={() => router.back()} style={{ margin: space.lg }} />
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => {
          if (handled.current) return;
          const id = parseQrPayload(data);
          if (!id) {
            toast("That isn't a Lumo sign-in code.", 'error');
            return;
          }
          handled.current = true;
          router.replace({ pathname: '/qr-login', params: { id } });
        }}
      />
      <View style={[st.top, { paddingTop: insets.top + space.sm }]}>
        <IconButton name="close" label="Close" onPress={() => router.back()} />
      </View>
      <View style={st.frame} pointerEvents="none" />
      <Text style={[st.hint, { bottom: insets.bottom + space.xxl }]}>Point at the QR code on lumo web or TV</Text>
    </View>
  );
}

const st = StyleSheet.create({
  top: { position: 'absolute', left: space.lg },
  frame: {
    position: 'absolute',
    alignSelf: 'center',
    top: '30%',
    width: 240,
    height: 240,
    borderRadius: radius.lg,
    borderWidth: 3,
    borderColor: colors.text,
  },
  hint: { position: 'absolute', alignSelf: 'center', textAlign: 'center' },
});
