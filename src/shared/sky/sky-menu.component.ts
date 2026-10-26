import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Injector, afterNextRender, effect, inject, untracked, viewChild } from '@angular/core';
import { IconComponent } from '../icon/icon.component';
import { SkyService } from './sky.service';
import { SkyToggleComponent } from './sky-toggle.component';
import { Lighting } from './sky-render';

/** Lighting choices in menu order. Labels and hints are drafts for Morgan. */
export const LIGHT_OPTIONS: readonly { id: Lighting; label: string; hint: string }[] = [
  { id: 'darkness', label: 'darkness [default]', hint: 'the stars where they really are, minus the sun' },
  { id: 'real', label: 'real time', hint: 'the sky as it actually is right now' },
  { id: 'sunrise', label: 'sunrise', hint: 'not the real time. just a nice one' },
  { id: 'sunset', label: 'sunset', hint: 'not the real time. just a nice one' },
  { id: 'day', label: 'day', hint: 'for the daylight people' },
];

/**
 * The ☾ button in the top-right corner and the small panel it opens: how the
 * sky is lit, whose sky it is, and what's up right now (the text version of the
 * sky, for anyone who can't see the canvas). A disclosure, not a modal: Esc or a
 * click outside closes it. Only shown once the live sky has drawn.
 */
@Component({
  selector: 'app-sky-menu',
  imports: [IconComponent, SkyToggleComponent],
  templateUrl: './sky-menu.component.html',
  styleUrl: './sky-menu.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(keydown.escape)': 'onEscape($event)',
  },
})
export class SkyMenuComponent {
  protected readonly sky = inject(SkyService);
  protected readonly options = LIGHT_OPTIONS;
  protected readonly open = this.sky.menuOpen;
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  private readonly injector = inject(Injector);
  private readonly button = viewChild<ElementRef<HTMLButtonElement>>('button');

  constructor() {
    const onPointerDown = (event: PointerEvent) => {
      if (this.open() && !this.host.contains(event.target as Node)) this.open.set(false);
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('pointerdown', onPointerDown);
      inject(DestroyRef).onDestroy(() => document.removeEventListener('pointerdown', onPointerDown));
    }
    // Opened from a badge: put focus on the current light, so Esc and Tab carry on from here.
    effect(() => {
      if (!this.sky.menuFocusRequests()) return;
      untracked(() => afterNextRender(() => {
        this.host.querySelector<HTMLInputElement>('input[name="sky-lighting"]:checked')?.focus();
      }, { injector: this.injector }));
    });
  }

  protected hint(): string {
    return this.options.find(o => o.id === this.sky.lighting())?.hint ?? '';
  }

  protected toggleOpen(): void {
    this.open.update(open => !open);
  }

  protected choose(lighting: Lighting): void {
    this.sky.setLighting(lighting);
  }

  protected onEscape(event: Event): void {
    if (!this.open()) return;
    // Handled here, so the site-wide Escape (back to the greeting) doesn't also fire.
    event.preventDefault();
    this.open.set(false);
    this.button()?.nativeElement.focus();
  }
}
