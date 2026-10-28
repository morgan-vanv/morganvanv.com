import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { SkyService, VISITOR_STARS_TOKEN } from './sky.service';
import { Mat3, altAz, altAzToVector, j2000ToHorizontalMatrix, multiply, sunHorizontal } from './sky-math';
import { ProperNameFile, starsAround, starsOnScreen, unnamedStars, visitorHoverNames, visitorNames } from './sky-naming';
import type { FreeLook } from './sky-free-look';
import { LookView, sameReading } from './sky-view';
import { upNow } from './sky-up-now';
import { Tonight, tonight } from './sky-tonight';
import { AstronomyModule, Bodies, computeBodies, loadAstronomy } from './sky-bodies';
import { NO_HOVER, SkyHover, hoverAt, hoverLabel, isOpenSky, sameHover } from './sky-hover';
import {
  Firefly,
  LANDSCAPE_LOOKS,
  LandscapeLook,
  NightLights,
  fireflies,
  fireflyAmount,
  landscapeUrl,
  lookWeights,
  nightLights,
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
  SkyLayout,
  SkyRenderResult,
  SkySegment,
  SkyTarget,
  StarFile,
  computeLayout,
  drawGlows,
  prepareCatalog,
  renderSky,
  screenPoint,
  smoothstep,
  sunDiscRadius,
} from './sky-render';
import { LightState, TRANSITION_MS, ease, lightBetween, sunPlaceAt, sunScreen } from './sky-transition';

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
/** How long a change of light waits for its landscape look to arrive before going ahead without it. */
const LOOK_WAIT_MS = 1500;
/** Fireflies are on the meadow while there's at least this much of them. */
const FIREFLY_MIN = 0.05;
/** How close (CSS px) a click or tap must be to an unnamed star to pick it while naming. */
export const PICK_REACH_CSS = 24;
export const PICK_REACH_TOUCH_CSS = 36;
/** Stars can be picked once they're this visible (as named stars become hover targets). */
const PICKABLE_STARS = 0.3;
/** What the naming candidates mustn't sit under (CSS px of clearance round each). */
const NAMING_COVERS = '.look-up-surface, app-sky-menu .sky-panel, app-sky-menu .sky-button';
const COVER_CLEARANCE = 12;

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
 * No standing animation loop: the sky is redrawn once a minute while the tab
 * is visible, and never on a timer for visitors who prefer reduced motion.
 * Changing the light draws the new one once, onto a second pair of layers,
 * and crossfades to it over a couple of seconds while the Sun (an element of
 * its own) travels to its new place; see sky-transition.ts. Per frame that's
 * an opacity and a transform, nothing redrawn. Under reduced motion the light
 * changes at once. The fireflies, the farmhouse window and the campfire are
 * CSS. Hover highlights go on their own cheap canvas, so pointing at stars
 * never redraws the sky.
 *
 * Layers, back to front: the sky (gradient, stars, Moon, halos), the Sun, the
 * landscape, the hover overlay, then the small lights.
 */
