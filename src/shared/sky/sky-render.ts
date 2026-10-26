import { Bodies, PlanetName } from './sky-bodies';
import { Vec3, altAz, altAzToVector, j2000ToHorizontalMatrix, multiply, projectSouth, raDecToVector, sunHorizontal } from './sky-math';

/**
 * Draws the sky into an RGBA buffer: the gradient (unless the caller paints it),
 * soft stars, antialiased constellation lines, the Sun and the Moon. The buffer
 * is usually at device resolution; `layout.artPixel` says how many CSS pixels
 * one buffer pixel is. Everything here is pure (no DOM), so it can be tested.
 * "Buffer pixels" below means pixels of that buffer.
 */

/** The painting's size (public/background.webp; the landscape looks are 3/4 of it), and the row where its horizon (the valley floor) sits. */
export const BACKGROUND_SIZE = { width: 2560, height: 1706 } as const;
export const BACKGROUND_HORIZON_Y = 905;
/** The low point of the valley between the painted mountains, where the pretend sunrise and sunset happen. */
export const BACKGROUND_VALLEY = { x: 1350, y: 922 } as const;
/** The farmhouse's gable end, where a light is left on after dark. */
export const BACKGROUND_WINDOW = { x: 542, y: 1052 } as const;
/** The campfire in the yard beside the farmhouse, where the flames sit on the ground. */
export const BACKGROUND_CAMPFIRE = { x: 672, y: 1071 } as const;
/** CSS pixels per buffer pixel by default. The component passes 1 / devicePixelRatio for crisp, smooth drawing. */
export const ART_PIXEL = 1;

export interface StarFile {
  readonly magLimit: number;
  /** [raDeg, decDeg, mag, bv], J2000 */
  readonly stars: readonly (readonly [number, number, number, number])[];
}
export interface NameFile {
  /** [raDeg, decDeg, name, constellation abbreviation], J2000 */
  readonly names: readonly (readonly [number, number, string, string])[];
}
export interface ConstellationFile {
  readonly constellations: readonly { readonly id: string; readonly lines: readonly (readonly (readonly [number, number])[])[] }[];
}

export interface SkyCatalog {
  readonly stars: readonly { readonly v: Vec3; readonly mag: number; readonly color: readonly [number, number, number] }[];
  readonly lines: readonly (readonly Vec3[])[];
  /** The constellation each entry of `lines` belongs to. */
  readonly lineIds: readonly string[];
  /** Named bright stars, for hover labels (empty if the names file wasn't given). */
  readonly names: readonly { readonly v: Vec3; readonly name: string; readonly constellation: string }[];
  /** Each constellation figure's id and the (normalised) mean direction of its vertices. */
  readonly figures: readonly { readonly id: string; readonly center: Vec3 }[];
}

export function prepareCatalog(stars: StarFile, constellations: ConstellationFile, names?: NameFile): SkyCatalog {
  return {
    lineIds: constellations.constellations.flatMap(c => c.lines.map(() => c.id)),
    names: (names?.names ?? []).map(([ra, dec, name, constellation]) => ({ v: raDecToVector(ra, dec), name, constellation })),
    stars: stars.stars.map(([ra, dec, mag, bv]) => ({ v: raDecToVector(ra, dec), mag, color: starColor(bv) })),
    lines: constellations.constellations.flatMap(c => c.lines.map(line => line.map(([ra, dec]) => raDecToVector(ra, dec)))),
    figures: constellations.constellations.map(c => {
      const sum = [0, 0, 0];
      for (const [ra, dec] of c.lines.flat()) {
        const v = raDecToVector(ra, dec);
        sum[0] += v[0];
        sum[1] += v[1];
        sum[2] += v[2];
      }
      const length = Math.hypot(sum[0], sum[1], sum[2]) || 1;
      return { id: c.id, center: [sum[0] / length, sum[1] / length, sum[2] / length] as Vec3 };
    }),
  };
}

