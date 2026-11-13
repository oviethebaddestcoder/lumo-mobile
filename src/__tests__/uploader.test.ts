import { uploadVideo, contentTypeFor, type ChunkSource } from '@/lib/uploader';
import type { UploadStart, UploadedPart } from '@/lib/api/types';

function source(size: number): ChunkSource & { reads: [number, number][]; closed: boolean } {
  const s = {
    size,
    reads: [] as [number, number][],
    closed: false,
    read: async (offset: number, length: number) => {
      s.reads.push([offset, length]);
      return new Uint8Array(length).fill(offset % 251);
    },
    close: () => {
      s.closed = true;
    },
  };
  return s;
}

const MiB = 1024 * 1024;

function media(parts: number, partSize: number, firstBatch = Math.min(parts, 100)) {
  const urlsFetched: [number, number][] = [];
  let completed: UploadedPart[] | null = null;
  const start: UploadStart = {
    video_id: 'v1',
    part_size: partSize,
    parts,
    part_urls: Array.from({ length: firstBatch }, (_, i) => `https://s3/part/${i + 1}?sig=1`),
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  };
  return {
    urlsFetched,
    get completed() {
      return completed;
    },
    api: {
      startUpload: jest.fn(async () => start),
      partUrls: jest.fn(async (_id: string, from: number, to: number) => {
        urlsFetched.push([from, to]);
        return { from, part_urls: Array.from({ length: to - from + 1 }, (_, i) => `https://s3/part/${from + i}?sig=2`) };
      }),
      completeUpload: jest.fn(async (_id: string, p: UploadedPart[]) => {
        completed = p;
        return { id: 'v1', status: 'processing' } as never;
      }),
    },
  };
}

const ok = (n: number) => new Response(null, { status: 200, headers: { ETag: `"etag-${n}"` } });
const partOf = (url: string) => Number(/part\/(\d+)/.exec(url)![1]);

describe('multipart uploader', () => {
  it('splits the file into parts, collects ETags in order and completes', async () => {
    const size = 40 * MiB + 123; // 3 parts at 16 MiB
    const m = media(3, 16 * MiB);
    const src = source(size);
    const progress: number[] = [];
    const fetchFn = jest.fn(async (url: RequestInfo | URL) => ok(partOf(String(url)))) as unknown as typeof fetch;

    await uploadVideo({
      media: m.api,
      source: src,
      input: { kind: 'short', content_type: 'video/mp4', title: 't', description: '', visibility: 'public' },
      fetchFn,
      onProgress: (p) => progress.push(p.sentBytes),
      concurrency: 2,
    });

    expect(m.api.startUpload).toHaveBeenCalledWith(expect.objectContaining({ size_bytes: size }));
    expect(src.reads.sort((a, b) => a[0] - b[0])).toEqual([
      [0, 16 * MiB],
      [16 * MiB, 16 * MiB],
      [32 * MiB, 8 * MiB + 123],
    ]);
    expect(m.completed).toEqual([
      { number: 1, etag: '"etag-1"' },
      { number: 2, etag: '"etag-2"' },
      { number: 3, etag: '"etag-3"' },
    ]);
    expect(progress.at(-1)).toBe(size);
    expect(src.closed).toBe(true);
  });

  it('fetches URLs for parts beyond the first batch', async () => {
    const m = media(250, 1, 100);
    const fetchFn = jest.fn(async (url: RequestInfo | URL) => ok(partOf(String(url)))) as unknown as typeof fetch;
    await uploadVideo({
      media: m.api,
      source: source(250),
      input: { kind: 'long', content_type: 'video/mp4', title: '', description: '', visibility: 'public' },
      fetchFn,
      concurrency: 4,
    });
    expect(m.completed).toHaveLength(250);
    // Batches never exceed the server's 200-per-call limit.
    for (const [from, to] of m.urlsFetched) expect(to - from).toBeLessThan(200);
    expect(m.urlsFetched[0]![0]).toBe(101);
  });

  it('retries a part with a fresh URL after a 403 (expired signature)', async () => {
    const m = media(2, 4);
    let first = true;
    const fetchFn = jest.fn(async (url: RequestInfo | URL) => {
      const n = partOf(String(url));
      if (n === 2 && first) {
        first = false;
        return new Response('expired', { status: 403 });
      }
      return ok(n);
    }) as unknown as typeof fetch;
    await uploadVideo({
      media: m.api,
      source: source(8),
      input: { kind: 'short', content_type: 'video/mp4', title: '', description: '', visibility: 'public' },
      fetchFn,
      retries: 2,
    });
    expect(m.api.partUrls).toHaveBeenCalledWith('v1', 2, 2);
    expect(m.completed).toHaveLength(2);
  }, 10_000);

  it('fails without completing when a part keeps failing', async () => {
    const m = media(1, 4);
    const fetchFn = jest.fn(async () => new Response('nope', { status: 500 })) as unknown as typeof fetch;
    await expect(
      uploadVideo({
        media: m.api,
        source: source(4),
        input: { kind: 'short', content_type: 'video/mp4', title: '', description: '', visibility: 'public' },
        fetchFn,
        retries: 1,
      }),
    ).rejects.toMatchObject({ code: 'upload_part_failed' });
    expect(m.api.completeUpload).not.toHaveBeenCalled();
  }, 10_000);

  it('maps content types', () => {
    expect(contentTypeFor('video/quicktime', 'a.mov')).toBe('video/quicktime');
    expect(contentTypeFor(undefined, 'file:///x/clip.MOV')).toBe('video/quicktime');
    expect(contentTypeFor(undefined, 'clip.webm')).toBe('video/webm');
    expect(contentTypeFor('video/mp4', 'clip')).toBe('video/mp4');
  });
});
