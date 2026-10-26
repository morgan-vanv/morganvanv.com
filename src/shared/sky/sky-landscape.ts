import { BACKGROUND_CAMPFIRE, BACKGROUND_WINDOW, Lighting, SkyLayout, smoothstep } from './sky-render';

/**
 * The landscape in front of the sky: Morgan's painting with its sky cut out
 * softly, in four pre-lit looks (built by scripts/build-landscape.py; the
 * sunrise look has its morning fog baked in). The component draws them over the
 * sky, blended by these weights, and adds the farmhouse window, the campfire
 * beside it and the dusk fireflies.
 */
export type LandscapeLook = 'darkness' | 'sunrise' | 'sunset' | 'day';
export const LANDSCAPE_LOOKS: readonly LandscapeLook[] = ['darkness', 'sunrise', 'sunset', 'day'];
export const landscapeUrl = (look: LandscapeLook) => `/landscape/${look}.webp`;

/** How much of each look to use. Weights sum to 1. */
export type LookWeights = Partial<Record<LandscapeLook, number>>;

/**
 * Fixed lightings use their own look. Real time follows the Sun: darkness at
 * night, the sunrise look in the morning twilight and the sunset look in the
 * evening, day once the Sun is well up, blended in between.
 */
export function lookWeights(lighting: Lighting, sunAlt: number, sunAz: number): LookWeights {
  if (lighting !== 'real') return { [lighting]: 1 };
  const twilight: LandscapeLook = sunAz < 180 ? 'sunrise' : 'sunset';
  if (sunAlt <= -12) return { darkness: 1 };
  if (sunAlt <= -3) {
    const t = smoothstep(-12, -3, sunAlt);
    return { darkness: 1 - t, [twilight]: t };
  }
  if (sunAlt < 10) {
    const t = smoothstep(-3, 10, sunAlt);
    return { [twilight]: 1 - t, day: t };
  }
  return { day: 1 };
}

/**
 * How brightly the farmhouse window and the campfire glow: fully after dark,
 * a little at dusk and dawn, not at all in daylight.
 */
export function windowGlow(lighting: Lighting, sunAlt: number): number {
  switch (lighting) {
    case 'darkness':
      return 1;
    case 'sunset':
      return 0.8;
    case 'sunrise':
      return 0.4;
    case 'day':
      return 0;
    case 'real':
      return smoothstep(-1, -8, sunAlt);
  }
}

/** Fireflies come out at dusk: always in the staged sunset, and on real summer-ish evenings in twilight. */
export function fireflyAmount(lighting: Lighting, sunAlt: number, sunAz: number): number {
  if (lighting === 'sunset') return 1;
  if (lighting !== 'real' || sunAz < 180) return 0;
  return smoothstep(0, -3, sunAlt) * (1 - smoothstep(-10, -16, sunAlt));
}

/** The band over the field and meadow where fireflies drift, in scene pixels. */
const FIREFLY_BAND = { top: 1010, bottom: 1330 } as const;

export interface Firefly {
  /** CSS pixels. */
  readonly x: number;
  readonly y: number;
  /** Seconds. */
  readonly delay: number;
  readonly duration: number;
}

/** A deterministic scatter of fireflies over the meadow (same layout, same fireflies). */
export function fireflies(layout: SkyLayout, count: number): Firefly[] {
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const css = layout.artPixel;
  const out: Firefly[] = [];
  const top = layout.imageY + FIREFLY_BAND.top * layout.imageScale;
  const bottom = Math.min(layout.height - 4 / css, layout.imageY + FIREFLY_BAND.bottom * layout.imageScale);
  for (let i = 0; i < count; i++) {
    const x = (8 + random() * (layout.width * css - 16));
    const y = (top + random() * Math.max(0, bottom - top)) * css;
    out.push({ x: Math.round(x), y: Math.round(y), delay: +(random() * 6).toFixed(2), duration: +(4 + random() * 4).toFixed(2) });
  }
  return out;
}

/** Where the farmhouse window and the campfire are, in CSS pixels, and how big a scene pixel is there (1 on a 1280-wide screen). */
export interface NightLights {
  readonly window: { readonly x: number; readonly y: number };
  readonly fire: { readonly x: number; readonly y: number };
  readonly size: number;
}

export function nightLights(layout: SkyLayout): NightLights {
  const css = layout.artPixel;
  const at = (p: { x: number; y: number }) => ({
    x: Math.round((layout.imageX + p.x * layout.imageScale) * css * 10) / 10,
    y: Math.round((layout.imageY + p.y * layout.imageScale) * css * 10) / 10,
  });
  // Scene pixels per CSS pixel × 2: the painting is drawn at half size on a 1280-wide screen.
  const size = Math.max(0.7, Math.round(layout.imageScale * css * 2 * 100) / 100);
  return { window: at(BACKGROUND_WINDOW), fire: at(BACKGROUND_CAMPFIRE), size };
}
