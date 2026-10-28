import { Vec3, altAz } from './sky-math';
import { SkyProjection, computeLayout, sunDiscRadius } from './sky-render';
import { LookView, clampView, wrapDegrees } from './sky-view';

/**
 * Free look's panorama: the whole sky drawn once into one buffer, so turning
 * it is only a CSS transform. Pure (no DOM), tested like sky-math.ts. Loaded
 * with free look, never on the landing page.
 *
 * The buffer is a Mercator cylinder: x is azimuth, y is the Mercator ordinate
 * of altitude, at the normal view's scale where the two meet (due south on the
 * horizon), so crossfading between them barely moves a star there. Mercator
 * is conformal, like the normal view's stereographic picture, so constellations
 * keep their shapes in every direction; they grow gently towards the top, as
 * they do in the normal view. Turning past north wraps round: the buffer is
 * 360° plus a screen's width, so any facing is one unbroken stretch of it.
 *
 * There is no tilt. The painting is a window, and the window's top is as high
 * as the sky goes (about 57° on a landscape screen, 75° on a phone held
 * upright): what's overhead isn't part of this view. A cylinder of any kind
 * can't show the zenith without smearing it right round, so rather than show
 * that, free look doesn't look up.
 *
 * Units: "CSS px" are the screen's; "buffer px" are the panorama's own (up to
 * 2 per CSS px, fewer on big screens so the buffer stays a sensible size).
 */

/**
 * The most pixels the panorama may have (about 25 MB of RGBA), and its longest side: 4096,
 * because some mobile GPUs can't hold a wider texture (Chrome then falls back to software).
 */
export const MAX_PANORAMA_PIXELS = 4096 * 1536;
export const MAX_PANORAMA_SIDE = 4096;
/** How far below the horizon it reaches (the Moon is drawn until it's 1° below). */
const BELOW_HORIZON = 3;
/** Constellation lines are drawn in pieces this long (degrees), so they curve as the sky does. */
const SEGMENT_STEP_DEG = 2;
/** Longer than this (degrees of buffer) and a piece of line is an artefact of the seam. */
const MAX_SEGMENT_DEG = 90;
/** The buffer runs this far (degrees) past the top of the screen, so a turn never shows its edge. */
const ABOVE_SCREEN = 1;

const RAD = Math.PI / 180;

/** The Mercator ordinate of an altitude (degrees), per unit of scale. */
export const mercator = (altDeg: number) => Math.log(Math.tan(Math.PI / 4 + (altDeg * RAD) / 2));
/** The altitude (degrees) at a Mercator ordinate. */
export const unmercator = (y: number) => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) / RAD;

export interface Panorama {
  /** CSS px per degree across: the normal view's scale at its centre. */
  readonly cssPerDeg: number;
  /** CSS px per Mercator unit up: the normal view's projection scale. */
  readonly cssScale: number;
  /** Buffer px per degree across. */
  readonly degPx: number;
  /** Buffer px per Mercator unit up. */
  readonly bufScale: number;
  /** CSS px per buffer px. */
  readonly artPixel: number;
  /** Buffer size (buffer px). */
  readonly width: number;
  readonly height: number;
  /** 360° in buffer px: the buffer repeats after this. */
  readonly period: number;
  /** The altitude at the top row and the bottom row. */
  readonly altTop: number;
  readonly altBottom: number;
  /** Where the facing direction sits on screen (CSS px): the middle, on the painting's horizon line. */
  readonly centerX: number;
  readonly horizonY: number;
  readonly viewWidth: number;
  readonly viewHeight: number;
  /** The Moon's radius (buffer px), the same on screen as in the normal view. */
  readonly discRadius: number;
}

/** Sizes the panorama for a screen (CSS px) and its pixel density. */
export function computePanorama(viewWidth: number, viewHeight: number, dpr = 1, maxPixels = MAX_PANORAMA_PIXELS): Panorama {
  const layout = computeLayout(viewWidth, viewHeight, 1);
  // Stereographic projection's scale at its centre is `scale` per radian; so is Mercator's at the horizon.
  const cssScale = layout.scale;
  const cssPerDeg = cssScale * RAD;
  const spanDeg = viewWidth / cssPerDeg;
  // The altitude at the top of the screen, and a little past it.
  const altTop = Math.min(89, unmercator(layout.horizonY / cssScale) + ABOVE_SCREEN);
  const altBottom = -BELOW_HORIZON;
  const columnsDeg = 360 + spanDeg + 2;
  // The rows, in the degrees a row near the horizon spans (Mercator's scale there is the same as across).
  const rowsDeg = (mercator(altTop) - mercator(altBottom)) / RAD;
  const degPx = Math.min(
    cssPerDeg * Math.max(1, dpr),
    Math.sqrt(maxPixels / (columnsDeg * rowsDeg)),
    MAX_PANORAMA_SIDE / columnsDeg,
    MAX_PANORAMA_SIDE / rowsDeg,
  );
  const artPixel = cssPerDeg / degPx;
  return {
    cssPerDeg,
    cssScale,
    degPx,
    bufScale: degPx / RAD,
    artPixel,
    width: Math.ceil(columnsDeg * degPx),
    height: Math.ceil(rowsDeg * degPx),
    period: 360 * degPx,
    altTop,
    altBottom,
    centerX: layout.centerX,
    horizonY: layout.horizonY,
    viewWidth,
    viewHeight,
    discRadius: sunDiscRadius(layout) / artPixel,
  };
}

