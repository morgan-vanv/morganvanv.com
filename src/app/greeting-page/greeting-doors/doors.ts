/**
 * The greeting's two hidden doors: the lit farmhouse window goes to /projects, the campfire to /social.
 * Each is a 44 px link over its spot in the painting (where the sky puts its window light and its
 * campfire, `SkyService.nightLights`), with a small label that rises above it on hover, focus or a
 * first tap. Pure: where a door goes (or that it hides) and what its label says.
 */
export type DoorId = 'window' | 'fire';

export interface Door {
  readonly id: DoorId;
  /** Where it goes. */
  readonly path: '/projects' | '/social';
  /** Its accessible name. */
  readonly name: string;
  /** The gold part of its label: `[ projects › ]`. */
  readonly label: string;
}

export const DOORS: readonly Door[] = [
  { id: 'window', path: '/projects', name: 'Projects', label: 'projects' },
  { id: 'fire', path: '/social', name: 'Social', label: 'social' },
];

/** The window's label, before the link (a draft). */
export const WINDOW_LEAD = 'the light\'s on';

/** The fire's label: how many are around it now (the campfire's `here`), or just that it's lit. */
export function fireLead(here: number | null): string {
  return here && here > 0 ? `${here} around the fire` : 'the fire\'s lit';
}

/** The whole label as it reads: "the light's on [ projects › ]". */
export function labelText(lead: string, door: Door): string {
  return `${lead} [ ${door.label} › ]`;
}

export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface Viewport {
  readonly width: number;
  readonly height: number;
}

/** Where a door sits (its spot's centre, CSS px) and how far its label slides sideways to stay on screen. */
export interface DoorPlace {
  readonly x: number;
  readonly y: number;
  readonly shift: number;
}

/** The link over the spot: a 44 px tap target. */
export const SPOT_SIZE = 44;
/** The label's pill: from the spot's centre up to its bottom, and its height (the SCSS uses the same numbers). */
export const LABEL_GAP = 30;
export const LABEL_HEIGHT = 30;
/**
 * The label's width per character and its padding and border: JetBrains Mono's advance is 0.6 em, and the
 * label is set at 0.8 rem (12.8 px), so the width is known without measuring.
 */
export const LABEL_CHAR_PX = 0.6 * 12.8;
export const LABEL_PADDING_PX = 2 * 12 + 2;
/** Kept clear of the window's edges, and between a door and the hero's words. */
export const EDGE = 8;
export const COVER_MARGIN = 6;

export function labelWidth(text: string): number {
  return Math.ceil(Array.from(text).length * LABEL_CHAR_PX + LABEL_PADDING_PX);
}

const overlaps = (a: Rect, b: Rect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/**
 * Where a door goes, or null when it can't be there: its spot off screen (a phone in portrait crops the
 * farmhouse away), no room above it for the label, or the spot under the hero's words or buttons
 * (`covers`, in the same CSS px). The label stays centred on the spot unless that would push it off
 * the side of the window; then it slides in (the lead line stays on the spot).
 */
export function placeDoor(at: { readonly x: number; readonly y: number } | null, viewport: Viewport, label: string, covers: readonly Rect[]): DoorPlace | null {
  if (!at) return null;
  const half = SPOT_SIZE / 2;
  const spot: Rect = { left: at.x - half, top: at.y - half, right: at.x + half, bottom: at.y + half };
  if (spot.left < 0 || spot.top < 0 || spot.right > viewport.width || spot.bottom > viewport.height) return null;
  if (at.y - LABEL_GAP - LABEL_HEIGHT < EDGE) return null;
  const width = labelWidth(label);
  if (width + 2 * EDGE > viewport.width) return null;
  const near: Rect = { left: spot.left - COVER_MARGIN, top: spot.top - COVER_MARGIN, right: spot.right + COVER_MARGIN, bottom: spot.bottom + COVER_MARGIN };
  if (covers.some(cover => overlaps(near, cover))) return null;
  const centre = Math.min(Math.max(at.x, EDGE + width / 2), viewport.width - EDGE - width / 2);
  return { x: at.x, y: at.y, shift: Math.round(centre - at.x) };
}
