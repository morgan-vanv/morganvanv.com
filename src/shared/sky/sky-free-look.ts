import {
  Cube,
  FACES,
  GUTTER,
  atlasPoint,
  bringIntoView,
  computeCube,
  faceProjection,
  cubeTransform,
  dragView,
  faceOrigin,
  faceTransform,
  groundShift,
  screenOfAtlas,
  viewBetween,
  viewPoint,
} from './sky-cube';
import { NO_HOVER, SkyHover, hoverAt, isOpenSky } from './sky-hover';
import { Vec3 } from './sky-math';
import { SkyInput, SkyLayout, SkySegment, SkyTarget, drawGlows, renderSky } from './sky-render';
import { ScreenMap } from './sky-naming';
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
  /** The view moved (each frame while it does): the ring follows, hover goes, the ground slides. */
  moved(view: LookView): void;
  /** The view came to rest, after a drag (and its glide), a turn, or a press that stopped either. */
  settled(view: LookView, cause: 'drag' | 'turn' | 'stop'): void;
}

/** What the cube needs to draw: the normal draw's input and its layout (which decides the light). */
export type PanoramaInput = Omit<SkyInput, 'projection' | 'paintBackground' | 'drawSun'>;

/**
 * Free look: while looking up, the sky can be dragged round and up to the
 * zenith, through a camera. The whole sky is drawn once onto the faces of a
 * cube (sky-cube.ts), five canvases in a CSS 3D box round the viewer; a drag
 * only changes the box's transform, so nothing is redrawn per frame. The
 * painting in front stays put as you turn, and slides down as you tilt (the
 * component does that from `groundShift`). Loaded with the first look up.
 *
 * Pointer events: a press on open sky that moves more than a few pixels is a
 * drag (the pointer is captured, and the click it ends with is swallowed);
 * less is a tap, which the sky component handles as before (naming picks the
 * nearest star). A flick glides to a stop, except under reduced motion.
 */
