import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { SkyService } from './sky.service';
import { j2000ToHorizontalMatrix } from './sky-math';
import { upNow } from './sky-up-now';
import { AstronomyModule, Bodies, computeBodies, loadAstronomy } from './sky-bodies';
import { NO_HOVER, SkyHover, hoverAt, hoverLabel, isOpenSky, sameHover } from './sky-hover';
import {
  Firefly,
  LandscapeLook,
  fireflies,
  fireflyAmount,
  landscapeUrl,
  lookWeights,
  windowGlow,
} from './sky-landscape';
import {
  BACKGROUND_SIZE,
  ConstellationFile,
  LIGHTINGS,
  Lighting,
  NameFile,
  SkyBackground,
  SkyCatalog,
  SkyGlow,
  SkyLayout,
  SkySegment,
  SkyTarget,
  StarFile,
  computeLayout,
  prepareCatalog,
  renderSky,
  smoothstep,
} from './sky-render';

/** How often the sky is redrawn while the tab is visible (the sky turns about 0.25° a minute). */
export const REDRAW_INTERVAL_MS = 60_000;
const RESIZE_DEBOUNCE_MS = 150;
/** How many fireflies come out at dusk. */
const FIREFLY_COUNT = 14;
/** How long a tapped label stays up on touch screens. */
const TOUCH_LABEL_MS = 3000;
/** Drawing resolution: device pixels, but no more than 2 per CSS pixel (the sky is redrawn in JS). */
const MAX_DPR = 2;
/** How close (CSS px) the pointer must be to a constellation line to name it. */
const LINE_REACH_CSS = 6;

/**
 * `?sky-at=2026-01-15T04:00Z` pins the sky to a moment, for checking how it
 * looks at noon, dusk or in winter without waiting. Invalid values are ignored.
 */
export function parseSkyAt(search: string): Date | null {
  const value = new URLSearchParams(search).get('sky-at');
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Tonight's sky: the real sky over Cincinnati (or the visitor's own, on
 * request) with Morgan's painting in front of it, drawn on a canvas at device
 * resolution: a smooth gradient, soft stars, the painting relit for the
 * chosen light, a little glow on anything that shines.
 *
 * Nothing here runs during prerendering or first paint: the painted
 * background shows until the star data and the night landscape have loaded
 * (and astronomy-engine has loaded or failed), then the live sky fades in
 * over it. If the data or the landscape fails, the painting simply stays; if
 * only astronomy-engine fails, the sky draws without the Moon and planets.
 * Other landscape looks (sunrise, sunset, day) load when first needed.
 *
 * No animation loop: the sky is redrawn once a minute while the tab is
 * visible, and never on a timer for visitors who prefer reduced motion. Hover
 * highlights go on a second, cheap canvas, so pointing at stars never redraws
 * the sky.
 */
@Component({
  selector: 'app-sky',
  template: `
    <canvas #canvas class="sky"></canvas>
    <canvas #overlay class="sky overlay"></canvas>
    @for (fly of fireflies(); track $index) {
      <span class="firefly" [style.left.px]="fly.x" [style.top.px]="fly.y"
        [style.animation-delay.s]="fly.delay" [style.animation-duration.s]="fly.duration"></span>
    }
    @if (label(); as label) {
      <div class="sky-label" [style.left.px]="label.x" [style.top.px]="label.y">{{ label.text }}</div>
    }
  `,
  styleUrl: './sky.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[class.ready]': 'sky.ready()',
  },
})
export class SkyComponent {
  protected readonly sky = inject(SkyService);
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly overlay = viewChild.required<ElementRef<HTMLCanvasElement>>('overlay');

  /** Fireflies on the meadow at dusk (CSS-animated; nothing at all otherwise). */
  protected readonly fireflies = signal<readonly Firefly[]>([]);
  /** The hover label, in CSS pixels, or null. */
  protected readonly label = signal<{ text: string; x: number; y: number } | null>(null);

  private catalog: SkyCatalog | null = null;
  private astronomy: AstronomyModule | null = null;
  private pinnedTime: Date | null = null;
  /** What the last draw put where, for hover. */
  private scene: { targets: readonly SkyTarget[]; segments: readonly SkySegment[] } | null = null;
  private hover: SkyHover = NO_HOVER;
  private layout: SkyLayout | null = null;

