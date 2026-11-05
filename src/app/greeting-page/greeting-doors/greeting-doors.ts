import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SkyService } from '../../../shared/sky/sky.service';
import { CampfireService } from '../../../shared/services/campfire.service';
import { DOORS, Door, DoorId, Rect, Viewport, WINDOW_LEAD, fireLead, labelText, placeDoor } from './doors';

/**
 * The greeting's two hidden doors over the painting: the lit farmhouse window (projects) and the
 * campfire (social). Nothing shows at rest; the window and the fire already flicker. On hover or
 * keyboard focus a gold ring and a small label rise; on touch the first tap shows the label (which is
 * itself the link) and a tap elsewhere puts it away. They sit where the sky put its window light and
 * campfire, and hide when that spot is off screen or under the hero's words (`hero`'s children).
 */
@Component({
  selector: 'app-greeting-doors',
  imports: [RouterLink],
  templateUrl: './greeting-doors.html',
  styleUrl: './greeting-doors.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GreetingDoorsComponent {
  /** The hero (the name, tagline and ways in): a door under any of its parts hides. */
  readonly hero = input.required<HTMLElement>();

  private readonly sky = inject(SkyService);
  private readonly campfire = inject(CampfireService);
  private readonly router = inject(Router);
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;

  private readonly viewport = signal<Viewport | null>(null);
  private readonly covers = signal<readonly Rect[]>([]);

  /** Visitors around the fire right now (the campfire's `here`), or null with no count or no campfire. */
  private readonly here = computed(() => this.campfire.configured ? this.campfire.shoutLog()?.here ?? null : null);

  protected readonly doors = computed(() => {
    const lights = this.sky.nightLights();
    const viewport = this.viewport();
    if (!lights || !viewport) return [];
    return DOORS.flatMap(door => {
      const lead = door.id === 'window' ? WINDOW_LEAD : fireLead(this.here());
      const place = placeDoor(door.id === 'window' ? lights.window : lights.fire, viewport, labelText(lead, door), this.covers());
      return place ? [{ door, lead, place }] : [];
    });
  });

  private readonly hovered = signal<DoorId | null>(null);
  private readonly focused = signal<DoorId | null>(null);
  private readonly tapped = signal<DoorId | null>(null);
  /** The door whose label is up: a first tap, else keyboard focus, else the pointer. */
  protected readonly showing = computed(() => this.tapped() ?? this.focused() ?? this.hovered());

  /** How the last press on a spot began, so a touch can show the label first. */
  private pointerType: string | null = null;

  constructor() {
    // The count is only asked for while the fire's door is on screen (it polls while watched).
    const fireShown = computed(() => this.doors().some(entry => entry.door.id === 'fire'));
    effect(onCleanup => {
      if (fireShown()) onCleanup(this.campfire.watchShouts());
    });

    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const measure = () => this.measure();
      measure();
      window.addEventListener('resize', measure);
      const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
      observer?.observe(this.hero());

      // A tap anywhere but the open door puts its label away.
      const onPointerDown = (event: PointerEvent) => {
        const open = this.tapped();
        if (open && !(event.target instanceof Element && event.target.closest(`.greeting-door[data-door="${open}"]`))) this.tapped.set(null);
      };
      // Escape hides a label without moving the pointer or focus (WCAG 1.4.13), not the site-wide Escape too.
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key !== 'Escape' || event.defaultPrevented || !this.showing() || this.host.closest('[inert]')) return;
        event.preventDefault();
        this.hide();
      };
      document.addEventListener('pointerdown', onPointerDown);
      document.addEventListener('keydown', onKeyDown);
      destroyRef.onDestroy(() => {
        window.removeEventListener('resize', measure);
        observer?.disconnect();
        document.removeEventListener('pointerdown', onPointerDown);
        document.removeEventListener('keydown', onKeyDown);
      });
    });
  }

  /** The window's size and where the hero's parts are, in the sky's CSS pixels (both start at the window's corner). */
  private measure(): void {
    this.viewport.set({ width: window.innerWidth, height: window.innerHeight });
    this.covers.set(Array.from(this.hero().children, child => {
      const { left, top, right, bottom } = child.getBoundingClientRect();
      return { left, top, right, bottom };
    }).filter(rect => rect.right > rect.left && rect.bottom > rect.top));
  }

  protected pointerEnter(event: PointerEvent, id: DoorId): void {
    if (event.pointerType === 'mouse') this.hovered.set(id);
  }

  protected pointerLeave(id: DoorId): void {
    if (this.hovered() === id) this.hovered.set(null);
  }

  protected focus(event: FocusEvent, id: DoorId): void {
    if (focusVisible(event.target)) this.focused.set(id);
  }

  protected blur(id: DoorId): void {
    if (this.focused() === id) this.focused.set(null);
  }

  protected pointerDown(event: PointerEvent): void {
    this.pointerType = event.pointerType;
  }

  /**
   * A plain press on a spot: a touch shows the label first (a second tap, or the label, goes in);
   * a mouse or the keyboard goes straight in. Modified clicks are the browser's (a new tab).
   */
  protected press(event: MouseEvent, door: Door): void {
    const touch = this.pointerType === 'touch' || this.pointerType === 'pen';
    this.pointerType = null;
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (touch && this.tapped() !== door.id) {
      this.tapped.set(door.id);
      return;
    }
    void this.router.navigateByUrl(door.path);
  }

  private hide(): void {
    this.tapped.set(null);
    this.focused.set(null);
    this.hovered.set(null);
  }
}

function focusVisible(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  try {
    return target.matches(':focus-visible');
  } catch {
    return true;
  }
}
