import { Bodies, PlanetName } from './sky-bodies';
import { Vec3, j2000ToHorizontalMatrix, multiply, projectSouth, raDecToVector, sunHorizontal, altAz } from './sky-math';

/**
 * Draws the sky into a small RGBA buffer, one buffer pixel per "art" pixel;
 * the component scales it up with nearest-neighbour so it reads as pixel art.
 * Everything here is pure (no DOM), so it can be tested directly.
 */

/** Size of public/background.webp, and the row where its horizon (the valley floor) sits. */
export const BACKGROUND_SIZE = { width: 2560, height: 1706 } as const;
export const BACKGROUND_HORIZON_Y = 905;
/** One art pixel is this many CSS pixels. */
export const ART_PIXEL = 3;

export interface StarFile {
  readonly magLimit: number;
  /** [raDeg, decDeg, mag, bv], J2000 */
  readonly stars: readonly (readonly [number, number, number, number])[];
}
export interface ConstellationFile {
  readonly constellations: readonly { readonly id: string; readonly lines: readonly (readonly (readonly [number, number])[])[] }[];
}

export interface SkyCatalog {
  readonly stars: readonly { readonly v: Vec3; readonly mag: number; readonly color: readonly [number, number, number] }[];
  readonly lines: readonly (readonly Vec3[])[];
}

export function prepareCatalog(stars: StarFile, constellations: ConstellationFile): SkyCatalog {
  return {
    stars: stars.stars.map(([ra, dec, mag, bv]) => ({ v: raDecToVector(ra, dec), mag, color: starColor(bv) })),
    lines: constellations.constellations.flatMap(c => c.lines.map(line => line.map(([ra, dec]) => raDecToVector(ra, dec)))),
  };
}

export interface SkyLayout {
  /** Buffer size in art pixels. */
  readonly width: number;
  readonly height: number;
  /** Where altitude 0 due south lands, in art pixels. */
  readonly centerX: number;
  readonly horizonY: number;
  /** Projection scale: the zenith is 2 × scale above the horizon, east and west 2 × scale either side. */
  readonly scale: number;
}

/**
 * Lines the sky up with the background as CSS draws it (`cover`, centred):
 * altitude 0 sits on the painting's valley floor. The projection is sized so
 * east-to-west spans the width on landscape screens and horizon-to-zenith
 * spans the sky on portrait ones.
 */
export function computeLayout(viewportWidth: number, viewportHeight: number, artPixel = ART_PIXEL): SkyLayout {
  const imageScale = Math.max(viewportWidth / BACKGROUND_SIZE.width, viewportHeight / BACKGROUND_SIZE.height);
  const offsetY = (viewportHeight - BACKGROUND_SIZE.height * imageScale) / 2;
  const horizonCss = offsetY + BACKGROUND_HORIZON_Y * imageScale;
  const width = Math.max(1, Math.ceil(viewportWidth / artPixel));
  return {
    width,
    height: Math.max(1, Math.ceil(viewportHeight / artPixel)),
    centerX: viewportWidth / 2 / artPixel,
    horizonY: horizonCss / artPixel,
    scale: Math.max(viewportWidth / 4, horizonCss / 2) / artPixel,
  };
}

type Rgb = readonly [number, number, number];

/** Sky colours (zenith, horizon) by Sun altitude. The night end matches the painting. */
const SKY_KEYS: readonly { alt: number; top: Rgb; horizon: Rgb }[] = [
  { alt: -18, top: [1, 32, 49], horizon: [27, 78, 88] },
  { alt: -12, top: [6, 38, 64], horizon: [52, 84, 102] },
  { alt: -6, top: [24, 56, 98], horizon: [168, 104, 90] },
  { alt: 0, top: [44, 86, 146], horizon: [222, 158, 104] },
  { alt: 8, top: [46, 98, 170], horizon: [150, 190, 224] },
];

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
/** 0 at `from`, 1 at `to`, smooth in between (either direction). */
export const smoothstep = (from: number, to: number, x: number) => {
  const t = clamp01((x - from) / (to - from));
  return t * t * (3 - 2 * t);
};

