import { Mat3, Vec3, altAz, altAzToVector } from './sky-math';
import { SkyProjection, computeLayout, sunDiscRadius } from './sky-render';
import { LookView, MAX_TILT, clampView, wrapDegrees } from './sky-view';

/**
 * Free look's camera: the sky drawn once onto the faces of a cube, and looked
 * at through a real (rectilinear) camera that turns and tilts. Pure (no DOM),
 * tested like sky-math.ts. Loaded with free look, never on the landing page.
 *
 * Five faces (south, west, north, east, up; nothing below the horizon is drawn
 * but the Moon to −1°, which the side faces reach), each a 90° gnomonic
 * picture of the sky, drawn one at a time by the renderer (its own buffer each,
 * with a gutter round it), but addressed in one coordinate space, the "atlas"
 * (the faces side by side, gutters between), so what was drawn where is one
 * list for hover and the ring. On screen each face is a canvas placed
 * in a CSS 3D cube round the viewer (`faceTransform`); turning and tilting is
 * one `matrix3d` on the cube (`cubeTransform`), so nothing is redrawn per
 * frame, and the GPU does the perspective. A rectilinear camera shows the sky
 * as a photo does: straight lines stay straight, constellations keep their
 * shapes, and the zenith is a place like any other.
 *
 * The camera's focal length is set so it sees CAMERA_FOV degrees across the
 * screen's longer side: about what a phone's camera sees. Its principal point
 * is the painting's horizon line in the middle of the screen, the same as the
 * normal view's centre, so at tilt 0 facing south the two nearly agree there.
 *
 * Units: "CSS px" are the screen's; "buffer px" are the atlas's own.
 */

/** What the camera sees across the screen's longer side, degrees. */
export const CAMERA_FOV = 100;
/**
 * The most pixels the five faces may have between them (about 36 MB of RGBA; a face resampled
 * by the GPU loses its faintest stars unless it has at least a pixel per CSS pixel), and a face's
 * longest side.
 */
export const MAX_FACE_PIXELS = 1344 * 1344 * 5;
export const MAX_FACE_SIDE = 2048;
/**
 * The gutter round each face (buffer px): a little of the sky past the face's edge is drawn into it
 * (so lines reach the edge and stars' glows aren't cut), and never shown.
 */
export const GUTTER = 64;
/** Constellation lines are drawn in pieces this long (degrees), so they curve as the sky does. */
const SEGMENT_STEP_DEG = 2;
/** The faces' places in the atlas (the one coordinate space hover and the ring use): 3 across, 2 down. */
const COLUMNS = 3;
const ROWS = 2;

const RAD = Math.PI / 180;

/** A face: which way it looks, and which way is right and up on it (horizontal vectors [north, east, up]). */
interface Face {
  readonly d: Vec3;
  readonly r: Vec3;
  readonly u: Vec3;
}

/**
 * South first (the face you start on), then round to the west, north and east, then up. Each
 * side's up is the zenith; the up face's up is north, so it joins the south face along its top.
 */
export const FACES: readonly Face[] = [
  { d: [-1, 0, 0], r: [0, -1, 0], u: [0, 0, 1] },
  { d: [0, -1, 0], r: [1, 0, 0], u: [0, 0, 1] },
  { d: [1, 0, 0], r: [0, 1, 0], u: [0, 0, 1] },
  { d: [0, 1, 0], r: [-1, 0, 0], u: [0, 0, 1] },
  { d: [0, 0, 1], r: [0, -1, 0], u: [1, 0, 0] },
];

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalize = (v: Vec3): Vec3 => {
  const n = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / n, v[1] / n, v[2] / n];
};

export interface Cube {
  /** A face's side (buffer px). */
  readonly face: number;
  /** The atlas (buffer px): the faces side by side, with gutters. */
  readonly width: number;
  readonly height: number;
  /** The camera's focal length: CSS px per radian at the middle of the screen. */
  readonly focal: number;
  /** CSS px a face spans on its own canvas (it sits `focal` away from the viewer, so this is 2 × focal). */
  readonly faceCss: number;
  /** CSS px per buffer px. */
  readonly artPixel: number;
  /** Where the camera's axis meets the screen (CSS px): the middle, on the painting's horizon line. */
  readonly centerX: number;
  readonly horizonY: number;
  readonly viewWidth: number;
  readonly viewHeight: number;
  /** The Moon's radius (buffer px), the same on screen as in the normal view. */
  readonly discRadius: number;
}

