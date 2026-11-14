import { ageOn, compact, duration, isoDate, routeForPush } from '@/lib/format';
import { parseQrPayload } from '@/lib/qr';

describe('format', () => {
  it('compacts counts', () => {
    expect(compact(999)).toBe('999');
    expect(compact(12_345)).toBe('12.3K');
    expect(compact(1_200_000)).toBe('1.2M');
    expect(compact(250_000_000)).toBe('250M');
    expect(compact(3_000_000_000)).toBe('3B');
  });

  it('formats durations', () => {
    expect(duration(5_000)).toBe('0:05');
    expect(duration(65_000)).toBe('1:05');
    expect(duration(3_725_000)).toBe('1:02:05');
  });

  it('computes age on a calendar date', () => {
    expect(ageOn('2008-06-15', new Date(2026, 5, 14))).toBe(17);
    expect(ageOn('2008-06-15', new Date(2026, 5, 15))).toBe(18);
    expect(isoDate(new Date(2026, 0, 9))).toBe('2026-01-09');
  });

  it('routes push payloads from svc-notifier', () => {
    expect(routeForPush({ type: 'follow', user_id: 'u1' })).toBe('/user/u1');
    expect(routeForPush({ type: 'comment', video_id: 'v1', comment_id: 'c1' })).toBe('/watch/v1?comments=1');
    expect(routeForPush({ type: 'live', room_id: 'r1' })).toBe('/live/r1');
    expect(routeForPush({ type: 'dm', conversation_id: 'c9' })).toBe('/chat/c9');
    expect(routeForPush({ type: 'payout', payout_id: 'p1' })).toBe('/wallet');
    expect(routeForPush({ type: 'unknown' })).toBeNull();
    expect(routeForPush(undefined)).toBeNull();
  });

  it('parses QR sign-in payloads strictly', () => {
    expect(parseQrPayload('lumo://qr-login?id=01HZXQ8K2M')).toBe('01HZXQ8K2M');
    expect(parseQrPayload('https://evil.example/qr-login?id=01HZXQ8K2M')).toBeNull();
    expect(parseQrPayload('lumo://qr-login?id=short')).toBeNull();
  });
});
