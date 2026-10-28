import { AstronomyModule, PLANETS, PlanetName } from './sky-bodies';
import { altAz, j2000ToHorizontalMatrix, multiply } from './sky-math';
import { SkyCatalog } from './sky-render';
import { CONSTELLATION_NAMES } from './sky-up-now';

/** Civil dusk: below this the Sun's down far enough for "tonight" to be true. */
export const NIGHT_SUN_ALT = -6;

/**
 * A planet (or the Moon) counts as up tonight once it's this high: clear of the hills and the haze,
 * so a Mercury skimming the horizon in twilight doesn't make the list for ten minutes.
 */
export const CLEAR_ALT = 5;

/** A star makes the brightest list once it's this high at prime time: well clear of the trees. */
export const STAR_CLEAR_ALT = 15;

/** How finely the night is sampled for the planets' windows. */
export const TONIGHT_STEP_MS = 10 * 60_000;

/** Prime time: this long after dusk (or now, once it's dark), when the "brightest" and "overhead" lists are taken. */
export const PRIME_TIME_AFTER_DUSK_MS = 2 * 3_600_000;

/** How many stars and constellations the lists name. */
export const BRIGHTEST_STARS = 3;
export const OVERHEAD_CONSTELLATIONS = 3;

/** A Moon at least this lit, up at prime time, washes out the faint stars. */
export const BRIGHT_MOON = 0.5;

/** A shower is mentioned from this many days before its peak to this many after. */
export const SHOWER_DAYS = 2;

/** When something is above the horizon tonight. */
export interface TonightWindow {
  /** The first and last samples it's up; a window that runs to the night's edge ends there. */
  readonly from: Date;
  readonly until: Date;
  /** Up at the start of the night: at dusk, or right now once it's dark. */
  readonly upAtStart: boolean;
  /** Up at the end: still up at dawn. */
  readonly upAtEnd: boolean;
  /** Its height at the start of the night, in degrees. */
  readonly altAtStart: number;
  /** When it's highest tonight, and how high. */
  readonly peak: Date;
  readonly peakAlt: number;
}

/** A naked-eye planet that clears the horizon (`CLEAR_ALT`) at some point tonight. */
export interface TonightPlanet extends TonightWindow {
  readonly name: PlanetName;
  /** Apparent magnitude at the start of the night (smaller is brighter). */
  readonly mag: number;
}

/** The Moon tonight. */
export interface TonightMoon {
  /** How much of it is lit at the start of the night, 0…1. */
  readonly illuminated: number;
  /** When it's up (`CLEAR_ALT`), or null if it stays down all night. */
  readonly up: TonightWindow | null;
  /** Lit enough, and up at prime time, to wash out the faint stars. */
  readonly bright: boolean;
}

/** A bright star up at prime time. */
export interface TonightStar {
  readonly name: string;
  readonly constellation: string;
  readonly mag: number;
  /** Its height at prime time, degrees. */
  readonly alt: number;
}

/** An annual meteor shower peaking about now. */
export interface TonightShower {
  readonly name: string;
  /** The peak date (midnight UTC of the table's day). */
  readonly peak: Date;
  /** Zenithal hourly rate at the peak, a rough figure. */
  readonly rate: number;
}

/**
 * The coming night, for an observer: from dusk (or from now, once it's dark) to dawn, and what's
 * worth seeing in it: the Moon, the planets up (the ones up at the start first, then brightest
 * first), the brightest stars and the constellations overhead at prime time, and a meteor shower
 * if one peaks about now.
 *   start null: the Sun doesn't get far enough down tonight for a dark sky (summer near the poles);
 *   end null: it doesn't come back up far enough (polar night); the night is then counted 12 hours.
 */
export interface Tonight {
  /** True when it's already dark (start is now). */
  readonly dark: boolean;
  readonly start: Date | null;
  readonly end: Date | null;
  /** Two hours into the night (or now, once dark), when the star and constellation lists are taken. */
  readonly primeTime: Date | null;
  readonly moon: TonightMoon | null;
  readonly planets: readonly TonightPlanet[];
  /** Up to BRIGHTEST_STARS, brightest first; empty without the catalog. */
  readonly stars: readonly TonightStar[];
  /** Up to OVERHEAD_CONSTELLATIONS names, highest first; empty without the catalog. */
  readonly constellations: readonly string[];
  readonly shower: TonightShower | null;
}

/**
 * The major annual showers: peak month and day, and a rough zenithal hourly rate. The dates drift
 * by a day either way from year to year, which SHOWER_DAYS covers.
 */
export const SHOWERS: readonly { readonly name: string; readonly month: number; readonly day: number; readonly rate: number }[] = [
  { name: 'Quadrantids', month: 1, day: 4, rate: 120 },
  { name: 'Lyrids', month: 4, day: 22, rate: 18 },
  { name: 'Eta Aquariids', month: 5, day: 6, rate: 50 },
  { name: 'Perseids', month: 8, day: 12, rate: 100 },
  { name: 'Orionids', month: 10, day: 21, rate: 20 },
  { name: 'Leonids', month: 11, day: 17, rate: 15 },
  { name: 'Geminids', month: 12, day: 14, rate: 150 },
  { name: 'Ursids', month: 12, day: 22, rate: 10 },
];

