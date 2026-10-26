import { altAz, altAzToVector, projectSouth, unprojectSouth } from './sky-math';
import { SkyLayout } from './sky-render';

/**
 * Moving between lights. The component draws the new light once, onto a second
 * set of layers, and the browser crossfades the sky and the landscape from the
 * old to the new (colours, stars and looks all blend linearly that way, and it
 * costs nothing per frame). What can't crossfade is the Sun: it travels across
 * the sky to its new place, or sinks behind the hills, or rises from behind
 * them. Along with it go the small lights and how bright the page sits on.
 */

/** How long a change of light takes. */
export const TRANSITION_MS = 2400;

/** Slow out, slow in. */
export const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** How far below the horizon the Sun goes when a light has no Sun (it sets out of sight, behind the hills). */
export const SUN_HIDDEN_DEPTH = 14;

export interface SunPlace {
  /** Degrees. */
  readonly alt: number;
  readonly az: number;
}

/** What's eased (rather than crossfaded) when the light changes. */
export interface LightState {
  /** Where the Sun is in the sky, or null for a light without one (darkness). */
  readonly sun: SunPlace | null;
  /** Farmhouse window and campfire, fireflies, and how bright the sky is behind the page cards: all 0…1. */
  readonly window: number;
  readonly fireflies: number;
  readonly daylight: number;
}

/** The sky place of a point on screen (buffer pixels). */
export function sunPlaceAt(layout: SkyLayout, x: number, y: number): SunPlace {
  return altAz(unprojectSouth((x - layout.centerX) / layout.scale, (layout.horizonY - y) / layout.scale));
}

/** Where a sky place lands on screen (buffer pixels), or null if it can't be projected. */
export function sunScreen(layout: SkyLayout, sun: SunPlace): { x: number; y: number } | null {
  const p = projectSouth(altAzToVector(sun.alt, sun.az));
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
  return { x: layout.centerX + p.x * layout.scale, y: layout.horizonY - p.y * layout.scale };
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * The Sun's place part way (t, 0…1) from `from` to `to`. It travels across the
 * sky by the short way round; a light without a Sun stands for one sunk out of
 * sight below wherever the other light has it, so turning to darkness sets the
 * Sun and turning away from it raises one.
 */
export function sunBetween(from: SunPlace | null, to: SunPlace | null, t: number): SunPlace | null {
  if (t <= 0) return from;
  if (t >= 1) return to;
  if (!from && !to) return null;
  const a = from ?? { alt: Math.min(to!.alt, 0) - SUN_HIDDEN_DEPTH, az: to!.az };
  const b = to ?? { alt: Math.min(from!.alt, 0) - SUN_HIDDEN_DEPTH, az: from!.az };
  const turn = ((b.az - a.az + 540) % 360) - 180;
  return { alt: mix(a.alt, b.alt, t), az: (((a.az + turn * t) % 360) + 360) % 360 };
}

/** The state part way (t, 0…1, already eased) from `from` to `to`. */
export function lightBetween(from: LightState, to: LightState, t: number): LightState {
  if (t <= 0) return from;
  if (t >= 1) return to;
  return {
    sun: sunBetween(from.sun, to.sun, t),
    window: mix(from.window, to.window, t),
    fireflies: mix(from.fireflies, to.fireflies, t),
    daylight: mix(from.daylight, to.daylight, t),
  };
}
