import { Ps1Model } from './ps1-models';

/**
 * A tiny PS1-style software renderer for the Lab's stage: a low-resolution RGBA buffer (scaled up with
 * `image-rendering: pixelated`), vertices snapped to whole pixels (the PS1 wobble), flat shading from one
 * light, a z-buffer, 15-bit colour with a 4×4 ordered dither, and a dithered shadow on the floor. Pure:
 * no DOM, so it's tested like `sky-render.ts`; the component copies the buffer into its canvas.
 */

/** Frames a second, as the PS1 often managed. */
export const PS1_FPS = 15;
/** The slow turn, in radians a second. */
export const PS1_TURN_SPEED = 0.9;
/** Looking down at the model a little. */
const PITCH = -0.42;
/** How far the camera is from the model's centre, in model units. */
const CAMERA_DISTANCE = 4.2;
/** Where the light comes from: upper left, in front. */
const LIGHT: Vec3 = [-0.45, 0.75, -0.48];
/** Lit faces run from AMBIENT to AMBIENT + DIFFUSE of their colour; emissive ones are always EMISSIVE. */
const AMBIENT = 0.42;
const DIFFUSE = 0.78;
const EMISSIVE = 1.1;
/** The 4×4 Bayer matrix, and how wide the dither is in 8-bit steps (one 15-bit step either way). */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const DITHER = 8;
/** 15-bit colour: five bits a channel. */
const CHANNEL_MASK = 0xf8;
/** The floor shadow's opacity (of black). */
const SHADOW_ALPHA = 110;

type Vec3 = [number, number, number];
type Rgb = [number, number, number];

interface Triangle {
  a: Vec3;
  b: Vec3;
  c: Vec3;
  /** The centre of the part it belongs to, so its normal can be turned to face outwards. */
  center: Vec3;
  rgb: Rgb;
  emissive: boolean;
}

