import { Lighting, SkyLayout, smoothstep } from './sky-render';

/**
 * The landscape in front of the sky: the painting with its sky cut out, in four
 * pre-lit looks (built by scripts/build-landscape.py), drawn into the same art-
 * pixel buffer as the sky so the whole background is one piece of pixel art.
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
 * How brightly the farmhouse window glows: fully after dark, a little at dusk
 * and dawn, not at all in daylight.
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

/** A look rasterised at art resolution: RGBA, same size as the sky buffer. */
export interface LandscapeLayer {
  readonly look: LandscapeLook;
  readonly data: Uint8ClampedArray;
}

/** Alpha at or above this (of 255) counts as land: pixel art has no half-covered pixels. */
const SOLID = 128;

/**
 * Paints the landscape over the sky in `buffer`, blending the weighted looks,
 * then the farmhouse light. Every layer must be `width × height`; they share
 * one silhouette, so the first layer's alpha decides what's land.
 */
export function compositeLandscape(
  buffer: Uint8ClampedArray,
  layout: SkyLayout,
  layers: readonly { layer: LandscapeLayer; weight: number }[],
  glow: number,
): void {
  if (!layers.length) return;
  const mask = layers[0].layer.data;
  for (let i = 0; i < buffer.length; i += 4) {
    if (mask[i + 3] < SOLID) continue;
    let [r, g, b] = [0, 0, 0];
    for (const { layer, weight } of layers) {
      r += layer.data[i] * weight;
      g += layer.data[i + 1] * weight;
      b += layer.data[i + 2] * weight;
    }
    buffer[i] = r;
    buffer[i + 1] = g;
    buffer[i + 2] = b;
  }
  if (glow > 0) drawWindowLight(buffer, layout, glow);
}

const WINDOW: readonly [number, number, number] = [255, 204, 120];

/** One warm art pixel with a soft cross around it, at the farmhouse window. */
function drawWindowLight(buffer: Uint8ClampedArray, layout: SkyLayout, strength: number): void {
  const x0 = Math.round(layout.windowX);
  const y0 = Math.round(layout.windowY);
  const spots: [number, number, number][] = [[0, 0, 1], [-1, 0, 0.3], [1, 0, 0.3], [0, -1, 0.25], [0, 1, 0.15]];
  for (const [dx, dy, a] of spots) {
    const [x, y] = [x0 + dx, y0 + dy];
    if (x < 0 || y < 0 || x >= layout.width || y >= layout.height) continue;
    const i = (y * layout.width + x) * 4;
    const t = a * strength;
    for (let c = 0; c < 3; c++) buffer[i + c] += (WINDOW[c] - buffer[i + c]) * t;
  }
}

/** True where the landscape covers the sky at art pixel (x, y). */
export function isLand(layer: LandscapeLayer | null, layout: SkyLayout, x: number, y: number): boolean {
  if (!layer) return false;
  const [ix, iy] = [Math.floor(x), Math.floor(y)];
  if (ix < 0 || iy < 0 || ix >= layout.width || iy >= layout.height) return false;
  return layer.data[(iy * layout.width + ix) * 4 + 3] >= SOLID;
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
  /** CSS pixels, snapped to the art-pixel grid. */
  readonly x: number;
  readonly y: number;
  /** Seconds. */
  readonly delay: number;
  readonly duration: number;
}

/** A deterministic scatter of fireflies over the meadow (same layout, same fireflies). */
export function fireflies(layout: SkyLayout, count: number, artPixel: number): Firefly[] {
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const out: Firefly[] = [];
  const top = layout.imageY + FIREFLY_BAND.top * layout.imageScale;
  const bottom = Math.min(layout.height - 4, layout.imageY + FIREFLY_BAND.bottom * layout.imageScale);
  for (let i = 0; i < count; i++) {
    const x = Math.round(4 + random() * (layout.width - 8));
    const y = Math.round(top + random() * Math.max(0, bottom - top));
    out.push({ x: x * artPixel, y: y * artPixel, delay: +(random() * 6).toFixed(2), duration: +(3 + random() * 3).toFixed(2) });
  }
  return out;
}
