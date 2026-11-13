import { useEffect, useRef, useState } from 'react';
import { client } from './api';
import { config } from './config';
import { RoomSocket, type ChatData, type GiftData, type PkScoreData, type RoomEvent, type SocketState } from './realtime';

export interface ChatLine extends ChatData {
  kind: 'chat' | 'gift' | 'system';
}

export interface PkState {
  pk_id: string;
  room_a: string;
  room_b: string;
  score_a: number;
  score_b: number;
  ends_at_unix: number;
  ended?: { winner_room?: string };
}

export interface RoomLive {
  state: SocketState;
  chat: ChatLine[];
  viewers: number | null;
  goal: { coins: number; target: number } | null;
  gifts: (GiftData & { key: string })[];
  pk: PkState | null;
  pkInvite: { pk_id: string; from_room: string; from_host: string } | null;
  ended: 'ended' | 'kicked' | null;
  send(text: string): boolean;
  dismissGift(key: string): void;
  clearInvite(): void;
}

const MAX_CHAT = 120;

/** Subscribes to /v1/rt/rooms/{id} and folds events into screen state. */
export function useRoomEvents(roomId: string | undefined, onEvent?: (e: RoomEvent) => void): RoomLive {
  const [state, setState] = useState<SocketState>('connecting');
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [viewers, setViewers] = useState<number | null>(null);
  const [goal, setGoal] = useState<RoomLive['goal']>(null);
  const [gifts, setGifts] = useState<RoomLive['gifts']>([]);
  const [pk, setPk] = useState<PkState | null>(null);
  const [pkInvite, setPkInvite] = useState<RoomLive['pkInvite']>(null);
  const [ended, setEnded] = useState<RoomLive['ended']>(null);
  const sock = useRef<RoomSocket | null>(null);
  const extra = useRef(onEvent);
  useEffect(() => {
    extra.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!roomId) return;
    const push = (line: ChatLine) => setChat((c) => (c.length >= MAX_CHAT ? [...c.slice(-MAX_CHAT + 1), line] : [...c, line]));
    const s = new RoomSocket({
      wsUrl: config.wsUrl,
      roomId,
      getToken: () => client.getAccessToken(),
      onState: setState,
      onEvent: (e) => {
        extra.current?.(e);
        switch (e.type) {
          case 'chat':
            push({ ...e.data, kind: 'chat' });
            break;
          case 'gift': {
            const key = `${Date.now()}-${Math.random()}`;
            setGifts((g) => [...g.slice(-4), { ...e.data, key }]);
            push({
              id: key,
              user_id: e.data.gift.sender_id,
              handle: e.data.sender.handle,
              display_name: e.data.sender.display_name,
              text: `sent ${e.data.gift.qty > 1 ? `${e.data.gift.qty}× ` : ''}${e.data.gift.gift_id.replace(/_/g, ' ')}`,
              kind: 'gift',
            });
            break;
          }
          case 'viewers':
            setViewers(e.data.count);
            break;
          case 'goal':
            setGoal(e.data);
            break;
          case 'pk_started':
            setPk({ ...e.data, score_a: 0, score_b: 0 });
            setPkInvite(null);
            break;
          case 'pk_score':
            setPk((p) => ({ ...(p ?? {}), ...(e.data as PkScoreData) }));
            break;
          case 'pk_ended':
            setPk((p) =>
              p ? { ...p, score_a: e.data.score_a, score_b: e.data.score_b, ended: { winner_room: e.data.winner_room } } : null,
            );
            setTimeout(() => setPk((p) => (p?.pk_id === e.data.pk_id ? null : p)), 8000);
            break;
          case 'room_ended':
            setEnded('ended');
            break;
          case 'kick':
            setEnded('kicked');
            break;
          case 'system':
            if (e.data.kind === 'pk_invite') {
              const d = e.data as { pk_id: string; from_room: string; from_host: string };
              setPkInvite({ pk_id: d.pk_id, from_room: d.from_room, from_host: d.from_host });
            }
            break;
          case 'error':
            push({ id: `${Date.now()}`, user_id: '', handle: '', display_name: '', text: e.data.message, kind: 'system' });
            break;
        }
      },
    });
    sock.current = s;
    s.connect();
    return () => {
      s.close();
      sock.current = null;
    };
  }, [roomId]);

  return {
    state,
    chat,
    viewers,
    goal,
    gifts,
    pk,
    pkInvite,
    ended,
    send: (t) => {
      const ok = sock.current?.sendChat(t) ?? false;
      return ok;
    },
    dismissGift: (key) => setGifts((g) => g.filter((x) => x.key !== key)),
    clearInvite: () => setPkInvite(null),
  };
}