export interface SkyLayout {
  /** CSS pixels per buffer pixel. */
  readonly artPixel: number;
  /** Buffer size in buffer pixels. */
  readonly width: number;
  readonly height: number;
  /** Where altitude 0 due south lands, in buffer pixels. */
  readonly centerX: number;
  readonly horizonY: number;
  /** Projection scale: the zenith is 2 × scale above the horizon, east and west 2 × scale either side. */
  readonly scale: number;
  /** The painting's valley between the mountains, in buffer pixels. */
  readonly valleyX: number;
  readonly valleyY: number;
  /** Where the scene's (0, 0) lands and how many buffer pixels one scene pixel spans. */
  readonly imageX: number;
  readonly imageY: number;
  readonly imageScale: number;
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
  const offsetX = (viewportWidth - BACKGROUND_SIZE.width * imageScale) / 2;
  const horizonCss = offsetY + BACKGROUND_HORIZON_Y * imageScale;
  const width = Math.max(1, Math.ceil(viewportWidth / artPixel));
  return {
    artPixel,
    width,
    height: Math.max(1, Math.ceil(viewportHeight / artPixel)),
    centerX: viewportWidth / 2 / artPixel,
    horizonY: horizonCss / artPixel,
    scale: Math.max(viewportWidth / 4, horizonCss / 2) / artPixel,
    valleyX: (offsetX + BACKGROUND_VALLEY.x * imageScale) / artPixel,
    valleyY: (offsetY + BACKGROUND_VALLEY.y * imageScale) / artPixel,
    imageX: offsetX / artPixel,
    imageY: offsetY / artPixel,
    imageScale: imageScale / artPixel,
  };
}

export type Rgb = readonly [number, number, number];

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
/** A touch of ordered dither on the gradient, so 8-bit colour doesn't band. */
const GRADIENT_STEP = 1;

/**
 * How the sky is lit. Star, Moon and planet positions are always real; only the
 * light changes. 'darkness' (the default) ignores the Sun so the stars are always
 * out; 'real' follows the actual Sun; 'sunrise' and 'sunset' are staged, with the
 * Sun sitting in the valley between the painted mountains; 'day' is a fixed midday.
 */
export type Lighting = 'darkness' | 'real' | 'sunrise' | 'sunset' | 'day';
export const LIGHTINGS: readonly Lighting[] = ['darkness', 'real', 'sunrise', 'sunset', 'day'];

/** Everything about the light that the drawing needs, whatever produced it. */
interface Look {
  readonly top: Rgb;
  readonly horizon: Rgb;
  /** A warm glow along the horizon, centred on `x` (buffer pixels). */
  readonly glow: { readonly x: number; readonly color: Rgb; readonly strength: number } | null;
  /** 0…1: how visible stars (and constellation lines) are. */
  readonly stars: number;
  /** 0…1: the same for the brightest planets, which show up first. */
  readonly brightPlanets: number;
  /** Where to draw the Sun's disc, in buffer pixels, or null for no Sun. */
  readonly sun: { readonly x: number; readonly y: number } | null;
  /** The Sun altitude this look stands for (drives how much page cards darken). */
  readonly sunAlt: number;
  /** And its azimuth (morning or evening, for the landscape's look). */
  readonly sunAz: number;
}

const DARKNESS_SUN_ALT = -30;
const DAY_SUN = { alt: 40, az: 200 } as const;

/** The staged sunrise and sunset: their own palettes, the Sun half sunk into the valley. */
const STAGED: Record<'sunrise' | 'sunset', { top: Rgb; horizon: Rgb; glow: Rgb; stars: number; sunDy: number }> = {
  // Cooler and pinker, the Sun just clearing the valley floor, a few stars hanging on.
  // sunDy: how far below the valley floor the disc's centre sits, in disc radii.
  sunrise: { top: [28, 58, 104], horizon: [238, 172, 136], glow: [255, 196, 150], stars: 0.2, sunDy: -0.15 },
  // Warmer and deeper, the Sun mostly gone, the first stars coming out.
  sunset: { top: [20, 44, 86], horizon: [228, 132, 84], glow: [255, 128, 64], stars: 0.35, sunDy: 0.35 },
};
const STAGED_SUN_ALT = -3;

