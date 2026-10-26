import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  untracked,
  viewChild,
} from '@angular/core';
import { SkyService } from './sky.service';
import { AstronomyModule, Bodies, computeBodies, loadAstronomy } from './sky-bodies';
import { ART_PIXEL, ConstellationFile, SkyCatalog, StarFile, computeLayout, prepareCatalog, renderSky, smoothstep } from './sky-render';

/** How often the sky is redrawn while the tab is visible (the sky turns about 0.25° a minute). */
export const REDRAW_INTERVAL_MS = 60_000;
const RESIZE_DEBOUNCE_MS = 150;
export const FOREGROUND_URL = '/foreground.webp';

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
 * request) drawn as pixel art behind the painted trees and mountains.
 *
 * Nothing here runs during prerendering or first paint: the painted
 * background shows until the star data and the cut-out foreground have
 * loaded (and astronomy-engine has loaded or failed), then the live sky fades
 * in over it. If the data or the foreground fails, the painting simply stays;
 * if only astronomy-engine fails, the sky draws without the Moon and planets.
 * No animation loop: the sky is
 * redrawn once a minute while the tab is visible, and never on a timer for
 * visitors who prefer reduced motion.
 */
@Component({
  selector: 'app-sky',
  template: `<canvas #canvas class="sky"></canvas><div #foreground class="foreground"></div>`,
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
  private readonly foreground = viewChild.required<ElementRef<HTMLElement>>('foreground');

  private catalog: SkyCatalog | null = null;
  private astronomy: AstronomyModule | null = null;
  private pinnedTime: Date | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);

    // Redraw when the visitor switches between Cincinnati and their own sky.
    effect(() => {
      this.sky.location();
      untracked(() => this.draw());
    });

    afterNextRender(() => {
      let destroyed = false;
      destroyRef.onDestroy(() => (destroyed = true));
      this.pinnedTime = parseSkyAt(location.search);

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
        destroyRef.onDestroy(() => {
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
      const foreground = new Image();
      foreground.src = FOREGROUND_URL;
      const [stars, constellations, astronomy] = await Promise.all([
        fetchJson<StarFile>('/data/sky/stars.json'),
        fetchJson<ConstellationFile>('/data/sky/constellations.json'),
        // Without astronomy-engine the sky still works, just without the Moon and planets.
        loadAstronomy().catch(() => null),
        // Without the foreground the trees would vanish behind the sky, so it's required.
        foreground.decode(),
      ]);
      this.catalog = prepareCatalog(stars, constellations);
      this.astronomy = astronomy;
      if (!this.canvas().nativeElement.getContext('2d')) return false;
      // The already-decoded image goes in as-is, so it paints in the same frame the sky appears.
      foreground.alt = '';
      // Styled inline: an element added outside the template doesn't get the component's
      // scoped styles. Same sizing as the painted background in app.scss, so they line up.
      Object.assign(foreground.style, { display: 'block', width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' });
      this.foreground().nativeElement.append(foreground);
      return true;
    } catch {
      return false;
    }
  }

  private draw(): void {
    const catalog = this.catalog;
    if (!catalog) return;
    const canvas = this.canvas().nativeElement;
    const context = canvas.getContext('2d');
    if (!context) return;

    const layout = computeLayout(this.host.clientWidth || window.innerWidth, this.host.clientHeight || window.innerHeight);
    if (canvas.width !== layout.width || canvas.height !== layout.height) {
      canvas.width = layout.width;
      canvas.height = layout.height;
    }
    canvas.style.width = `${layout.width * ART_PIXEL}px`;
    canvas.style.height = `${layout.height * ART_PIXEL}px`;

    const date = this.pinnedTime ?? new Date();
    const { lat, lon } = this.sky.location();
    let bodies: Bodies | null;
    try {
      bodies = this.astronomy ? computeBodies(this.astronomy, date, lat, lon) : null;
    } catch {
      bodies = null;
    }
    const image = context.createImageData(layout.width, layout.height);
    const { sunAlt } = renderSky(image.data, layout, { date, lat, lon, catalog, bodies });
    context.putImageData(image, 0, 0);
    // 0 at night, 1 in daylight, on <html> so page cards can darken behind their text
    // when the sky behind them is bright (see base-page), and the trees can brighten a little.
    document.documentElement.style.setProperty('--daylight', String(Math.round(smoothstep(-6, 6, sunAlt) * 100) / 100));
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return (await response.json()) as T;
}
