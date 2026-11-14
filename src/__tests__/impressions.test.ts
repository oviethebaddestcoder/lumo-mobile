import { impressionFor } from '@/lib/hooks';

describe('impressionFor', () => {
  const item = { id: 'v1', duration_ms: 15_000, rec_source: 'co', rec_arm: 'b' };

  it('marks fast swipes as skipped and echoes the ranking metadata', () => {
    expect(impressionFor(item, 400, 'foryou', false)).toEqual({
      video_id: 'v1',
      watch_ms: 400,
      skipped: true,
      shared: undefined,
      source: 'co',
      arm: 'b',
      surface: 'foryou',
    });
  });

  it('does not mark a watched video skipped, and carries shares', () => {
    const imp = impressionFor(item, 15_000, 'foryou', true);
    expect(imp.skipped).toBe(false);
    expect(imp.shared).toBe(true);
  });

  it('never calls a sub-3s clip skipped just for being short', () => {
    expect(impressionFor({ id: 'v2', duration_ms: 2500 }, 800, 'foryou', false).skipped).toBe(false);
  });
});