/** Radius of the Sun and Moon discs, in buffer pixels (6–13 CSS px, by screen width). */
export function sunDiscRadius(layout: SkyLayout): number {
  return Math.max(6, Math.min(13, (layout.width * layout.artPixel) / 110)) / layout.artPixel;
}

/** Gaussian-ish glow strength for the real Sun near the horizon. */
const twilightGlow = (sunAlt: number) => smoothstep(-14, -4, sunAlt) * (1 - smoothstep(2, 12, sunAlt));

function lookFor(lighting: Lighting, realSun: Vec3, layout: SkyLayout, toScreen: (h: Vec3) => { x: number; y: number } | null): Look {
  switch (lighting) {
    case 'darkness': {
      const { top, horizon } = skyColors(DARKNESS_SUN_ALT);
      return { top, horizon, glow: null, stars: 1, brightPlanets: 1, sun: null, sunAlt: DARKNESS_SUN_ALT, sunAz: 0 };
    }
    case 'sunrise':
    case 'sunset': {
      const staged = STAGED[lighting];
      return {
        top: staged.top,
        horizon: staged.horizon,
        glow: { x: layout.valleyX, color: staged.glow, strength: 1 },
        stars: staged.stars,
        brightPlanets: Math.min(1, staged.stars * 2.5),
        sun: { x: layout.valleyX, y: layout.valleyY + staged.sunDy * sunDiscRadius(layout) },
        sunAlt: STAGED_SUN_ALT,
        sunAz: lighting === 'sunrise' ? 90 : 270,
      };
    }
    case 'day':
    case 'real': {
      const sunVector = lighting === 'day' ? altAzToVector(DAY_SUN.alt, DAY_SUN.az) : realSun;
      const sunAlt = altAz(sunVector).alt;
      const { top, horizon } = skyColors(sunAlt);
      const glowStrength = twilightGlow(sunAlt);
      const projected = glowStrength > 0 || sunAlt > -1 ? toScreen(sunVector) : null;
      return {
        top,
        horizon,
        glow: glowStrength > 0 && projected ? { x: projected.x, color: [255, 150, 92], strength: glowStrength } : null,
        stars: starVisibility(sunAlt),
        brightPlanets: smoothstep(-2, -9, sunAlt),
        sun: sunAlt > -1 ? projected : null,
        sunAlt,
        sunAz: altAz(sunVector).az,
      };
    }
  }
}

export interface SkyInput {
  readonly date: Date;
  readonly lat: number;
  readonly lon: number;
  readonly catalog: SkyCatalog;
  /** From astronomy-engine; without it the sky still has stars and the right colour, just no Moon or planets. */
  readonly bodies: Bodies | null;
  /** Defaults to 'darkness'. */
  readonly lighting?: Lighting;
  /**
   * Paint the sky gradient into the buffer (default). False leaves the buffer
   * transparent apart from the stars, Moon and so on, for a caller that paints
   * the gradient itself (the component does, with the GPU; see `background`).
   */
  readonly paintBackground?: boolean;
  /**
   * Draw the Sun's disc and halo (default). False leaves them to the caller,
   * which gets the place in `sun` (the component draws the Sun itself, so it
   * can move it between lights).
   */
  readonly drawSun?: boolean;
}

/** The sky's colours, for painting the gradient: zenith → horizon (eased by t²), plus a horizon glow. */
export interface SkyBackground {
  readonly top: Rgb;
  readonly horizon: Rgb;
  /** Glow centred on x (buffer pixels): colour mixed in by strength × t³ × 0.55 × exp(−(dx / (0.3 × width))²). */
  readonly glow: { readonly x: number; readonly color: Rgb; readonly strength: number } | null;
}

