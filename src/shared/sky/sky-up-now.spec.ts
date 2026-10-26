import { readFileSync } from 'node:fs';
import * as Astronomy from 'astronomy-engine';
import { computeBodies } from './sky-bodies';
import { j2000ToHorizontalMatrix } from './sky-math';
import { prepareCatalog } from './sky-render';
import { CONSTELLATION_NAMES, upNow } from './sky-up-now';
import { CINCINNATI } from './sky.service';

const catalog = prepareCatalog(
  JSON.parse(readFileSync('public/data/sky/stars.json', 'utf8')),
  JSON.parse(readFileSync('public/data/sky/constellations.json', 'utf8')),
);
const { lat, lon } = CINCINNATI;
const at = (iso: string, withBodies = true) => {
  const date = new Date(iso);
  return upNow(withBodies ? computeBodies(Astronomy, date, lat, lon) : null, catalog, j2000ToHorizontalMatrix(date, lat, lon));
};

describe('upNow', () => {
  it('names every drawn constellation', () => {
    for (const { id } of catalog.figures) expect(CONSTELLATION_NAMES[id], id).toBeTruthy();
  });

  it('a January night: Orion is up, the planets above the horizon are listed brightest first', () => {
    const date = new Date('2026-01-15T04:00:00Z');
    const bodies = computeBodies(Astronomy, date, lat, lon);
    const up = at('2026-01-15T04:00:00Z');
    expect(up.constellations).toContain('Orion');
    expect(up.constellations.length).toBeLessThanOrEqual(4);
    const expected = bodies.planets.filter(p => p.alt > 0).sort((a, b) => a.mag - b.mag).map(p => p.name);
    expect(up.planets).toEqual(expected);
  });

  it('describes the Moon, up or down', () => {
    expect(at('2026-10-26T03:00:00Z').moon).toMatch(/^Moon, (99|100)% lit$/);
    expect(at('2026-10-26T16:30:00Z').moon).toMatch(/^Moon \(\d+% lit\) below the horizon$/);
    expect(at('2026-10-26T03:00:00Z', false).moon).toBeNull();
  });
});