/** The shower peaking within SHOWER_DAYS of a date (the nearest, if two), or null. */
export function showerNear(date: Date): TonightShower | null {
  let best: TonightShower | null = null;
  let nearest = Infinity;
  for (const s of SHOWERS) {
    for (const year of [date.getUTCFullYear() - 1, date.getUTCFullYear(), date.getUTCFullYear() + 1]) {
      const peak = new Date(Date.UTC(year, s.month - 1, s.day));
      // Whole days between the two dates (UTC), so a night counts the same from dusk to dawn.
      const days = Math.abs(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - peak.getTime()) / 86_400_000;
      if (days <= SHOWER_DAYS && days < nearest) [best, nearest] = [{ name: s.name, peak, rate: s.rate }, days];
    }
  }
  return best;
}

/** When a body sampled at `times` is above `minAlt`, or null if never. */
function windowOf(times: readonly Date[], alts: readonly number[], minAlt: number): TonightWindow | null {
  const first = alts.findIndex(a => a > minAlt);
  if (first < 0) return null;
  const last = alts.length - 1 - [...alts].reverse().findIndex(a => a > minAlt);
  let peak = first;
  for (let i = first; i <= last; i++) if (alts[i] > alts[peak]) peak = i;
  return {
    from: times[first],
    until: times[last],
    upAtStart: first === 0,
    upAtEnd: last === alts.length - 1,
    altAtStart: alts[0],
    peak: times[peak],
    peakAlt: alts[peak],
  };
}

/** The night after `date`, or the rest of it if `date` is already dark. */
export function tonight(astro: AstronomyModule, date: Date, latDeg: number, lonDeg: number, catalog?: SkyCatalog): Tonight {
  const observer = new astro.Observer(latDeg, lonDeg, 0);
  const altitude = (body: Parameters<AstronomyModule['Equator']>[0], when: Date) => {
    const eq = astro.Equator(body, when, observer, true, true);
    return astro.Horizon(when, observer, eq.ra, eq.dec, 'normal').altitude;
  };

  const dark = altitude(astro.Body.Sun, date) < NIGHT_SUN_ALT;
  // Dusk is the Sun sinking through −6°, dawn it rising back through, within a day of each.
  const dusk = dark ? date : astro.SearchAltitude(astro.Body.Sun, observer, -1, date, 1, NIGHT_SUN_ALT)?.date ?? null;
  if (!dusk) return { dark, start: null, end: null, primeTime: null, moon: null, planets: [], stars: [], constellations: [], shower: null };
  const dawn = astro.SearchAltitude(astro.Body.Sun, observer, +1, dusk, 1, NIGHT_SUN_ALT)?.date ?? null;
  const end = dawn ?? new Date(dusk.getTime() + 12 * 3_600_000);
  const primeTime = new Date(Math.min(end.getTime(), dusk.getTime() + (dark ? 0 : PRIME_TIME_AFTER_DUSK_MS)));

  const times: Date[] = [];
  for (let t = dusk.getTime(); t < end.getTime(); t += TONIGHT_STEP_MS) times.push(new Date(t));
  times.push(end);

  const planets: TonightPlanet[] = [];
  for (const name of PLANETS) {
    const body = astro.Body[name];
    const window = windowOf(times, times.map(t => altitude(body, t)), CLEAR_ALT);
    if (window) planets.push({ name, mag: astro.Illumination(body, dusk).mag, ...window });
  }
  planets.sort((a, b) => Number(b.upAtStart) - Number(a.upAtStart) || a.mag - b.mag);

  const moonUp = windowOf(times, times.map(t => altitude(astro.Body.Moon, t)), CLEAR_ALT);
  const illuminated = astro.Illumination(astro.Body.Moon, dusk).phase_fraction;
  const moon: TonightMoon = {
    illuminated,
    up: moonUp,
    bright: illuminated >= BRIGHT_MOON && altitude(astro.Body.Moon, primeTime) > CLEAR_ALT,
  };

  const stars: TonightStar[] = [];
  const constellations: string[] = [];
  if (catalog) {
    const toHorizontal = j2000ToHorizontalMatrix(primeTime, latDeg, lonDeg);
    for (const named of catalog.names) {
      const { alt } = altAz(multiply(toHorizontal, named.v));
      if (alt < STAR_CLEAR_ALT) continue;
      // The names file has no magnitudes; the star is the catalog entry in the same place.
      const star = catalog.stars.find(s => s.v[0] * named.v[0] + s.v[1] * named.v[1] + s.v[2] * named.v[2] > 0.9999999);
      if (!star) continue;
      stars.push({ name: named.name, constellation: named.constellation, mag: star.mag, alt });
    }
    stars.sort((a, b) => a.mag - b.mag);
    stars.splice(BRIGHTEST_STARS);
    constellations.push(...catalog.figures
      .map(({ id, center }) => ({ id, alt: altAz(multiply(toHorizontal, center)).alt }))
      .filter(c => c.alt >= STAR_CLEAR_ALT && CONSTELLATION_NAMES[c.id])
      .sort((a, b) => b.alt - a.alt)
      .slice(0, OVERHEAD_CONSTELLATIONS)
      .map(c => CONSTELLATION_NAMES[c.id]));
  }

  return { dark, start: dusk, end: dawn, primeTime, moon, planets, stars, constellations, shower: showerNear(dusk) };
}
