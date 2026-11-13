import { create } from 'zustand';
import { api, client, onSessionEnded } from '../api';
import type { Me, SignInResult, UserPublic } from '../api/types';
import { queryClient } from '../query';

export type AuthStatus = 'loading' | 'signedOut' | 'needsBirthDate' | 'signedIn';

interface SessionState {
  status: AuthStatus;
  me: Me | null;
  /** Browsing signed-out (feed and live are public; actions prompt sign-in). */
  guest: boolean;
  browseAsGuest(): void;
  /** Bootstrap from the stored refresh token on launch. */
  restore(): Promise<void>;
  /** Apply a sign-in result from any provider. */
  signedIn(result: SignInResult): Promise<void>;
  refreshMe(): Promise<Me | null>;
  setMe(me: Me): void;
  signOut(opts?: { everywhere?: boolean }): Promise<void>;
  /** Local-only teardown when the server says the session is gone. */
  ended(): void;
}

const hooks: { onSignedIn?: () => void; onSignedOut?: () => Promise<void> | void }[] = [];

/** Lets push/IAP modules react to sign-in/out without import cycles. */
export function registerSessionHooks(h: (typeof hooks)[number]) {
  hooks.push(h);
}

function statusFor(me: Pick<Me, 'birth_date'> | null): AuthStatus {
  if (!me) return 'signedOut';
  return me.birth_date ? 'signedIn' : 'needsBirthDate';
}

export const useSession = create<SessionState>((set, get) => ({
  status: 'loading',
  me: null,
  guest: false,
  browseAsGuest: () => set({ guest: true }),

  async restore() {
    if (!(await client.hasSession())) {
      set({ status: 'signedOut', me: null });
      return;
    }
    try {
      const me = await api.identity.me();
      set({ me, status: statusFor(me) });
      hooks.forEach((h) => h.onSignedIn?.());
    } catch (e) {
      // Offline at launch: keep the session; screens will retry their queries.
      if (await client.hasSession()) set({ status: 'signedIn' });
      else set({ status: 'signedOut', me: null });
      if (__DEV__) console.warn('restore failed', e);
    }
  },

  async signedIn(result) {
    await client.setSession(result.tokens);
    queryClient.clear();
    const me = await api.identity.me().catch(() => null);
    const fallback = me ?? ({ ...(result.user as UserPublic), has_password: false, identities: [], roles: [] } as Me);
    set({ me: fallback, status: result.needs_birth_date ? 'needsBirthDate' : statusFor(fallback) });
    hooks.forEach((h) => h.onSignedIn?.());
  },

  async refreshMe() {
    try {
      const me = await api.identity.me();
      set({ me, status: statusFor(me) });
      return me;
    } catch {
      return get().me;
    }
  },

  setMe(me) {
    set({ me, status: statusFor(me) });
  },

  async signOut(opts) {
    for (const h of hooks) await Promise.resolve(h.onSignedOut?.()).catch(() => undefined);
    try {
      if (opts?.everywhere) await api.identity.logoutAll(false);
      else await api.identity.logout();
    } catch {
      /* best effort: the local session goes regardless */
    }
    await client.clearSession();
    queryClient.clear();
    set({ status: 'signedOut', me: null, guest: false });
  },

  ended() {
    queryClient.clear();
    set({ status: 'signedOut', me: null, guest: false });
  },
}));

onSessionEnded(() => useSession.getState().ended());

export const isAdult = (me: Pick<UserPublic, 'adult'> | null | undefined) => !!me?.adult;