export function skyColors(sunAlt: number): { top: Rgb; horizon: Rgb } {
  if (sunAlt <= SKY_KEYS[0].alt) return SKY_KEYS[0];
  const last = SKY_KEYS[SKY_KEYS.length - 1];
  if (sunAlt >= last.alt) return last;
  const i = SKY_KEYS.findIndex(k => k.alt > sunAlt);
  const [a, b] = [SKY_KEYS[i - 1], SKY_KEYS[i]];
  const t = (sunAlt - a.alt) / (b.alt - a.alt);
  const lerp = (x: Rgb, y: Rgb): Rgb => [mix(x[0], y[0], t), mix(x[1], y[1], t), mix(x[2], y[2], t)];
  return { top: lerp(a.top, b.top), horizon: lerp(a.horizon, b.horizon) };
}

/** How visible the stars are: 1 in full darkness, 0 once the Sun is within 4° of the horizon. */
export const starVisibility = (sunAlt: number) => smoothstep(-4, -14, sunAlt);

/** Rough star colour from the B−V index. */
export function starColor(bv: number): Rgb {
  if (bv < 0) return [178, 198, 255];
  if (bv < 0.4) return [236, 240, 255];
  if (bv < 0.8) return [255, 246, 222];
  if (bv < 1.3) return [255, 222, 176];
  return [255, 190, 140];
}

const PLANET_COLORS: Record<PlanetName, Rgb> = {
  Mercury: [226, 214, 200],
  Venus: [255, 250, 232],
  Mars: [255, 156, 112],
  Jupiter: [255, 240, 214],
  Saturn: [242, 222, 168],
};

/** 4×4 ordered-dither thresholds, 0…15. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** The sky gradient steps in this many colour levels per channel; dithering covers the steps. */
const GRADIENT_STEP = 4;

export interface SkyInput {
  readonly date: Date;
  readonly lat: number;
  readonly lon: number;
  readonly catalog: SkyCatalog;
  /** From astronomy-engine; without it the sky still has stars and the right colour, just no Moon or planets. */
  readonly bodies: Bodies | null;
}

export interface SkyRenderResult {
  readonly sunAlt: number;
  /** How many catalogue stars ended up drawn (above the horizon, on screen, not washed out). */
  readonly starsDrawn: number;
  /** Where the Moon was drawn (art pixels) and the mean offset of its lit pixels from its centre (y down), or null if not drawn. */
  readonly moon: { readonly x: number; readonly y: number; readonly litCount: number; readonly litDx: number; readonly litDy: number } | null;
}

