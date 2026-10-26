const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/**
 * "just now", "12 minutes ago", "3 hours ago", "yesterday", "5 days ago".
 * Returns '' for an invalid timestamp rather than throwing (Intl throws on NaN).
 */
export function relativeTime(thenMs: number, nowMs: number = Date.now()): string {
  if (!Number.isFinite(thenMs) || !Number.isFinite(nowMs)) return '';
  const age = Math.max(0, nowMs - thenMs);
  if (age < MINUTE) return 'just now';
  if (age < HOUR) return formatter.format(-Math.floor(age / MINUTE), 'minute');
  if (age < DAY) return formatter.format(-Math.floor(age / HOUR), 'hour');
  return formatter.format(-Math.floor(age / DAY), 'day');
}
