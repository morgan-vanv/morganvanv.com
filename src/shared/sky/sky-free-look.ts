import { NO_HOVER, SkyHover, hoverAt, isOpenSky } from './sky-hover';
import { Vec3, altAz } from './sky-math';
import { SkyInput, SkyLayout, SkySegment, SkyTarget, drawGlows, renderSky } from './sky-render';
import { ScreenMap } from './sky-naming';
import {
  Panorama,
  bringIntoView,
  bufferPoint,
  computePanorama,
  dragView,
  panoramaOffset,
  panoramaProjection,
  screenOfBuffer,
  viewBetween,
  viewPoint,
} from './sky-panorama';
import { ease } from './sky-transition';
import { FACE_SOUTH, LookView, MAX_TILT, clampView } from './sky-view';

/** How far (CSS px) a press can wander and still be a tap, by mouse or pen and by finger. */
export const TAP_SLOP = 6;
export const TAP_SLOP_TOUCH = 10;
/** How long a turn from the compass or ‹ › takes. */
export const TURN_MS = 600;
/**
 * The glide after a flick: it starts no faster than GLIDE_MAX_SPEED (CSS px/ms), slows with
 * this time constant (ms) and stops below GLIDE_MIN_SPEED. So it carries on at most about
 * 500 px: gentle, not a spin.
 */
const GLIDE_TIME_CONSTANT = 250;
const GLIDE_MAX_SPEED = 2;
const GLIDE_MIN_SPEED = 0.03;
/** The flick's speed is measured over the last stretch of the drag (ms). */
const VELOCITY_WINDOW = 100;

/** What free look tells the sky component. */
export interface FreeLookHost {
  /** The view moved (each frame while it does): the ring follows, hover goes. */
  moved(view: LookView): void;
  /** The view came to rest, after a drag (and its glide), a turn, or a press that stopped either. */
  settled(view: LookView, cause: 'drag' | 'turn' | 'stop'): void;
}

/** What the panorama needs to draw: the normal draw's input and its layout (which decides the light). */
export type PanoramaInput = Omit<SkyInput, 'projection' | 'paintBackground' | 'drawSun'>;

/**
 * Free look: while looking up, the sky can be dragged round and up. The whole
 * sky is drawn once into a panorama (sky-panorama.ts) on one canvas; a drag
 * only moves that canvas (a CSS transform), so nothing is redrawn per frame.
 * The painting in front stays where it is. Loaded with the first look up.
 *
 * Pointer events: a press on open sky that moves more than a few pixels is a
 * drag (the pointer is captured, and the click it ends with is swallowed);
 * less is a tap, which the sky component handles as before (naming picks the
 * nearest star). A flick glides to a stop, except under reduced motion.
 */
export class FreeLook {
  /** Which way the visitor is looking. */
  view: LookView = FACE_SOUTH;
  pan: Panorama | null = null;
  readonly canvas: HTMLCanvasElement;
  /** What the last render drew (buffer px), for hover. */
  scene: { targets: readonly SkyTarget[]; segments: readonly SkySegment[] } | null = null;
  private pointer: { id: number; startX: number; startY: number; lastX: number; lastY: number; slop: number } | null = null;
  private samples: { t: number; x: number; y: number }[] = [];
  /** A drag is under way (past the slop). */
  dragging = false;
  /** The press that just ended was a drag, so its click shouldn't pick a star. */
  private dragEnded = false;
  private frame = 0;
  private motion: 'glide' | 'turn' | null = null;
  private listening = false;

  constructor(
    container: HTMLElement,
    private readonly surface: HTMLElement,
    private readonly host: FreeLookHost,
    private readonly reducedMotion: () => boolean,
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'panorama';
    // Made here, so the component's styles don't reach it.
    Object.assign(this.canvas.style, { position: 'absolute', top: '0', left: '0', transformOrigin: '0 0', opacity: '0' });
    container.append(this.canvas);
  }

  /** Moving on its own (gliding or turning), or being dragged. */
  get moving(): boolean {
    return this.dragging || this.motion !== null;
  }

  /** Draws the whole sky into the panorama (sized for the screen), and puts it where the view has it. */
  render(viewWidth: number, viewHeight: number, dpr: number, layout: SkyLayout, input: PanoramaInput): void {
    const pan = computePanorama(viewWidth, viewHeight, dpr);
    const context = this.canvas.getContext('2d');
    if (!context) return;
    if (this.canvas.width !== pan.width || this.canvas.height !== pan.height) [this.canvas.width, this.canvas.height] = [pan.width, pan.height];
    this.canvas.style.width = `${pan.width * pan.artPixel}px`;
    this.canvas.style.height = `${pan.height * pan.artPixel}px`;
    // Made for each render and let go straight after: kept, it would double the panorama's
    // memory for something needed once a minute.
    const image = context.createImageData(pan.width, pan.height);
    const result = renderSky(image.data, layout, { ...input, projection: panoramaProjection(pan), paintBackground: false, drawSun: false });
    context.putImageData(image, 0, 0);
    drawGlows(context, result.glows);
    this.pan = pan;
    this.scene = { targets: result.targets, segments: result.segments };
    this.place();
  }

