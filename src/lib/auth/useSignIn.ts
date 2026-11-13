import { useState } from 'react';
import { toastError } from '@/components/Toast';
import { api } from '../api';
import type { OAuthProvider, SignInResult } from '../api/types';
import { isCancelled, providerCredential } from './providers';
import { useSession } from './session';

/** Shared state machine for every sign-in button. */
export function useSignIn() {
  const signedIn = useSession((s) => s.signedIn);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(label: string, fn: () => Promise<SignInResult>) {
    if (busy) return;
    setBusy(label);
    try {
      await signedIn(await fn());
    } catch (e) {
      if (!isCancelled(e)) toastError(e);
    } finally {
      setBusy(null);
    }
  }

  return {
    busy,
    withProvider: (p: OAuthProvider) => run(p, async () => api.identity.oauth(p, await providerCredential(p))),
    withPassword: (login: string, password: string) => run('password', () => api.identity.passwordLogin(login, password)),
    withOtp: (channel: 'sms' | 'email', target: string, code: string) =>
      run('otp', () => api.identity.verifyOtp(channel, target, code)),
  };
}