/** Sizes the cube for a screen (CSS px) and its pixel density. */
export function computeCube(viewWidth: number, viewHeight: number, dpr = 1, maxPixels = MAX_FACE_PIXELS): Cube {
  const layout = computeLayout(viewWidth, viewHeight, 1);
  const focal = Math.max(viewWidth, viewHeight) / 2 / Math.tan((CAMERA_FOV / 2) * RAD);
  const faceCss = 2 * focal;
  // One buffer px per CSS px at the middle of a face (dpr of them on a dense screen), within the budget.
  const face = Math.floor(Math.min(faceCss * Math.max(1, dpr), Math.sqrt(maxPixels / FACES.length), MAX_FACE_SIDE));
  return {
    face,
    width: COLUMNS * face + (COLUMNS + 1) * GUTTER,
    height: ROWS * face + (ROWS + 1) * GUTTER,
    focal,
    faceCss,
    artPixel: faceCss / face,
    centerX: layout.centerX,
    horizonY: layout.horizonY,
    viewWidth,
    viewHeight,
    discRadius: sunDiscRadius(layout) / (faceCss / face),
  };
}

/** Where a face's top-left corner is in the atlas (buffer px). */
export function faceOrigin(cube: Cube, face: number): { x: number; y: number } {
  return { x: GUTTER + (face % COLUMNS) * (cube.face + GUTTER), y: GUTTER + Math.floor(face / COLUMNS) * (cube.face + GUTTER) };
}

/**
 * Where a horizontal direction lands on a face (buffer px, in the atlas), or null if it's off that
 * face by more than the gutter. A direction near an edge lands on both faces that share it.
 */
export function facePoint(cube: Cube, face: number, h: Vec3): { x: number; y: number } | null {
  const f = FACES[face];
  const depth = dot(h, f.d);
  if (depth < 0.2) return null;
  const half = cube.face / 2;
  const x = (half * dot(h, f.r)) / depth;
  const y = (-half * dot(h, f.u)) / depth;
  if (Math.abs(x) > half + GUTTER || Math.abs(y) > half + GUTTER) return null;
  const o = faceOrigin(cube, face);
  return { x: o.x + half + x, y: o.y + half + y };
}

/** The face a direction is best drawn on (the one it's most squarely in front of). */
export function faceOf(h: Vec3): number {
  let best = 0;
  let depth = -Infinity;
  FACES.forEach((f, i) => {
    const d = dot(h, f.d);
    if (d > depth) [best, depth] = [i, d];
  });
  return best;
}

/** The direction (horizontal vector) at an atlas point, taking it to be on `face` (even in its gutter). */
export function atlasDirection(cube: Cube, face: number, x: number, y: number): Vec3 {
  const f = FACES[face];
  const o = faceOrigin(cube, face);
  const half = cube.face / 2;
  const [fx, fy] = [(x - o.x - half) / half, -(y - o.y - half) / half];
  return normalize([
    f.d[0] + f.r[0] * fx + f.u[0] * fy,
    f.d[1] + f.r[1] * fx + f.u[1] * fy,
    f.d[2] + f.r[2] * fx + f.u[2] * fy,
  ]);
}

/**
 * One face as the renderer draws it: a buffer the face's size plus its gutter all round, with
 * (0, 0) at the atlas point `faceOrigin − GUTTER`, so what it draws is moved into the atlas by
 * adding that.
 */
export function faceProjection(cube: Cube, face: number): SkyProjection {
  const o = faceOrigin(cube, face);
  const [ox, oy] = [o.x - GUTTER, o.y - GUTTER];
  return {
    width: cube.face + 2 * GUTTER,
    height: cube.face + 2 * GUTTER,
    artPixel: cube.artPixel,
    discRadius: cube.discRadius,
    images: 1,
    point: h => {
      const p = facePoint(cube, face, h);
      return p && { x: p.x - ox, y: p.y - oy };
    },
    period: 0,
    // A piece of line is at most 2°, under a quarter of a face even at a corner; longer is a jump between faces.
    maxSegment: cube.face / 4,
    segmentStepDeg: SEGMENT_STEP_DEG,
  };
}