export interface Ps1Buffer {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface Ps1Pose {
  /** The turn, in radians (the model's own `phase` is added to it). */
  turn: number;
  /** Seconds, for the VPS's bob. */
  time: number;
}

/** The six faces of a box, as corners of `boxCorners`, each split into two triangles. */
const BOX_FACES = [[0, 1, 3, 2], [4, 5, 7, 6], [0, 1, 5, 4], [2, 3, 7, 6], [0, 2, 6, 4], [1, 3, 7, 5]] as const;
const DROP_SIDES = 6;

const hexToRgb = (hex: string): Rgb =>
  [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

const triangleCache = new WeakMap<Ps1Model, readonly Triangle[]>();

/** A model's parts as triangles, worked out once per model. */
export function ps1Triangles(model: Ps1Model): readonly Triangle[] {
  const cached = triangleCache.get(model);
  if (cached) return cached;
  const tris: Triangle[] = [];
  for (const part of model.parts) {
    if (part.kind === 'box') {
      if (!part.w || !part.h || !part.d) continue;
      const center: Vec3 = [part.x, part.y, part.z];
      const corners: Vec3[] = [];
      for (let i = 0; i < 8; i++) {
        corners.push([
          part.x + (i & 1 ? 0.5 : -0.5) * part.w,
          part.y + (i & 2 ? 0.5 : -0.5) * part.h,
          part.z + (i & 4 ? 0.5 : -0.5) * part.d,
        ]);
      }
      const rgb = hexToRgb(part.color);
      const emissive = !!part.emissive;
      for (const [p, q, r, s] of BOX_FACES) {
        tris.push({ a: corners[p], b: corners[q], c: corners[r], center, rgb, emissive });
        tris.push({ a: corners[p], b: corners[r], c: corners[s], center, rgb, emissive });
      }
    } else {
      const radius = 0.62;
      const top: Vec3 = [0, 1.05, 0];
      const bottom: Vec3 = [0, -0.62, 0];
      const ring: Vec3[] = [];
      for (let i = 0; i < DROP_SIDES; i++) {
        const angle = (i * 2 * Math.PI) / DROP_SIDES;
        ring.push([Math.cos(angle) * radius, -0.12, Math.sin(angle) * radius]);
      }
      const upper = hexToRgb(part.color);
      const lower = hexToRgb(part.underside);
      for (let i = 0; i < DROP_SIDES; i++) {
        const next = ring[(i + 1) % DROP_SIDES];
        tris.push({ a: top, b: ring[i], c: next, center: [0, 0, 0], rgb: upper, emissive: false });
        tris.push({ a: bottom, b: ring[i], c: next, center: [0, -0.2, 0], rgb: lower, emissive: false });
      }
    }
  }
  triangleCache.set(model, tris);
  return tris;
}

/**
 * Draws `model` at `pose` into an RGBA buffer `width` × `height` (into `into` when given, which is
 * cleared first, so a canvas's own ImageData can be drawn into without a copy). Pixels the model and
 * its shadow don't cover stay transparent; every colour is on the 15-bit grid.
 */
export function renderPs1(model: Ps1Model, pose: Ps1Pose, width: number, height: number, into?: Uint8ClampedArray): Ps1Buffer {
  const W = width;
  const H = height;
  const px = into ?? new Uint8ClampedArray(W * H * 4);
  px.fill(0);
  // Holds 1/depth: screen-space weights interpolate that linearly (depth itself doesn't, after the
  // perspective divide), so overlapping parts keep the right order. Bigger is nearer; 0 is empty.
  const zbuffer = new Float32Array(W * H);

  const yaw = pose.turn + model.phase;
  const cosYaw = Math.cos(yaw), sinYaw = Math.sin(yaw), cosPitch = Math.cos(PITCH), sinPitch = Math.sin(PITCH);
  const bob = model.bobs ? Math.sin(pose.time * 2) * 0.06 : 0;
  const scale = model.scale;
  // Model space to camera space: scale, bob, turn about y, then tip towards the camera.
  const toCamera = (p: Vec3): Vec3 => {
    const x = p[0] * scale, y = (p[1] + bob) * scale, z = p[2] * scale;
    const x1 = x * cosYaw + z * sinYaw, z1 = -x * sinYaw + z * cosYaw;
    return [x1, y * cosPitch - z1 * sinPitch, y * sinPitch + z1 * cosPitch];
  };
  const focal = H * 1.25, centerX = W / 2, centerY = H * 0.54;
  // Camera space to whole pixels (the snap is the wobble), keeping depth for the z-buffer.
  const project = (q: Vec3): Vec3 => {
    const depth = q[2] + CAMERA_DISTANCE;
    return [Math.round(centerX + (focal * q[0]) / depth), Math.round(centerY - (focal * q[1]) / depth), depth];
  };

  // The floor shadow first: an ellipse, solid in the middle and checkered towards its edge.
  const shadowX = W * 0.5, shadowY = H * 0.8, shadowRx = W * 0.27, shadowRy = H * 0.06;
  for (let y = Math.max(0, Math.floor(shadowY - shadowRy)); y <= Math.min(H - 1, shadowY + shadowRy); y++) {
    for (let x = Math.max(0, Math.floor(shadowX - shadowRx)); x <= Math.min(W - 1, shadowX + shadowRx); x++) {
      const k = ((x - shadowX) / shadowRx) ** 2 + ((y - shadowY) / shadowRy) ** 2;
      if (k <= 1 && ((x + y) & 1 || k < 0.55)) px[(y * W + x) * 4 + 3] = SHADOW_ALPHA;
    }
  }

  for (const tri of ps1Triangles(model)) {
    const a = toCamera(tri.a), b = toCamera(tri.b), c = toCamera(tri.c), m = toCamera(tri.center);
    const shade = tri.emissive ? EMISSIVE : AMBIENT + DIFFUSE * Math.max(0, outwardNormalDotLight(a, b, c, m));
    const r0 = tri.rgb[0] * shade, g0 = tri.rgb[1] * shade, b0 = tri.rgb[2] * shade;

    const A = project(a), B = project(b), C = project(c);
    const area = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
    if (area === 0) continue;
    const minX = Math.max(0, Math.min(A[0], B[0], C[0])), maxX = Math.min(W - 1, Math.max(A[0], B[0], C[0]));
    const minY = Math.max(0, Math.min(A[1], B[1], C[1])), maxY = Math.min(H - 1, Math.max(A[1], B[1], C[1]));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const w0 = ((B[0] - x) * (C[1] - y) - (B[1] - y) * (C[0] - x)) / area;
        const w1 = ((C[0] - x) * (A[1] - y) - (C[1] - y) * (A[0] - x)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const inverseDepth = w0 / A[2] + w1 / B[2] + w2 / C[2];
        const i = y * W + x;
        if (inverseDepth <= zbuffer[i]) continue;
        zbuffer[i] = inverseDepth;
        const d = (BAYER[(x & 3) + (y & 3) * 4] / 16 - 0.5) * DITHER;
        px[i * 4] = quantize(r0 + d);
        px[i * 4 + 1] = quantize(g0 + d);
        px[i * 4 + 2] = quantize(b0 + d);
        px[i * 4 + 3] = 255;
      }
    }
  }
  return { data: px, width: W, height: H };
}

/** Rounds a channel down to the 15-bit grid. */
function quantize(value: number): number {
  return Math.max(0, Math.min(255, value)) & CHANNEL_MASK;
}

/** How squarely a face (camera space) is lit: its normal, turned away from its part's centre, dotted with the light. */
function outwardNormalDotLight(a: Vec3, b: Vec3, c: Vec3, center: Vec3): number {
  let nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
  let ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
  let nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const length = Math.hypot(nx, ny, nz) || 1;
  nx /= length; ny /= length; nz /= length;
  const gx = (a[0] + b[0] + c[0]) / 3 - center[0];
  const gy = (a[1] + b[1] + c[1]) / 3 - center[1];
  const gz = (a[2] + b[2] + c[2]) / 3 - center[2];
  const sign = nx * gx + ny * gy + nz * gz < 0 ? -1 : 1;
  return sign * (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
}