/** Something on screen that can be named on hover. Positions in buffer pixels. */
export interface SkyTarget {
  readonly kind: 'star' | 'planet' | 'moon' | 'sun';
  readonly name: string;
  /** Constellation abbreviation for stars. */
  readonly constellation?: string;
  /** Extra detail, e.g. how much of the Moon is lit. */
  readonly detail?: string;
  readonly x: number;
  readonly y: number;
  /** How close (buffer pixels) the pointer has to be. */
  readonly radius: number;
}

/** A drawn constellation line segment, in buffer pixels. */
export interface SkySegment {
  readonly figure: string;
  readonly ax: number;
  readonly ay: number;
  readonly bx: number;
  readonly by: number;
}

export interface SkyRenderResult {
  readonly sunAlt: number;
  /** Azimuth of the Sun that lit this look (degrees from north through east). */
  readonly sunAz: number;
  /** How many catalogue stars ended up drawn (above the horizon, on screen, not washed out). */
  readonly starsDrawn: number;
  /** Where the Moon was drawn (buffer pixels) and the mean offset of its lit pixels from its centre (y down), or null if not drawn. */
  readonly moon: { readonly x: number; readonly y: number; readonly litCount: number; readonly litDx: number; readonly litDy: number } | null;
  /** What was drawn that can be named on hover (only things visible in this lighting). */
  readonly targets: readonly SkyTarget[];
  /** Constellation line segments as drawn. */
  readonly segments: readonly SkySegment[];
  /** Soft halos to add over the finished picture (bright stars, planets, Moon, Sun). */
  readonly glows: readonly SkyGlow[];
  readonly background: SkyBackground;
  /** Where the Sun is (drawn or not, on screen or not), in buffer pixels, or null if this light has none. */
  readonly sun: { readonly x: number; readonly y: number; readonly radius: number } | null;
}

/** The Sun's disc colour, and its halo (radius in disc radii). The component's .sun element uses the same values in CSS. */
export const SUN_COLOR: Rgb = [255, 250, 232];
export const SUN_GLOW = { radius: 6, color: [255, 214, 150] as Rgb, strength: 0.55 } as const;

/** A soft halo, in buffer pixels. */
export interface SkyGlow {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly color: Rgb;
  /** Peak opacity, 0…1. */
  readonly strength: number;
}

