import { CREDIT_MAX_LENGTH, STAR_NAME_MAX_LENGTH, VisitorStar, capText, oneLine } from '../visitor-content/visitor-content';
import { Mat3, Vec3, altAz, multiply, raDecToVector, wrap360 } from './sky-math';
import { ExtraName, SkyLayout, StarFile, screenPoint } from './sky-render';

/**
 * Name a star: which stars can be named, where they are on screen, which one a
 * click or the ‹ › buttons pick, and the suggestion sent to Morgan. Pure (no
 * DOM), so it's tested like sky-math.ts and sky-render.ts.
 *
 * A star is nameable when it's in stars.json, has no proper name in
 * proper-names.json (every proper name d3-celestial knows, to magnitude 4.5;
 * names.json only has the bright ones the hover labels use) and hasn't been
 * named by a visitor already. Visitor names are one file each in content/stars/
 * (a merged "Publish as PR"), gathered at build time into VISITOR_STARS.
 */

/** Two catalogue entries closer than this in RA and Dec (degrees) are the same star. */
export const SAME_STAR_DEG = 0.01;

/** proper-names.json: every drawn star with a proper name. */
export interface ProperNameFile {
  /** [raDeg, decDeg, name], J2000 */
  readonly names: readonly (readonly [number, number, string])[];
}

/** A star without a name, ready to be named. */
export interface UnnamedStar {
  readonly ra: number;
  readonly dec: number;
  readonly mag: number;
  readonly v: Vec3;
  /** The nearest bright named star (one the sky labels on hover), for "an unnamed star near Vega"; null if none loaded. */
  readonly near: string | null;
}

/** A visitor-named star, for the ☾ menu and the hover labels. */
export interface VisitorName {
  readonly ra: number;
  readonly dec: number;
  readonly name: string;
  readonly credit: string | null;
  /** "YYYY-MM". */
  readonly added: string;
  readonly near: string | null;
}

/** An unnamed star on screen (layout units: buffer pixels from the renderer, or CSS pixels). */
export interface StarOnScreen {
  readonly star: UnnamedStar;
  readonly x: number;
  readonly y: number;
}

/** Same star? RA wraps at 360. */
export function sameStar(ra1: number, dec1: number, ra2: number, dec2: number): boolean {
  const dRa = Math.abs(((ra1 - ra2 + 540) % 360) - 180);
  return dRa <= SAME_STAR_DEG && Math.abs(dec1 - dec2) <= SAME_STAR_DEG;
}

/** Angle between two unit vectors, in degrees. */
export function angularSeparation(a: Vec3, b: Vec3): number {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI;
}

/** The named star nearest a direction on the sky, or null when there are none. */
export function nearestNamed(v: Vec3, names: readonly { readonly v: Vec3; readonly name: string }[]): string | null {
  let best: string | null = null;
  let bestAngle = Infinity;
  for (const named of names) {
    const angle = angularSeparation(v, named.v);
    if (angle < bestAngle) {
      best = named.name;
      bestAngle = angle;
    }
  }
  return best;
}

/** The longest name or credit, as the form allows. */
export const MAX_NAME = STAR_NAME_MAX_LENGTH;

type NamedVectors = readonly { readonly v: Vec3; readonly name: string }[];

function namedVectors(names?: ProperNameFile): NamedVectors {
  return (names?.names ?? []).map(([ra, dec, name]) => ({ v: raDecToVector(ra, dec), name }));
}

/** Whether a star ever gets above the horizon at a latitude (its highest altitude is 90° − |lat − dec|). */
export function everRises(dec: number, lat: number): boolean {
  return Math.abs(lat - dec) < 90;
}

/**
 * The stars that can still be named, brightest first (stars.json is sorted by
 * magnitude). Needs proper-names.json: without it a named star could be
 * offered, so none is. "Near" is measured to `landmarks` (the bright named
 * stars the sky labels on hover, so a visitor can find them).
 */