  /** Landscape looks, loaded on demand. */
  private readonly lookImages = new Map<LandscapeLook, HTMLImageElement>();
  private readonly lookLoads = new Map<LandscapeLook, Promise<void>>();
  /** Looks that failed to load; not retried (the darkness look stands in). */
  private readonly failedLooks = new Set<LandscapeLook>();
  /** Looks a redraw is already waiting on. */
  private readonly awaitedLooks = new Set<LandscapeLook>();
  /** Where the landscape covers the sky (alpha), at a quarter of CSS resolution, for hover. */
  private landMask: { width: number; height: number; alpha: Uint8ClampedArray } | null = null;
  private destroyed = false;
  private readonly scratch = new Map<string, HTMLCanvasElement>();
  private pointsData: ImageData | null = null;
  private blendKey = '';
  private fireflyKey = '';

  constructor() {
    const destroyRef = inject(DestroyRef);

    // Redraw when the visitor changes whose sky it is or how it's lit.
    effect(() => {
      this.sky.location();
      this.sky.lighting();
      untracked(() => this.draw());
    });

    afterNextRender(() => {
      destroyRef.onDestroy(() => (this.destroyed = true));
      this.pinnedTime = parseSkyAt(location.search);
      const forcedLighting = new URLSearchParams(location.search).get('sky-light') as Lighting | null;
      if (forcedLighting && LIGHTINGS.includes(forcedLighting)) this.sky.lighting.set(forcedLighting);

      void this.load().then(ok => {
        if (!ok || this.destroyed) return;
        this.draw();
        this.sky.ready.set(true);

        const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
        const interval = reducedMotion ? undefined : setInterval(() => {
          if (document.visibilityState === 'visible') this.draw();
        }, REDRAW_INTERVAL_MS);
        const onVisibility = () => {
          if (document.visibilityState === 'visible') this.draw();
        };
        let resizeTimer: ReturnType<typeof setTimeout> | undefined;
        const onResize = () => {
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(() => this.draw(), RESIZE_DEBOUNCE_MS);
        };
        document.addEventListener('visibilitychange', onVisibility);
        // Follow the element the painting is sized to, not the window (they differ when pinch-zoomed).
        const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(onResize);
        if (resizeObserver) resizeObserver.observe(this.host);
        else window.addEventListener('resize', onResize);
        const stopHover = this.listenForHover();
        // Moving to a screen with a different pixel density: redraw at the new resolution.
        let density: MediaQueryList | null = null;
        const watchDensity = () => {
          density?.removeEventListener?.('change', onDensity);
          density = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
          density.addEventListener?.('change', onDensity);
        };
        const onDensity = () => {
          watchDensity();
          this.draw();
        };
        watchDensity();
        destroyRef.onDestroy(() => {
          stopHover();
          density?.removeEventListener?.('change', onDensity);
          document.documentElement.style.removeProperty('--daylight');
          clearInterval(interval);
          clearTimeout(resizeTimer);
          document.removeEventListener('visibilitychange', onVisibility);
          resizeObserver?.disconnect();
          window.removeEventListener('resize', onResize);
        });
      });
    });
  }

  /** Loads everything the live sky needs; false if any required piece is missing. */
  private async load(): Promise<boolean> {
    try {
      const [stars, constellations, names, astronomy] = await Promise.all([
        fetchJson<StarFile>('/data/sky/stars.json'),
        fetchJson<ConstellationFile>('/data/sky/constellations.json'),
        // Names only feed the hover labels; the sky is fine without them.
        fetchJson<NameFile>('/data/sky/names.json').catch(() => undefined),
        // Without astronomy-engine the sky still works, just without the Moon and planets.
        loadAstronomy().catch(() => null),
        // Without the night landscape the trees would vanish behind the sky, so it's required.
        this.loadLook('darkness'),
      ]);
      this.catalog = prepareCatalog(stars, constellations, names);
      this.astronomy = astronomy;
      return !!this.canvas().nativeElement.getContext('2d');
    } catch {
      return false;
    }
  }

  /** Loads one landscape look (once); rejects if it can't. */
  private loadLook(look: LandscapeLook): Promise<void> {
    let pending = this.lookLoads.get(look);
    if (!pending) {
      const image = new Image();
      image.src = landscapeUrl(look);
      pending = image.decode().then(() => void this.lookImages.set(look, image));
      pending.catch(() => this.failedLooks.add(look));
      this.lookLoads.set(look, pending);
    }
    return pending;
  }

