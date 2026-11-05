import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, PLATFORM_ID, afterNextRender, afterRenderEffect, computed, inject,
  input, signal, untracked, viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PS1_MODELS, Ps1ModelKey } from './ps1-models';
import { PS1_FPS, PS1_TURN_SPEED, renderPs1 } from './ps1-render';

export type Ps1StageSize = 'large' | 'small';

/** The buffer each size draws into; the CSS shows it at exactly twice that, so every pixel is a 2×2 block. */
export const PS1_BUFFERS: Readonly<Record<Ps1StageSize, { width: number; height: number }>> = {
  large: { width: 110, height: 84 },
  small: { width: 96, height: 72 },
};

/** A drag turns the model this many radians a CSS pixel (about a full turn across 300 px). */
export const DRAG_RADIANS_PER_PX = 0.021;
/** After a drag, how much of the gap to the slow turn closes each frame (about a second to settle). */
const SETTLE = 0.06;
/** The fastest a flick can spin it, radians a second. */
const MAX_SPIN = 12;
/** A release this long after the last move is a release at rest: no flick. */
const FLICK_WINDOW_MS = 100;

/**
 * The Lab's PS1 stage: the selected machine as a low-poly model turning slowly on a dashed stage with a
 * gold grid floor, where the spec sheet's photo would go. The canvas is drawn only in the browser, after
 * render (the prerendered page has the empty stage, at its final size), by `renderPs1`, 15 times a second
 * while the stage is on screen and the tab is visible. A drag left or right spins it (pointer capture;
 * `touch-action: pan-y` keeps a phone's vertical scroll), and it eases back into its slow turn after.
 * Under reduced motion it's one still frame, a three-quarter view, which a drag can still turn. It's
 * decorative beside the spec sheet: not focusable, no keys (← → change page).
 */
@Component({
  selector: 'app-ps1-stage',
  templateUrl: './ps1-stage.component.html',
  styleUrl: './ps1-stage.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.small]': "size() === 'small'",
    '[class.dragging]': 'dragging()',
  },
})
export class Ps1StageComponent {
  /** Which model to show. */
  readonly model = input.required<Ps1ModelKey>();
  /** The machine's name, for the canvas's accessible name. */
  readonly name = input.required<string>();
  readonly size = input<Ps1StageSize>('large');

  protected readonly buffer = computed(() => PS1_BUFFERS[this.size()]);
  /** True under reduced motion, once the browser has said so: one still frame, no timer. */
  protected readonly still = signal(false);
  protected readonly label = computed(() => `${this.name()}, a low-poly model${this.still() ? '' : ' turning slowly'}`);
  protected readonly dragging = signal(false);

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  private context: CanvasRenderingContext2D | null = null;
  private image: ImageData | null = null;
  /** The turn (radians) and the clock (seconds, for the VPS's bob). */
  private turn = 0;
  private time = 0;
  /** How fast it's turning, radians a second: the slow turn, or what a flick left it with. */
  private spin = PS1_TURN_SPEED;
  private shownKey: Ps1ModelKey | null = null;

  private timer: ReturnType<typeof setInterval> | null = null;
  private onScreen = true;
  private tabVisible = true;
  private destroyed = false;

  private pointerId: number | null = null;
  private lastX = 0;
  private lastMoveAt = 0;

  constructor() {
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.sync();
    });
    if (!this.browser) return;

    afterNextRender(() => {
      // Reduced motion can be switched on (or off) while the page is open: follow it.
      const motion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
      this.still.set(motion?.matches ?? false);
      if (motion) {
        const onMotion = (event: MediaQueryListEvent) => {
          this.still.set(event.matches);
          this.sync();
          this.draw();
        };
        motion.addEventListener('change', onMotion);
        destroyRef.onDestroy(() => motion.removeEventListener('change', onMotion));
      }
      this.tabVisible = document.visibilityState !== 'hidden';
      const onVisibility = () => {
        this.tabVisible = document.visibilityState !== 'hidden';
        this.sync();
      };
      document.addEventListener('visibilitychange', onVisibility);
      destroyRef.onDestroy(() => document.removeEventListener('visibilitychange', onVisibility));
      if (typeof IntersectionObserver === 'function') {
        const observer = new IntersectionObserver(entries => {
          this.onScreen = entries[entries.length - 1].isIntersecting;
          this.sync();
        });
        observer.observe(this.host);
        destroyRef.onDestroy(() => observer.disconnect());
      }
      this.sync();
    });

    // The first frame, and a new model (or size) whenever the selection changes: a new model starts its turn again.
    afterRenderEffect(() => {
      const key = this.model();
      this.buffer();
      untracked(() => {
        if (key !== this.shownKey) {
          this.shownKey = key;
          this.turn = 0;
          this.spin = PS1_TURN_SPEED;
        }
        this.draw();
      });
    });
  }

  /** Runs the timer while it should be turning (on screen, tab visible, not reduced motion, not destroyed), and stops it otherwise. */
  private sync(): void {
    const wanted = !this.destroyed && !this.still() && this.onScreen && this.tabVisible;
    if (wanted && this.timer === null) {
      this.timer = setInterval(() => this.tick(), 1000 / PS1_FPS);
    } else if (!wanted && this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private tick(): void {
    this.time += 1 / PS1_FPS;
    if (this.pointerId === null) {
      this.spin += (PS1_TURN_SPEED - this.spin) * SETTLE;
      this.turn += this.spin / PS1_FPS;
    }
    this.draw();
  }

  private draw(): void {
    const canvas = this.canvas().nativeElement;
    this.context ??= canvas.getContext('2d');
    if (!this.context) return;
    const { width, height } = this.buffer();
    if (!this.image || this.image.width !== width || this.image.height !== height) {
      this.image = this.context.createImageData(width, height);
    }
    renderPs1(PS1_MODELS[this.model()], { turn: this.turn, time: this.time }, width, height, this.image.data);
    this.context.putImageData(this.image, 0, 0);
  }

  protected grab(event: PointerEvent): void {
    if (event.button !== 0 || this.pointerId !== null) return;
    this.pointerId = event.pointerId;
    this.lastX = event.clientX;
    this.lastMoveAt = event.timeStamp;
    this.spin = 0;
    this.canvas().nativeElement.setPointerCapture?.(event.pointerId);
    this.dragging.set(true);
  }

  protected drag(event: PointerEvent): void {
    if (event.pointerId !== this.pointerId) return;
    const dx = event.clientX - this.lastX;
    const seconds = (event.timeStamp - this.lastMoveAt) / 1000;
    // Dragging right brings the front round to the right.
    this.turn -= dx * DRAG_RADIANS_PER_PX;
    if (seconds > 0) this.spin = Math.max(-MAX_SPIN, Math.min(MAX_SPIN, (-dx * DRAG_RADIANS_PER_PX) / seconds));
    this.lastX = event.clientX;
    this.lastMoveAt = event.timeStamp;
    this.draw();
  }

  protected release(event: PointerEvent): void {
    if (event.pointerId !== this.pointerId) return;
    this.pointerId = null;
    if (event.timeStamp - this.lastMoveAt > FLICK_WINDOW_MS) this.spin = 0;
    this.dragging.set(false);
  }
}