/** The camera's frame for a view: forward, right and up as horizontal vectors. */
export function cameraFrame(view: LookView): { f: Vec3; r: Vec3; u: Vec3 } {
  const f = altAzToVector(view.tilt, view.facing);
  const r = altAzToVector(0, view.facing + 90);
  return { f, r, u: cross(f, r) };
}

/** Where a direction is on screen (CSS px), or null if it's behind the camera or off screen (beyond `margin`). */
export function viewPoint(cube: Cube, view: LookView, h: Vec3, margin = 0): { x: number; y: number } | null {
  const { f, r, u } = cameraFrame(view);
  const depth = dot(h, f);
  if (depth < 0.05) return null;
  const x = cube.centerX + (cube.focal * dot(h, r)) / depth;
  const y = cube.horizonY - (cube.focal * dot(h, u)) / depth;
  if (x >= -margin && y >= -margin && x <= cube.viewWidth + margin && y <= cube.viewHeight + margin) return { x, y };
  return null;
}

/** The direction (horizontal vector) at a screen point (CSS px) in a view. */
export function viewDirection(cube: Cube, view: LookView, x: number, y: number): Vec3 {
  const { f, r, u } = cameraFrame(view);
  const [sx, sy] = [(x - cube.centerX) / cube.focal, (cube.horizonY - y) / cube.focal];
  return normalize([f[0] + r[0] * sx + u[0] * sy, f[1] + r[1] * sx + u[1] * sy, f[2] + r[2] * sx + u[2] * sy]);
}

/** A screen point (CSS px) in the atlas (buffer px), on the face that direction is best drawn on. */
export function atlasPoint(cube: Cube, view: LookView, x: number, y: number): { x: number; y: number; face: number } {
  const h = viewDirection(cube, view, x, y);
  const face = faceOf(h);
  const p = facePoint(cube, face, h)!;
  return { ...p, face };
}

/** The face an atlas point is on (by which face's region, gutter included, holds it). */
export function faceAt(cube: Cube, x: number, y: number): number {
  const column = Math.min(COLUMNS - 1, Math.max(0, Math.floor((x - GUTTER / 2) / (cube.face + GUTTER))));
  const row = Math.min(ROWS - 1, Math.max(0, Math.floor((y - GUTTER / 2) / (cube.face + GUTTER))));
  return Math.min(FACES.length - 1, row * COLUMNS + column);
}

/** The other way: an atlas point on screen (CSS px), wherever the view has it (even off screen). */
export function screenOfAtlas(cube: Cube, view: LookView, x: number, y: number): { x: number; y: number } {
  const h = atlasDirection(cube, faceAt(cube, x, y), x, y);
  return viewPoint(cube, view, h, 1e9) ?? { x: -1e6, y: -1e6 };
}

/**
 * How far down the screen the ground (the painting) has slid for a view (CSS px): the horizon
 * straight ahead is this far below the painting's horizon line. Off the bottom once the camera
 * is well up.
 */
export function groundShift(cube: Cube, view: LookView): number {
  const tilt = Math.min(89, Math.max(0, view.tilt));
  return Math.min(cube.viewHeight, cube.focal * Math.tan(tilt * RAD));
}

/** Dragging by (dx, dy) CSS px: the sky goes with the pointer, so dragging right turns you left, and down tilts you up. */
export function dragView(cube: Cube, view: LookView, dx: number, dy: number): LookView {
  const perPx = 1 / (cube.focal * RAD);
  return clampView({ facing: view.facing - dx * perPx, tilt: view.tilt + dy * perPx });
}

/** b − a in degrees, the short way round: [−180, 180). */
export const turnBetween = (a: number, b: number) => wrapDegrees(b - a + 180) - 180;

/** Part way (t, 0…1) from one view to another, turning the short way round. */
export function viewBetween(from: LookView, to: LookView, t: number): LookView {
  if (t <= 0) return from;
  if (t >= 1) return to;
  return clampView({ facing: from.facing + turnBetween(from.facing, to.facing) * t, tilt: from.tilt + (to.tilt - from.tilt) * t });
}

/**
 * The view that shows a direction, changing as little as it can: the same view if it's already
 * visible; else the same tilt, turned so it sits at the first clear column from the middle
 * outwards; else tilted so it's a third of the way down the screen, turned the same way.
 * `visible` says whether a screen point (CSS px) can be seen. Null if no view shows it.
 */
