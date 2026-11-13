import type { Connection, Room } from './api/types';

/**
 * Short-lived hand-off of values between screens that should not travel in
 * route params (tokens, local file URIs with metadata).
 */
const hosting = new Map<string, { room: Room; connection: Connection }>();
export const hostHandoff = {
  put: (room: Room, connection: Connection) => hosting.set(room.id, { room, connection }),
  take: (roomId: string) => {
    const v = hosting.get(roomId);
    hosting.delete(roomId);
    return v;
  },
};

export interface PickedVideo {
  uri: string;
  mimeType?: string;
  fileSize?: number;
  durationMs?: number | null;
  width?: number;
  height?: number;
}
let picked: PickedVideo | null = null;
export const uploadHandoff = {
  put: (v: PickedVideo) => {
    picked = v;
  },
  take: () => {
    const v = picked;
    picked = null;
    return v;
  },
};
