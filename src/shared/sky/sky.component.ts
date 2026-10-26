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
  LandscapeLayer,
  fireflies,
  fireflyAmount,
  LandscapeLook,
  compositeLandscape,
  isLand,
  landscapeUrl,
  lookWeights,
  windowGlow,
} from './sky-landscape';
import {
  ART_PIXEL,
  BACKGROUND_SIZE,
  ConstellationFile,
  LIGHTINGS,
  Lighting,
  NameFile,
  SkyCatalog,
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
 * request) and the landscape in front of it, drawn together as one piece of
 * pixel art on a canvas at a third of screen resolution.
 *
 * Nothing here runs during prerendering or first paint: the painted
 * background shows until the star data and the night landscape have loaded
 * (and astronomy-engine has loaded or failed), then the live sky fades in
 * over it. If the data or the landscape fails, the painting simply stays; if
 * only astronomy-engine fails, the sky draws without the Moon and planets.
 * Other landscape looks (sunrise, sunset, day) load when first needed.
 *
 * No animation loop: the sky is redrawn once a minute while the tab is
 * visible, and never on a timer for visitors who prefer reduced motion.
 */
@Component({
  selector: 'app-sky',
  template: `
    <canvas #canvas class="sky"></canvas>
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

  /** Fireflies on the meadow at dusk (CSS-animated; nothing at all otherwise). */
  protected readonly fireflies = signal<readonly Firefly[]>([]);
  /** The hover label, in CSS pixels, or null. */
  protected readonly label = signal<{ text: string; x: number; y: number } | null>(null);

  private catalog: SkyCatalog | null = null;
  private astronomy: AstronomyModule | null = null;
  private pinnedTime: Date | null = null;
  /** The last draw's inputs and hover targets; a hover-only redraw reuses them instead of recomputing the Moon and planets. */
  private scene: { date: Date; lat: number; lon: number; bodies: Bodies | null; targets: readonly SkyTarget[]; segments: readonly SkySegment[] } | null = null;
  private hover: SkyHover = NO_HOVER;

  /** Landscape looks: the loaded images, and their rasterisation at the current art size. */
  private readonly lookImages = new Map<LandscapeLook, HTMLImageElement>();
  private readonly lookLoads = new Map<LandscapeLook, Promise<void>>();
  /** Looks that failed to load; not retried (the darkness look stands in). */
  private readonly failedLooks = new Set<LandscapeLook>();
  /** Looks a redraw is already waiting on. */
  private readonly awaitedLooks = new Set<LandscapeLook>();
  private scratch: HTMLCanvasElement | null = null;
  private destroyed = false;
  private readonly layers = new Map<LandscapeLook, LandscapeLayer>();
  private layersSize = '';
  private layout: SkyLayout | null = null;
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
        destroyRef.onDestroy(() => {
          stopHover();
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

  /**
   * A look rasterised at art resolution, with the same `cover` fit CSS gives the
   * painting. Null if it hasn't loaded yet (in which case loading starts and the
   * sky redraws when it arrives).
   */
  private layer(look: LandscapeLook, layout: SkyLayout): LandscapeLayer | null {
    const size = `${layout.width}x${layout.height}`;
    if (size !== this.layersSize) {
      this.layers.clear();
      this.layersSize = size;
    }
    const cached = this.layers.get(look);
    if (cached) return cached;
    const image = this.lookImages.get(look);
    if (!image) {
      // Start loading (once) and redraw (once) when it arrives; a failed look stays missing.
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
    try {
      // One scratch canvas, reused, so resizes don't pile up canvas memory (iOS caps it).
      const canvas = (this.scratch ??= document.createElement('canvas'));
      canvas.width = layout.width;
      canvas.height = layout.height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return null;
      // Sized like the painting (BACKGROUND_SIZE, which the layout is built on), whatever the asset's own size.
      const scale = Math.max(this.viewWidth() / BACKGROUND_SIZE.width, this.viewHeight() / BACKGROUND_SIZE.height) / ART_PIXEL;
      const [drawWidth, drawHeight] = [BACKGROUND_SIZE.width * scale, BACKGROUND_SIZE.height * scale];
      context.clearRect(0, 0, layout.width, layout.height);
      // Shrinking averages neighbouring pixels; enlarging (huge screens) keeps them crisp.
      context.imageSmoothingEnabled = drawWidth < image.naturalWidth;
      context.imageSmoothingQuality = 'high';
      context.drawImage(
        image,
        (this.viewWidth() / ART_PIXEL - drawWidth) / 2,
        (this.viewHeight() / ART_PIXEL - drawHeight) / 2,
        drawWidth,
        drawHeight,
      );
      const layer = { look, data: context.getImageData(0, 0, layout.width, layout.height).data };
      this.layers.set(look, layer);
      return layer;
    } catch {
      return null;
    }
  }

  private viewWidth(): number {
    return this.host.clientWidth || window.innerWidth;
  }

  private viewHeight(): number {
    return this.host.clientHeight || window.innerHeight;
  }

  /**
   * Hover (mouse and pen) and tap (touch) on open sky name what's there. Hit
   * testing runs at most once a frame and only redraws when the answer changes.
   * Returns a function that removes the listeners.
   */
  private listenForHover(): () => void {
    let frame = 0;
    let pending: PointerEvent | null = null;
    let touchTimer: ReturnType<typeof setTimeout> | undefined;
    const check = (event: PointerEvent) => {
      const scene = this.scene;
      const [x, y] = [event.clientX / ART_PIXEL, event.clientY / ART_PIXEL];
      const overLand = this.layout ? isLand(this.layers.get('darkness') ?? null, this.layout, x, y) : false;
      const hover = scene && !overLand && isOpenSky(event.target) ? hoverAt(x, y, scene.targets, scene.segments) : NO_HOVER;
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

  private setHover(hover: SkyHover, clientX: number, clientY: number): void {
    const text = hoverLabel(hover);
    if (text) {
      this.label.set({ text, ...labelPosition(text, clientX, clientY) });
    } else {
      this.label.set(null);
    }
    if (sameHover(hover, this.hover)) return;
    this.hover = hover;
    this.draw(true);
  }

  /** Draws the sky and landscape. `hoverOnly` reuses the last computed positions (only the highlight changed). */
  private draw(hoverOnly = false): void {
    const catalog = this.catalog;
    if (!catalog) return;
    const canvas = this.canvas().nativeElement;
    const context = canvas.getContext('2d');
    if (!context) return;

    const layout = computeLayout(this.viewWidth(), this.viewHeight());
    this.layout = layout;
    if (canvas.width !== layout.width || canvas.height !== layout.height) {
      canvas.width = layout.width;
      canvas.height = layout.height;
    }
    canvas.style.width = `${layout.width * ART_PIXEL}px`;
    canvas.style.height = `${layout.height * ART_PIXEL}px`;

    let date: Date;
    let lat: number;
    let lon: number;
    let bodies: Bodies | null;
    if (hoverOnly && this.scene) {
      ({ date, lat, lon, bodies } = this.scene);
    } else {
      date = this.pinnedTime ?? new Date();
      ({ lat, lon } = this.sky.location());
      try {
        bodies = this.astronomy ? computeBodies(this.astronomy, date, lat, lon) : null;
      } catch {
        bodies = null;
      }
    }
    // Without the night landscape there's nothing to put in front of the sky; leave the painting.
    const night = this.layer('darkness', layout);
    if (!night) return;

    const lighting = this.sky.lighting();
    const image = context.createImageData(layout.width, layout.height);
    const { sunAlt, sunAz, targets, segments } = renderSky(image.data, layout, {
      date, lat, lon, catalog, bodies, lighting,
      highlight: { figure: this.hover.figure, target: this.hover.target },
    });

    // The landscape: the weighted looks. A look that hasn't loaded (or failed) lends its weight
    // to the night look until it arrives. The night look goes first: it decides the silhouette,
    // which all looks share.
    const layers: { layer: LandscapeLayer; weight: number }[] = [{ layer: night, weight: 0 }];
    for (const [look, weight] of Object.entries(lookWeights(lighting, sunAlt, sunAz)) as [LandscapeLook, number][]) {
      const layer: LandscapeLayer | null = look === 'darkness' ? night : this.layer(look, layout);
      if (layer && layer !== night) layers.push({ layer, weight });
      else layers[0].weight += weight;
    }
    compositeLandscape(image.data, layout, layers, windowGlow(lighting, sunAlt));
    // Only touch the DOM when the fireflies actually change (they come or go, or the screen resizes).
    const flies = fireflyAmount(lighting, sunAlt, sunAz) > 0.3 ? FIREFLY_COUNT : 0;
    const fireflyKey = `${flies}@${layout.width}x${layout.height}`;
    if (fireflyKey !== this.fireflyKey) {
      this.fireflyKey = fireflyKey;
      this.fireflies.set(flies ? fireflies(layout, flies, ART_PIXEL) : []);
    }

    context.putImageData(image, 0, 0);
    this.scene = { date, lat, lon, bodies, targets, segments };
    if (hoverOnly) return;
    // The sky moved (or changed): drop a hover whose object is no longer there.
    const { target, figure } = this.hover;
    const stillThere = target
      ? targets.some(t => t.kind === target.kind && t.name === target.name)
      : !figure || segments.some(s => s.figure === figure);
    if (!stillThere) {
      this.hover = NO_HOVER;
      this.label.set(null);
    }
    this.sky.upNow.set(upNow(bodies, catalog, j2000ToHorizontalMatrix(date, lat, lon)));
    // 0 at night, 1 in daylight, on <html> so page cards can darken behind their text
    // when the sky behind them is bright (see base-page).
    document.documentElement.style.setProperty('--daylight', String(Math.round(smoothstep(-6, 6, sunAlt) * 100) / 100));
  }
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