@Component({
  selector: 'app-sky',
  template: `
    <canvas #sky class="sky"></canvas>
    <canvas #sky class="sky"></canvas>
    <!-- Free look's panorama goes in here (loaded with the first look up). -->
    <div #free class="free"></div>
    <div #sun class="sun"></div>
    <div class="land">
      <canvas #land class="sky"></canvas>
      <canvas #land class="sky"></canvas>
    </div>
    <canvas #overlay class="sky overlay"></canvas>
    @if (lights(); as lights) {
      <span class="window-light" [style.left.px]="lights.window.x" [style.top.px]="lights.window.y" [style.--size]="lights.size"></span>
      <div class="campfire" [style.left.px]="lights.fire.x" [style.top.px]="lights.fire.y" [style.--size]="lights.size">
        <span class="fire-pool"></span>
        <span class="fire-glow"></span>
        <span class="fire-flame"></span>
        <span class="fire-core"></span>
        @for (ember of embers; track $index) {
          <span class="ember" [style.--drift.px]="ember.drift" [style.animation-delay.s]="ember.delay"></span>
        }
      </div>
    }
    <div class="fireflies">
      @for (fly of fireflies(); track $index) {
        <span class="firefly" [style.left.px]="fly.x" [style.top.px]="fly.y"
          [style.animation-delay.s]="fly.delay" [style.animation-duration.s]="fly.duration"></span>
      }
    </div>
    @if (ring(); as ring) {
      <span #ring class="star-ring" [class.sent]="sent()" [style.transform]="'translate(' + ring.x + 'px, ' + ring.y + 'px)'">
        <span class="sparkle"></span>
      </span>
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
    '[class.free-look]': 'sky.freeLooking()',
  },
})
export class SkyComponent {
  protected readonly sky = inject(SkyService);
  private readonly visitorStars = inject(VISITOR_STARS_TOKEN);
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  private readonly injector = inject(Injector);
  /** The selected star's ring while naming (CSS pixels), and whether its name has just been sent. */
  protected readonly ring = this.sky.selectedPoint;
  protected readonly sent = this.sky.sent;
  /** Two of each, so a change of light can crossfade from one to the other. */
  private readonly skies = viewChildren<ElementRef<HTMLCanvasElement>>('sky');
  private readonly lands = viewChildren<ElementRef<HTMLCanvasElement>>('land');
  private readonly sunElement = viewChild.required<ElementRef<HTMLElement>>('sun');
  private readonly overlay = viewChild.required<ElementRef<HTMLCanvasElement>>('overlay');
  private readonly freeLayer = viewChild.required<ElementRef<HTMLElement>>('free');
  private readonly ringElement = viewChild<ElementRef<HTMLElement>>('ring');

  /** Fireflies on the meadow at dusk (CSS-animated; nothing at all otherwise). */
  protected readonly fireflies = signal<readonly Firefly[]>([]);
  /** Where the farmhouse window and the campfire are (CSS pixels); how bright they are is a CSS variable. */
  protected readonly lights = signal<NightLights | null>(null);
  /** Sparks off the campfire: sideways drift (CSS px) and start offset (s). */
  protected readonly embers = [
    { drift: -2, delay: 0 },
    { drift: 2.5, delay: 0.9 },
    { drift: -0.5, delay: 1.7 },
    { drift: 1.5, delay: 2.6 },
  ] as const;
  /** The hover label, in CSS pixels, or null. */
  protected readonly label = signal<{ text: string; x: number; y: number } | null>(null);

  private catalog: SkyCatalog | null = null;
  private astronomy: AstronomyModule | null = null;
  private pinnedTime: Date | null = null;
  /** The last night worked out, where and when for: it's redone every ten minutes or on a move. */
  private tonightFor: { lat: number; lon: number; at: number; value: Tonight | null } | null = null;
  /** What the last draw put where, for hover. */
  private scene: { targets: readonly SkyTarget[]; segments: readonly SkySegment[] } | null = null;
  private hover: SkyHover = NO_HOVER;
  private layout: SkyLayout | null = null;
  /** The last draw's J2000 → horizontal rotation and how visible its stars were, for naming. */
  private toHorizontal: Mat3 | null = null;
  private starsVisible = 0;

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
  private lightsKey = '';
  /** Which of the two sky/landscape pairs is on screen. */
  private shown = 0;
  /** What's eased on screen now, and the change under way (if any). */
  private state: LightState | null = null;
  private transition: {
    start: number;
    frame: number;
    /** Which pair is fading in (the other is fading out). */
    incoming: number;
    /** 0…1, eased: how far the crossfade has got. */
    progress: number;
  } | null = null;
  /** Bumped by every redraw, so a change of light still waiting on its look knows if it's been overtaken. */
  private drawId = 0;
  /** Something wanted a redraw mid-change (a late look, the minute tick): do it when the change is over. */
  private redrawAfterTransition = false;
  /** The change of light waiting for its look (it draws when that arrives), if any. */
  private lookWait: number | null = null;

  /** Free look (sky-free-look.ts), once loaded: the panorama the visitor can turn while looking up. */
  private free: FreeLook | null = null;
  private freeLoad: Promise<FreeLook | null> | null = null;
  /** Free look is on (looking up, and loaded): the stars are on the panorama, the sky canvas is only the gradient. */
  private freeOn = false;
  /** How much of the panorama is showing (it crossfades with the normal view). */
  private freeOpacity = 0;
  /** Something wanted a redraw while the sky was being turned: do it when it comes to rest. */
  private redrawAfterSettle = false;
  /** ‹ › turned the sky: say where it left the visitor once it's there. */
  private announceOnSettle = false;

  constructor() {
    const destroyRef = inject(DestroyRef);

    // Redraw when the visitor changes whose sky it is or how it's lit, easing into it.
    effect(() => {
      this.sky.location();
      this.sky.lighting();
      untracked(() => this.changeLight());
    });

    // Naming opened (its panel now on screen), or the ☾ menu opened or closed over the sky while
    // naming: work out again which stars can be picked (what covers the sky has changed).
    effect(() => {
      this.sky.menuOpen();
      if (!this.sky.naming()) return;
      untracked(() => afterNextRender(() => this.updateNaming(), { injector: this.injector }));
    });
    // The panel has just appeared (on first use it loads after naming started, so the first pick
    // couldn't see it): a star it now covers is picked again. Nobody has typed a name for it yet.
    effect(() => {
      if (!this.sky.namingPanelShown()) return;
      untracked(() => {
        this.updateNaming();
        const selected = this.sky.selected();
        if (selected && !this.sky.sent() && !this.sky.candidates().some(c => c.star === selected)) {
          this.sky.select(null);
          this.sky.setCandidates(this.sky.candidates());
        }
      });
    });
    // The ring follows the selected star.
    effect(() => {
      this.sky.selected();
      untracked(() => this.updateSelectedPoint());
    });

    // Looking up turns free look on (the sky can be dragged round) once there's a sky to turn;
    // coming back turns it off.
    effect(() => {
      const up = this.sky.lookingUp() && this.sky.ready();
      untracked(() => this.setFreeLook(up));
    });
    // The compass asked for a turn.
    effect(() => {
      const request = this.sky.viewRequest();
      if (request) untracked(() => this.free?.turnTo(request.view));
    });
    // ‹ › picked a star: turn to bring it into view.
    effect(() => {
      if (this.sky.showSelected()) untracked(() => this.showSelectedStar());
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
        // Mid-change, these wait for the change to finish; mid-turn (a drag, a glide), for the sky to come to rest.
        const redraw = () => {
          if (this.transition) this.redrawAfterTransition = true;
          else if (this.freeOn && this.free?.moving) this.redrawAfterSettle = true;
          else this.draw();
        };
        const interval = reducedMotion ? undefined : setInterval(() => {
          if (document.visibilityState === 'visible') redraw();
        }, REDRAW_INTERVAL_MS);
        const onVisibility = () => {
          if (document.visibilityState === 'visible') redraw();
        };
        let resizeTimer: ReturnType<typeof setTimeout> | undefined;
        const onResize = () => {
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(() => {
            if (this.freeOn && this.free?.moving) this.redrawAfterSettle = true;
            else this.draw();
          }, RESIZE_DEBOUNCE_MS);
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
          if (this.transition) cancelAnimationFrame(this.transition.frame);
          this.transition = null;
          stopHover();
          this.free?.destroy();
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
      const [stars, constellations, names, properNames, astronomy] = await Promise.all([
        fetchJson<StarFile>('/data/sky/stars.json'),
        fetchJson<ConstellationFile>('/data/sky/constellations.json'),
        // Names only feed the hover labels; the sky is fine without them.
        fetchJson<NameFile>('/data/sky/names.json').catch(() => undefined),
        // Every proper name, so name-a-star never offers a named star; without it, nothing is offered.
        fetchJson<ProperNameFile>('/data/sky/proper-names.json').catch(() => undefined),
        // Without astronomy-engine the sky still works, just without the Moon and planets.
        loadAstronomy().catch(() => null),
        // Without the night landscape the trees would vanish behind the sky, so it's required.
        this.loadLook('darkness'),
      ]);
      // "Near" points at a bright star the sky labels on hover, so a visitor can find it.
      const landmarks = names && { names: names.names.map(([ra, dec, name]) => [ra, dec, name] as const) };
      // Stars visitors have named come with the build (content/stars/), so there's nothing to fetch.
      const named = visitorNames(this.visitorStars, landmarks);
      this.sky.visitorNames.set(named);
      this.sky.unnamed.set(unnamedStars(stars, properNames, this.visitorStars, landmarks));
      this.catalog = prepareCatalog(stars, constellations, names, visitorHoverNames(named));
      this.astronomy = astronomy;
      return !!this.skies()[0]?.nativeElement.getContext('2d');
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
          // Mid-change, ease it in once the change is over; if a change is waiting for it, that draws.
          if (this.transition) this.redrawAfterTransition = true;
          else if (!this.destroyed && this.lookWait === null) this.draw(this.mayEase());
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
    const [width, height] = [first.naturalWidth || first.width, first.naturalHeight || first.height];
    // Resizing a canvas reallocates it, even to the same size, so only resize when it changes.
    if (canvas.width !== width || canvas.height !== height) [canvas.width, canvas.height] = [width, height];
    else context.clearRect(0, 0, width, height);
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
      const free = this.freeOn ? this.free : null;
      const open = !!scene && !!layout && isOpenSky(event.target) && !this.isLand(event.clientX, event.clientY) && !free?.moving;
      let hover = NO_HOVER;
      if (open && free) {
        hover = free.hoverAt(event.clientX, event.clientY, LINE_REACH_CSS);
        // The Sun stays with the painting, so it's found where the normal view has it.
        const sun = hover.target ? null : scene!.targets.find(t => t.kind === 'sun');
        if (sun && Math.hypot(event.clientX / layout!.artPixel - sun.x, event.clientY / layout!.artPixel - sun.y) <= sun.radius) {
          hover = { target: sun, figure: null };
        }
      } else if (open) {
        hover = hoverAt(event.clientX / layout!.artPixel, event.clientY / layout!.artPixel, scene!.targets, scene!.segments, LINE_REACH_CSS / layout!.artPixel);
      }
      this.setHover(hover, event.clientX, event.clientY);
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || this.free?.dragging) return;
      pending = event;
      if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = 0;
          if (pending) check(pending);
        });
      }
    };
    const onTap = (event: PointerEvent) => {
      // (A drag that just ended isn't a tap.)
      if (event.pointerType !== 'touch' || (this.freeOn && this.free?.endedDrag)) return;
      check(event);
      clearTimeout(touchTimer);
      touchTimer = setTimeout(() => this.setHover(NO_HOVER, 0, 0), TOUCH_LABEL_MS);
    };
    // (Chrome sends a touch's pointerleave to <html> right after its pointerup: that mustn't take the tapped label away.)
    const onLeave = (event: Event) => {
      if ((event as PointerEvent).pointerType !== 'touch') this.setHover(NO_HOVER, 0, 0);
    };
    // While naming a star, a click or tap on open sky picks the unnamed star nearest it. A click
    // doesn't always say what made it (Safari's has no pointerType), so the last pointerdown does.
    let lastPointer = 'mouse';
    const onDown = (event: PointerEvent) => (lastPointer = event.pointerType || 'mouse');
    const onClick = (event: MouseEvent) => {
      // A drag turned the sky; it doesn't pick a star as it lets go.
      if (this.free?.takeDragClick()) return;
      if (!this.sky.naming() || !isOpenSky(event.target)) return;
      const reach = lastPointer === 'touch' ? PICK_REACH_TOUCH_CSS : PICK_REACH_CSS;
      this.sky.selectNear(event.clientX, event.clientY, reach);
    };
    document.addEventListener('pointerdown', onDown, { passive: true });
    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerup', onTap, { passive: true });
    document.addEventListener('click', onClick);
    document.documentElement.addEventListener('pointerleave', onLeave);
    window.addEventListener('blur', onLeave);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(touchTimer);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onTap);
      document.removeEventListener('click', onClick);
      document.removeEventListener('pointerdown', onDown);
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
    const free = this.freeOn ? this.free : null;
    const scene = free ? free.scene : this.scene;
    if (!context || !layout) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!scene || (!this.hover.figure && !this.hover.target)) return;
    const css = 1 / layout.artPixel;
    // What was drawn, in overlay pixels: the normal view's are already; the panorama's are where the view has them.
    const at = free
      ? (x: number, y: number) => {
        const p = free.toScreen(x, y);
        return { x: p.x * css, y: p.y * css };
      }
      : (x: number, y: number) => ({ x, y });
    const unit = free ? free.cssPerPixel * css : 1;
    context.lineCap = 'round';
    if (this.hover.figure) {
      context.strokeStyle = 'rgba(170, 206, 226, 0.7)';
      context.lineWidth = 1.2 * css;
      context.beginPath();
      for (const s of scene.segments) {
        if (s.figure !== this.hover.figure) continue;
        const [a, b] = [at(s.ax, s.ay), at(s.bx, s.by)];
        context.moveTo(a.x, a.y);
        context.lineTo(b.x, b.y);
      }
      context.stroke();
    }
    // The same object in this drawing (the panorama may have it twice: take the one nearest the hover).
    const wanted = this.hover.target;
    const target = wanted && scene.targets
      .filter(t => t.kind === wanted.kind && t.name === wanted.name)
      .sort((a, b) => Math.hypot(a.x - wanted.x, a.y - wanted.y) - Math.hypot(b.x - wanted.x, b.y - wanted.y))[0];
    if (target) {
      const p = at(target.x, target.y);
      context.strokeStyle = 'rgba(201, 146, 42, 0.9)';
      context.lineWidth = 1.5 * css;
      context.beginPath();
      context.arc(p.x, p.y, Math.max(7 * css, target.radius * unit * 0.8), 0, Math.PI * 2);
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

  /**
   * The visitor picked another light (or place). Eases into it, once the
   * landscape look it needs has arrived (or a moment has passed); at once
   * before the sky is up, and always at once under reduced motion.
   */
  private changeLight(): void {
    const id = ++this.drawId;
    this.lookWait = null;
    if (!this.mayEase()) {
      this.draw();
      return;
    }
    const needed = this.neededLooks().filter(look => !this.lookImages.has(look) && !this.failedLooks.has(look));
    if (!needed.length) {
      this.draw(true);
      return;
    }
    this.lookWait = id;
    const go = () => {
      if (this.lookWait === id) this.lookWait = null;
      // Overtaken by another redraw (which drew the light already)? Nothing to do.
      if (id === this.drawId && !this.destroyed) this.draw(true);
    };
    const wait = setTimeout(go, LOOK_WAIT_MS);
    void Promise.allSettled(needed.map(look => this.loadLook(look))).then(() => {
      clearTimeout(wait);
      go();
    });
  }

  /** Whether a redraw may ease in (there's a sky on screen to ease from, and motion is welcome). */
  private mayEase(): boolean {
    return !!this.state && !!this.layout && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /** The looks the chosen light uses (real time: those for where the Sun is now). */
  private neededLooks(): LandscapeLook[] {
    const lighting = this.sky.lighting();
    if (lighting !== 'real') return [lighting];
    const { lat, lon } = this.sky.location();
    const { alt, az } = altAz(sunHorizontal(this.pinnedTime ?? new Date(), lat, lon));
    const weights = lookWeights('real', alt, az);
    return LANDSCAPE_LOOKS.filter(look => (weights[look] ?? 0) > 0);
  }

  /**
   * Stops a change of light part way, keeping what's on screen: both pairs are
   * folded into the first at their current strengths, so the picture doesn't
   * jump, and that becomes the pair on screen.
   */
  private settleTransition(): void {
    const transition = this.transition;
    if (!transition) return;
    cancelAnimationFrame(transition.frame);
    this.transition = null;
    const p = transition.progress;
    // Strength of pair 0 and pair 1 right now.
    const [w0, w1] = transition.incoming === 1 ? [1 - p, p] : [p, 1 - p];
    // The sky: opaque, the second canvas laid over the first at its opacity (as on screen).
    const [skyUnder, skyOver] = this.skies().map(ref => ref.nativeElement);
    const skyContext = skyUnder?.getContext('2d');
    if (skyContext && skyOver?.width) {
      skyContext.globalAlpha = transition.incoming === 1 ? p : 1 - p;
      skyContext.drawImage(skyOver, 0, 0);
      skyContext.globalAlpha = 1;
    }
    // The landscape: the two added at their strengths (as on screen; see .land in the styles).
    const [landA, landB] = this.lands().map(ref => ref.nativeElement);
    const landContext = landA?.getContext('2d');
    if (landContext && landB?.width) {
      landContext.globalCompositeOperation = 'destination-in';
      landContext.globalAlpha = w0;
      landContext.fillRect(0, 0, landA.width, landA.height);
      landContext.globalCompositeOperation = 'lighter';
      landContext.globalAlpha = w1;
      landContext.drawImage(landB, 0, 0);
      landContext.globalAlpha = 1;
      landContext.globalCompositeOperation = 'source-over';
    }
    this.shown = 0;
    this.showPair(0);
  }

  /** Shows one pair fully and hides the other (and gives its memory back: phones are short of it). */
  private showPair(index: number): void {
    for (const pair of [this.skies(), this.lands()]) {
      pair.forEach((ref, i) => {
        const canvas = ref.nativeElement;
        canvas.style.opacity = i === index ? '' : '0';
        if (i !== index && canvas.width) [canvas.width, canvas.height] = [0, 0];
      });
    }
  }

  /**
   * Draws the sky and landscape for the chosen light: renders the stars, Moon
   * and planets, paints the gradient, halos and landscape, and places the Sun.
   * With `animate`, draws onto the hidden pair and crossfades to it from what's
   * on screen, the Sun travelling as it goes.
   */
  private draw(animate = false): void {
    const catalog = this.catalog;
    const first = this.skies()[0]?.nativeElement;
    if (!catalog || !first?.getContext('2d')) return;
    // Without the night landscape there's nothing to put in front of the sky; leave the painting.
    const night = this.look('darkness');
    if (!night) return;
    this.drawId++;

    const dpr = Math.min(MAX_DPR, Math.max(1, window.devicePixelRatio || 1));
    const layout = computeLayout(this.viewWidth(), this.viewHeight(), 1 / dpr);
    const sameLayout = !!this.layout && this.layout.width === layout.width && this.layout.height === layout.height
      && this.layout.artPixel === layout.artPixel;
    this.layout = layout;

    // Easing needs something on screen to ease from, at the same size. A change already under
    // way stops where it is (and eases on from there).
    this.settleTransition();
    const from = animate && sameLayout && this.state ? this.state : null;
    const target = from ? 1 - this.shown : this.shown;
    const sky = this.skies()[target]?.nativeElement;
    const land = this.lands()[target]?.nativeElement;
    const skyContext = sky?.getContext('2d');
    const landContext = land?.getContext('2d');
    if (!sky || !land || !skyContext || !landContext) return;
    for (const c of [sky, land, this.overlay().nativeElement]) {
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
    // or a disc is drawn in JS onto a transparent layer and laid over it. The Sun is an element.
    const image = this.pointsImage(skyContext, layout);
    const result = renderSky(image.data, layout, {
      date, lat, lon, catalog, bodies, lighting, paintBackground: false, drawSun: false,
    });
    paintSky(skyContext, layout, result.background, this.scratchCanvas('glow'));
    // In free look the stars are on the panorama, turned over this; the sky canvas is only the gradient.
    const free = this.freeOn ? this.free : null;
    const points = free ? null : this.scratchCanvas('points');
    if (points) {
      if (points.width !== layout.width || points.height !== layout.height) [points.width, points.height] = [layout.width, layout.height];
      points.getContext('2d')?.putImageData(image, 0, 0);
      skyContext.drawImage(points, 0, 0);
      drawGlows(skyContext, result.glows);
    }
    free?.render(this.viewWidth(), this.viewHeight(), dpr, layout, { date, lat, lon, catalog, bodies, lighting });

    // The landscape: the weighted looks. A look that hasn't loaded (or failed) lends its
    // weight to the night look until it arrives.
    let nightWeight = 0;
    const layers: { image: HTMLImageElement; weight: number }[] = [];
    for (const [look, weight] of Object.entries(lookWeights(lighting, result.sunAlt, result.sunAz)) as [LandscapeLook, number][]) {
      const img = look === 'darkness' ? null : this.look(look);
      if (img) layers.push({ image: img, weight });
      else nightWeight += weight;
    }
    if (nightWeight > 0) layers.unshift({ image: night, weight: nightWeight });
    landContext.clearRect(0, 0, layout.width, layout.height);
    this.drawCover(landContext, this.blendedLandscape(layers) ?? night, layout);
    this.updateLandMask(night);

    const state = lightState(lighting, result, layout);
    this.placeNightLights(layout);
    // Fireflies come out (or stay out) if either end of a change has them.
    this.setFireflies(layout, Math.max(state.fireflies, from?.fireflies ?? 0) > FIREFLY_MIN);

    this.scene = { targets: result.targets, segments: result.segments };
    // The sky moved (or changed): drop a hover whose object is no longer there.
    const { target: hovered, figure } = this.hover;
    const stillThere = hovered
      ? result.targets.some(t => t.kind === hovered.kind && t.name === hovered.name)
      : !figure || result.segments.some(s => s.figure === figure);
    if (!stillThere || from || free) {
      this.hover = NO_HOVER;
      this.label.set(null);
    }
    this.drawOverlay();
    const toHorizontal = j2000ToHorizontalMatrix(date, lat, lon);
    this.sky.upNow.set(upNow(bodies, catalog, toHorizontal));
    this.refreshTonight(date, lat, lon);
    this.toHorizontal = toHorizontal;
    this.starsVisible = result.starVisibility;
    this.updateNaming();

    // The panorama fades in as free look starts, and out as it ends, with the stars of the normal view.
    const [freeFrom, freeTo] = [this.freeOpacity, this.freeOn ? 1 : 0];
    if (!from) {
      this.showPair(this.shown);
      this.apply(state);
      this.setFreeOpacity(freeTo);
      return;
    }

    // Crossfade. The skies are opaque: the upper one fades (in, or out over the incoming one).
    // The landscapes have soft edges, so they're added instead (see .land in the styles): the
    // incoming one at the progress, the outgoing one at the rest, which keeps their coverage.
    const incoming = target;
    // Free look starting or ending: the stars on the way out go in the first part of the fade,
    // so the two projections' stars (which disagree away from due south) are barely seen together.
    const quick = (progress: number) => Math.min(1, progress / 0.4);
    const [skyFade, freeFade] = freeTo > freeFrom ? [quick, (p: number) => p] : freeTo < freeFrom ? [(p: number) => p, quick] : [(p: number) => p, (p: number) => p];
    const setFade = (progress: number) => {
      const [skyUnder, skyOver] = this.skies().map(ref => ref.nativeElement);
      const sky = skyFade(progress);
      skyUnder.style.opacity = '';
      skyOver.style.opacity = String(incoming === 1 ? sky : 1 - sky);
      this.lands().forEach((ref, i) => (ref.nativeElement.style.opacity = String(i === incoming ? progress : 1 - progress)));
      this.setFreeOpacity(freeFrom + (freeTo - freeFrom) * freeFade(progress));
    };
    const transition = { start: performance.now(), frame: 0, incoming, progress: 0 };
    const step = (now: number) => {
      if (this.transition !== transition || this.destroyed) return;
      const t = Math.min(1, (now - transition.start) / TRANSITION_MS);
      transition.progress = ease(t);
      if (t >= 1) {
        this.transition = null;
        this.shown = incoming;
        this.showPair(incoming);
        this.apply(state);
        this.setFreeOpacity(freeTo);
        this.setFireflies(layout, state.fireflies > FIREFLY_MIN);
        if (this.redrawAfterTransition) {
          this.redrawAfterTransition = false;
          this.draw(this.mayEase());
        }
        return;
      }
      setFade(transition.progress);
      this.apply(lightBetween(from, state, transition.progress));
      transition.frame = requestAnimationFrame(step);
    };
    this.transition = transition;
    setFade(0);
    transition.frame = requestAnimationFrame(step);
  }

  /**
   * The coming night for the Up tonight badge. The sky redraws every minute, but the night samples
   * the whole night (tens of milliseconds), so it's redone every ten minutes, on a move, or when dusk
   * or dawn passes, and after the draw rather than in it.
   */
  private refreshTonight(date: Date, lat: number, lon: number): void {
    const last = this.tonightFor;
    const crossed = (edge: Date | null | undefined) => !!edge && date.getTime() >= edge.getTime();
    const passed = !last?.value || (last.value.dark ? crossed(last.value.end) : crossed(last.value.start));
    if (last && !passed && last.lat === lat && last.lon === lon && Math.abs(date.getTime() - last.at) < 10 * 60_000) return;
    const astronomy = this.astronomy;
    this.tonightFor = { lat, lon, at: date.getTime(), value: last?.value ?? null };
    setTimeout(() => {
      let value: Tonight | null;
      try {
        value = astronomy ? tonight(astronomy, date, lat, lon) : null;
      } catch {
        value = null;
      }
      // A newer request (a move) may have come in meanwhile; only the latest is kept.
      if (this.tonightFor?.at !== date.getTime() || this.tonightFor.lat !== lat || this.tonightFor.lon !== lon) return;
      this.tonightFor = { lat, lon, at: date.getTime(), value };
      this.sky.tonight.set(value);
    });
  }

  /**
   * While naming: the unnamed stars a visitor can see and pick (above the
   * horizon, on screen, visible in this light, not behind the trees or under
   * the panel or the ☾ menu), in CSS pixels. The selection stays while its star
   * is above the horizon and on screen, even if it drifts behind something, so
   * nothing changes under a visitor who's typing; once it's gone, the brightest
   * candidate takes over.
   */
  private updateNaming(): void {
    const layout = this.layout;
    const toHorizontal = this.toHorizontal;
    if (!this.sky.naming() || !layout || !toHorizontal) return;
    const css = layout.artPixel;
    const hidden = this.hiddenTest();
    const pickable = this.starsVisible > PICKABLE_STARS;
    const screen = this.freeOn ? this.free?.screenMap() : null;
    // Free look's screen map is in CSS pixels already; the normal view's is in buffer pixels.
    const list = !pickable ? [] : screen
      ? starsOnScreen(this.sky.unnamed(), screen, toHorizontal, hidden)
      : starsOnScreen(this.sky.unnamed(), layout, toHorizontal, (x, y) => hidden(x * css, y * css))
        .map(c => ({ star: c.star, x: c.x * css, y: c.y * css }));
    // ‹ › go all the way round, so they need every unnamed star that's up.
    this.sky.around.set(pickable ? starsAround(this.sky.unnamed(), toHorizontal) : []);
    // (Not while the sky is turning: ‹ › may have picked a star it's turning towards.)
    if (this.sky.selected() && !this.selectedOnScreen() && !(this.freeOn && this.free?.moving)) this.sky.select(null);
    this.sky.setCandidates(list);
    this.updateSelectedPoint();
  }

  /** Whether a CSS point is hidden from the visitor: behind the landscape, or under the panel, the compass or the ☾ menu. */
  private hiddenTest(): (x: number, y: number) => boolean {
    const covers = Array.from(document.querySelectorAll(NAMING_COVERS)).map(el => el.getBoundingClientRect());
    return (x, y) => this.isLand(x, y) || covers.some(r => r.width > 0 && x > r.left - COVER_CLEARANCE && x < r.right + COVER_CLEARANCE
      && y > r.top - COVER_CLEARANCE && y < r.bottom + COVER_CLEARANCE);
  }

  /** The selected star's place (CSS pixels) if it's above the horizon and on screen, else null. */
  private selectedOnScreen(): { x: number; y: number } | null {
    const star = this.sky.selected();
    const layout = this.layout;
    const toHorizontal = this.toHorizontal;
    if (!star || !layout || !toHorizontal) return null;
    const h = multiply(toHorizontal, star.v);
    if (h[2] <= 0) return null;
    if (this.freeOn && this.free?.pan) return this.free.screenPoint(h);
    const p = screenPoint(layout, h);
    if (!p || p.x < 0 || p.y < 0 || p.x > layout.width || p.y > layout.height) return null;
    return { x: p.x * layout.artPixel, y: p.y * layout.artPixel };
  }

  /** ‹ › picked a star: free look turns (as little as it can) to bring it into view, and says where it got to. */
  private showSelectedStar(): void {
    const star = this.sky.selected();
    const toHorizontal = this.toHorizontal;
    const free = this.freeOn ? this.free : null;
    if (!star || !toHorizontal || !free) return;
    const { alt, az } = altAz(multiply(toHorizontal, star.v));
    if (alt <= 0) return;
    if (free.show(alt, az, this.clearSpot())) this.announceOnSettle = true;
  }

  /** Whether a star at a CSS point can be seen: well on screen, and not behind the landscape or under anything. */
  private clearSpot(): (x: number, y: number) => boolean {
    const hidden = this.hiddenTest();
    const [width, height] = [this.viewWidth(), this.viewHeight()];
    const margin = 24;
    return (x, y) => x > margin && y > margin && x < width - margin && y < height - margin && !hidden(x, y);
  }

  /**
   * Free look on (looking up) or off. On: load it the first time, start facing
   * south, and crossfade from the normal view to the panorama. Off: crossfade
   * back, and let the panorama go once it has faded.
   */
  private setFreeLook(on: boolean): void {
    if (!on) {
      if (!this.freeOn) return;
      this.freeOn = false;
      this.redrawAfterSettle = false;
      this.announceOnSettle = false;
      this.sky.freeLooking.set(false);
      this.sky.showable = null;
      this.free?.stop();
      this.draw(this.mayEase());
      return;
    }
    void this.loadFreeLook().then(free => {
      if (!free || this.destroyed || !this.sky.lookingUp() || this.freeOn) return;
      free.reset();
      free.start();
      // Nothing asked for before free look was on gets carried out now.
      this.sky.viewRequest.set(null);
      this.freeOn = true;
      this.draw(this.mayEase());
      this.sky.freeLooking.set(true);
      // ‹ › pass over stars no view can show (worked out with what's on screen as they're asked).
      this.sky.showable = ({ alt, az }) => {
        const clear = this.clearSpot();
        return free.canShow(alt, az, clear);
      };
    });
  }

  private loadFreeLook(): Promise<FreeLook | null> {
    this.freeLoad ??= import('./sky-free-look').then(
      ({ FreeLook }) => {
        if (this.destroyed) return null;
        this.free = new FreeLook(this.freeLayer().nativeElement, this.host, {
          moved: view => this.freeMoved(view),
          settled: (view, cause) => this.freeSettled(view, cause),
        }, () => matchMedia('(prefers-reduced-motion: reduce)').matches);
        return this.free;
      },
      () => null,
    );
    return this.freeLoad;
  }

  /**
   * The panorama moved (a frame of a drag or a turn): the ring goes with its star (its transform
   * set here, like the panorama's, rather than through a signal each frame), hover labels go, and
   * the compass reads on when its reading changes.
   */
  private freeMoved(view: LookView): void {
    const point = this.selectedOnScreen();
    const ring = this.ringElement()?.nativeElement;
    if (point && ring && this.sky.selectedPoint()) ring.style.transform = `translate(${point.x}px, ${point.y}px)`;
    // On or off screen: the ring comes or goes, which the template does.
    else if (!!point !== !!this.sky.selectedPoint()) this.sky.selectedPoint.set(point);
    if (this.hover !== NO_HOVER || this.label()) {
      this.hover = NO_HOVER;
      this.label.set(null);
      this.drawOverlay();
    }
    // The Sun turns with the sky too.
    if (this.state) this.placeSun(this.state);
    if (!sameReading(view, this.sky.view())) this.sky.view.set(view);
  }

  /**
   * The panorama came to rest: a redraw that waited is done, what can be picked is worked out
   * again, and a ‹ › turn says where it left the visitor (the compass's buttons say so as they're
   * pressed; a drag says nothing).
   */
  private freeSettled(view: LookView, cause: 'drag' | 'turn' | 'stop'): void {
    this.sky.view.set(view);
    this.sky.viewRequest.set(null);
    if (this.redrawAfterSettle) {
      this.redrawAfterSettle = false;
      this.draw();
    }
    this.updateNaming();
    if (this.announceOnSettle && cause === 'turn') this.sky.announceView(view);
    this.announceOnSettle = false;
  }

  private setFreeOpacity(opacity: number): void {
    this.freeOpacity = opacity;
    this.free?.setOpacity(opacity);
    // Faded right out: give its memory back.
    if (opacity === 0 && !this.freeOn) this.free?.release();
  }

  /**
   * Puts the Sun (an element of its own) where the light has it: in the normal view's
   * projection, or, in free look, wherever the sky is turned to (so it turns with the stars).
   */
  private placeSun(state: LightState): void {
    const layout = this.layout;
    const sun = this.sunElement().nativeElement;
    if (!layout || !state.sun) {
      sun.style.display = 'none';
      return;
    }
    const css = layout.artPixel;
    const radius = sunDiscRadius(layout) * css;
    const free = this.freeOn && this.free?.pan ? this.free : null;
    const place = free
      ? free.screenPoint(altAzToVector(state.sun.alt, state.sun.az), radius * 8)
      : (() => {
        const p = sunScreen(layout, state.sun);
        if (!p) return null;
        const [x, y] = [p.x * css, p.y * css];
        const onScreen = x > -radius * 8 && y > -radius * 8 && x < layout.width * css + radius * 8 && y < layout.height * css + radius * 8;
        return onScreen ? { x, y } : null;
      })();
    if (!place) {
      sun.style.display = 'none';
      return;
    }
    sun.style.display = 'block';
    sun.style.setProperty('--radius', `${radius.toFixed(2)}px`);
    sun.style.transform = `translate(${place.x.toFixed(2)}px, ${place.y.toFixed(2)}px)`;
  }

  /** Where the selected star is now (CSS pixels), for its ring; drawn as an element, never on the sky. */
  private updateSelectedPoint(): void {
    const point = this.selectedOnScreen();
    if (point || this.sky.selectedPoint()) this.sky.selectedPoint.set(point);
  }

  /** Puts the Sun where the state has it, and hands the small lights and the page their levels. */
  private apply(state: LightState): void {
    this.state = state;
    this.placeSun(state);
    const style = this.host.style;
    style.setProperty('--night-light', state.window.toFixed(3));
    // Out (and not animating) in daylight.
    this.host.classList.toggle('night-lit', state.window > 0);
    style.setProperty('--fireflies', smoothstep(FIREFLY_MIN, 0.5, state.fireflies).toFixed(3));
    // 0 at night, 1 in daylight, on <html> so page cards can darken behind their text
    // when the sky behind them is bright (see base-page).
    document.documentElement.style.setProperty('--daylight', String(Math.round(state.daylight * 100) / 100));
  }

  /** Puts the window light and the campfire where the painting has them (DOM only touched when they move). */
  private placeNightLights(layout: SkyLayout): void {
    const lights = nightLights(layout);
    const key = JSON.stringify(lights);
    if (key === this.lightsKey) return;
    this.lightsKey = key;
    this.lights.set(lights);
  }

  /** Puts the fireflies out (or takes them in); only touches the DOM when that changes. */
  private setFireflies(layout: SkyLayout, out: boolean): void {
    const key = `${out}@${layout.width}x${layout.height}`;
    if (key === this.fireflyKey) return;
    this.fireflyKey = key;
    this.fireflies.set(out ? fireflies(layout, FIREFLY_COUNT) : []);
  }
}

/** What's eased about a light (see sky-transition.ts), from a render of it. */
export function lightState(lighting: Lighting, result: SkyRenderResult, layout: SkyLayout): LightState {
  const { sunAlt, sunAz } = result;
  const sun = lighting === 'darkness'
    ? null
    : lighting === 'sunrise' || lighting === 'sunset'
      ? (result.sun ? sunPlaceAt(layout, result.sun.x, result.sun.y) : null)
      // Real time and day: where the renderer has a Sun (real time has none once it's below -1°).
      : result.sun ? { alt: sunAlt, az: sunAz } : null;
  return {
    sun,
    window: windowGlow(lighting, sunAlt),
    fireflies: fireflyAmount(lighting, sunAlt, sunAz),
    daylight: smoothstep(-6, 6, sunAlt),
  };
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
  // A card hidden while looking up keeps its box; it doesn't hide anything then.
  return Array.from(document.querySelectorAll('.page-container, app-sky-menu, .look-up-surface'))
    .filter(el => !el.closest('[inert]'))
    .map(el => el.getBoundingClientRect());
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return (await response.json()) as T;
}
