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
  LandscapeLayer,
  LandscapeLook,
  compositeLandscape,
  isLand,
  landscapeUrl,
  lookWeights,
  windowGlow,
} from './sky-landscape';
import {
  ART_PIXEL,
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

  /** The hover label, in CSS pixels, or null. */
  protected readonly label = signal<{ text: string; x: number; y: number } | null>(null);

  private catalog: SkyCatalog | null = null;
  private astronomy: AstronomyModule | null = null;
  private pinnedTime: Date | null = null;
  /** The last full draw's inputs and hover targets, so a hover change can redraw without recomputing the sky. */
  private scene: { date: Date; lat: number; lon: number; bodies: Bodies | null; targets: readonly SkyTarget[]; segments: readonly SkySegment[] } | null = null;
  private hover: SkyHover = NO_HOVER;

  /** Landscape looks: the loaded images, and their rasterisation at the current art size. */
  private readonly lookImages = new Map<LandscapeLook, HTMLImageElement>();
  private readonly lookLoads = new Map<LandscapeLook, Promise<void>>();
  private readonly layers = new Map<LandscapeLook, LandscapeLayer>();
  private layersSize = '';
  private layout: SkyLayout | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);

    // Redraw when the visitor changes whose sky it is or how it's lit.
    effect(() => {
      this.sky.location();
      this.sky.lighting();
      untracked(() => this.draw());
    });

    afterNextRender(() => {
      let destroyed = false;
      destroyRef.onDestroy(() => (destroyed = true));
      this.pinnedTime = parseSkyAt(location.search);
      const forcedLighting = new URLSearchParams(location.search).get('sky-light') as Lighting | null;
      if (forcedLighting && LIGHTINGS.includes(forcedLighting)) this.sky.lighting.set(forcedLighting);

      void this.load().then(ok => {
        if (!ok || destroyed) return;
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
      pending.catch(() => this.lookLoads.delete(look));
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
      this.loadLook(look).then(() => this.draw(), () => undefined);
      return null;
    }
    try {
      const canvas = document.createElement('canvas');
      canvas.width = layout.width;
      canvas.height = layout.height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return null;
      const scale = Math.max(this.viewWidth() / image.naturalWidth, this.viewHeight() / image.naturalHeight) / ART_PIXEL;
      const [drawWidth, drawHeight] = [image.naturalWidth * scale, image.naturalHeight * scale];
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
      // Beside the pointer, kept on screen.
      const x = Math.min(clientX + 14, window.innerWidth - text.length * 8 - 24);
      const y = Math.min(clientY + 12, window.innerHeight - 32);
      this.label.set({ text, x: Math.max(4, x), y });
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
    const lighting = this.sky.lighting();
    const image = context.createImageData(layout.width, layout.height);
    const { sunAlt, sunAz, targets, segments } = renderSky(image.data, layout, {
      date, lat, lon, catalog, bodies, lighting,
      highlight: this.hover,
    });

    // The landscape: the weighted looks, or the night look until the others have loaded.
    const weighted = Object.entries(lookWeights(lighting, sunAlt, sunAz))
      .map(([look, weight]) => ({ layer: this.layer(look as LandscapeLook, layout), weight: weight ?? 0 }))
      .filter((entry): entry is { layer: LandscapeLayer; weight: number } => !!entry.layer && entry.weight > 0);
    const night = this.layer('darkness', layout);
    const layers = weighted.length ? normalise(weighted) : night ? [{ layer: night, weight: 1 }] : [];
    // The night look decides the silhouette (all looks share it), so it goes first.
    if (night && layers[0]?.layer !== night) layers.unshift({ layer: night, weight: 0 });
    compositeLandscape(image.data, layout, layers, windowGlow(lighting, sunAlt));

    context.putImageData(image, 0, 0);
    this.scene = { date, lat, lon, bodies, targets, segments };
    if (hoverOnly) return;
    this.sky.upNow.set(upNow(bodies, catalog, j2000ToHorizontalMatrix(date, lat, lon)));
    // 0 at night, 1 in daylight, on <html> so page cards can darken behind their text
    // when the sky behind them is bright (see base-page).
    document.documentElement.style.setProperty('--daylight', String(Math.round(smoothstep(-6, 6, sunAlt) * 100) / 100));
  }
}

function normalise<T extends { weight: number }>(entries: T[]): T[] {
  const total = entries.reduce((sum, e) => sum + e.weight, 0) || 1;
  return entries.map(e => ({ ...e, weight: e.weight / total }));
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return (await response.json()) as T;
}