  setOpacity(opacity: number): void {
    this.canvas.style.opacity = String(opacity);
  }

  /** Starts listening for drags on the sky. */
  start(): void {
    if (this.listening) return;
    this.listening = true;
    this.canvas.style.willChange = 'transform';
    this.surface.addEventListener('pointerdown', this.onDown);
    this.surface.addEventListener('pointermove', this.onMove);
    this.surface.addEventListener('pointerup', this.onUp);
    this.surface.addEventListener('pointercancel', this.onCancel);
  }

  /** Stops listening, and stops any motion. */
  stop(): void {
    this.listening = false;
    this.canvas.style.willChange = '';
    this.surface.classList.remove('dragging');
    this.surface.removeEventListener('pointerdown', this.onDown);
    this.surface.removeEventListener('pointermove', this.onMove);
    this.surface.removeEventListener('pointerup', this.onUp);
    this.surface.removeEventListener('pointercancel', this.onCancel);
    this.halt();
    this.pointer = null;
    this.dragging = false;
  }

  /** Back to facing south (free look always starts there). */
  reset(): void {
    this.halt();
    this.view = FACE_SOUTH;
    this.place();
  }

  /** Gives the panorama's memory back (phones are short of it) and forgets the view. */
  release(): void {
    this.stop();
    if (!this.pan && !this.canvas.width) return;
    this.view = FACE_SOUTH;
    this.scene = null;
    this.pan = null;
    [this.canvas.width, this.canvas.height] = [0, 0];
  }

  destroy(): void {
    this.release();
    this.canvas.remove();
  }

  /** Whether a click should be ignored because it ended a drag (asking clears it). */
  takeDragClick(): boolean {
    const ended = this.dragEnded;
    this.dragEnded = false;
    return ended;
  }

  /** Whether the press that just ended was a drag (without clearing it). */
  get endedDrag(): boolean {
    return this.dragEnded;
  }