export function renderSky(buffer: Uint8ClampedArray, layout: SkyLayout, input: SkyInput): SkyRenderResult {
  const { width, height, centerX, horizonY, scale } = layout;
  // The real Sun always lights the Moon, so its phase is right whatever the lighting.
  const sunH = input.bodies?.sun.h ?? sunHorizontal(input.date, input.lat, input.lon);
  const toScreen = (h: Vec3) => {
    const p = projectSouth(h);
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
    return { x: centerX + p.x * scale, y: horizonY - p.y * scale };
  };
  const look = lookFor(input.lighting ?? 'darkness', sunH, layout, toScreen);
  const sunAlt = look.sunAlt;

  // Sky gradient, zenith colour at the top of the screen to horizon colour at altitude 0,
  // plus the glow along the horizon on the Sun's side.
  const { top, horizon, glow } = look;
  // Fast path: one colour per row (four dithered variants), written a whole pixel at a time.
  // Only rows low enough to carry the glow are worked out pixel by pixel.
  const paintBackground = input.paintBackground ?? true;
  const pixels = new Uint32Array(buffer.buffer, buffer.byteOffset, width * height);
  const littleEndian = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
  const pack = (r: number, g: number, b: number) =>
    littleEndian ? (255 << 24) | (b << 16) | (g << 8) | r : (r << 24) | (g << 16) | (b << 8) | 255;
  const glowColumn = glow ? Float32Array.from({ length: width }, (_, x) => Math.exp(-(((x - glow.x) / (width * 0.3)) ** 2))) : null;
  for (let y = 0; paintBackground && y < height; y++) {
    const t = clamp01(y / Math.max(1, horizonY));
    const eased = t * t;
    const base = [mix(top[0], horizon[0], eased), mix(top[1], horizon[1], eased), mix(top[2], horizon[2], eased)];
    const rowGlow = glow ? glow.strength * t * t * t * 0.55 : 0;
    const row = y * width;
    const variants = [0, 1, 2, 3].map(k => {
      const threshold = (BAYER[(y & 3) * 4 + k] + 0.5) / 16;
      const [r, g, b] = base.map(v => Math.floor(v / GRADIENT_STEP + threshold) * GRADIENT_STEP);
      return pack(r, g, b);
    });
    for (let x = 0; x < width; x++) pixels[row + x] = variants[x & 3];
    if (rowGlow < 0.002 || !glow || !glowColumn) continue;
    // The glow only reaches so far either side of the Sun; work out just that stretch.
    const reach = width * 0.3 * Math.sqrt(Math.log(rowGlow / 0.002));
    const x0 = Math.max(0, Math.floor(glow.x - reach));
    const x1 = Math.min(width, Math.ceil(glow.x + reach));
    for (let x = x0; x < x1; x++) {
      const threshold = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
      const amount = rowGlow * glowColumn[x];
      const r = Math.floor(mix(base[0], glow.color[0], amount) / GRADIENT_STEP + threshold) * GRADIENT_STEP;
      const g = Math.floor(mix(base[1], glow.color[1], amount) / GRADIENT_STEP + threshold) * GRADIENT_STEP;
      const b = Math.floor(mix(base[2], glow.color[2], amount) / GRADIENT_STEP + threshold) * GRADIENT_STEP;
      pixels[row + x] = pack(r, g, b);
    }
  }

  // "Over" compositing, so it works on the opaque gradient and on a transparent buffer alike.
  const blend = (x: number, y: number, color: Rgb, alpha: number) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= width || y >= height || alpha <= 0) return;
    const i = (y * width + x) * 4;
    const a = Math.min(1, alpha);
    const below = buffer[i + 3] / 255;
    const out = a + below * (1 - a);
    for (let c = 0; c < 3; c++) buffer[i + c] = (color[c] * a + buffer[i + c] * below * (1 - a)) / out;
    buffer[i + 3] = out * 255;
  };
  const onScreen = (p: { x: number; y: number }, margin = 2) =>
    p.x >= -margin && p.y >= -margin && p.x < width + margin && p.y < height + margin;

  const stars = look.stars;
  const matrix = j2000ToHorizontalMatrix(input.date, input.lat, input.lon);
  /** CSS pixels → buffer pixels (the buffer may be at device resolution). */
  const px = (css: number) => css / layout.artPixel;
  let starsDrawn = 0;
  const targets: SkyTarget[] = [];
  const segments: SkySegment[] = [];
  const glows: SkyGlow[] = [];

  // A soft round dot centred anywhere (not just on pixel centres).
  const splat = (x: number, y: number, color: Rgb, alpha: number, sigma: number) => {
    const reach = Math.ceil(sigma * 2.5);
    const [x0, y0] = [Math.round(x), Math.round(y)];
    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        const d2 = (x0 + dx - x) ** 2 + (y0 + dy - y) ** 2;
        blend(x0 + dx, y0 + dy, color, alpha * Math.exp(-d2 / (2 * sigma * sigma)));
      }
    }
  };

  if (stars > 0) {
    // Constellation lines: thin, faint, antialiased, under the stars.
    const lineColor: Rgb = [150, 192, 214];
    const lineAlpha = 0.22 * stars;
    for (let l = 0; l < input.catalog.lines.length; l++) {
      const line = input.catalog.lines[l];
      const figure = input.catalog.lineIds[l];
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
        drawLine(a.x, a.y, b.x, b.y, (x, y, coverage) => blend(x, y, lineColor, lineAlpha * coverage));
        segments.push({ figure, ax: a.x, ay: a.y, bx: b.x, by: b.y });
      }
    }

    for (const star of input.catalog.stars) {
      const h = multiply(matrix, star.v);
      if (h[2] < 0) continue;
      const p = toScreen(h);
      if (!p || !onScreen(p, 2)) continue;
      const strength = clamp01((4.5 - star.mag) / 5.5);
      const brightness = (0.35 + 0.65 * strength) * stars;
      splat(p.x, p.y, star.color, brightness, px(0.45 + 0.5 * strength));
      if (star.mag < 1.5) glows.push({ x: p.x, y: p.y, radius: px(4 + 4 * strength), color: star.color, strength: 0.35 * brightness });
      starsDrawn++;
    }

    // Named stars become hover targets once they're visible enough to point at.
    if (stars > 0.3) {
      for (const named of input.catalog.names) {
        const h = multiply(matrix, named.v);
        if (h[2] < 0) continue;
        const p = toScreen(h);
        if (!p || !onScreen(p, 0)) continue;
        targets.push({ kind: 'star', name: named.name, constellation: named.constellation, x: p.x, y: p.y, radius: px(9) });
      }
    }
  }

  if (input.bodies) {
    for (const planet of input.bodies.planets) {
      // The brightest planets (usually Venus and Jupiter) show up a little before the stars do.
      const visibility = planet.mag < -1.5 ? look.brightPlanets : stars;
      if (planet.alt < 0 || visibility <= 0) continue;
      const p = toScreen(planet.h);
      if (!p || !onScreen(p, 2)) continue;
      const strength = clamp01((1.5 - planet.mag) / 5);
      const brightness = (0.6 + 0.4 * strength) * visibility;
      splat(p.x, p.y, PLANET_COLORS[planet.name], brightness, px(0.8 + 0.5 * strength));
      glows.push({ x: p.x, y: p.y, radius: px(6 + 6 * strength), color: PLANET_COLORS[planet.name], strength: 0.4 * brightness });
      if (visibility > 0.3) targets.push({ kind: 'planet', name: planet.name, x: p.x, y: p.y, radius: px(11) });
    }
  }

  const discRadius = sunDiscRadius(layout);

  if (look.sun) {
    const p = look.sun;
    if (onScreen(p, discRadius * 4)) {
      if (input.drawSun ?? true) {
        softDisc(p.x, p.y, discRadius, (x, y, coverage) => blend(x, y, SUN_COLOR, coverage));
        glows.push({ x: p.x, y: p.y, radius: discRadius * SUN_GLOW.radius, color: SUN_GLOW.color, strength: SUN_GLOW.strength });
      }
      targets.push({ kind: 'sun', name: 'the Sun', x: p.x, y: p.y, radius: discRadius + px(6) });
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
      let [litWeight, litX, litY] = [0, 0, 0];
      // Each pixel is supersampled, so both the rim and the terminator come out smooth.
      softDisc(p.x, p.y, r, (x, y, coverage, samples) => {
        let litSamples = 0;
        for (const [sx, sy] of samples) {
          const nx = (sx - p.x) / r;
          const ny = -(sy - p.y) / r;
          const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
          if (nx * sun[0] + ny * sun[1] + nz * sun[2] > 0) litSamples++;
        }
        const litShare = samples.length ? litSamples / samples.length : 0;
        if (daylight < 0.5) blend(x, y, shadow, 0.6 * coverage * (1 - litShare));
        if (litShare > 0) {
          blend(x, y, lit, litAlpha * coverage * litShare);
          litWeight += litShare;
          litX += (x - p.x) * litShare;
          litY += (y - p.y) * litShare;
        }
      });
      // A thin crescent can be thinner than a pixel; keep a glint on the limb facing the Sun.
      if (litWeight < 0.5 && moon.illuminated > 0.02) {
        const [lx, ly] = [toSun.x * r * 0.92, -toSun.y * r * 0.92];
        splat(p.x + lx, p.y + ly, lit, litAlpha, px(0.7));
        [litWeight, litX, litY] = [1, lx, ly];
      }
      glows.push({ x: p.x, y: p.y, radius: r * 5, color: [210, 220, 230], strength: 0.25 * moon.illuminated * (1 - daylight) });
      targets.push({ kind: 'moon', name: 'the Moon', detail: `${Math.round(moon.illuminated * 100)}% lit`, x: p.x, y: p.y, radius: r + px(6) });
      moonResult = {
        x: p.x, y: p.y, litCount: Math.round(litWeight),
        litDx: litWeight ? litX / litWeight : 0, litDy: litWeight ? litY / litWeight : 0,
      };
    }
  }

  return { sunAlt, sunAz: look.sunAz, starsDrawn, moon: moonResult, targets, segments, glows, background: { top, horizon, glow },
    sun: look.sun ? { x: look.sun.x, y: look.sun.y, radius: discRadius } : null };
}