export function bringIntoView(cube: Cube, view: LookView, alt: number, az: number, visible: (x: number, y: number) => boolean): LookView | null {
  const h = altAzToVector(alt, az);
  const here = viewPoint(cube, view, h);
  if (here && visible(here.x, here.y)) return view;
  if (alt <= 0) return null;
  const step = cube.viewWidth / 12;
  const columns = [cube.centerX];
  for (let k = 1; k <= 5; k++) columns.push(cube.centerX + k * step, cube.centerX - k * step);
  const degPerPx = 1 / (cube.focal * RAD);
  const goalTilt = clampView({ facing: 0, tilt: alt - (cube.horizonY - cube.viewHeight / 3) * degPerPx }).tilt;
  for (const tilt of view.tilt === goalTilt ? [goalTilt] : [view.tilt, goalTilt]) {
    for (const x of columns) {
      // Near enough for a small-angle guess; the real projection decides.
      const guess = clampView({ facing: az - (x - cube.centerX) * degPerPx, tilt });
      const at = viewPoint(cube, guess, h);
      if (at && visible(at.x, at.y)) return guess;
    }
  }
  return null;
}

/** 3 × 3 rotation taking the sky's frame [north, east, up] to CSS space (x right = west, y down, z toward the viewer = north). */
const SKY_TO_CSS: Mat3 = [
  [0, -1, 0],
  [0, 0, -1],
  [1, 0, 0],
];

const matrix3d = (m: Mat3, t: Vec3) =>
  `matrix3d(${[m[0][0], m[1][0], m[2][0], 0, m[0][1], m[1][1], m[2][1], 0, m[0][2], m[1][2], m[2][2], 0, t[0], t[1], t[2], 1]
    .map(v => (Math.abs(v) < 1e-9 ? 0 : +v.toFixed(6))).join(', ')})`;

const toCss = (v: Vec3): Vec3 => [dot(SKY_TO_CSS[0], v), dot(SKY_TO_CSS[1], v), dot(SKY_TO_CSS[2], v)];

/**
 * The CSS transform placing a face's canvas on the cube: `focal` from the viewer, its front
 * toward them (its z axis points back in, so its back face, which is hidden, is on the outside).
 * The canvas is `faceCss` square with its transform origin at its centre, and sits, untransformed,
 * centred on the cube's origin.
 */
export function faceTransform(cube: Cube, face: number): string {
  const f = FACES[face];
  const [r, u, d] = [toCss(f.r), toCss(f.u), toCss(f.d)];
  const columns: Mat3 = [
    [r[0], -u[0], -d[0]],
    [r[1], -u[1], -d[1]],
    [r[2], -u[2], -d[2]],
  ];
  return matrix3d(columns, [d[0] * cube.focal, d[1] * cube.focal, d[2] * cube.focal]);
}

/**
 * The CSS transform for the cube in a view: turned so the camera looks along it, then pushed
 * `focal` toward the viewer so the viewer (at `perspective: focal`) is at its centre.
 */
export function cubeTransform(cube: Cube, view: LookView): string {
  const { f, r, u } = cameraFrame(view);
  // Rows: where CSS x, y, z come from in the sky's frame; then undo SKY_TO_CSS (orthonormal, so its transpose).
  const rows: Vec3[] = [r, [-u[0], -u[1], -u[2]], [-f[0], -f[1], -f[2]]];
  const q: Mat3 = [
    [dot(rows[0], SKY_TO_CSS[0]), dot(rows[0], SKY_TO_CSS[1]), dot(rows[0], SKY_TO_CSS[2])],
    [dot(rows[1], SKY_TO_CSS[0]), dot(rows[1], SKY_TO_CSS[1]), dot(rows[1], SKY_TO_CSS[2])],
    [dot(rows[2], SKY_TO_CSS[0]), dot(rows[2], SKY_TO_CSS[1]), dot(rows[2], SKY_TO_CSS[2])],
  ];
  return matrix3d(q, [0, 0, cube.focal]);
}

/** The compass reading's tilt, clamped as the view is. */
export const clampTilt = (tilt: number) => Math.min(MAX_TILT, Math.max(0, tilt));

/** Altitude and azimuth of a screen point, for anything that wants degrees. */
export function viewAltAz(cube: Cube, view: LookView, x: number, y: number): { alt: number; az: number } {
  return altAz(viewDirection(cube, view, x, y));
}
