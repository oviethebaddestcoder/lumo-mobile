import type { Device, ErrorBody, Tokens } from './types';

/** An error the gateway (or the network) returned, normalised. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: Record<string, string>;
  readonly traceId?: string;

  constructor(status: number, code: string, message: string, fields?: Record<string, string>, traceId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.traceId = traceId;
  }

  /** Network failures and 5xx are worth retrying; 4xx are not. */
  get retryable(): boolean {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;

/** Persists the long-lived refresh token. The access token never leaves memory. */
export interface RefreshStore {
  get(): Promise<string | null>;
  set(token: string | null): Promise<void>;
}

export type AuthMode = 'required' | 'optional' | 'none';

export interface RequestOptions {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  auth?: AuthMode;
  headers?: Record<string, string>;
  idempotencyKey?: string;
  signal?: AbortSignal;
}

export interface ApiClientOptions {
  baseUrl: string;
  store: RefreshStore;
  device: () => Promise<Device>;
  /** Called once when the session can no longer be refreshed. */
  onSessionEnded?: (reason: string) => void;
  /** Called after every successful refresh so callers can observe rotation. */
  onTokens?: (tokens: Tokens) => void;
  fetchFn?: typeof fetch;
  now?: () => number;
  /** Refresh this many ms before the access token expires. */
  skewMs?: number;
}

export interface ApiClient {
  request<T>(method: string, path: string, opts?: RequestOptions): Promise<T>;
  get<T>(path: string, opts?: Omit<RequestOptions, 'body'>): Promise<T>;
  post<T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'body'>): Promise<T>;
  put<T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'body'>): Promise<T>;
  patch<T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'body'>): Promise<T>;
  del<T>(path: string, opts?: RequestOptions): Promise<T>;
  /** Store a fresh session from a sign-in. */
  setSession(tokens: Tokens): Promise<void>;
  /** Forget the session locally (does not call the server). */
  clearSession(): Promise<void>;
  /** True when a refresh token is stored (the user is signed in on this device). */
  hasSession(): Promise<boolean>;
  /** A valid access token, refreshing first when needed. Null when signed out. */
  getAccessToken(): Promise<string | null>;
  /** Force a refresh (single-flight). */
  refresh(): Promise<string | null>;
  readonly baseUrl: string;
}

const MAX_NETWORK_RETRIES = 2;

