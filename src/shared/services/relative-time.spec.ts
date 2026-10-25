import { relativeTime } from './relative-time';

const NOW = Date.UTC(2026, 9, 25, 12, 0, 0);
const min = (n: number) => n * 60_000;

describe('relativeTime', () => {
  it('says "just now" inside a minute, including slightly-future timestamps', () => {
    expect(relativeTime(NOW - 10_000, NOW)).toBe('just now');
    expect(relativeTime(NOW + 5_000, NOW)).toBe('just now');
  });

  it('counts minutes, hours and days', () => {
    expect(relativeTime(NOW - min(1), NOW)).toBe('1 minute ago');
    expect(relativeTime(NOW - min(12), NOW)).toBe('12 minutes ago');
    expect(relativeTime(NOW - min(60), NOW)).toBe('1 hour ago');
    expect(relativeTime(NOW - min(3 * 60 + 20), NOW)).toBe('3 hours ago');
    expect(relativeTime(NOW - min(24 * 60), NOW)).toBe('yesterday');
    expect(relativeTime(NOW - min(5 * 24 * 60), NOW)).toBe('5 days ago');
  });
});