export function renderSky(buffer: Uint8ClampedArray, layout: SkyLayout, input: SkyInput): SkyRenderResult {
  const { width, height, centerX, horizonY, scale } = layout;
  const sunH = input.bodies?.sun.h ?? sunHorizontal(input.date, input.lat, input.lon);
  const sunAlt = altAz(sunH).alt;

  // Sky gradient, zenith colour at the top of the screen to horizon colour at altitude 0.
  const { top, horizon } = skyColors(sunAlt);
  for (let y = 0; y < height; y++) {
    const t = clamp01(y / Math.max(1, horizonY));
    const eased = t * t;
    const base = [mix(top[0], horizon[0], eased), mix(top[1], horizon[1], eased), mix(top[2], horizon[2], eased)];
    for (let x = 0; x < width; x++) {
      const threshold = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
      const i = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        buffer[i + c] = Math.floor(base[c] / GRADIENT_STEP + threshold) * GRADIENT_STEP;
      }
      buffer[i + 3] = 255;
    }
  }

  const blend = (x: number, y: number, color: Rgb, alpha: number) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= width || y >= height || alpha <= 0) return;
    const i = (y * width + x) * 4;
    const a = Math.min(1, alpha);
    buffer[i] = mix(buffer[i], color[0], a);
    buffer[i + 1] = mix(buffer[i + 1], color[1], a);
    buffer[i + 2] = mix(buffer[i + 2], color[2], a);
  };
  const toScreen = (h: Vec3) => {
    const p = projectSouth(h);
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
    return { x: centerX + p.x * scale, y: horizonY - p.y * scale };
  };
  const onScreen = (p: { x: number; y: number }, margin = 2) =>
    p.x >= -margin && p.y >= -margin && p.x < width + margin && p.y < height + margin;

  const stars = starVisibility(sunAlt);
  const matrix = j2000ToHorizontalMatrix(input.date, input.lat, input.lon);
  let starsDrawn = 0;

  if (stars > 0) {
    // Constellation lines: 1-px stepped lines, faint, under the stars.
    const lineColor: Rgb = [150, 192, 214];
    for (const line of input.catalog.lines) {
      for (let k = 1; k < line.length; k++) {
        const ha = multiply(matrix, line[k - 1]);
        const hb = multiply(matrix, line[k]);
        if (ha[2] < -0.05 && hb[2] < -0.05) continue;
        const a = toScreen(ha);
        const b = toScreen(hb);
        if (!a || !b || (!onScreen(a, width) && !onScreen(b, width))) continue;
        // A segment near the north point can project absurdly long; skip it.
        // (Measured against the projection scale, so it means the same on every screen shape.)
        if (Math.hypot(b.x - a.x, b.y - a.y) > 3 * scale) continue;
        drawLine(a.x, a.y, b.x, b.y, (x, y) => blend(x, y, lineColor, 0.25 * stars));
      }
    }

    for (const star of input.catalog.stars) {
      const h = multiply(matrix, star.v);
      if (h[2] < 0) continue;
      const p = toScreen(h);
      if (!p || !onScreen(p, 0)) continue;
      const brightness = (0.3 + 0.7 * clamp01((4.5 - star.mag) / 5)) * stars;
      blend(p.x, p.y, star.color, brightness);
      if (star.mag < 1) plusArms(blend, p.x, p.y, star.color, brightness * 0.45);
      starsDrawn++;
    }
  }

  if (input.bodies) {
    for (const planet of input.bodies.planets) {
      // The brightest planets (usually Venus and Jupiter) show up a little before the stars do.
      const visibility = planet.mag < -1.5 ? smoothstep(-2, -9, sunAlt) : stars;
      if (planet.alt < 0 || visibility <= 0) continue;
      const p = toScreen(planet.h);
      if (!p || !onScreen(p, 0)) continue;
      const brightness = (0.55 + 0.45 * clamp01((1.5 - planet.mag) / 5)) * visibility;
      blend(p.x, p.y, PLANET_COLORS[planet.name], brightness);
      if (planet.mag < 0.5) plusArms(blend, p.x, p.y, PLANET_COLORS[planet.name], brightness * 0.5);
    }
  }

  const discRadius = Math.max(3, Math.min(6, Math.round(width / 120)));

  if (sunAlt > -1) {
    const p = toScreen(sunH);
    if (p && onScreen(p, discRadius + 2)) {
      disc(p.x, p.y, discRadius + 1, (x, y) => blend(x, y, [255, 236, 190], 0.35));
      disc(p.x, p.y, discRadius, (x, y) => blend(x, y, [255, 250, 232], 1));
    }
  }

  let moonResult: SkyRenderResult['moon'] = null;
  const moon = input.bodies?.moon;
  if (moon && moon.alt > -1) {
    const p = toScreen(moon.h);
    if (p && onScreen(p, discRadius + 1)) {
      const toSun = screenDirection(moon.h, sunH, toScreen);
      const i = (moon.phaseAngle * Math.PI) / 180;
      const sun = [toSun.x * Math.sin(i), toSun.y * Math.sin(i), Math.cos(i)];
      const lit: Rgb = [238, 234, 214];
      const shadow: Rgb = [24, 40, 54];
      // In daylight the Moon is a pale ghost; at night the unlit part hides the stars behind it.
      const daylight = 1 - stars;
      const litAlpha = daylight > 0.5 ? 0.75 : 1;
      const r = discRadius;
      const [cx, cy] = [Math.round(p.x), Math.round(p.y)];
      let [litCount, litX, litY] = [0, 0, 0];
      disc(p.x, p.y, r, (x, y) => {
        const nx = (x - cx) / (r + 0.5);
        const ny = -(y - cy) / (r + 0.5);
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        if (nx * sun[0] + ny * sun[1] + nz * sun[2] > 0) {
          blend(x, y, lit, litAlpha);
          litCount++;
          litX += x - cx;
          litY += y - cy;
        } else if (daylight < 0.5) {
          blend(x, y, shadow, 0.6);
        }
      });
      // A thin crescent can fall between pixel centres; keep at least the limb facing the Sun lit.
      if (litCount === 0 && moon.illuminated > 0.02) {
        const [lx, ly] = [Math.round(toSun.x * r), Math.round(-toSun.y * r)];
        blend(cx + lx, cy + ly, lit, litAlpha);
        [litCount, litX, litY] = [1, lx, ly];
      }
      moonResult = { x: cx, y: cy, litCount, litDx: litCount ? litX / litCount : 0, litDy: litCount ? litY / litCount : 0 };
    }
  }

  return { sunAlt, starsDrawn, moon: moonResult };
}

