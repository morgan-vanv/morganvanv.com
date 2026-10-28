import * as astro from 'astronomy-engine';
import { readFileSync } from 'node:fs';
import { prepareCatalog } from './sky-render';
import { BRIGHT_MOON, CLEAR_ALT, SHOWERS, STAR_CLEAR_ALT, showerNear, tonight } from './sky-tonight';

const catalog = prepareCatalog(
  JSON.parse(readFileSync('public/data/sky/stars.json', 'utf8')),
  JSON.parse(readFileSync('public/data/sky/constellations.json', 'utf8')),
  JSON.parse(readFileSync('public/data/sky/names.json', 'utf8')),
);

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
      .toEqual({ dark: false, start: null, end: null, primeTime: null, moon: null, planets: [], stars: [], constellations: [], shower: null });
  });

  it('has no dawn in a polar night, and counts the night as 12 hours', () => {
    const now = new Date('2026-12-21T12:00:00Z');
    const night = tonight(astro, now, 78.2, 15.6);
    expect(night).toMatchObject({ dark: true, start: now, end: null });
    expect(Math.max(...night.planets.map(p => hours(now, p.until)))).toBe(12);
  });

  it('knows the Moon tonight: when it\'s up, how lit, and whether it drowns the faint stars', () => {
    // 27 October 2026: a 95% Moon rises about 8:20 pm EDT and is up the rest of the night.
    const night = tonight(astro, new Date('2026-10-27T16:00:00Z'), ...CINCINNATI);
    expect(night.moon?.illuminated).toBeGreaterThan(0.9);
    expect(night.moon?.up).toMatchObject({ upAtStart: false, upAtEnd: true });
    expect(night.moon?.up?.from.toISOString()).toMatch(/^2026-10-28T00:[123]/);
    expect(night.moon?.up?.peakAlt).toBeGreaterThan(50);
    expect(night.moon?.bright).toBe(true);
    // Prime time is two hours into the night by day, now once it's dark.
    expect(hours(night.start!, night.primeTime!)).toBe(2);
    const now = new Date('2026-10-28T03:00:00Z');
    expect(tonight(astro, now, ...CINCINNATI).primeTime).toEqual(now);
    // A new Moon (10 November 2026) isn't bright, whether or not it's up.
    const dark = tonight(astro, new Date('2026-11-10T16:00:00Z'), ...CINCINNATI);
    expect(dark.moon?.illuminated).toBeLessThan(BRIGHT_MOON);
    expect(dark.moon?.bright).toBe(false);
  });

  it('gives each planet its best hour', () => {
    const night = tonight(astro, new Date('2026-10-27T16:00:00Z'), ...CINCINNATI);
    const saturn = night.planets.find(p => p.name === 'Saturn')!;
    // Saturn crosses the meridian a little before midnight EDT that night.
    expect(saturn.peak.toISOString()).toMatch(/^2026-10-28T0[34]:/);
    expect(saturn.peakAlt).toBeGreaterThan(saturn.altAtStart);
    expect(saturn.peak.getTime()).toBeGreaterThanOrEqual(saturn.from.getTime());
    expect(saturn.peak.getTime()).toBeLessThanOrEqual(saturn.until.getTime());
  });

  it('with the catalog, names the brightest stars and the constellations overhead at prime time', () => {
    const night = tonight(astro, new Date('2026-10-27T16:00:00Z'), ...CINCINNATI, catalog);
    // Late October, 9 pm: Vega and Capella are the brightest well up; Arcturus and Sirius are down.
    expect(night.stars.length).toBe(3);
    expect(night.stars.map(s => s.name)).toContain('Vega');
    expect(night.stars.map(s => s.name)).not.toContain('Sirius');
    expect(night.stars.map(s => s.name)).not.toContain('Arcturus');
    for (const s of night.stars) expect(s.alt).toBeGreaterThanOrEqual(STAR_CLEAR_ALT);
    expect(night.stars[0].mag).toBeLessThanOrEqual(night.stars[1].mag);
    expect(night.constellations.length).toBe(3);
    expect(night.constellations).toContain('Cygnus');
    // Without the catalog there are no such lists.
    expect(tonight(astro, new Date('2026-10-27T16:00:00Z'), ...CINCINNATI).stars).toEqual([]);
  });

  it('mentions a meteor shower peaking within a couple of days, and none otherwise', () => {
    expect(showerNear(new Date('2026-08-11T23:00:00Z'))?.name).toBe('Perseids');
    expect(showerNear(new Date('2026-08-14T23:00:00Z'))?.name).toBe('Perseids');
    expect(showerNear(new Date('2026-08-16T23:00:00Z'))).toBeNull();
    expect(showerNear(new Date('2026-12-31T23:00:00Z'))).toBeNull();
    expect(showerNear(new Date('2027-01-02T23:00:00Z'))?.name).toBe('Quadrantids'); // across the new year
    expect(showerNear(new Date('2026-10-20T23:00:00Z'))).toMatchObject({ name: 'Orionids', rate: 20 });
    expect(tonight(astro, new Date('2026-10-27T16:00:00Z'), ...CINCINNATI).shower).toBeNull();
    expect(SHOWERS.length).toBe(8);
  });
});