/** Finds what's under a point (buffer pixels): the nearest target in reach, else the nearest figure line within `lineReach`. */
export function hitTest(
  x: number,
  y: number,
  targets: readonly SkyTarget[],
  segments: readonly SkySegment[],
  lineReach = 2.5,
): { target: SkyTarget | null; figure: string | null } {
  let best: SkyTarget | null = null;
  let bestDistance = Infinity;
  for (const target of targets) {
    const d = Math.hypot(target.x - x, target.y - y);
    if (d <= target.radius && d < bestDistance) {
      best = target;
      bestDistance = d;
    }
  }
  if (best) return { target: best, figure: best.constellation ?? null };
  let figure: string | null = null;
  let figureDistance = lineReach;
  for (const s of segments) {
    const d = distanceToSegment(x, y, s.ax, s.ay, s.bx, s.by);
    if (d <= figureDistance) {
      figure = s.figure;
      figureDistance = d;
    }
  }
  return { target: null, figure };
}

function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? clamp01(((px - ax) * dx + (py - ay) * dy) / lengthSquared) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
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

/** Sub-pixel sample offsets (4×4) for antialiasing discs. */
const SUBSAMPLES: readonly (readonly [number, number])[] = Array.from({ length: 16 }, (_, k) => [((k % 4) + 0.5) / 4 - 0.5, (Math.floor(k / 4) + 0.5) / 4 - 0.5] as const);

