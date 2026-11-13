import type { ID } from './api/types';

// Mirrors lumo-contracts/realtime/messages.go.
export interface ChatData {
  id: string;
  user_id: ID;
  handle: string;
  display_name: string;
  text: string;
}
export interface GiftData {
  gift: { sender_id: ID; receiver_id: ID; gift_id: string; qty: number; coins: number };
  sender: { handle: string; display_name: string; avatar_url: string };
}
export interface PkScoreData {
  pk_id: ID;
  room_a: ID;
  room_b: ID;
  score_a: number;
  score_b: number;
  ends_at_unix: number;
}
export interface PkStartedData {
  pk_id: ID;
  room_a: ID;
  room_b: ID;
  host_a: ID;
  host_b: ID;
  ends_at_unix: number;
}
export interface PkEndedData {
  pk_id: ID;
  room_a: ID;
  room_b: ID;
  score_a: number;
  score_b: number;
  /** Empty or absent on a draw. */
  winner_room?: ID;
}
export type SystemData =
  | { kind: 'connected' }
  | { kind: 'pk_invite'; pk_id: ID; from_room: ID; from_host: string }
  | { kind: string; [k: string]: unknown };

export type RoomEvent =
  | { type: 'chat'; data: ChatData }
  | { type: 'gift'; data: GiftData }
  | { type: 'viewers'; data: { count: number } }
  | { type: 'goal'; data: { coins: number; target: number } }
  | { type: 'pk_started'; data: PkStartedData }
  | { type: 'pk_score'; data: PkScoreData }
  | { type: 'pk_ended'; data: PkEndedData }
  | { type: 'room_ended'; data: { reason?: string } }
  | { type: 'kick'; data: unknown }
  | { type: 'system'; data: SystemData }
  | { type: 'error'; data: { code: string; message: string } };

export type SocketState = 'connecting' | 'open' | 'reconnecting' | 'closed';

export interface RoomSocketOptions {
  wsUrl: string;
  roomId: string;
  getToken: () => Promise<string | null>;
  onEvent: (e: RoomEvent) => void;
  onState?: (s: SocketState) => void;
  /** Injected for tests. */
  WebSocketImpl?: typeof WebSocket;
  random?: () => number;
  maxBackoffMs?: number;
}

const TERMINAL: ReadonlySet<RoomEvent['type']> = new Set(['room_ended', 'kick']);
const POLICY_VIOLATION = 1008;

/**
 * One live room's realtime channel. Reconnects with jittered exponential
 * backoff and a fresh access token each time; stops for good when the room
 * ends, the user is removed, or close() is called.
 */
export class RoomSocket {
  private ws: WebSocket | null = null;
  private attempt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private readonly o: Required<Omit<RoomSocketOptions, 'onState'>> & Pick<RoomSocketOptions, 'onState'>;

  constructor(opts: RoomSocketOptions) {
    this.o = {
      WebSocketImpl: globalThis.WebSocket,
      random: Math.random,
      maxBackoffMs: 30_000,
      ...opts,
    };
  }

  connect(): void {
    this.stopped = false;
    void this.open();
  }

  /** Send a chat line. Returns false when not connected. */
  sendChat(text: string): boolean {
    const t = text.trim();
    if (!t || !this.ws || this.ws.readyState !== 1) return false;
    this.ws.send(JSON.stringify({ type: 'chat', text: t.slice(0, 200) }));
    return true;
  }

  close(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onclose = null;
      ws.onmessage = null;
      ws.onerror = null;
      try {
        ws.close(1000);
      } catch {
        /* already closed */
      }
    }
    this.o.onState?.('closed');
  }

  /** Exposed for tests. */
  backoffMs(attempt: number): number {
    const base = Math.min(this.o.maxBackoffMs, 500 * 2 ** attempt);
    return Math.round(base / 2 + this.o.random() * (base / 2));
  }

  private async open() {
    if (this.stopped) return;
    this.o.onState?.(this.attempt === 0 ? 'connecting' : 'reconnecting');
    let token: string | null = null;
    try {
      token = await this.o.getToken();
    } catch {
      token = null;
    }
    if (this.stopped) return;
    if (!token) {
      this.schedule();
      return;
    }
    const url = `${this.o.wsUrl}/v1/rt/rooms/${encodeURIComponent(this.o.roomId)}?access_token=${encodeURIComponent(token)}`;
    const ws = new this.o.WebSocketImpl(url);
    this.ws = ws;

    ws.onopen = () => {
      this.attempt = 0;
      this.o.onState?.('open');
    };
    ws.onmessage = (ev: MessageEvent) => {
      let msg: RoomEvent | null = null;
      try {
        msg = JSON.parse(String(ev.data)) as RoomEvent;
      } catch {
        return;
      }
      if (!msg || typeof msg.type !== 'string') return;
      this.o.onEvent(msg);
      if (TERMINAL.has(msg.type)) this.close();
    };
    ws.onerror = () => {
      /* onclose follows */
    };
    ws.onclose = (ev: CloseEvent) => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.stopped) return;
      if (ev.code === POLICY_VIOLATION && ev.reason === 'removed by moderator') {
        this.o.onEvent({ type: 'kick', data: { reason: ev.reason } });
        this.close();
        return;
      }
      this.schedule();
    };
  }

  private schedule() {
    if (this.stopped) return;
    this.o.onState?.('reconnecting');
    const delay = this.backoffMs(this.attempt++);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.open();
    }, delay);
  }
}