  /** A loaded look, or null (starting the load, once, and redrawing once when it arrives). */
  private look(look: LandscapeLook): HTMLImageElement | null {
    const image = this.lookImages.get(look);
    if (image) return image;
    if (!this.failedLooks.has(look) && !this.awaitedLooks.has(look)) {
      this.awaitedLooks.add(look);
      this.loadLook(look).then(
        () => {
          this.awaitedLooks.delete(look);
          if (!this.destroyed) this.draw();
        },
        () => this.awaitedLooks.delete(look),
      );
    }
    return null;
  }

  /** A named offscreen canvas, created once and reused. */
  private scratchCanvas(name: string): HTMLCanvasElement | null {
    try {
      let canvas = this.scratch.get(name);
      if (!canvas) this.scratch.set(name, (canvas = document.createElement('canvas')));
      return canvas;
    } catch {
      return null;
    }
  }

  /** The transparent buffer the renderer draws points into: reused, cleared each time. */
  private pointsImage(context: CanvasRenderingContext2D, layout: SkyLayout): ImageData {
    const reuse = this.pointsData;
    if (reuse && reuse.width === layout.width && reuse.height === layout.height) {
      reuse.data.fill(0);
      return reuse;
    }
    return (this.pointsData = context.createImageData(layout.width, layout.height));
  }

  /**
   * The weighted looks combined into one image, at the looks' own size. They all share one
   * silhouette, so adding weight × each (premultiplied) gives exactly the blend, soft edges
   * included. Cached until the weights change.
   */
  private blendedLandscape(layers: readonly { image: HTMLImageElement; weight: number }[]): CanvasImageSource | null {
    if (layers.length === 1) return layers[0].image;
    const canvas = this.scratchCanvas('landscape');
    const first = layers[0]?.image;
    if (!canvas || !first) return null;
    const key = layers.map(l => `${l.image.src}:${l.weight.toFixed(3)}`).join('|');
    if (key === this.blendKey) return canvas;
    const context = canvas.getContext('2d');
    if (!context) return null;
    [canvas.width, canvas.height] = [first.naturalWidth || first.width, first.naturalHeight || first.height];
    context.globalCompositeOperation = 'lighter';
    for (const { image, weight } of layers) {
      context.globalAlpha = weight;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
    }
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
    this.blendKey = key;
    return canvas;
  }

  private viewWidth(): number {
    return this.host.clientWidth || window.innerWidth;
  }

  private viewHeight(): number {
    return this.host.clientHeight || window.innerHeight;
  }

  /** Draws a landscape image the way CSS draws the painting (`cover`, centred), in buffer pixels. */
  private drawCover(context: CanvasRenderingContext2D, image: CanvasImageSource, layout: SkyLayout): void {
    // (Any source: a look image or the blended canvas; it's stretched to the painting's frame.)
    const scale = layout.imageScale;
    context.drawImage(image, layout.imageX, layout.imageY, BACKGROUND_SIZE.width * scale, BACKGROUND_SIZE.height * scale);
  }