/**
 * Calls `plot` for every pixel a disc touches, with how much of the pixel it
 * covers (0…1) and the covered sub-pixel sample positions.
 */
function softDisc(cx: number, cy: number, r: number, plot: (x: number, y: number, coverage: number, samples: readonly (readonly [number, number])[]) => void) {
  const reach = Math.ceil(r + 1);
  const [x0, y0] = [Math.round(cx), Math.round(cy)];
  for (let dy = -reach; dy <= reach; dy++) {
    for (let dx = -reach; dx <= reach; dx++) {
      const [x, y] = [x0 + dx, y0 + dy];
      const inside = SUBSAMPLES.map(([ox, oy]) => [x + ox, y + oy] as const).filter(([sx, sy]) => (sx - cx) ** 2 + (sy - cy) ** 2 <= r * r);
      if (inside.length) plot(x, y, inside.length / SUBSAMPLES.length, inside);
    }
  }
}

/**
 * Antialiased line (Xiaolin Wu): calls `plot` with each pixel and how much of
 * it the line covers, so thin lines look smooth rather than stepped.
 */
export function drawLine(x0: number, y0: number, x1: number, y1: number, plot: (x: number, y: number, coverage: number) => void) {
  const steep = Math.abs(y1 - y0) > Math.abs(x1 - x0);
  if (steep) [x0, y0, x1, y1] = [y0, x0, y1, x1];
  if (x0 > x1) [x0, y0, x1, y1] = [x1, y1, x0, y0];
  const dx = x1 - x0;
  const gradient = dx === 0 ? 1 : (y1 - y0) / dx;
  const put = (x: number, y: number, c: number) => (steep ? plot(y, x, c) : plot(x, y, c));
  const xStart = Math.round(x0);
  const xEnd = Math.round(x1);
  let y = y0 + gradient * (xStart - x0);
  for (let x = xStart; x <= xEnd; x++) {
    const base = Math.floor(y);
    const frac = y - base;
    put(x, base, 1 - frac);
    put(x, base + 1, frac);
    y += gradient;
  }
}