  /** Turns to a view: briefly animated, or at once under reduced motion. */
  turnTo(target: LookView): void {
    this.halt();
    const to = clampView(target);
    if (this.reducedMotion() || !this.pan) {
      this.view = to;
      this.place();
      this.host.settled(this.view, 'turn');
      return;
    }
    const from = this.view;
    const start = performance.now();
    this.motion = 'turn';
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / TURN_MS);
      this.view = viewBetween(from, to, ease(t));
      this.place();
      if (t >= 1) {
        this.motion = null;
        this.frame = 0;
        this.host.settled(this.view, 'turn');
        return;
      }
      this.frame = requestAnimationFrame(step);
    };
    this.frame = requestAnimationFrame(step);
  }

  /** Whether some view shows a direction (see `bringIntoView`). */
  canShow(alt: number, az: number, visible: (x: number, y: number) => boolean): boolean {
    return !!this.pan && bringIntoView(this.pan, this.view, alt, az, visible) !== null;
  }

  /** Turns (as little as it can) so a direction can be seen; true if that means turning. */
  show(alt: number, az: number, visible: (x: number, y: number) => boolean): boolean {
    if (!this.pan) return false;
    const target = bringIntoView(this.pan, this.view, alt, az, visible);
    if (!target || target === this.view) return false;
    this.turnTo(target);
    return true;
  }

  /** Where a horizontal direction is on screen (CSS px), or null if it's off screen. */
  screenPoint(h: Vec3, margin = 0): { x: number; y: number } | null {
    if (!this.pan) return null;
    const { alt, az } = altAz(h);
    return viewPoint(this.pan, this.view, alt, az, margin);
  }

  /** The screen (CSS px) as the naming candidates see it. */
  screenMap(): ScreenMap | null {
    const pan = this.pan;
    if (!pan) return null;
    return { width: pan.viewWidth, height: pan.viewHeight, point: h => this.screenPoint(h) };
  }

  /** What's under a screen point (CSS px). */
  hoverAt(clientX: number, clientY: number, lineReachCss: number): SkyHover {
    const pan = this.pan;
    const scene = this.scene;
    if (!pan || !scene) return NO_HOVER;
    const at = bufferPoint(pan, this.view, clientX, clientY);
    return hoverAt(at.x, at.y, scene.targets, scene.segments, lineReachCss / pan.artPixel);
  }

  /** A buffer point on screen (CSS px), and CSS px per buffer px. */
  toScreen(x: number, y: number): { x: number; y: number } {
    return this.pan ? screenOfBuffer(this.pan, this.view, x, y) : { x, y };
  }

  get cssPerPixel(): number {
    return this.pan?.artPixel ?? 1;
  }

  private place(): void {
    const pan = this.pan;
    if (!pan) return;
    const { x, y } = panoramaOffset(pan, this.view);
    this.canvas.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
    this.host.moved(this.view);
  }

  /** Stops a glide or a turn where it is. */
  private halt(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.motion = null;
  }

  private readonly onDown = (event: PointerEvent) => {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0) || !this.pan || !isOpenSky(event.target)) return;
    // A press stops a glide or a turn; let the sky catch up (a tap now picks from where things are).
    if (this.motion) {
      this.halt();
      this.host.settled(this.view, 'stop');
    }
    this.dragEnded = false;
    this.pointer = {
      id: event.pointerId, startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastY: event.clientY,
      slop: event.pointerType === 'touch' ? TAP_SLOP_TOUCH : TAP_SLOP,
    };
    this.samples = [{ t: event.timeStamp, x: event.clientX, y: event.clientY }];
    try {
      this.surface.setPointerCapture(event.pointerId);
    } catch {
      // Not every browser (or test DOM) can; the sky covers the window anyway.
    }
  };

  private readonly onMove = (event: PointerEvent) => {
    const pointer = this.pointer;
    const pan = this.pan;
    if (!pointer || event.pointerId !== pointer.id || !pan) return;
    if (!this.dragging) {
      if (Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) <= pointer.slop) return;
      this.dragging = true;
      this.surface.classList.add('dragging');
    }
    this.view = dragView(pan, this.view, event.clientX - pointer.lastX, event.clientY - pointer.lastY);
    pointer.lastX = event.clientX;
    pointer.lastY = event.clientY;
    this.samples.push({ t: event.timeStamp, x: event.clientX, y: event.clientY });
    this.samples = this.samples.filter(s => event.timeStamp - s.t <= VELOCITY_WINDOW);
    this.place();
  };

  private readonly onUp = (event: PointerEvent) => this.endPress(event, true);
  private readonly onCancel = (event: PointerEvent) => this.endPress(event, false);

  private endPress(event: PointerEvent, mayGlide: boolean): void {
    const pointer = this.pointer;
    if (!pointer || event.pointerId !== pointer.id) return;
    this.pointer = null;
    try {
      this.surface.releasePointerCapture(event.pointerId);
    } catch {
      // Already released.
    }
    if (!this.dragging) return;
    this.dragging = false;
    this.dragEnded = true;
    this.surface.classList.remove('dragging');
    const velocity = mayGlide && !this.reducedMotion() ? flickVelocity(this.samples, event.timeStamp) : null;
    if (velocity) this.glide(velocity);
    else this.host.settled(this.view, 'drag');
  }

  /** Carries on after a flick, slowing to a stop. */
  private glide(velocity: { x: number; y: number }): void {
    let [vx, vy] = [velocity.x, velocity.y];
    let last = performance.now();
    this.motion = 'glide';
    const step = (now: number) => {
      const pan = this.pan;
      // (Frames can arrive with a time just before the last one's.)
      const dt = Math.max(0, Math.min(50, now - last));
      last = now;
      if (!pan || Math.hypot(vx, vy) < GLIDE_MIN_SPEED) {
        this.motion = null;
        this.frame = 0;
        this.host.settled(this.view, 'drag');
        return;
      }
      const next = dragView(pan, this.view, vx * dt, vy * dt);
      // Stopped at the horizon or the zenith: no more up or down.
      if ((next.tilt <= 0 && vy < 0) || (next.tilt >= MAX_TILT && vy > 0)) vy = 0;
      this.view = next;
      const decay = Math.exp(-dt / GLIDE_TIME_CONSTANT);
      vx *= decay;
      vy *= decay;
      this.place();
      this.frame = requestAnimationFrame(step);
    };
    this.frame = requestAnimationFrame(step);
  }
}

/** How fast (CSS px/ms) a drag was going as it let go, from its last moments; null if it had stopped. */
export function flickVelocity(samples: readonly { t: number; x: number; y: number }[], now: number): { x: number; y: number } | null {
  const recent = samples.filter(s => now - s.t <= VELOCITY_WINDOW);
  if (recent.length < 2) return null;
  const [first, last] = [recent[0], recent[recent.length - 1]];
  const dt = last.t - first.t;
  if (dt <= 0) return null;
  const velocity = { x: (last.x - first.x) / dt, y: (last.y - first.y) / dt };
  const speed = Math.hypot(velocity.x, velocity.y);
  if (speed < GLIDE_MIN_SPEED * 2) return null;
  const scale = Math.min(1, GLIDE_MAX_SPEED / speed);
  return { x: velocity.x * scale, y: velocity.y * scale };
}
