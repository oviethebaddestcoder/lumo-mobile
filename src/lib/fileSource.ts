import { File } from 'expo-file-system';
import type { ChunkSource } from './uploader';

/**
 * Reads a local video in chunks without loading the whole file into JS
 * memory. Reads are serialised because the native handle has one cursor.
 */
export function fileChunkSource(uri: string): ChunkSource {
  const file = new File(uri);
  const handle = file.open();
  const size = file.size;
  let queue: Promise<unknown> = Promise.resolve();
  let closed = false;

  return {
    size,
    read(offset, length) {
      const run = async () => {
        if (closed) throw new Error('file closed');
        handle.offset = offset;
        return handle.readBytes(length);
      };
      const p = queue.then(run, run);
      queue = p.catch(() => undefined);
      return p;
    },
    close() {
      if (closed) return;
      closed = true;
      void queue.finally(() => handle.close());
    },
  };
}
