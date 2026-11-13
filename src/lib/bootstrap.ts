import { registerGlobals } from '@livekit/react-native';
import { registerSessionHooks } from './auth/session';
import { startIap, stopIap } from './iap';
import { registerPush, unregisterPush } from './push';

let done = false;

/** One-time process setup. Called from the root layout module scope. */
export function bootstrap() {
  if (done) return;
  done = true;
  // WebRTC globals for livekit-client.
  registerGlobals();
  registerSessionHooks({
    onSignedIn: () => {
      void registerPush();
      void startIap();
    },
    onSignedOut: async () => {
      await unregisterPush();
      await stopIap();
    },
  });
}
