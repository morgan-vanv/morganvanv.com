import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';

/** What a badge says on hover or keyboard focus. Purely visual: the badge's `label` already says all of it. */
export interface BadgePopover {
  title: string;
  rows?: readonly { label: string; value: string }[];
  lines?: readonly string[];
  note?: string;
  cta?: string;
}

/** Names longer than this get set a touch tighter so they fit the 132px face. */
const LONG_NAME = 14;

/**
 * The shared 88×31 button (drawn at 1.5×, 132×46): a glyph cell, a tiny gold caps name over the
 * value, the classic bevel, a gold border on hover/focus, and a solid popover above it.
 *
 * Each badge (Lighthouse, Moon, …) is a small component that works out its data and renders one of
 * these, or nothing at all while it has no data. Give it `href` (opens in a new tab), `route` (in-site),
 * or neither (a button; listen to `pressed`). `label` is the accessible name and must carry the full
 * text, since the face is tiny and the popover is hidden from assistive tech.
 *
 * The glyph is projected (`<svg glyph …>`); so is the face text when a badge needs its own (`[text]`).
 */
@Component({
  selector: 'app-badge',
  imports: [NgTemplateOutlet, RouterLink],
  templateUrl: './badge.component.html',
  styleUrl: './badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(mouseenter)': 'place()',
    '(focusin)': 'place()',
  },
})
export class BadgeComponent {
  readonly label = input.required<string>();
  readonly name = input('');
  /** One string, or several shown side by side (the Lighthouse scores). */
  readonly value = input<string | readonly string[]>('');
  readonly href = input<string | null>(null);
  readonly route = input<string | null>(null);
  /** For a button badge that opens something: its aria-expanded and aria-controls. */
  readonly expanded = input<boolean | null>(null);
  readonly controls = input<string | null>(null);
  readonly popover = input<BadgePopover | null>(null);
  readonly pressed = output<void>();

  protected readonly parts = computed(() => {
    const value = this.value();
    return typeof value === 'string' ? (value ? [value] : []) : value;
  });
  protected readonly longName = computed(() => this.name().length > LONG_NAME);

  /**
   * Popovers open up and to the right. Near the right edge of the page they open to the left, and
   * near the top of the visible page (a landscape phone) below, so the card never clips them.
   */
  protected readonly placement = signal<PopoverPlacement>({ end: false, below: false });
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  private readonly popoverEl = viewChild<ElementRef<HTMLElement>>('pop');

  protected place(): void {
    const popover = this.popoverEl()?.nativeElement;
    // Measured as it opens: it's display: none until the badge is hovered or focused.
    if (popover) this.placement.set(placeFor(this.host, popover.offsetWidth, popover.offsetHeight));
  }
}

export interface PopoverPlacement {
  end: boolean;
  below: boolean;
}

/**
 * Where something `width` × `height`, opening above `el` from its left edge, fits inside the page's
 * scroll container (`base-page`'s `.page-content`, which clips it) and the window.
 */
export function placeFor(el: HTMLElement, width: number, height: number): PopoverPlacement {
  const box = el.getBoundingClientRect();
  const container = (el.closest('.page-content') ?? document.documentElement).getBoundingClientRect();
  const right = Math.min(container.right, window.innerWidth);
  const top = Math.max(container.top, 0);
  return { end: box.left + width > right - 8, below: box.top - height < top + 8 };
}
