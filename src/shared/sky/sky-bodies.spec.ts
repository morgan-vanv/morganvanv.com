import * as Astronomy from 'astronomy-engine';
import { computeBodies } from './sky-bodies';
import { altAz, sunHorizontal } from './sky-math';
import { CINCINNATI } from './sky.service';

const angleBetween = (a: readonly number[], b: readonly number[]) =>
  (Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])) * 180) / Math.PI;

describe('sky bodies', () => {
  it('puts the Moon over the Sun at totality (Dayton, 8 April 2024)', () => {
    // Totality in Dayton was about 3:09 pm EDT. Compared against our own Sun
    // formula, which shares no code with astronomy-engine.
    const date = new Date('2024-04-08T19:09:00Z');
    const [lat, lon] = [39.76, -84.19];
    const bodies = computeBodies(Astronomy, date, lat, lon);
    expect(angleBetween(bodies.moon.h, sunHorizontal(date, lat, lon))).toBeLessThan(0.3);
    expect(bodies.moon.alt).toBeGreaterThan(40);
    expect(bodies.moon.phaseAngle).toBeGreaterThan(178);
  });

  it('the Moon is full and up on the night of 25 October 2026', () => {
    const bodies = computeBodies(Astronomy, new Date('2026-10-26T03:00:00Z'), CINCINNATI.lat, CINCINNATI.lon);
    expect(bodies.moon.phaseAngle).toBeLessThan(10);
    expect(bodies.moon.illuminated).toBeGreaterThan(0.98);
    expect(bodies.moon.alt).toBeGreaterThan(40);
    expect(bodies.sun.alt).toBeLessThan(-40);
  });

  it('returns the five naked-eye planets with sane magnitudes', () => {
    const bodies = computeBodies(Astronomy, new Date('2026-10-26T03:00:00Z'), CINCINNATI.lat, CINCINNATI.lon);
    expect(bodies.planets.map(p => p.name)).toEqual(['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']);
    for (const planet of bodies.planets) {
      expect(planet.mag).toBeGreaterThan(-5);
      expect(planet.mag).toBeLessThan(3);
      expect(altAz(planet.h).alt).toBeCloseTo(planet.alt, 6);
    }
  });
});
