import { readFileSync } from 'node:fs';
import { j2000ToHorizontalMatrix, raDecToVector } from './sky-math';
import { NameFile, StarFile, computeLayout, prepareCatalog, renderSky } from './sky-render';
import { CINCINNATI } from './sky.service';
import {
  StarOnScreen,
  UnnamedStar,
  angularSeparation,
  approveRow,
  brightest,
  makeSuggestion,
  monthLabel,
  monthStamp,
  nearestNamed,
  nearestTo,
  parseVisitorNames,
  sameStar,
  starTitle,
  starsOnScreen,
  stepStar,
  suggestionBody,
  suggestionText,
  unnamedStars,
  visitorDetail,
  visitorHoverNames,
  visitorMenuLine,
  visitorNames,
} from './sky-naming';

const stars: StarFile = JSON.parse(readFileSync('public/data/sky/stars.json', 'utf8'));
const names: NameFile = JSON.parse(readFileSync('public/data/sky/names.json', 'utf8'));
const constellations = JSON.parse(readFileSync('public/data/sky/constellations.json', 'utf8'));
const visitorFile = JSON.parse(readFileSync('public/data/sky/visitor-names.json', 'utf8'));

/** The unnamed star beside Vega (ζ¹ Lyrae), used throughout. */
const NEAR_VEGA = { ra: 281.193, dec: 37.605 };
/** A night when Lyra is high over Cincinnati. */
const NIGHT = new Date('2026-10-28T01:00:00Z');

const fake = (ra: number, dec: number, mag: number): UnnamedStar => ({ ra, dec, mag, v: raDecToVector(ra, dec), near: null });
const at = (star: UnnamedStar, x: number, y: number): StarOnScreen => ({ star, x, y });

