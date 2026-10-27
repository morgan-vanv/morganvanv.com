import { AstronomyModule, PLANETS, PlanetName } from './sky-bodies';

/** Civil dusk: below this the Sun's down far enough for "tonight" to be true. */
export const NIGHT_SUN_ALT = -6;

/**
 * A planet counts as up tonight once it's this high: clear of the hills and the haze, so a Mercury
 * skimming the horizon in twilight doesn't make the list for ten minutes.
 */
export const CLEAR_ALT = 5;

/** How finely the night is sampled for the planets' windows. */
export const TONIGHT_STEP_MS = 10 * 60_000;

/** A naked-eye planet that clears the horizon (`CLEAR_ALT`) at some point tonight. */
export interface TonightPlanet {
  readonly name: PlanetName;
  /** Apparent magnitude at the start of the night (smaller is brighter). */
  readonly mag: number;
  /** The first and last samples it's up; a window that runs to the night's edge ends there. */
  readonly from: Date;
  readonly until: Date;
  /** Up at the start of the night: at dusk, or right now once it's dark. */
  readonly upAtStart: boolean;
  /** Up at the end: still up at dawn. */
  readonly upAtEnd: boolean;
  /** Its height at the start of the night, in degrees. */
  readonly altAtStart: number;
}

/**
 * The coming night, for an observer: from dusk (or from now, once it's dark) to dawn, and the planets
 * up in it, the ones up at the start first, then brightest first.
 *   start null: the Sun doesn't get far enough down tonight for a dark sky (summer near the poles);
 *   end null: it doesn't come back up far enough (polar night); the night is then counted 12 hours.
 */
export interface Tonight {
  /** True when it's already dark (start is now). */
  readonly dark: boolean;
  readonly start: Date | null;
  readonly end: Date | null;
  readonly planets: readonly TonightPlanet[];
}

/** The night after `date`, or the rest of it if `date` is already dark. */
export function tonight(astro: AstronomyModule, date: Date, latDeg: number, lonDeg: number): Tonight {
  const observer = new astro.Observer(latDeg, lonDeg, 0);
  const altitude = (body: Parameters<AstronomyModule['Equator']>[0], when: Date) => {
    const eq = astro.Equator(body, when, observer, true, true);
    return astro.Horizon(when, observer, eq.ra, eq.dec, 'normal').altitude;
  };

  const dark = altitude(astro.Body.Sun, date) < NIGHT_SUN_ALT;
  // Dusk is the Sun sinking through −6°, dawn it rising back through, within a day of each.
  const dusk = dark ? date : astro.SearchAltitude(astro.Body.Sun, observer, -1, date, 1, NIGHT_SUN_ALT)?.date ?? null;
  if (!dusk) return { dark, start: null, end: null, planets: [] };
  const dawn = astro.SearchAltitude(astro.Body.Sun, observer, +1, dusk, 1, NIGHT_SUN_ALT)?.date ?? null;
  const end = dawn ?? new Date(dusk.getTime() + 12 * 3_600_000);

  const times: Date[] = [];
  for (let t = dusk.getTime(); t < end.getTime(); t += TONIGHT_STEP_MS) times.push(new Date(t));
  times.push(end);

  const planets: TonightPlanet[] = [];
  for (const name of PLANETS) {
    const body = astro.Body[name];
    const alts = times.map(t => altitude(body, t));
    const first = alts.findIndex(a => a > CLEAR_ALT);
    if (first < 0) continue;
    const last = alts.length - 1 - [...alts].reverse().findIndex(a => a > CLEAR_ALT);
    planets.push({
      name,
      mag: astro.Illumination(body, dusk).mag,
      from: times[first],
      until: times[last],
      upAtStart: first === 0,
      upAtEnd: last === alts.length - 1,
      altAtStart: alts[0],
    });
  }
  planets.sort((a, b) => Number(b.upAtStart) - Number(a.upAtStart) || a.mag - b.mag);
  return { dark, start: dusk, end: dawn, planets };
}
