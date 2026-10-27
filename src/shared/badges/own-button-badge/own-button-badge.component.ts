import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Injector, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { BadgeComponent, PopoverPlacement, placeFor } from '../badge/badge.component';
import { SITE_CONFIG } from '../../config/site.config';

/** The real 88×31, drawn by scripts/build-88x31.py, for other sites to hotlink or copy. */
export const OWN_BUTTON_PATH = '/88x31.gif';
export const OWN_BUTTON_SNIPPET =
  `<a href="${SITE_CONFIG.url}"><img src="${SITE_CONFIG.url}${OWN_BUTTON_PATH}" width="88" height="31" alt="${SITE_CONFIG.domain}"></a>`;

const COPIED_MS = 2000;

/**
 * This site's own 88×31, for other people to link here with. The face is the same design as the gif
 * at 1.5×; pressing it opens a small panel with the real gif and the HTML to paste. A disclosure,
 * like the ☾ menu: Esc or a click outside closes it.
 */
@Component({
  selector: 'app-own-button-badge',
  imports: [BadgeComponent],
  templateUrl: './own-button-badge.component.html',
  styleUrl: './own-button-badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(keydown.escape)': 'onEscape($event)',
    '(focusout)': 'onFocusOut($event)',
  },
})
export class OwnButtonBadgeComponent {
  readonly snippet = OWN_BUTTON_SNIPPET;
  readonly imagePath = OWN_BUTTON_PATH;
  readonly open = signal(false);
  readonly copied = signal(false);
  protected readonly placement = signal<PopoverPlacement>({ end: false, below: false });

  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  private readonly injector = inject(Injector);
  private readonly code = viewChild<ElementRef<HTMLTextAreaElement>>('code');
  private copiedTimer: ReturnType<typeof setTimeout> | undefined;

  readonly label = `${SITE_CONFIG.domain}: this site's own 88×31 button. Shows the HTML to link to this site with it.`;

  constructor() {
    const onPointerDown = (event: PointerEvent) => {
      if (this.open() && !this.host.contains(event.target as Node)) this.open.set(false);
    };
    const destroyRef = inject(DestroyRef);
    if (typeof document !== 'undefined') {
      document.addEventListener('pointerdown', onPointerDown);
      destroyRef.onDestroy(() => document.removeEventListener('pointerdown', onPointerDown));
    }
    destroyRef.onDestroy(() => clearTimeout(this.copiedTimer));
  }

  toggle(): void {
    // Placed before it opens, from its usual size (18rem wide, about 15rem tall).
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    // (The host is display: contents and has no box of its own, so measure the anchor.)
    const anchor = this.host.querySelector<HTMLElement>('.anchor');
    if (!this.open() && anchor) this.placement.set(placeFor(anchor, 18 * rem, 15 * rem));
    this.open.update(open => !open);
    this.copied.set(false);
    // On a short screen it may open partly out of view: bring it in.
    if (this.open()) {
      afterNextRender(() => this.host.querySelector('#link-to-me')?.scrollIntoView?.({ block: 'nearest' }), { injector: this.injector });
    }
  }

  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.snippet);
    } catch {
      // No clipboard (insecure context, old browser): select it so ⌘C / Ctrl+C works.
      this.code()?.nativeElement.select();
      return;
    }
    this.copied.set(true);
    clearTimeout(this.copiedTimer);
    this.copiedTimer = setTimeout(() => this.copied.set(false), COPIED_MS);
  }

  /** Tabbing out of it closes it too, so it never lingers behind the visitor. */
  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (this.open() && next && !this.host.contains(next)) this.open.set(false);
  }

  protected onEscape(event: Event): void {
    if (!this.open()) return;
    // Handled here, so the site-wide Escape (back to the greeting) doesn't also fire.
    event.preventDefault();
    this.open.set(false);
    this.host.querySelector<HTMLElement>('.badge')?.focus();
  }
}
