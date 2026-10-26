import { Vec3, altAzToVector } from './sky-math';

/** The astronomy-engine module, loaded on demand (it's ~100 kB, and only the sky needs it). */
export type AstronomyModule = typeof import('astronomy-engine');

export function loadAstronomy(): Promise<AstronomyModule> {
  return import('astronomy-engine');
}

export type PlanetName = 'Mercury' | 'Venus' | 'Mars' | 'Jupiter' | 'Saturn';
export const PLANETS: readonly PlanetName[] = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];

export interface SkyBody {
  /** Horizontal unit vector [north, east, up], refraction included. */
  readonly h: Vec3;
  readonly alt: number;
  readonly az: number;
  /** Apparent visual magnitude. */
  readonly mag: number;
}

export interface MoonBody extends SkyBody {
  /** Sun–Moon–Earth angle in degrees: 0 is full, 180 is new. */
  readonly phaseAngle: number;
  /** Illuminated fraction of the disc, 0…1. */
  readonly illuminated: number;
}

export interface Bodies {
  readonly sun: SkyBody;
  readonly moon: MoonBody;
  readonly planets: readonly (SkyBody & { readonly name: PlanetName })[];
}

/** Sun, Moon and the naked-eye planets for an observer at `date`. */
export function computeBodies(astro: AstronomyModule, date: Date, latDeg: number, lonDeg: number): Bodies {
  const observer = new astro.Observer(latDeg, lonDeg, 0);
  const place = (body: Parameters<AstronomyModule['Equator']>[0]) => {
    const eq = astro.Equator(body, date, observer, true, true);
    const hor = astro.Horizon(date, observer, eq.ra, eq.dec, 'normal');
    return { h: altAzToVector(hor.altitude, hor.azimuth), alt: hor.altitude, az: hor.azimuth };
  };
  const moonIllumination = astro.Illumination(astro.Body.Moon, date);
  return {
    sun: { ...place(astro.Body.Sun), mag: -26.7 },
    moon: {
      ...place(astro.Body.Moon),
      mag: moonIllumination.mag,
      phaseAngle: moonIllumination.phase_angle,
      illuminated: moonIllumination.phase_fraction,
    },
    planets: PLANETS.map(name => ({
      name,
      ...place(astro.Body[name]),
      mag: astro.Illumination(astro.Body[name], date).mag,
    })),
  };
}
