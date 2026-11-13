import { ApiError, createApiClient, type RefreshStore } from '@/lib/api/http';
import type { Tokens } from '@/lib/api/types';

const device = async () => ({ device_id: 'dev-1', device_name: 'Test', platform: 'ios' as const });

function memStore(initial: string | null = 'r0'): RefreshStore & { value: string | null } {
  const s = {
    value: initial,
    get: async () => s.value,
    set: async (t: string | null) => {
      s.value = t;
    },
  };
  return s;
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

const tokens = (n: number, expiresInMs = 15 * 60_000): Tokens => ({
  access_token: `a${n}`,
  access_expires_at: new Date(Date.now() + expiresInMs).toISOString(),
  refresh_token: `r${n}`,
  refresh_expires_at: new Date(Date.now() + 86400_000).toISOString(),
  token_type: 'Bearer',
  session_id: 's1',
});

type Call = { url: string; init: RequestInit };

function fakeFetch(handler: (c: Call, i: number) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fn = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const c = { url: String(url), init: init ?? {} };
    calls.push(c);
    return handler(c, calls.length - 1);
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

const auth = (c: Call) => (c.init.headers as Record<string, string>)?.Authorization;

describe('api client', () => {
  it('refreshes once for concurrent requests (single-flight)', async () => {
    const store = memStore('r0');
    let refreshes = 0;
    const f = fakeFetch(async (c) => {
      if (c.url.endsWith('/v1/auth/refresh')) {
        refreshes++;
        const body = JSON.parse(String(c.init.body));
        expect(body.refresh_token).toBe('r0');
        expect(body.device.device_id).toBe('dev-1');
        await new Promise((r) => setTimeout(r, 10));
        return json(200, tokens(1));
      }
      expect(auth(c)).toBe('Bearer a1');
      return json(200, { ok: true });
    });
    const api = createApiClient({ baseUrl: 'https://api.test', store, device, fetchFn: f.fn });
    const results = await Promise.all([api.get('/v1/me'), api.get('/v1/wallet'), api.get('/v1/feed/foryou')]);
    expect(results).toHaveLength(3);
    expect(refreshes).toBe(1);
    expect(store.value).toBe('r1');
  });

  it('replays once after a 401 with a fresh token', async () => {
    const store = memStore('r0');
    let n = 0;
    const f = fakeFetch((c) => {
      if (c.url.endsWith('/v1/auth/refresh')) return json(200, tokens(++n));
      if (auth(c) === 'Bearer a1') return json(401, { error: { code: 'token_revoked', message: 'revoked' } });
      return json(200, { me: 'ok' });
    });
    const api = createApiClient({ baseUrl: 'https://api.test', store, device, fetchFn: f.fn });
    await expect(api.get('/v1/me')).resolves.toEqual({ me: 'ok' });
    expect(n).toBe(2);
  });

  it('ends the session when the refresh token is invalid', async () => {
    const store = memStore('r0');
    const ended = jest.fn();
    const f = fakeFetch(() => json(401, { error: { code: 'refresh_invalid', message: 'gone' } }));
    const api = createApiClient({ baseUrl: 'https://api.test', store, device, fetchFn: f.fn, onSessionEnded: ended });
    await expect(api.get('/v1/me')).rejects.toMatchObject({ status: 401 });
    expect(store.value).toBeNull();
    expect(ended).toHaveBeenCalledWith('refresh_invalid');
    // Signed out now: no further network call is attempted.
    const before = f.calls.length;
    await expect(api.get('/v1/me')).rejects.toBeInstanceOf(ApiError);
    expect(f.calls.length).toBe(before);
  });

  it('keeps the session on refresh_in_progress when no newer token exists', async () => {
    const store = memStore('r0');
    const ended = jest.fn();
    const f = fakeFetch(() => json(409, { error: { code: 'refresh_in_progress', message: 'race' } }));
    const api = createApiClient({ baseUrl: 'https://api.test', store, device, fetchFn: f.fn, onSessionEnded: ended });
    await expect(api.get('/v1/me')).rejects.toMatchObject({ code: 'refresh_in_progress' });
    expect(store.value).toBe('r0');
    expect(ended).not.toHaveBeenCalled();
  });

  it('parses the gateway error envelope', async () => {
    const store = memStore(null);
    const f = fakeFetch(() =>
      json(422, { error: { code: 'validation', message: 'Bad input', fields: { handle: 'taken' }, trace_id: 't-1' } }),
    );
    const api = createApiClient({ baseUrl: 'https://api.test', store, device, fetchFn: f.fn });
    const err = (await api.post('/v1/auth/otp/send', { channel: 'sms', target: 'x' }, { auth: 'none' }).catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 422, code: 'validation', message: 'Bad input', fields: { handle: 'taken' }, traceId: 't-1' });
    expect(err.retryable).toBe(false);
  });

  it('sends Idempotency-Key and retries a keyed POST after a network error', async () => {
    const store = memStore(null);
    const f = fakeFetch((_c, i) => {
      if (i === 0) throw new TypeError('Network request failed');
      return json(200, { gift_send_id: 'g1' });
    });
    const api = createApiClient({ baseUrl: 'https://api.test', store, device, fetchFn: f.fn });
    await api.post('/v1/wallet/gifts/send', { gift_id: 'rose' }, { auth: 'none', idempotencyKey: 'k-123' });
    expect(f.calls).toHaveLength(2);
    for (const c of f.calls) expect((c.init.headers as Record<string, string>)['Idempotency-Key']).toBe('k-123');
  });

  it('does not replay an unkeyed POST after a network error', async () => {
    const store = memStore(null);
    const f = fakeFetch(() => {
      throw new TypeError('Network request failed');
    });
    const api = createApiClient({ baseUrl: 'https://api.test', store, device, fetchFn: f.fn });
    await expect(api.post('/v1/social/follows/u1', undefined, { auth: 'none' })).rejects.toMatchObject({ code: 'network' });
    expect(f.calls).toHaveLength(1);
  });

  it('refreshes ahead of expiry and builds query strings', async () => {
    const store = memStore('r0');
    let n = 0;
    const f = fakeFetch((c) => {
      if (c.url.endsWith('/v1/auth/refresh')) return json(200, tokens(++n, 10_000)); // expires inside the 30 s skew
      return json(200, {});
    });
    const api = createApiClient({ baseUrl: 'https://api.test', store, device, fetchFn: f.fn });
    await api.get('/v1/live/rooms', { query: { category: 'music', cursor: undefined, limit: 20 } });
    await api.get('/v1/live/rooms');
    expect(n).toBe(2);
    expect(f.calls.find((c) => c.url.includes('/v1/live/rooms'))!.url).toBe('https://api.test/v1/live/rooms?category=music&limit=20');
  });

  it('returns undefined for 204', async () => {
    const f = fakeFetch(() => new Response(null, { status: 204 }));
    const api = createApiClient({ baseUrl: 'https://api.test', store: memStore(null), device, fetchFn: f.fn });
    await expect(api.del('/v1/x', { auth: 'none' })).resolves.toBeUndefined();
  });
});
