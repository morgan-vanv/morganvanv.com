/**
 * Free look: which way the visitor is looking while they look up. Small and
 * pure, because the service and the compass need it before the free-look code
 * itself (sky-cube.ts, sky-free-look.ts) has loaded.
 */

export interface LookView {
  /** The azimuth in the middle of the screen, degrees from north through east, [0, 360). */
  readonly facing: number;
  /** How far up the sky is turned: the altitude sitting on the painting's horizon line, 0 (as normal) to 90 (the zenith). */
  readonly tilt: number;
}

/** The normal view, and where free look always starts. */
export const FACE_SOUTH: LookView = { facing: 180, tilt: 0 };
export const MAX_TILT = 90;
/** What the compass buttons turn and tilt by. */
export const TURN_STEP = 45;
export const TILT_STEP = 15;

export const wrapDegrees = (deg: number) => ((deg % 360) + 360) % 360;

/** Facing wrapped into [0, 360), tilt held between the horizon and the zenith. */
export function clampView(view: LookView): LookView {
  return { facing: wrapDegrees(view.facing), tilt: Math.min(MAX_TILT, Math.max(0, view.tilt)) };
}

const POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const SPOKEN = ['north', 'north-northeast', 'northeast', 'east-northeast', 'east', 'east-southeast', 'southeast', 'south-southeast',
  'south', 'south-southwest', 'southwest', 'west-southwest', 'west', 'west-northwest', 'northwest', 'north-northwest'];

const pointIndex = (facing: number) => Math.round(wrapDegrees(facing) / 22.5) % 16;

/** The 16-point compass name: 338° → "NNW". */
export function compassPoint(facing: number): string {
  return POINTS[pointIndex(facing)];
}

const degrees = (facing: number) => Math.round(wrapDegrees(facing)) % 360;
const tiltDegrees = (tilt: number) => Math.round(Math.min(MAX_TILT, Math.max(0, tilt)));

function tiltText(tilt: number): string {
  const t = tiltDegrees(tilt);
  return t === 0 ? 'at the horizon' : t === MAX_TILT ? 'straight up' : `looking up ${t}°`;
}

/** The compass reading: "facing NNW · 338° · looking up 40°" (approved by Morgan, 2026-10-28). */
export function compassText(view: LookView): string {
  return `facing ${compassPoint(view.facing)} · ${degrees(view.facing)}° · ${tiltText(view.tilt)}`;
}

/** The same, for a screen reader: "facing north-northwest, 338°, looking up 40°". */
export function spokenView(view: LookView): string {
  return `facing ${SPOKEN[pointIndex(view.facing)]}, ${degrees(view.facing)}°, ${tiltText(view.tilt)}`;
}

/** Whether two views read the same on the compass (so the reading only changes when it would show). */
export function sameReading(a: LookView, b: LookView): boolean {
  return degrees(a.facing) === degrees(b.facing) && tiltDegrees(a.tilt) === tiltDegrees(b.tilt);
}