export function createApiClient(opts: ApiClientOptions): ApiClient {
  const fetchFn = opts.fetchFn ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const now = opts.now ?? Date.now;
  const skew = opts.skewMs ?? 30_000;

  let access: { token: string; expiresAt: number } | null = null;
  let inflight: Promise<string | null> | null = null;
  let ended = false;

  const url = (path: string, query?: RequestOptions['query']) => {
    let u = opts.baseUrl + path;
    if (query) {
      const qs = Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');
      if (qs) u += (u.includes('?') ? '&' : '?') + qs;
    }
    return u;
  };

  async function parseError(res: Response): Promise<ApiError> {
    let body: Partial<ErrorBody> | null = null;
    try {
      body = (await res.json()) as Partial<ErrorBody>;
    } catch {
      body = null;
    }
    const e = body?.error;
    const traceId = e?.trace_id ?? res.headers.get('x-trace-id') ?? undefined;
    return new ApiError(
      res.status,
      e?.code ?? `http_${res.status}`,
      e?.message ?? defaultMessage(res.status),
      e?.fields,
      traceId,
    );
  }

  async function endSession(reason: string) {
    access = null;
    await opts.store.set(null);
    if (!ended) {
      ended = true;
      opts.onSessionEnded?.(reason);
    }
  }

  async function doRefresh(): Promise<string | null> {
    const sent = await opts.store.get();
    if (!sent) {
      access = null;
      return null;
    }
    let res: Response;
    try {
      res = await fetchFn(url('/v1/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refresh_token: sent, device: await opts.device() }),
      });
    } catch {
      throw new ApiError(0, 'network', 'No connection. Check your internet and try again.');
    }
    if (res.ok) {
      const tokens = (await res.json()) as Tokens;
      await applyTokens(tokens);
      opts.onTokens?.(tokens);
      return tokens.access_token;
    }
    const err = await parseError(res);
    if (err.code === 'refresh_in_progress') {
      // The token we sent was rotated moments ago. If something already
      // stored the newer one, use it; otherwise leave the session alone and
      // let the caller retry.
      const latest = await opts.store.get();
      if (latest && latest !== sent) return doRefresh();
      throw err;
    }
    if (err.status === 401 || err.status === 403) {
      await endSession(err.code);
      return null;
    }
    throw err;
  }

  async function applyTokens(tokens: Tokens) {
    access = { token: tokens.access_token, expiresAt: Date.parse(tokens.access_expires_at) || now() + 10 * 60_000 };
    ended = false;
    await opts.store.set(tokens.refresh_token);
  }

  function refresh(): Promise<string | null> {
    if (!inflight) {
      inflight = doRefresh().finally(() => {
        inflight = null;
      });
    }
    return inflight;
  }

  async function getAccessToken(): Promise<string | null> {
    if (inflight) return inflight;
    if (access && access.expiresAt - skew > now()) return access.token;
    return refresh();
  }

  async function send(method: string, path: string, o: RequestOptions, token: string | null): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json', ...o.headers };
    let body: string | undefined;
    if (o.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(o.body);
    }
    if (token) headers.Authorization = `Bearer ${token}`;
    if (o.idempotencyKey) headers['Idempotency-Key'] = o.idempotencyKey;

    for (let attempt = 0; ; attempt++) {
      try {
        return await fetchFn(url(path, o.query), { method, headers, body, signal: o.signal });
      } catch (e) {
        if (o.signal?.aborted) throw e;
        // Only replay requests that are safe to replay.
        const safe = method === 'GET' || method === 'PUT' || method === 'DELETE' || !!o.idempotencyKey;
        if (!safe || attempt >= MAX_NETWORK_RETRIES) {
          throw new ApiError(0, 'network', 'No connection. Check your internet and try again.');
        }
        await sleep(300 * 2 ** attempt);
      }
    }
  }

  async function request<T>(method: string, path: string, o: RequestOptions = {}): Promise<T> {
    const mode = o.auth ?? 'required';
    let token: string | null = null;
    if (mode !== 'none') {
      token = await getAccessToken();
      if (!token && mode === 'required') throw new ApiError(401, 'unauthenticated', 'Sign in to continue.');
    }

    let res = await send(method, path, o, token);
    if (res.status === 401 && token) {
      // Access token revoked or expired early (clock skew, logout elsewhere).
      // Refresh once and replay.
      access = null;
      const fresh = await refresh();
      if (!fresh) throw new ApiError(401, 'unauthenticated', 'Your session has ended. Sign in again.');
      res = await send(method, path, o, fresh);
    }
    if (!res.ok) throw await parseError(res);
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  return {
    baseUrl: opts.baseUrl,
    request,
    get: (p, o) => request('GET', p, o),
    post: (p, b, o) => request('POST', p, { ...o, body: b }),
    put: (p, b, o) => request('PUT', p, { ...o, body: b }),
    patch: (p, b, o) => request('PATCH', p, { ...o, body: b }),
    del: (p, o) => request('DELETE', p, o),
    setSession: applyTokens,
    async clearSession() {
      access = null;
      await opts.store.set(null);
    },
    async hasSession() {
      return !!(await opts.store.get());
    },
    getAccessToken,
    refresh,
  };
}

function defaultMessage(status: number): string {
  if (status === 429) return 'Too many requests. Wait a moment and try again.';
  if (status >= 500) return 'Something went wrong on our side. Try again.';
  if (status === 404) return 'Not found.';
  if (status === 403) return "You can't do that.";
  return 'Request failed.';
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
