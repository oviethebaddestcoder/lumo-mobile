import { RoomSocket, type RoomEvent } from '@/lib/realtime';

class FakeWS {
  static instances: FakeWS[] = [];
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((e: { code: number; reason: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(public url: string) {
    FakeWS.instances.push(this);
  }
  send(d: string) {
    this.sent.push(d);
  }
  close() {
    this.closed = true;
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  emit(msg: object) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }
  drop(code = 1006, reason = '') {
    this.readyState = 3;
    this.onclose?.({ code, reason });
  }
}

const flush = () => new Promise<void>((r) => setImmediate(() => r()));

describe('RoomSocket', () => {
  beforeEach(() => {
    FakeWS.instances = [];
    jest.useFakeTimers({ doNotFake: ['setImmediate'] });
  });
  afterEach(() => jest.useRealTimers());

  function make(events: RoomEvent[] = [], tokens = ['t1', 't2', 't3']) {
    let i = 0;
    const s = new RoomSocket({
      wsUrl: 'wss://api.test',
      roomId: 'room 1',
      getToken: async () => tokens[i++] ?? null,
      onEvent: (e) => events.push(e),
      WebSocketImpl: FakeWS as unknown as typeof WebSocket,
      random: () => 0.5,
    });
    return s;
  }

  it('connects with an encoded room id and token, sends chat', async () => {
    const s = make();
    s.connect();
    await flush();
    const ws = FakeWS.instances[0]!;
    expect(ws.url).toBe('wss://api.test/v1/rt/rooms/room%201?access_token=t1');
    expect(s.sendChat('hello')).toBe(false); // not open yet
    ws.open();
    expect(s.sendChat('  hello  ')).toBe(true);
    expect(JSON.parse(ws.sent[0]!)).toEqual({ type: 'chat', text: 'hello' });
    expect(s.sendChat('   ')).toBe(false);
  });

  it('reconnects with backoff and a fresh token', async () => {
    const s = make();
    s.connect();
    await flush();
    FakeWS.instances[0]!.open();
    FakeWS.instances[0]!.drop();
    expect(FakeWS.instances).toHaveLength(1);
    jest.advanceTimersByTime(s.backoffMs(0));
    await flush();
    expect(FakeWS.instances).toHaveLength(2);
    expect(FakeWS.instances[1]!.url).toContain('access_token=t2');
  });

  it('backoff grows and caps', () => {
    const s = make();
    expect(s.backoffMs(0)).toBe(375);
    expect(s.backoffMs(3)).toBe(3000);
    expect(s.backoffMs(20)).toBe(22500);
  });

  it('stops for good when the room ends', async () => {
    const events: RoomEvent[] = [];
    const s = make(events);
    s.connect();
    await flush();
    const ws = FakeWS.instances[0]!;
    ws.open();
    ws.emit({ type: 'viewers', data: { count: 12 } });
    ws.emit({ type: 'room_ended', data: { reason: 'host' } });
    expect(events.map((e) => e.type)).toEqual(['viewers', 'room_ended']);
    expect(ws.closed).toBe(true);
    jest.advanceTimersByTime(60_000);
    await flush();
    expect(FakeWS.instances).toHaveLength(1);
    expect(s).toBeDefined();
  });

  it('treats a moderator removal close as a kick', async () => {
    const events: RoomEvent[] = [];
    const s = make(events);
    s.connect();
    await flush();
    FakeWS.instances[0]!.open();
    FakeWS.instances[0]!.drop(1008, 'removed by moderator');
    expect(events.at(-1)?.type).toBe('kick');
    jest.advanceTimersByTime(60_000);
    await flush();
    expect(FakeWS.instances).toHaveLength(1);
    s.close();
  });

  it('connects to the personal channel by path', async () => {
    const s = new RoomSocket({
      wsUrl: 'wss://api.test',
      path: '/v1/rt/me',
      getToken: async () => 'tok',
      onEvent: () => undefined,
      WebSocketImpl: FakeWS as unknown as typeof WebSocket,
    });
    s.connect();
    await flush();
    expect(FakeWS.instances[0]!.url).toBe('wss://api.test/v1/rt/me?access_token=tok');
    s.close();
  });

  it('ignores malformed frames', async () => {
    const events: RoomEvent[] = [];
    const s = make(events);
    s.connect();
    await flush();
    const ws = FakeWS.instances[0]!;
    ws.onmessage?.({ data: 'not json' });
    ws.onmessage?.({ data: '{"nope":1}' });
    expect(events).toHaveLength(0);
    s.close();
  });
});