/** Where an altitude and an azimuth land in the buffer (buffer px), or null if the buffer stops short of it. */
function bufferAt(pan: Panorama, alt: number, az: number): { x: number; y: number } | null {
  if (alt < pan.altBottom || alt > pan.altTop) return null;
  return { x: wrapDegrees(az) * pan.degPx, y: (mercator(pan.altTop) - mercator(alt)) * pan.bufScale };
}

/** The panorama as the renderer draws onto it: one image of the sky, wrapping every 360°. */
export function panoramaProjection(pan: Panorama): SkyProjection {
  return {
    width: pan.width,
    height: pan.height,
    artPixel: pan.artPixel,
    discRadius: pan.discRadius,
    images: 1,
    point: (h: Vec3) => {
      const { alt, az } = altAz(h);
      return bufferAt(pan, alt, az);
    },
    period: pan.period,
    maxSegment: MAX_SEGMENT_DEG * pan.degPx,
    segmentStepDeg: SEGMENT_STEP_DEG,
  };
}

/** b − a in degrees, the short way round: [−180, 180). */
export const turnBetween = (a: number, b: number) => wrapDegrees(b - a + 180) - 180;

/** Where the panorama's top-left corner goes on screen (CSS px) for a view: its translate. */
export function panoramaOffset(pan: Panorama, view: LookView): { x: number; y: number } {
  const leftAz = wrapDegrees(view.facing - pan.centerX / pan.cssPerDeg);
  return { x: -leftAz * pan.cssPerDeg, y: pan.horizonY - mercator(pan.altTop) * pan.cssScale };
}

/** Where a direction (degrees) is on screen in a view (CSS px), or null if it's off screen (beyond `margin`). */
export function viewPoint(pan: Panorama, view: LookView, alt: number, az: number, margin = 0): { x: number; y: number } | null {
  if (alt < pan.altBottom || alt > pan.altTop) return null;
  const x = pan.centerX + turnBetween(view.facing, az) * pan.cssPerDeg;
  const y = pan.horizonY - mercator(alt) * pan.cssScale;
  if (x >= -margin && y >= -margin && x <= pan.viewWidth + margin && y <= pan.viewHeight + margin) return { x, y };
  return null;
}

/** The direction (degrees) at a screen point (CSS px) in a view. */
export function viewDirection(pan: Panorama, view: LookView, x: number, y: number): { alt: number; az: number } {
  return {
    alt: unmercator((pan.horizonY - y) / pan.cssScale),
    az: wrapDegrees(view.facing + (x - pan.centerX) / pan.cssPerDeg),
  };
}

/** A screen point (CSS px) in buffer px, for hit tests against what was drawn. */
export function bufferPoint(pan: Panorama, view: LookView, x: number, y: number): { x: number; y: number } {
  const offset = panoramaOffset(pan, view);
  return { x: (x - offset.x) / pan.artPixel, y: (y - offset.y) / pan.artPixel };
}

/** The other way: a buffer point on screen (CSS px). */
export function screenOfBuffer(pan: Panorama, view: LookView, x: number, y: number): { x: number; y: number } {
  const offset = panoramaOffset(pan, view);
  return { x: offset.x + x * pan.artPixel, y: offset.y + y * pan.artPixel };
}

/** Dragging by dx CSS px: the sky goes with the pointer, so dragging right turns you left. Up and down do nothing. */
export function dragView(pan: Panorama, view: LookView, dx: number): LookView {
  return clampView({ facing: view.facing - dx / pan.cssPerDeg });
}

/** Part way (t, 0…1) from one view to another, turning the short way round. */
export function viewBetween(from: LookView, to: LookView, t: number): LookView {
  if (t <= 0) return from;
  if (t >= 1) return to;
  return clampView({ facing: from.facing + turnBetween(from.facing, to.facing) * t });
}

/**
 * The view that shows a direction (degrees), changing as little as it can:
 * the same view if it's already visible; else turned so it sits at the first
 * clear spot from the middle outwards. `visible` says whether a screen point
 * (CSS px) can be seen (on screen, not behind the landscape, not under a
 * panel). Null if no view shows it: a star low behind the hills, above the
 * window's top, or under a phone's bottom sheet.
 */
export function bringIntoView(pan: Panorama, view: LookView, alt: number, az: number, visible: (x: number, y: number) => boolean): LookView | null {
  const here = viewPoint(pan, view, alt, az);
  if (here && visible(here.x, here.y)) return view;
  if (alt < pan.altBottom || alt > pan.altTop) return null;
  const p = pan.cssPerDeg;
  const step = pan.viewWidth / 12;
  const columns = [pan.centerX];
  for (let k = 1; k <= 5; k++) columns.push(pan.centerX + k * step, pan.centerX - k * step);
  const y = pan.horizonY - mercator(alt) * pan.cssScale;
  for (const x of columns) {
    if (visible(x, y)) return clampView({ facing: az - (x - pan.centerX) / p });
  }
  return null;
}