export class FreeLook {
  /** Which way the visitor is looking. */
  view: LookView = FACE_SOUTH;
  cube: Cube | null = null;
  /** The 3D box the faces hang on; its transform is the view. */
  readonly box: HTMLElement;
  readonly faces: HTMLCanvasElement[];
  /** What the last render drew (atlas px), for hover. */
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
    private readonly container: HTMLElement,
    private readonly surface: HTMLElement,
    private readonly host: FreeLookHost,
    private readonly reducedMotion: () => boolean,
  ) {
    this.box = document.createElement('div');
    this.box.className = 'cube';
    // Made here, so the component's styles don't reach it.
    Object.assign(this.box.style, { position: 'absolute', width: '0', height: '0', transformStyle: 'preserve-3d', transformOrigin: '0 0', opacity: '0' });
    this.faces = FACES.map((_, i) => {
      const canvas = document.createElement('canvas');
      canvas.className = `face face-${i}`;
      Object.assign(canvas.style, { position: 'absolute', backfaceVisibility: 'hidden' });
      this.box.append(canvas);
      return canvas;
    });
    container.append(this.box);
  }

  /** Moving on its own (gliding or turning), or being dragged. */
  get moving(): boolean {
    return this.dragging || this.motion !== null;
  }

  /** Draws the whole sky onto the cube (sized for the screen), a face at a time, and turns it to the view. */
  render(viewWidth: number, viewHeight: number, dpr: number, layout: SkyLayout, input: PanoramaInput): void {
    const cube = computeCube(viewWidth, viewHeight, dpr);
    const targets: SkyTarget[] = [];
    const segments: SkySegment[] = [];
    this.faces.forEach((canvas, i) => {
      if (canvas.width !== cube.face || canvas.height !== cube.face) [canvas.width, canvas.height] = [cube.face, cube.face];
      const face = canvas.getContext('2d');
      if (!face) return;
      const projection = faceProjection(cube, i);
      // Made for each face and let go straight after: kept, they would double the cube's memory.
      const image = face.createImageData(projection.width, projection.height);
      const result = renderSky(image.data, layout, { ...input, projection, paintBackground: false, drawSun: false });
      face.clearRect(0, 0, cube.face, cube.face);
      face.putImageData(image, -GUTTER, -GUTTER, GUTTER, GUTTER, cube.face, cube.face);
      face.save();
      face.translate(-GUTTER, -GUTTER);
      drawGlows(face, result.glows);
      face.restore();
      // Into the atlas, where hover and the ring look things up.
      const o = faceOrigin(cube, i);
      const [dx, dy] = [o.x - GUTTER, o.y - GUTTER];
      for (const t of result.targets) targets.push({ ...t, x: t.x + dx, y: t.y + dy });
      for (const s of result.segments) segments.push({ ...s, ax: s.ax + dx, ay: s.ay + dy, bx: s.bx + dx, by: s.by + dy });
      Object.assign(canvas.style, {
        width: `${cube.faceCss}px`,
        height: `${cube.faceCss}px`,
        left: `${-cube.focal}px`,
        top: `${-cube.focal}px`,
        transform: faceTransform(cube, i),
      });
    });
    Object.assign(this.container.style, { perspective: `${cube.focal}px`, perspectiveOrigin: `${cube.centerX}px ${cube.horizonY}px` });
    Object.assign(this.box.style, { left: `${cube.centerX}px`, top: `${cube.horizonY}px` });
    this.cube = cube;
    this.scene = { targets, segments };
    this.place();
  }

  setOpacity(opacity: number): void {
    this.box.style.opacity = String(opacity);
  }

  /** Starts listening for drags on the sky. */
  start(): void {
    if (this.listening) return;
    this.listening = true;
    this.box.style.willChange = 'transform';
    this.surface.addEventListener('pointerdown', this.onDown);
    this.surface.addEventListener('pointermove', this.onMove);
    this.surface.addEventListener('pointerup', this.onUp);
    this.surface.addEventListener('pointercancel', this.onCancel);
  }

  /** Stops listening, and stops any motion. */
  stop(): void {
    this.listening = false;
    this.box.style.willChange = '';
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

  /** Gives the faces' memory back (phones are short of it) and forgets the view. */
  release(): void {
    this.stop();
    if (!this.cube && !this.faces[0].width) return;
    this.view = FACE_SOUTH;
    this.scene = null;
    this.cube = null;
    for (const canvas of this.faces) [canvas.width, canvas.height] = [0, 0];
  }

  destroy(): void {
    this.release();
    this.box.remove();
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

  /** How far down the painting has slid for the view (CSS px). */
  get groundShift(): number {
    return this.cube ? groundShift(this.cube, this.view) : 0;
  }

  /** Turns to a view: briefly animated, or at once under reduced motion. */
  turnTo(target: LookView): void {
    this.halt();
    const to = clampView(target);
    if (this.reducedMotion() || !this.cube) {
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
    return !!this.cube && bringIntoView(this.cube, this.view, alt, az, visible) !== null;
  }

  /** Turns (as little as it can) so a direction can be seen; true if that means turning. */
  show(alt: number, az: number, visible: (x: number, y: number) => boolean): boolean {
    if (!this.cube) return false;
    const target = bringIntoView(this.cube, this.view, alt, az, visible);
    if (!target || target === this.view) return false;
    this.turnTo(target);
    return true;
  }

  /** Where a horizontal direction is on screen (CSS px), or null if it's off screen. */
  screenPoint(h: Vec3, margin = 0): { x: number; y: number } | null {
    return this.cube ? viewPoint(this.cube, this.view, h, margin) : null;
  }

  /** The screen (CSS px) as the naming candidates see it. */
  screenMap(): ScreenMap | null {
    const cube = this.cube;
    if (!cube) return null;
    return { width: cube.viewWidth, height: cube.viewHeight, point: h => this.screenPoint(h) };
  }

  /** What's under a screen point (CSS px). */
  hoverAt(clientX: number, clientY: number, lineReachCss: number): SkyHover {
    const cube = this.cube;
    const scene = this.scene;
    if (!cube || !scene) return NO_HOVER;
    const at = atlasPoint(cube, this.view, clientX, clientY);
    return hoverAt(at.x, at.y, scene.targets, scene.segments, lineReachCss / cube.artPixel);
  }

  /** An atlas point on screen (CSS px). */
  toScreen(x: number, y: number): { x: number; y: number } {
    return this.cube ? screenOfAtlas(this.cube, this.view, x, y) : { x, y };
  }

  /** CSS px per atlas px (at the middle of a face). */
  get cssPerPixel(): number {
    return this.cube?.artPixel ?? 1;
  }

  private place(): void {
    const cube = this.cube;
    if (!cube) return;
    this.box.style.transform = cubeTransform(cube, this.view);
    this.host.moved(this.view);
  }

  /** Stops a glide or a turn where it is. */
  private halt(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.motion = null;
  }

  private readonly onDown = (event: PointerEvent) => {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0) || !this.cube || !isOpenSky(event.target)) return;
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
    const cube = this.cube;
    if (!pointer || event.pointerId !== pointer.id || !cube) return;
    if (!this.dragging) {
      if (Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) <= pointer.slop) return;
      this.dragging = true;
      this.surface.classList.add('dragging');
    }
    this.view = dragView(cube, this.view, event.clientX - pointer.lastX, event.clientY - pointer.lastY);
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
      const cube = this.cube;
      // (Frames can arrive with a time just before the last one's.)
      const dt = Math.max(0, Math.min(50, now - last));
      last = now;
      if (!cube || Math.hypot(vx, vy) < GLIDE_MIN_SPEED) {
        this.motion = null;
        this.frame = 0;
        this.host.settled(this.view, 'drag');
        return;
      }
      const next = dragView(cube, this.view, vx * dt, vy * dt);
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
