import { readFileSync } from 'node:fs';
import * as Astronomy from 'astronomy-engine';
import {
  altAz,
  gmstDeg,
  j2000ToHorizontalMatrix,
  julianDate,
  multiply,
  projectSouth,
  raDecToVector,
  sunHorizontal,
  sunRaDec,
  wrap360,
} from './sky-math';
import { CINCINNATI } from './sky.service';
import { StarFile } from './sky-render';

const { lat, lon } = CINCINNATI;
/** Signed difference between two angles, in degrees. */
const angleDiff = (a: number, b: number) => ((a - b + 540) % 360) - 180;
const starAltAz = (ra: number, dec: number, date: Date) => altAz(multiply(j2000ToHorizontalMatrix(date, lat, lon), raDecToVector(ra, dec)));

/** The same star placed by astronomy-engine (precession and nutation of date, no refraction). */
function referenceAltAz(ra: number, dec: number, date: Date) {
  Astronomy.DefineStar(Astronomy.Body.Star1, ra / 15, dec, 1000);
  const observer = new Astronomy.Observer(lat, lon, 0);
  const eq = Astronomy.Equator(Astronomy.Body.Star1, date, observer, true, false);
  const hor = Astronomy.Horizon(date, observer, eq.ra, eq.dec);
  return { alt: hor.altitude, az: hor.azimuth };
}

describe('sky math', () => {
  it('Julian Date and sidereal time match the J2000 epoch', () => {
    const epoch = new Date('2000-01-01T12:00:00Z');
    expect(julianDate(epoch)).toBe(2451545);
    expect(gmstDeg(epoch)).toBeCloseTo(280.46061837, 6);
  });

  it('sidereal time agrees with astronomy-engine today', () => {
    const date = new Date('2026-10-26T03:00:00Z');
    expect(Math.abs(angleDiff(gmstDeg(date), Astronomy.SiderealTime(date) * 15))).toBeLessThan(0.01);
  });

  it('Polaris sits at about the observer\'s latitude, due north', () => {
    const [ra, dec] = [37.9545, 89.2641]; // Polaris, J2000
    for (const iso of ['2026-01-15T04:00:00Z', '2026-07-01T12:00:00Z']) {
      const { alt, az } = starAltAz(ra, dec, new Date(iso));
      expect(Math.abs(alt - lat)).toBeLessThan(1);
      expect(Math.abs(angleDiff(az, 0))).toBeLessThan(1.5);
    }
  });

  it('places catalogue stars where astronomy-engine does, to within 0.05°', () => {
    const date = new Date('2026-01-15T04:00:00Z');
    const stars = [
      [88.7929, 7.4071], // Betelgeuse
      [101.2872, -16.7161], // Sirius
      [165.932, 61.751], // Dubhe
      [279.235, 38.784], // Vega
    ];
    for (const [ra, dec] of stars) {
      const ours = starAltAz(ra, dec, date);
      const reference = referenceAltAz(ra, dec, date);
      expect(Math.abs(ours.alt - reference.alt)).toBeLessThan(0.05);
      // Azimuth is meaningless near the zenith; these stars are well clear of it.
      expect(Math.abs(angleDiff(ours.az, reference.az)) * Math.cos((ours.alt * Math.PI) / 180)).toBeLessThan(0.05);
    }
  });

  it('puts Orion high in the south on a January night', () => {
    const { alt, az } = starAltAz(88.7929, 7.4071, new Date('2026-01-15T04:00:00Z')); // Betelgeuse, 11 pm EST
    expect(alt).toBeGreaterThan(40);
    expect(az).toBeGreaterThan(140);
    expect(az).toBeLessThan(220);
  });

  it('the low-precision Sun agrees with astronomy-engine to within 0.05°', () => {
    for (const iso of ['2026-03-20T15:00:00Z', '2026-06-21T17:30:00Z', '2026-10-26T03:00:00Z']) {
      const date = new Date(iso);
      const ours = sunRaDec(date);
      const reference = Astronomy.Equator(Astronomy.Body.Sun, date, new Astronomy.Observer(lat, lon, 0), true, true);
      expect(Math.abs(angleDiff(ours.ra, reference.ra * 15))).toBeLessThan(0.05);
      expect(Math.abs(ours.dec - reference.dec)).toBeLessThan(0.05);
    }
  });

  it('the Sun is high at a summer noon and well down at midnight', () => {
    expect(altAz(sunHorizontal(new Date('2026-06-21T17:30:00Z'), lat, lon)).alt).toBeGreaterThan(70);
    expect(altAz(sunHorizontal(new Date('2026-06-22T05:30:00Z'), lat, lon)).alt).toBeLessThan(-20);
  });

  it('projects facing south: horizon through the middle, east on the left, zenith above', () => {
    const at = (n: number, e: number, u: number) => {
      const p = projectSouth([n, e, u]);
      return p && [p.x + 0, p.y + 0]; // + 0 turns -0 into 0
    };
    expect(at(-1, 0, 0)).toEqual([0, 0]); // due south on the horizon
    expect(at(0, 1, 0)).toEqual([-2, 0]); // east
    expect(at(0, -1, 0)).toEqual([2, 0]); // west
    expect(at(0, 0, 1)).toEqual([0, 2]); // zenith
    expect(at(1, 0, 0)).toBeNull(); // north, behind the viewer
  });

  it('wraps angles into [0, 360)', () => {
    expect(wrap360(-30)).toBe(330);
    expect(wrap360(725)).toBe(5);
  });
});

