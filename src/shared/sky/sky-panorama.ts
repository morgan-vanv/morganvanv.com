import { Vec3, altAz } from './sky-math';
import { SkyProjection, computeLayout, sunDiscRadius } from './sky-render';
import { LookView, MAX_TILT, clampView, wrapDegrees } from './sky-view';

/**
 * Free look's panorama: the whole sky drawn once into one buffer, so turning
 * and tilting it is only a CSS transform. Pure (no DOM), tested like
 * sky-math.ts. Loaded with free look, never on the landing page.
 *
 * The buffer is a cylinder (equirectangular): x is azimuth, y is altitude, at
 * the normal view's scale where the two meet (due south on the horizon), so
 * crossfading between them barely moves a star there. Turning past north wraps
 * round: the buffer is 360° plus a screen's width, so any facing is one
 * unbroken stretch of it. Tilting up runs on past the zenith into the sky
 * behind you, upside down, as it would if you leant back; so the buffer has two
 * images of the sky: as seen facing that way (altitude 0…90°) and over the top
 * (an altitude `a` above 90° shows the direction at 180° − a, 180° round).
 *
 * The price is stretching high up: across, a degree of sky near the zenith
 * spans many degrees of azimuth, so constellations up there look wider than in
 * the normal view (which is conformal).
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
/** Longer than this (degrees of buffer) and a piece of line is an artefact of the seam or the zenith. */
const MAX_SEGMENT_DEG = 90;

export interface Panorama {
  /** CSS px per degree: the normal view's scale at its centre. */
  readonly cssPerDeg: number;
  /** Buffer px per degree. */
  readonly degPx: number;
  /** CSS px per buffer px. */
  readonly artPixel: number;
  /** Buffer size (buffer px). */
  readonly width: number;
  readonly height: number;
  /** 360° in buffer px: the buffer repeats after this. */
  readonly period: number;
  /** The extended altitude at the top row and the bottom row (above 90 is over the top). */
  readonly altTop: number;
  readonly altBottom: number;
  /** Where the facing direction sits on screen (CSS px): the middle, on the painting's horizon line at tilt 0. */
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
  // Stereographic projection's scale at its centre is `scale` per radian.
  const cssPerDeg = (layout.scale * Math.PI) / 180;
  const spanDeg = viewWidth / cssPerDeg;
  // Tilted all the way (the zenith on the horizon line), the top of the screen is this far over.
  const altTop = Math.min(180, MAX_TILT + layout.horizonY / cssPerDeg) + 1;
  const altBottom = -BELOW_HORIZON;
  const columnsDeg = 360 + spanDeg + 2;
  const rowsDeg = altTop - altBottom;
  const degPx = Math.min(
    cssPerDeg * Math.max(1, dpr),
    Math.sqrt(maxPixels / (columnsDeg * rowsDeg)),
    MAX_PANORAMA_SIDE / columnsDeg,
    MAX_PANORAMA_SIDE / rowsDeg,
  );
  const artPixel = cssPerDeg / degPx;
  return {
    cssPerDeg,
    degPx,
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

/** Where an extended altitude and an azimuth land in the buffer (buffer px), or null if the buffer stops short of it. */
function bufferAt(pan: Panorama, a: number, column: number): { x: number; y: number } | null {
  if (a < pan.altBottom || a > pan.altTop) return null;
  return { x: wrapDegrees(column) * pan.degPx, y: (pan.altTop - a) * pan.degPx };
}

/** The panorama as the renderer draws onto it: two images (as seen, over the top), wrapping every 360°. */
export function panoramaProjection(pan: Panorama): SkyProjection {
  return {
    width: pan.width,
    height: pan.height,
    artPixel: pan.artPixel,
    discRadius: pan.discRadius,
    images: 2,
    point: (h: Vec3, image: number) => {
      const { alt, az } = altAz(h);
      return image === 0 ? bufferAt(pan, alt, az) : bufferAt(pan, 180 - alt, az + 180);
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
  return { x: -leftAz * pan.cssPerDeg, y: pan.horizonY - (pan.altTop - view.tilt) * pan.cssPerDeg };
}

/**
 * Where a direction (degrees) is on screen in a view (CSS px): as seen, or
 * over the top, whichever is on screen (within `margin`); null if neither is.
 */
export function viewPoint(pan: Panorama, view: LookView, alt: number, az: number, margin = 0): { x: number; y: number } | null {
  for (const [a, column] of [[alt, az], [180 - alt, az + 180]]) {
    if (a < pan.altBottom || a > pan.altTop) continue;
    const x = pan.centerX + turnBetween(view.facing, column) * pan.cssPerDeg;
    const y = pan.horizonY - (a - view.tilt) * pan.cssPerDeg;
    if (x >= -margin && y >= -margin && x <= pan.viewWidth + margin && y <= pan.viewHeight + margin) return { x, y };
  }
  return null;
}

/** The direction (degrees) at a screen point (CSS px) in a view. */
export function viewDirection(pan: Panorama, view: LookView, x: number, y: number): { alt: number; az: number } {
  const a = view.tilt + (pan.horizonY - y) / pan.cssPerDeg;
  const column = view.facing + (x - pan.centerX) / pan.cssPerDeg;
  return a <= 90 ? { alt: a, az: wrapDegrees(column) } : { alt: 180 - a, az: wrapDegrees(column + 180) };
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

/** Dragging by (dx, dy) CSS px: the sky goes with the pointer, so dragging right turns you left, and down tilts you up. */
export function dragView(pan: Panorama, view: LookView, dx: number, dy: number): LookView {
  return clampView({ facing: view.facing - dx / pan.cssPerDeg, tilt: view.tilt + dy / pan.cssPerDeg });
}

/** Part way (t, 0…1) from one view to another, turning the short way round. */
export function viewBetween(from: LookView, to: LookView, t: number): LookView {
  if (t <= 0) return from;
  if (t >= 1) return to;
  return clampView({ facing: from.facing + turnBetween(from.facing, to.facing) * t, tilt: from.tilt + (to.tilt - from.tilt) * t });
}

/**
 * The view that shows a direction (degrees), changing as little as it can:
 * the same view if it's already visible; else the same tilt, turned so it sits
 * at the first clear spot from the middle outwards; else tilted so it's half
 * way up the sky above the horizon line, turned the same way. `visible` says
 * whether a screen point (CSS px) can be seen (on screen, not behind the
 * landscape, not under a panel). Null if no view shows it: a star low behind
 * the hills, or under a phone's bottom sheet (tilting only moves a star down).
 */
export function bringIntoView(pan: Panorama, view: LookView, alt: number, az: number, visible: (x: number, y: number) => boolean): LookView | null {
  const here = viewPoint(pan, view, alt, az);
  if (here && visible(here.x, here.y)) return view;
  const p = pan.cssPerDeg;
  const goalTilt = clampView({ facing: 0, tilt: alt - pan.horizonY / 2 / p }).tilt;
  const step = pan.viewWidth / 12;
  const columns = [pan.centerX];
  for (let k = 1; k <= 5; k++) columns.push(pan.centerX + k * step, pan.centerX - k * step);
  for (const tilt of view.tilt === goalTilt ? [goalTilt] : [view.tilt, goalTilt]) {
    const y = pan.horizonY - (alt - tilt) * p;
    for (const x of columns) {
      if (visible(x, y)) return clampView({ facing: az - (x - pan.centerX) / p, tilt });
    }
  }
  return null;
}
