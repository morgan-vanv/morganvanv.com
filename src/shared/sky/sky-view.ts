/**
 * Free look: which way the visitor is facing while they look up. Small and
 * pure, because the service and the compass need it before the free-look code
 * itself (sky-panorama.ts, sky-free-look.ts) has loaded.
 *
 * Only a facing: the painting is a window, and you turn behind it. There is no
 * tilt, so the zenith is never in the window (see sky-panorama.ts for why).
 */

export interface LookView {
  /** The azimuth in the middle of the screen, degrees from north through east, [0, 360). */
  readonly facing: number;
}

/** The normal view, and where free look always starts. */
export const FACE_SOUTH: LookView = { facing: 180 };
/** What the compass buttons turn by. */
export const TURN_STEP = 45;

export const wrapDegrees = (deg: number) => ((deg % 360) + 360) % 360;

/** Facing wrapped into [0, 360). */
export function clampView(view: LookView): LookView {
  return { facing: wrapDegrees(view.facing) };
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

/** The compass reading: "facing NNW · 338°" (draft copy). */
export function compassText(view: LookView): string {
  return `facing ${compassPoint(view.facing)} · ${degrees(view.facing)}°`;
}

/** The same, for a screen reader: "facing north-northwest, 338°". */
export function spokenView(view: LookView): string {
  return `facing ${SPOKEN[pointIndex(view.facing)]}, ${degrees(view.facing)}°`;
}

/** Whether two views read the same on the compass (so the reading only changes when it would show). */
export function sameReading(a: LookView, b: LookView): boolean {
  return degrees(a.facing) === degrees(b.facing);
}