  /**
   * Hover (mouse and pen) and tap (touch) on open sky name what's there. Hit
   * testing runs at most once a frame; only the overlay redraws, and only when
   * the answer changes. Returns a function that removes the listeners.
   */
  private listenForHover(): () => void {
    let frame = 0;
    let pending: PointerEvent | null = null;
    let touchTimer: ReturnType<typeof setTimeout> | undefined;
    const check = (event: PointerEvent) => {
      const scene = this.scene;
      const layout = this.layout;
      const open = !!scene && !!layout && isOpenSky(event.target) && !this.isLand(event.clientX, event.clientY);
      const hover = open
        ? hoverAt(event.clientX / layout!.artPixel, event.clientY / layout!.artPixel, scene!.targets, scene!.segments, LINE_REACH_CSS / layout!.artPixel)
        : NO_HOVER;
      this.setHover(hover, event.clientX, event.clientY);
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      pending = event;
      if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = 0;
          if (pending) check(pending);
        });
      }
    };
    const onTap = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return;
      check(event);
      clearTimeout(touchTimer);
      touchTimer = setTimeout(() => this.setHover(NO_HOVER, 0, 0), TOUCH_LABEL_MS);
    };
    const onLeave = () => this.setHover(NO_HOVER, 0, 0);
    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerup', onTap, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    window.addEventListener('blur', onLeave);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(touchTimer);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onTap);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('blur', onLeave);
    };
  }

  /** True where the landscape covers the sky at a CSS-pixel point. */
  private isLand(clientX: number, clientY: number): boolean {
    const mask = this.landMask;
    if (!mask) return false;
    const [x, y] = [Math.floor(clientX / 4), Math.floor(clientY / 4)];
    if (x < 0 || y < 0 || x >= mask.width || y >= mask.height) return false;
    return mask.alpha[(y * mask.width + x) * 4 + 3] > 128;
  }

  private updateLandMask(image: HTMLImageElement): void {
    const [width, height] = [Math.ceil(this.viewWidth() / 4), Math.ceil(this.viewHeight() / 4)];
    if (this.landMask?.width === width && this.landMask.height === height) return;
    try {
      const canvas = document.createElement('canvas');
      [canvas.width, canvas.height] = [width, height];
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return;
      this.drawCover(context, image, computeLayout(this.viewWidth(), this.viewHeight(), 4));
      this.landMask = { width, height, alpha: context.getImageData(0, 0, width, height).data };
    } catch {
      this.landMask = null;
    }
  }

  private setHover(hover: SkyHover, clientX: number, clientY: number): void {
    const text = hoverLabel(hover);
    if (text) {
      this.label.set({ text, ...labelPosition(text, clientX, clientY) });
    } else {
      this.label.set(null);
    }
    if (sameHover(hover, this.hover)) return;
    this.hover = hover;
    this.drawOverlay();
  }

  /** The hovered figure's lines, brighter, and a ring round the hovered object; never over the landscape. */
  private drawOverlay(): void {
    const canvas = this.overlay().nativeElement;
    const context = canvas.getContext('2d');
    const layout = this.layout;
    const scene = this.scene;
    if (!context || !layout) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!scene || (!this.hover.figure && !this.hover.target)) return;
    const css = 1 / layout.artPixel;
    context.lineCap = 'round';
    if (this.hover.figure) {
      context.strokeStyle = 'rgba(170, 206, 226, 0.7)';
      context.lineWidth = 1.2 * css;
      context.beginPath();
      for (const s of scene.segments) {
        if (s.figure !== this.hover.figure) continue;
        context.moveTo(s.ax, s.ay);
        context.lineTo(s.bx, s.by);
      }
      context.stroke();
    }
    const wanted = this.hover.target;
    const target = wanted && scene.targets.find(t => t.kind === wanted.kind && t.name === wanted.name);
    if (target) {
      context.strokeStyle = 'rgba(201, 146, 42, 0.9)';
      context.lineWidth = 1.5 * css;
      context.beginPath();
      context.arc(target.x, target.y, Math.max(7 * css, target.radius * 0.8), 0, Math.PI * 2);
      context.stroke();
    }
    // Lines that run behind the trees stay behind them.
    const night = this.lookImages.get('darkness');
    if (night) {
      context.globalCompositeOperation = 'destination-out';
      this.drawCover(context, night, layout);
      context.globalCompositeOperation = 'source-over';
    }
  }

  /** Draws the sky and landscape. */
  private draw(): void {
    const catalog = this.catalog;
    if (!catalog) return;
    const canvas = this.canvas().nativeElement;
    const context = canvas.getContext('2d');
    if (!context) return;
    // Without the night landscape there's nothing to put in front of the sky; leave the painting.
    const night = this.look('darkness');
    if (!night) return;

    const dpr = Math.min(MAX_DPR, Math.max(1, window.devicePixelRatio || 1));
    const layout = computeLayout(this.viewWidth(), this.viewHeight(), 1 / dpr);
    this.layout = layout;
    for (const c of [canvas, this.overlay().nativeElement]) {
      if (c.width !== layout.width || c.height !== layout.height) [c.width, c.height] = [layout.width, layout.height];
      c.style.width = `${layout.width / dpr}px`;
      c.style.height = `${layout.height / dpr}px`;
    }

    const date = this.pinnedTime ?? new Date();
    const { lat, lon } = this.sky.location();
    let bodies: Bodies | null;
    try {
      bodies = this.astronomy ? computeBodies(this.astronomy, date, lat, lon) : null;
    } catch {
      bodies = null;
    }
    const lighting = this.sky.lighting();
    // The gradient is painted by the canvas (fast, smooth); everything that's a point, a line
    // or a disc is drawn in JS onto a transparent layer and laid over it.
    const image = this.pointsImage(context, layout);
    const { sunAlt, sunAz, targets, segments, glows, background } = renderSky(image.data, layout, {
      date, lat, lon, catalog, bodies, lighting, paintBackground: false,
    });
    paintSky(context, layout, background, this.scratchCanvas('glow'));
    const points = this.scratchCanvas('points');
    if (points) {
      if (points.width !== layout.width || points.height !== layout.height) [points.width, points.height] = [layout.width, layout.height];
      points.getContext('2d')?.putImageData(image, 0, 0);
      context.drawImage(points, 0, 0);
    }
    drawGlows(context, glows);

    // The landscape: the weighted looks. A look that hasn't loaded (or failed) lends its
    // weight to the night look until it arrives.
    let nightWeight = 0;
    const layers: { image: HTMLImageElement; weight: number }[] = [];
    for (const [look, weight] of Object.entries(lookWeights(lighting, sunAlt, sunAz)) as [LandscapeLook, number][]) {
      const img = look === 'darkness' ? null : this.look(look);
      if (img) layers.push({ image: img, weight });
      else nightWeight += weight;
    }
    if (nightWeight > 0) layers.unshift({ image: night, weight: nightWeight });
    this.drawCover(context, this.blendedLandscape(layers) ?? night, layout);

    drawWindowLight(context, layout, windowGlow(lighting, sunAlt));
    this.updateLandMask(night);

    this.scene = { targets, segments };
    // The sky moved (or changed): drop a hover whose object is no longer there.
    const { target, figure } = this.hover;
    const stillThere = target
      ? targets.some(t => t.kind === target.kind && t.name === target.name)
      : !figure || segments.some(s => s.figure === figure);
    if (!stillThere) {
      this.hover = NO_HOVER;
      this.label.set(null);
    }
    this.drawOverlay();

    // Only touch the DOM when the fireflies actually change (they come or go, or the screen resizes).
    const flies = fireflyAmount(lighting, sunAlt, sunAz) > 0.3 ? FIREFLY_COUNT : 0;
    const fireflyKey = `${flies}@${layout.width}x${layout.height}`;
    if (fireflyKey !== this.fireflyKey) {
      this.fireflyKey = fireflyKey;
      this.fireflies.set(flies ? fireflies(layout, flies) : []);
    }

    this.sky.upNow.set(upNow(bodies, catalog, j2000ToHorizontalMatrix(date, lat, lon)));
    // 0 at night, 1 in daylight, on <html> so page cards can darken behind their text
    // when the sky behind them is bright (see base-page).
    document.documentElement.style.setProperty('--daylight', String(Math.round(smoothstep(-6, 6, sunAlt) * 100) / 100));
  }
}

