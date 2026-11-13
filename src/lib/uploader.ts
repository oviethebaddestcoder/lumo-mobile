import type { Endpoints } from './api/endpoints';
import { ApiError, sleep } from './api/http';
import type { UploadContentType, UploadStartInput, UploadedPart, Video } from './api/types';

/** Random-access reader over the local file. */
export interface ChunkSource {
  readonly size: number;
  read(offset: number, length: number): Promise<Uint8Array>;
  close(): void;
}

export interface UploadProgress {
  sentBytes: number;
  totalBytes: number;
  partsDone: number;
  parts: number;
}

export interface UploadOptions {
  media: Pick<Endpoints['media'], 'startUpload' | 'partUrls' | 'completeUpload'>;
  source: ChunkSource;
  input: Omit<UploadStartInput, 'size_bytes'>;
  onProgress?: (p: UploadProgress) => void;
  signal?: AbortSignal;
  /** Parts in flight at once. Each holds one part (16 MiB) in memory. */
  concurrency?: number;
  retries?: number;
  fetchFn?: typeof fetch;
}

const URL_BATCH = 200; // the media service's max per /parts call

/**
 * S3 multipart upload through presigned URLs:
 *  1. POST /v1/media/uploads → part size, part count, first batch of URLs
 *  2. PUT each part to its URL, collect the ETag response header
 *  3. POST /complete with every {number, etag}
 * Parts retry independently; expired or missing URLs are re-fetched.
 */
export async function uploadVideo(o: UploadOptions): Promise<Video> {
  const fetchFn = o.fetchFn ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const concurrency = Math.max(1, o.concurrency ?? 2);
  const retries = o.retries ?? 4;
  const total = o.source.size;

  const start = await o.media.startUpload({ ...o.input, size_bytes: total });
  const urls = new Map<number, string>();
  start.part_urls.forEach((u, i) => urls.set(i + 1, u));
  let urlsExpireAt = start.expires_at * 1000;

  const etags = new Array<UploadedPart | undefined>(start.parts);
  let sent = 0;
  let done = 0;
  const report = () => o.onProgress?.({ sentBytes: sent, totalBytes: total, partsDone: done, parts: start.parts });
  report();

  async function urlFor(n: number, forceRefresh = false): Promise<string> {
    const stale = Date.now() > urlsExpireAt - 60_000;
    if (!forceRefresh && !stale && urls.has(n)) return urls.get(n)!;
    const to = Math.min(start.parts, n + URL_BATCH - 1);
    const res = await o.media.partUrls(start.video_id, n, to);
    res.part_urls.forEach((u, i) => urls.set(res.from + i, u));
    // Presigned URLs from /parts carry the same lifetime as the first batch.
    urlsExpireAt = Math.max(urlsExpireAt, Date.now() + 50 * 60_000);
    const u = urls.get(n);
    if (!u) throw new ApiError(500, 'upload_url_missing', 'Upload link missing. Try again.');
    return u;
  }

  async function putPart(n: number): Promise<void> {
    const offset = (n - 1) * start.part_size;
    const length = Math.min(start.part_size, total - offset);
    const bytes = await o.source.read(offset, length);
    for (let attempt = 0; ; attempt++) {
      if (o.signal?.aborted) throw new ApiError(0, 'aborted', 'Upload cancelled.');
      let res: Response | null = null;
      try {
        res = await fetchFn(await urlFor(n, attempt > 0), {
          method: 'PUT',
          body: bytes as unknown as BodyInit,
          signal: o.signal,
        });
      } catch (e) {
        if (o.signal?.aborted) throw new ApiError(0, 'aborted', 'Upload cancelled.');
        if (e instanceof ApiError && !e.retryable) throw e;
      }
      if (res?.ok) {
        const etag = res.headers.get('etag') ?? res.headers.get('ETag');
        if (!etag) throw new ApiError(500, 'upload_etag_missing', 'Storage did not confirm the upload.');
        etags[n - 1] = { number: n, etag };
        sent += length;
        done += 1;
        report();
        return;
      }
      // 403 is the usual "URL expired"; urlFor refetches on the next attempt.
      if (attempt >= retries) {
        throw new ApiError(res?.status ?? 0, 'upload_part_failed', `Part ${n} failed to upload. Try again.`);
      }
      await sleep(Math.min(8_000, 500 * 2 ** attempt));
    }
  }

  try {
    let next = 1;
    const worker = async () => {
      while (next <= start.parts) {
        const n = next++;
        await putPart(n);
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, start.parts) }, worker));
  } finally {
    o.source.close();
  }

  const parts = etags.filter((p): p is UploadedPart => !!p);
  if (parts.length !== start.parts) throw new ApiError(500, 'upload_incomplete', 'Some parts are missing. Try again.');
  return o.media.completeUpload(start.video_id, parts);
}

export function contentTypeFor(mime: string | undefined, uri: string): UploadContentType {
  const m = (mime ?? '').toLowerCase();
  if (m === 'video/quicktime' || /\.mov$/i.test(uri)) return 'video/quicktime';
  if (m === 'video/webm' || /\.webm$/i.test(uri)) return 'video/webm';
  return 'video/mp4';
}
