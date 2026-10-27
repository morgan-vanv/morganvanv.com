import * as astro from 'astronomy-engine';
import { CLEAR_ALT, tonight } from './sky-tonight';

const CINCINNATI = [39.1, -84.51] as const;
const hours = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 3_600_000;

describe('tonight', () => {
  it('by day, runs from dusk to dawn, the planets up at dusk first', () => {
    // Noon in Cincinnati, 27 October 2026: Saturn is up at dusk, Jupiter and Mars rise after midnight.
    const night = tonight(astro, new Date('2026-10-27T16:00:00Z'), ...CINCINNATI);
    expect(night.dark).toBe(false);
    // Civil dusk about 7:10 pm EDT, dawn about 7:35 am.
    expect(night.start?.toISOString()).toMatch(/^2026-10-27T23:(0|1)/);
    expect(night.end?.toISOString()).toMatch(/^2026-10-28T11:(2|3|4)/);
    expect(night.planets.map(p => p.name)).toEqual(['Saturn', 'Jupiter', 'Mars']);

    const [saturn, jupiter] = night.planets;
    expect(saturn).toMatchObject({ upAtStart: true, upAtEnd: false });
    expect(saturn.from).toEqual(night.start);
    expect(hours(saturn.until, night.end!)).toBeGreaterThan(1);
    expect(jupiter).toMatchObject({ upAtStart: false, upAtEnd: true });
    expect(jupiter.until).toEqual(night.end);
  });

  it('leaves out a planet that only skims the horizon in twilight', () => {
    // Mercury is half a degree up at dusk that night, and sets straight after.
    const night = tonight(astro, new Date('2026-10-27T16:00:00Z'), ...CINCINNATI);
    expect(night.planets.some(p => p.name === 'Mercury')).toBe(false);
    expect(night.planets.every(p => !p.upAtStart || p.altAtStart > CLEAR_ALT)).toBe(true);
  });

  it('once it\'s dark, runs from now to dawn', () => {
    const now = new Date('2026-10-28T03:00:00Z');
    const night = tonight(astro, now, ...CINCINNATI);
    expect(night.dark).toBe(true);
    expect(night.start).toEqual(now);
    expect(night.end?.toISOString()).toMatch(/^2026-10-28T11:/);
    expect(night.planets[0]).toMatchObject({ name: 'Saturn', upAtStart: true });
    expect(night.planets[0].altAtStart).toBeGreaterThan(40);
  });

  it('has no night at all in a northern midsummer', () => {
    expect(tonight(astro, new Date('2026-06-21T12:00:00Z'), 69.6, 18.9))
      .toEqual({ dark: false, start: null, end: null, planets: [] });
  });

  it('has no dawn in a polar night, and counts the night as 12 hours', () => {
    const now = new Date('2026-12-21T12:00:00Z');
    const night = tonight(astro, now, 78.2, 15.6);
    expect(night).toMatchObject({ dark: true, start: now, end: null });
    expect(Math.max(...night.planets.map(p => hours(now, p.until)))).toBe(12);
  });
});