const rgba = ([r, g, b]: readonly number[], a: number) => `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;

/**
 * The sky gradient (zenith to horizon, eased like the renderer's), and the horizon glow,
 * built exactly as the renderer defines it: strength × 0.55 × t³ (up from the horizon) ×
 * exp(−(dx / 0.3w)²) (along it), as a horizontal gradient masked by a vertical one on a
 * small offscreen canvas.
 */
function paintSky(context: CanvasRenderingContext2D, layout: SkyLayout, background: SkyBackground, scratch: HTMLCanvasElement | null): void {
  const { top, horizon, glow } = background;
  const horizonY = Math.max(1, layout.horizonY);
  const gradient = context.createLinearGradient(0, 0, 0, horizonY);
  for (let k = 0; k <= 10; k++) {
    const t = (k / 10) ** 2;
    gradient.addColorStop(k / 10, rgba(top.map((c, i) => c + (horizon[i] - c) * t), 1));
  }
  context.fillStyle = gradient;
  context.fillRect(0, 0, layout.width, layout.height);
  if (!glow || !scratch) return;
  const glowContext = scratch.getContext('2d');
  if (!glowContext) return;
  // A quarter size is plenty for something this soft.
  const [w, h] = [Math.ceil(layout.width / 4), Math.ceil(layout.height / 4)];
  if (scratch.width !== w || scratch.height !== h) [scratch.width, scratch.height] = [w, h];
  glowContext.clearRect(0, 0, w, h);
  const along = glowContext.createLinearGradient(0, 0, w, 0);
  const [gx, sigma] = [glow.x / 4, (layout.width * 0.3) / 4];
  for (let k = 0; k <= 24; k++) {
    const x = (k / 24) * w;
    along.addColorStop(k / 24, rgba(glow.color, glow.strength * 0.55 * Math.exp(-(((x - gx) / sigma) ** 2))));
  }
  glowContext.fillStyle = along;
  glowContext.fillRect(0, 0, w, h);
  const up = glowContext.createLinearGradient(0, 0, 0, horizonY / 4);
  for (let k = 0; k <= 10; k++) up.addColorStop(k / 10, `rgba(0, 0, 0, ${(k / 10) ** 3})`);
  glowContext.globalCompositeOperation = 'destination-in';
  glowContext.fillStyle = up;
  glowContext.fillRect(0, 0, w, h);
  glowContext.globalCompositeOperation = 'source-over';
  context.drawImage(scratch, 0, 0, layout.width, layout.height);
}

/** Soft halos round things that shine. */
function drawGlows(context: CanvasRenderingContext2D, glows: readonly SkyGlow[]): void {
  context.globalCompositeOperation = 'lighter';
  for (const glow of glows) {
    const gradient = context.createRadialGradient(glow.x, glow.y, 0, glow.x, glow.y, glow.radius);
    gradient.addColorStop(0, rgba(glow.color, glow.strength));
    gradient.addColorStop(0.35, rgba(glow.color, glow.strength * 0.35));
    gradient.addColorStop(1, rgba(glow.color, 0));
    context.fillStyle = gradient;
    context.fillRect(glow.x - glow.radius, glow.y - glow.radius, glow.radius * 2, glow.radius * 2);
  }
  context.globalCompositeOperation = 'source-over';
}

/** A warm light left on in the farmhouse: a bright core and a wide, faint halo. */
function drawWindowLight(context: CanvasRenderingContext2D, layout: SkyLayout, strength: number): void {
  if (strength <= 0) return;
  const css = 1 / layout.artPixel;
  const [x, y] = [layout.windowX, layout.windowY];
  context.globalCompositeOperation = 'lighter';
  for (const [radius, alpha] of [[2.2, 0.95], [7, 0.35], [26, 0.12]] as const) {
    const r = radius * css * Math.max(0.7, layout.imageScale * layout.artPixel * 2);
    const gradient = context.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, `rgba(255, 206, 128, ${alpha * strength})`);
    gradient.addColorStop(1, 'rgba(255, 170, 90, 0)');
    context.fillStyle = gradient;
    context.fillRect(x - r, y - r, r * 2, r * 2);
  }
  context.globalCompositeOperation = 'source-over';
}

/** Rough size of a label, in CSS pixels (0.75rem monospace plus padding). */
const LABEL_HEIGHT = 24;
const labelWidth = (text: string) => text.length * 7.5 + 22;

/**
 * Beside the pointer, on screen, and not under a page card (the label sits
 * behind the page, so a card would hide it): tries below-right, below-left,
 * above-right, above-left.
 */
export function labelPosition(text: string, clientX: number, clientY: number, cards: readonly DOMRect[] = cardRects()): { x: number; y: number } {
  const [width, height] = [labelWidth(text), LABEL_HEIGHT];
  const candidates = [
    [clientX + 14, clientY + 12],
    [clientX - 14 - width, clientY + 12],
    [clientX + 14, clientY - 12 - height],
    [clientX - 14 - width, clientY - 12 - height],
  ];
  const fits = ([x, y]: number[]) =>
    x >= 4 && y >= 4 && x + width <= window.innerWidth - 4 && y + height <= window.innerHeight - 4
    && !cards.some(c => x < c.right && x + width > c.left && y < c.bottom && y + height > c.top);
  const [x, y] = candidates.find(fits) ?? candidates[0];
  return {
    x: Math.max(4, Math.min(x, window.innerWidth - width - 4)),
    y: Math.max(4, Math.min(y, window.innerHeight - height - 4)),
  };
}

function cardRects(): DOMRect[] {
  return Array.from(document.querySelectorAll('.page-container, app-sky-menu')).map(el => el.getBoundingClientRect());
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return (await response.json()) as T;
}
