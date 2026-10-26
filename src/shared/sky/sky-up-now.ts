import { Bodies } from './sky-bodies';
import { Mat3, altAz, multiply } from './sky-math';
import { SkyCatalog } from './sky-render';

/** Constellation names by IAU abbreviation: the 30 drawn, plus any that hold a named bright star. */
export const CONSTELLATION_NAMES: Record<string, string> = {
  And: 'Andromeda', Aql: 'Aquila', Aqr: 'Aquarius', Ari: 'Aries', Aur: 'Auriga', Boo: 'Boötes',
  CMa: 'Canis Major', CMi: 'Canis Minor', Cap: 'Capricornus', Cas: 'Cassiopeia', Cep: 'Cepheus', Cnc: 'Cancer',
  CrB: 'Corona Borealis', Cyg: 'Cygnus', Dra: 'Draco', Gem: 'Gemini', Her: 'Hercules', Leo: 'Leo',
  Lib: 'Libra', Lyr: 'Lyra', Ori: 'Orion', Peg: 'Pegasus', Per: 'Perseus', Psc: 'Pisces',
  Sco: 'Scorpius', Sgr: 'Sagittarius', Tau: 'Taurus', UMa: 'Ursa Major', UMi: 'Ursa Minor', Vir: 'Virgo',
  // Not drawn, but home to a named bright star.
  Ara: 'Ara', CVn: 'Canes Venatici', Car: 'Carina', Cen: 'Centaurus', Cet: 'Cetus', Col: 'Columba',
  Cru: 'Crux', Crv: 'Corvus', Eri: 'Eridanus', Gru: 'Grus', Hya: 'Hydra', Lep: 'Lepus', Lup: 'Lupus',
  Oph: 'Ophiuchus', Pav: 'Pavo', Phe: 'Phoenix', PsA: 'Piscis Austrinus', Pup: 'Puppis', Ser: 'Serpens',
  TrA: 'Triangulum Australe', Tri: 'Triangulum', Vel: 'Vela',
};

/** A plain-text summary of what's above the horizon, for the sky menu (and anyone who can't see the canvas). */
export interface UpNow {
  /** Naked-eye planets above the horizon, brightest first. */
  readonly planets: readonly string[];
  /** e.g. "Moon, 99% lit" or "Moon (99% lit) below the horizon"; null without astronomy-engine. */
  readonly moon: string | null;
  /** Up to `limit` constellations, highest first. */
  readonly constellations: readonly string[];
  /** The numbers behind the text, for the Moon and Up tonight badges; null without astronomy-engine. */
  readonly detail: {
    readonly moon: { readonly illuminated: number; readonly phase: number; readonly alt: number };
    readonly planets: readonly { readonly name: string; readonly alt: number }[];
  } | null;
}

/** Constellations count as "up" when the middle of their figure is this high. */
const CONSTELLATION_MIN_ALT = 10;

export function upNow(bodies: Bodies | null, catalog: SkyCatalog, toHorizontal: Mat3, limit = 4): UpNow {
  const planetsUp = (bodies?.planets ?? [])
    .filter(p => p.alt > 0)
    .sort((a, b) => a.mag - b.mag);
  const planets = planetsUp.map(p => p.name);
  let moon: string | null = null;
  if (bodies) {
    const lit = `${Math.round(bodies.moon.illuminated * 100)}% lit`;
    moon = bodies.moon.alt > 0 ? `Moon, ${lit}` : `Moon (${lit}) below the horizon`;
  }
  const constellations = catalog.figures
    .map(({ id, center }) => ({ id, alt: altAz(multiply(toHorizontal, center)).alt }))
    .filter(c => c.alt >= CONSTELLATION_MIN_ALT && CONSTELLATION_NAMES[c.id])
    .sort((a, b) => b.alt - a.alt)
    .slice(0, limit)
    .map(c => CONSTELLATION_NAMES[c.id]);
  const detail = bodies && {
    moon: { illuminated: bodies.moon.illuminated, phase: bodies.moon.phase, alt: bodies.moon.alt },
    planets: planetsUp.map(p => ({ name: p.name, alt: p.alt })),
  };
  return { planets, moon, constellations, detail };
}
