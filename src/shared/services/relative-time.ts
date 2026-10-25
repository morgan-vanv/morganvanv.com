const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** "just now", "12 minutes ago", "3 hours ago", "yesterday", "5 days ago". */
export function relativeTime(thenMs: number, nowMs: number = Date.now()): string {
  const age = Math.max(0, nowMs - thenMs);
  if (age < MINUTE) return 'just now';
  if (age < HOUR) return formatter.format(-Math.floor(age / MINUTE), 'minute');
  if (age < DAY) return formatter.format(-Math.floor(age / HOUR), 'hour');
  return formatter.format(-Math.floor(age / DAY), 'day');
}