export function unnamedStars(
  stars: StarFile,
  names: ProperNameFile | undefined,
  visitor: readonly Pick<VisitorStar, 'ra' | 'dec'>[],
  landmarks: ProperNameFile | undefined = names,
): UnnamedStar[] {
  if (!names) return [];
  const named = namedVectors(landmarks);
  const taken = (ra: number, dec: number) =>
    names.names.some(n => sameStar(ra, dec, n[0], n[1])) || visitor.some(n => sameStar(ra, dec, n.ra, n.dec));
  return stars.stars
    .filter(([ra, dec]) => !taken(ra, dec))
    .map(([ra, dec, mag]) => {
      const v = raDecToVector(ra, dec);
      return { ra, dec, mag, v, near: nearestNamed(v, named) };
    });
}

/**
 * Visitor names, in content order, each with the landmark (bright named star) it's near: the file's own
 * "near" (what the naming panel said when it was suggested), or the nearest one worked out here.
 */
export function visitorNames(stars: readonly VisitorStar[], landmarks?: ProperNameFile): VisitorName[] {
  const named = namedVectors(landmarks);
  return stars.map(({ ra, dec, name, by, added, near }) => ({
    ra, dec, name, credit: by, added, near: near ?? nearestNamed(raDecToVector(ra, dec), named),
  }));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-10" → "Oct 2026". */
export function monthLabel(added: string): string {
  const [year, month] = added.split('-').map(Number);
  return `${MONTHS[month - 1] ?? ''} ${year}`.trim();
}

/** The hover label's second half: "named by sam, Oct 2026" or "named by a visitor, Oct 2026". */
export function visitorDetail(entry: Pick<VisitorName, 'credit' | 'added'>): string {
  return `named by ${entry.credit ?? 'a visitor'}, ${monthLabel(entry.added)}`;
}

/** The ☾ menu line: "Gerald · near Vega · by sam". */
export function visitorMenuLine(entry: VisitorName): string {
  return [entry.name, entry.near ? `near ${entry.near}` : null, `by ${entry.credit ?? 'a visitor'}`].filter(Boolean).join(' · ');
}

/** Visitor names as the catalogue takes them, for hover targets. */
export function visitorHoverNames(entries: readonly VisitorName[]): ExtraName[] {
  return entries.map(entry => ({ ra: entry.ra, dec: entry.dec, name: entry.name, detail: visitorDetail(entry) }));
}

/** A screen of some size and how directions land on it: free look's turned view (sky-panorama.ts). */
export interface ScreenMap {
  readonly width: number;
  readonly height: number;
  point(h: Vec3): { x: number; y: number } | null;
}

/**
 * Unnamed stars above the horizon and on screen (at least `margin` in from the edges, so the ring fits),
 * left to right, in layout units (or the screen map's). `hidden` drops points the
 * visitor can't see (behind the landscape, under the naming panel).
 */
export function starsOnScreen(
  stars: readonly UnnamedStar[],
  screen: SkyLayout | ScreenMap,
  toHorizontal: Mat3,
  hidden: (x: number, y: number) => boolean = () => false,
  margin = 14,
): StarOnScreen[] {
  const project = 'point' in screen ? (h: Vec3) => screen.point(h) : (h: Vec3) => screenPoint(screen, h);
  const out: StarOnScreen[] = [];
  for (const star of stars) {
    const h = multiply(toHorizontal, star.v);
    if (h[2] <= 0) continue;
    const p = project(h);
    if (!p || p.x < margin || p.y < margin || p.x > screen.width - margin || p.y > screen.height - margin) continue;
    if (hidden(p.x, p.y)) continue;
    out.push({ star, x: p.x, y: p.y });
  }
  return out.sort((a, b) => a.x - b.x || a.y - b.y);
}

/** The brightest of them (lowest magnitude), or null. */
export function brightest(list: readonly StarOnScreen[]): StarOnScreen | null {
  return list.reduce<StarOnScreen | null>((best, s) => (!best || s.star.mag < best.star.mag ? s : best), null);
}

/** The one nearest a point, if it's within `reach`. */
export function nearestTo(list: readonly StarOnScreen[], x: number, y: number, reach: number): StarOnScreen | null {
  let best: StarOnScreen | null = null;
  let bestDistance = reach;
  for (const s of list) {
    const d = Math.hypot(s.x - x, s.y - y);
    if (d <= bestDistance) {
      best = s;
      bestDistance = d;
    }
  }
  return best;
}

/** An unnamed star above the horizon, and where it is in the sky (degrees; azimuth from north through east). */
export interface StarAround {
  readonly star: UnnamedStar;
  readonly alt: number;
  readonly az: number;
}

/** The unnamed stars above the horizon, all the way round, in azimuth order (then by altitude). */
export function starsAround(stars: readonly UnnamedStar[], toHorizontal: Mat3): StarAround[] {
  const out: StarAround[] = [];
  for (const star of stars) {
    const h = multiply(toHorizontal, star.v);
    if (h[2] <= 0) continue;
    const { alt, az } = altAz(h);
    out.push({ star, alt, az });
  }
  return out.sort((a, b) => a.az - b.az || a.alt - b.alt);
}

/**
 * ‹ (−1) or › (+1): the next star round the sky by azimuth (to the right is
 * west of south, as on screen), wrapping past north. From a star that isn't in
 * the list (nothing selected, or it has set) it starts from `facing`: › takes
 * the first star to its right, ‹ the first to its left.
 */
export function stepAround(list: readonly StarAround[], current: UnnamedStar | null, direction: 1 | -1, facing: number): StarAround | null {
  if (!list.length) return null;
  const i = current ? list.findIndex(s => s.star === current) : -1;
  if (i !== -1) return list[(i + direction + list.length) % list.length];
  const turn = (s: StarAround) => wrap360(s.az - facing);
  return list.reduce((best, s) => {
    const [t, b] = [turn(s), turn(best)];
    return direction === 1 ? (t < b ? s : best) : (t > b ? s : best);
  });
}

/** How many of them ever rise at a latitude: the ones that are really "in this sky". */
export function unnamedInSky(stars: readonly Pick<UnnamedStar, 'dec'>[], lat: number): number {
  return stars.filter(s => everRises(s.dec, lat)).length;
}

/** "428 stars over Cincinnati have no name yet" (draft copy). */
export function unnamedCountText(count: number, mine: boolean): string {
  const where = mine ? 'in your sky' : 'over Cincinnati';
  return `${count} star${count === 1 ? '' : 's'} ${where} ${count === 1 ? 'has' : 'have'} no name yet`;
}

/** "an unnamed star near Vega" (or, with no names loaded, "an unnamed star"). */
export function starTitle(star: Pick<UnnamedStar, 'near'>): string {
  return star.near ? `an unnamed star near ${star.near}` : 'an unnamed star';
}

export interface StarSuggestion {
  readonly name: string;
  readonly credit: string | null;
  readonly star: Pick<UnnamedStar, 'ra' | 'dec' | 'mag' | 'near'>;
}

/**
 * The message Morgan gets (the Ask Morgan function forwards `question` to his Discord). It's exactly what
 * morganvanv.com-backend's `ask/submit` checks the structured fields against before it offers a
 * "Publish as PR" link (its `matchesMessage`), so keep the two in step.
 */
export function suggestionText(s: StarSuggestion): string {
  return [
    '⭐ Star name suggestion',
    `${JSON.stringify(s.name)} for the ${starTitle(s.star).replace(/^an /, '')} (magnitude ${s.star.mag.toFixed(1)})`,
    `named by: ${s.credit ?? 'anonymous'}`,
  ].join('\n');
}

/** The request body: today's function reads `question` and `username_honey`; an upgraded one can read the rest. */
export function suggestionBody(s: StarSuggestion, honey = '') {
  return {
    question: suggestionText(s),
    username_honey: honey,
    kind: 'star' as const,
    name: s.name,
    credit: s.credit,
    star: { ra: s.star.ra, dec: s.star.dec, mag: s.star.mag, near: s.star.near },
  };
}

/**
 * The form's inputs as a suggestion: cleaned as the backend cleans them (oneLine) and capped at 24
 * without splitting a character, so what Discord shows is exactly what a Publish link would publish.
 * A blank credit is anonymous; null without a name.
 */
export function makeSuggestion(name: string, credit: string, star: UnnamedStar): StarSuggestion | null {
  const cleanName = capText(oneLine(name), STAR_NAME_MAX_LENGTH);
  if (!cleanName) return null;
  return { name: cleanName, credit: capText(oneLine(credit), CREDIT_MAX_LENGTH) || null, star };
}