describe('sky data', () => {
  const stars = JSON.parse(readFileSync('public/data/sky/stars.json', 'utf8')) as StarFile;
  const constellations = JSON.parse(readFileSync('public/data/sky/constellations.json', 'utf8')) as {
    constellations: { id: string; lines: [number, number][][] }[];
  };

  it('has the bright stars down to magnitude 4.5, brightest first', () => {
    expect(stars.magLimit).toBe(4.5);
    expect(stars.stars.length).toBeGreaterThan(800);
    expect(stars.stars.every(([ra, dec, mag]) => ra >= 0 && ra < 360 && Math.abs(dec) <= 90 && mag <= 4.5)).toBe(true);
    const sirius = stars.stars[0];
    expect(sirius[0]).toBeCloseTo(101.287, 2);
    expect(sirius[2]).toBeCloseTo(-1.44, 2);
  });

  it('has 30 constellations, each with lines', () => {
    expect(constellations.constellations.length).toBe(30);
    expect(constellations.constellations.every(c => c.lines.length > 0)).toBe(true);
  });

  it('the Big Dipper connects the right seven stars, in order', () => {
    const dipper = {
      alkaid: [206.885, 49.313],
      mizar: [200.981, 54.925],
      alioth: [193.507, 55.96],
      megrez: [183.857, 57.033],
      dubhe: [165.932, 61.751],
      merak: [165.46, 56.382],
      phecda: [178.458, 53.695],
    } as const;
    const edges: [keyof typeof dipper, keyof typeof dipper][] = [
      ['alkaid', 'mizar'], ['mizar', 'alioth'], ['alioth', 'megrez'], ['megrez', 'dubhe'],
      ['dubhe', 'merak'], ['merak', 'phecda'], ['phecda', 'megrez'],
    ];
    const uma = constellations.constellations.find(c => c.id === 'UMa')!;
    const near = (p: readonly number[], q: readonly number[]) => Math.abs(p[0] - q[0]) < 0.05 && Math.abs(p[1] - q[1]) < 0.05;
    const segments = uma.lines.flatMap(line => line.slice(1).map((p, i) => [line[i], p] as const));
    for (const [a, b] of edges) {
      const found = segments.some(([p, q]) => (near(p, dipper[a]) && near(q, dipper[b])) || (near(p, dipper[b]) && near(q, dipper[a])));
      expect(found, `${a}–${b}`).toBe(true);
    }
  });
});
