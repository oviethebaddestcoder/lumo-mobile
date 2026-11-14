export function compact(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const abs = Math.abs(n);
  if (abs >= 1e9) return trim(n / 1e9) + 'B';
  if (abs >= 1e6) return trim(n / 1e6) + 'M';
  if (abs >= 1e4) return trim(n / 1e3) + 'K';
  return n.toLocaleString('en-US');
}

const trim = (x: number) => (x >= 100 ? Math.round(x).toString() : x.toFixed(1).replace(/\.0$/, ''));

export function duration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return (h ? `${h}:` : '') + `${mm}:${String(sec).padStart(2, '0')}`;
}

export function timeAgo(iso: string, now = Date.now()): string {
  const t = Date.parse(iso);
  if (!t) return '';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d`;
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** YYYY-MM-DD from a Date, in local time (birthdays are calendar dates). */
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function ageOn(birth: string, now = new Date()): number {
  const [y, m, d] = birth.split('-').map(Number);
  if (!y || !m || !d) return 0;
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--;
  return age;
}

/** Push payloads from svc-notifier → app route. */
export function routeForPush(data: Record<string, unknown> | undefined): string | null {
  if (!data) return null;
  const s = (k: string) => (typeof data[k] === 'string' ? (data[k] as string) : '');
  switch (s('type')) {
    case 'follow':
      return s('user_id') ? `/user/${s('user_id')}` : null;
    case 'comment':
      return s('video_id') ? `/watch/${s('video_id')}?comments=1` : null;
    case 'likes':
      return s('video_id') ? `/watch/${s('video_id')}` : null;
    case 'live':
      return s('room_id') ? `/live/${s('room_id')}` : null;
    case 'dm':
      return s('conversation_id') ? `/chat/${s('conversation_id')}` : null;
    case 'payout':
      return '/wallet';
    default:
      return null;
  }
}