/** Unit screen direction (x right, y up) from body `from` toward body `to` along the sky. */
function screenDirection(from: Vec3, to: Vec3, toScreen: (h: Vec3) => { x: number; y: number } | null): { x: number; y: number } {
  const dot = from[0] * to[0] + from[1] * to[1] + from[2] * to[2];
  const tangent = [to[0] - dot * from[0], to[1] - dot * from[1], to[2] - dot * from[2]];
  const len = Math.hypot(tangent[0], tangent[1], tangent[2]) || 1;
  const step = 0.02 / len;
  const nudged: Vec3 = [from[0] + tangent[0] * step, from[1] + tangent[1] * step, from[2] + tangent[2] * step];
  const a = toScreen(from);
  const b = toScreen(nudged);
  if (!a || !b) return { x: 0, y: 1 };
  const dx = b.x - a.x;
  const dy = -(b.y - a.y);
  const d = Math.hypot(dx, dy) || 1;
  return { x: dx / d, y: dy / d };
}

type Blend = (x: number, y: number, color: Rgb, alpha: number) => void;

function plusArms(blend: Blend, x: number, y: number, color: Rgb, alpha: number) {
  blend(x - 1, y, color, alpha);
  blend(x + 1, y, color, alpha);
  blend(x, y - 1, color, alpha);
  blend(x, y + 1, color, alpha);
}

/** Calls `plot` for each pixel of a filled pixel-art circle. */
function disc(cx: number, cy: number, r: number, plot: (x: number, y: number) => void) {
  const x0 = Math.round(cx);
  const y0 = Math.round(cy);
  const limit = r * r + r * 0.8;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy <= limit) plot(x0 + dx, y0 + dy);
    }
  }
}

/** Bresenham: one pixel per step, no anti-aliasing. */
export function drawLine(x0: number, y0: number, x1: number, y1: number, plot: (x: number, y: number) => void) {
  let [x, y] = [Math.round(x0), Math.round(y0)];
  const [xe, ye] = [Math.round(x1), Math.round(y1)];
  const dx = Math.abs(xe - x);
  const dy = -Math.abs(ye - y);
  const sx = x < xe ? 1 : -1;
  const sy = y < ye ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    plot(x, y);
    if (x === xe && y === ye) return;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}