describe('sky naming', () => {
  it('ships an empty visitor-names file in the documented format', () => {
    expect(visitorFile.format).toBe('[raDeg, decDeg, name, namedBy|null, added YYYY-MM]');
    expect(visitorFile.names).toEqual([]);
    expect(parseVisitorNames(visitorFile)).toEqual([]);
  });

  it('finds the 766 stars in the catalogue that have no proper name, brightest first', () => {
    const unnamed = unnamedStars(stars, names, []);
    expect(unnamed.length).toBe(766);
    expect(unnamed.length).toBe(stars.stars.length - names.names.length);
    for (let i = 1; i < unnamed.length; i++) expect(unnamed[i].mag).toBeGreaterThanOrEqual(unnamed[i - 1].mag);
    // None of them is a named star.
    const vega = names.names.find(n => n[2] === 'Vega')!;
    expect(unnamed.some(s => sameStar(s.ra, s.dec, vega[0], vega[1]))).toBe(false);
  });

  it('a star a visitor has named is no longer offered', () => {
    const rows = parseVisitorNames({ names: [[NEAR_VEGA.ra, NEAR_VEGA.dec, 'Gerald', 'sam', '2026-10']] });
    const unnamed = unnamedStars(stars, names, rows);
    expect(unnamed.length).toBe(765);
    expect(unnamed.some(s => sameStar(s.ra, s.dec, NEAR_VEGA.ra, NEAR_VEGA.dec))).toBe(false);
  });

  it('offers nothing without the names file (every star would look unnamed)', () => {
    expect(unnamedStars(stars, undefined, [])).toEqual([]);
  });

  it('matches stars within 0.01°, across RA 0/360', () => {
    expect(sameStar(10, 20, 10.009, 19.991)).toBe(true);
    expect(sameStar(10, 20, 10.02, 20)).toBe(false);
    expect(sameStar(359.995, 5, 0.004, 5)).toBe(true);
  });

  it('measures angles on the sky and names the nearest named star', () => {
    expect(angularSeparation(raDecToVector(0, 0), raDecToVector(90, 0))).toBeCloseTo(90, 6);
    expect(angularSeparation(raDecToVector(10, 89), raDecToVector(190, 89))).toBeCloseTo(2, 6);
    const named = names.names.map(([ra, dec, name]) => ({ v: raDecToVector(ra, dec), name }));
    expect(nearestNamed(raDecToVector(NEAR_VEGA.ra, NEAR_VEGA.dec), named)).toBe('Vega');
    expect(nearestNamed(raDecToVector(0, 0), [])).toBeNull();
    const star = unnamedStars(stars, names, []).find(s => sameStar(s.ra, s.dec, NEAR_VEGA.ra, NEAR_VEGA.dec))!;
    expect(star.near).toBe('Vega');
    expect(star.mag).toBe(4.34);
    expect(starTitle(star)).toBe('an unnamed star near Vega');
    expect(starTitle({ near: null })).toBe('an unnamed star');
  });

  it('skips malformed visitor rows rather than failing', () => {
    const rows = parseVisitorNames({
      names: [
        [281.193, 37.605, 'Gerald', 'sam', '2026-10'],
        [10, 20, 'Pat', null, '2026-11'],
        [10, 20, '', null, '2026-11'],
        [10, 95, 'Too far north', null, '2026-11'],
        [10, 20, 'No month', null, 'October'],
        ['10', 20, 'String RA', null, '2026-11'],
        'nonsense',
      ],
    });
    expect(rows.map(r => r[2])).toEqual(['Gerald', 'Pat']);
    expect(parseVisitorNames(null)).toEqual([]);
    expect(parseVisitorNames({ names: 'x' })).toEqual([]);
  });

  it('labels visitor names for hover and for the ☾ menu', () => {
    const [gerald, pat] = visitorNames(parseVisitorNames({
      names: [[281.193, 37.605, 'Gerald', 'sam', '2026-10'], [281.193, 37.605, 'Pat', null, '2027-01']],
    }), names);
    expect(gerald).toEqual({ ra: 281.193, dec: 37.605, name: 'Gerald', credit: 'sam', added: '2026-10', near: 'Vega' });
    expect(visitorDetail(gerald)).toBe('named by sam, Oct 2026');
    expect(visitorDetail(pat)).toBe('named by a visitor, Jan 2027');
    expect(visitorMenuLine(gerald)).toBe('Gerald · near Vega · by sam');
    expect(visitorMenuLine(pat)).toBe('Pat · near Vega · by a visitor');
    expect(visitorHoverNames([gerald])).toEqual([{ ra: 281.193, dec: 37.605, name: 'Gerald', detail: 'named by sam, Oct 2026' }]);
  });

  it('a visitor-named star becomes a hover target with its label', () => {
    const layout = computeLayout(1280, 800);
    const toHorizontal = j2000ToHorizontalMatrix(NIGHT, CINCINNATI.lat, CINCINNATI.lon);
    // Whichever unnamed star is on screen that night (Vega's neighbour is overhead, off the top).
    const { star } = starsOnScreen(unnamedStars(stars, names, []), layout, toHorizontal)[0];
    const [entry] = visitorNames(parseVisitorNames({ names: [[star.ra, star.dec, 'Gerald', 'sam', '2026-10']] }), names);
    const catalog = prepareCatalog(stars, constellations, names, visitorHoverNames([entry]));
    const result = renderSky(new Uint8ClampedArray(layout.width * layout.height * 4), layout, {
      date: NIGHT, lat: CINCINNATI.lat, lon: CINCINNATI.lon, catalog, bodies: null, lighting: 'darkness',
    });
    const target = result.targets.find(t => t.name === 'Gerald');
    expect(target).toBeTruthy();
    expect(target!.detail).toBe('named by sam, Oct 2026');
    expect(result.starVisibility).toBe(1);
  });

  it('months: stamps and labels', () => {
    expect(monthStamp(new Date(2026, 9, 27))).toBe('2026-10');
    expect(monthStamp(new Date(2027, 0, 3))).toBe('2027-01');
    expect(monthLabel('2026-10')).toBe('Oct 2026');
  });

  describe('on screen', () => {
    const layout = computeLayout(1440, 900);
    const toHorizontal = j2000ToHorizontalMatrix(NIGHT, CINCINNATI.lat, CINCINNATI.lon);
    const unnamed = unnamedStars(stars, names, []);

    it('lists the unnamed stars that are up and on screen, left to right', () => {
      const list = starsOnScreen(unnamed, layout, toHorizontal);
      expect(list.length).toBeGreaterThan(50);
      expect(list.length).toBeLessThan(unnamed.length);
      for (let i = 1; i < list.length; i++) expect(list[i].x).toBeGreaterThanOrEqual(list[i - 1].x);
      for (const { x, y } of list) {
        expect(x).toBeGreaterThanOrEqual(8);
        expect(y).toBeGreaterThanOrEqual(8);
        expect(x).toBeLessThanOrEqual(layout.width - 8);
        expect(y).toBeLessThanOrEqual(layout.height - 8);
      }
      // Vega's neighbour is nearly overhead tonight: above the top of a landscape screen.
      expect(list.some(s => sameStar(s.star.ra, s.star.dec, NEAR_VEGA.ra, NEAR_VEGA.dec))).toBe(false);
    });

    it('a portrait screen reaches the zenith, so it shows stars a landscape one can\'t', () => {
      const early = j2000ToHorizontalMatrix(new Date('2026-10-27T23:30:00Z'), CINCINNATI.lat, CINCINNATI.lon);
      const phone = starsOnScreen(unnamed, computeLayout(390, 844), early);
      expect(phone.some(s => sameStar(s.star.ra, s.star.dec, NEAR_VEGA.ra, NEAR_VEGA.dec))).toBe(true);
    });

    it('leaves out what the visitor can\'t see', () => {
      const all = starsOnScreen(unnamed, layout, toHorizontal);
      const topHalf = starsOnScreen(unnamed, layout, toHorizontal, (_x, y) => y > layout.height / 2);
      expect(topHalf.length).toBeLessThan(all.length);
      expect(topHalf.every(s => s.y <= layout.height / 2)).toBe(true);
    });
  });

  it('picks the brightest, the nearest within reach, and steps left to right with wrap', () => {
    const [a, b, c] = [fake(1, 0, 4.1), fake(2, 0, 3.2), fake(3, 0, 4.4)];
    const list = [at(a, 100, 100), at(b, 200, 120), at(c, 300, 90)];
    expect(brightest(list)?.star).toBe(b);
    expect(brightest([])).toBeNull();
    expect(nearestTo(list, 205, 130, 24)?.star).toBe(b);
    expect(nearestTo(list, 250, 300, 24)).toBeNull();
    expect(nearestTo(list, 140, 105, 70)?.star).toBe(a); // the nearer of two in reach
    expect(stepStar(list, b, 1)?.star).toBe(c);
    expect(stepStar(list, c, 1)?.star).toBe(a);
    expect(stepStar(list, a, -1)?.star).toBe(c);
    expect(stepStar(list, null, 1)?.star).toBe(a);
    expect(stepStar(list, fake(9, 9, 1), -1)?.star).toBe(c);
    expect(stepStar([], a, 1)).toBeNull();
  });

  describe('the suggestion', () => {
    const star = { ra: 281.193, dec: 37.605, mag: 4.34, near: 'Vega', v: raDecToVector(281.193, 37.605) };

    it('is the exact message Morgan gets, ending in the row to approve it', () => {
      const s = makeSuggestion('  Gerald ', ' sam ', star, new Date(2026, 9, 27))!;
      expect(suggestionText(s)).toBe([
        '⭐ Star name suggestion',
        '"Gerald" for the unnamed star near Vega (magnitude 4.3)',
        'named by: sam',
        'approve: [281.193, 37.605, "Gerald", "sam", "2026-10"]',
      ].join('\n'));
      // The approve line is exactly a valid visitor-names.json row.
      const row = JSON.parse(suggestionText(s).split('approve: ')[1]);
      expect(row).toEqual(approveRow(s));
      expect(parseVisitorNames({ names: [row] })).toEqual([row]);
    });

    it('says anonymous for a blank credit, and approves it with null', () => {
      const s = makeSuggestion('Gerald', '   ', star, new Date(2026, 9, 27))!;
      expect(s.credit).toBeNull();
      expect(suggestionText(s)).toContain('named by: anonymous');
      expect(suggestionText(s)).toContain('approve: [281.193, 37.605, "Gerald", null, "2026-10"]');
    });

    it('escapes quotes so the approve row stays valid JSON', () => {
      const s = makeSuggestion('The "Big" One', 'o\'neil', star, new Date(2026, 9, 27))!;
      const row = JSON.parse(suggestionText(s).split('approve: ')[1]);
      expect(row[2]).toBe('The "Big" One');
    });

    it('needs a name, and caps both fields at 24 characters', () => {
      expect(makeSuggestion('   ', 'sam', star, new Date())).toBeNull();
      const s = makeSuggestion('x'.repeat(40), 'y'.repeat(40), star, new Date())!;
      expect(s.name.length).toBe(24);
      expect(s.credit!.length).toBe(24);
    });

    it('posts a body today\'s function understands, with the details for a later one', () => {
      const s = makeSuggestion('Gerald', 'sam', star, new Date(2026, 9, 27))!;
      expect(suggestionBody(s)).toEqual({
        question: suggestionText(s),
        username_honey: '',
        kind: 'star',
        name: 'Gerald',
        credit: 'sam',
        star: { ra: 281.193, dec: 37.605, mag: 4.34, near: 'Vega' },
      });
    });
  });
});
