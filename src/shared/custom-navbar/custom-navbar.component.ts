import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, map } from 'rxjs';
import { IconComponent, IconName } from '../icon/icon.component';
import { GREETING_ROUTE, MAIN_ROUTES } from '../main-routes';

interface NavLink {
  route: string;
  label?: string;
  icon?: IconName;
  ariaLabel?: string;
  exact?: boolean;
}

/** Greeting link, then every main route in MAIN_ROUTES order. */
export const NAV_LINKS: readonly NavLink[] = [
  { route: GREETING_ROUTE, icon: 'exit', ariaLabel: 'Greeting', exact: true },
  ...MAIN_ROUTES.map(({ path, title }) => ({ route: `/${path}`, label: title })),
];

/** "/interests?x=1#y" → "/interests". */
function pathOf(url: string): string {
  const path = url.split(/[?#]/)[0].replace(/\/+$/, '');
  return path === '' ? GREETING_ROUTE : `/${path.split('/').filter(Boolean)[0]}`;
}

/**
 * The navbar. Wide screens get every page on one line; tablets and phones get
 * a pager instead: the greeting, ‹ previous, the current page (which opens the
 * full list) and next ›. Its right end is left free for the ☾ sky button,
 * which is fixed to that spot on small screens. Which one shows is pure CSS,
 * so the prerendered HTML is the same at every size.
 */
@Component({
  selector: 'app-custom-navbar',
  imports: [RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './custom-navbar.component.html',
  styleUrl: './custom-navbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(keydown.escape)': 'onEscape($event)',
  },
})
export class CustomNavbarComponent {
  readonly navLinks = NAV_LINKS;

  private readonly router = inject(Router);
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  private readonly menuButton = viewChild<ElementRef<HTMLButtonElement>>('menuButton');

  private readonly path = toSignal(
    this.router.events.pipe(filter(e => e instanceof NavigationEnd), map(e => pathOf(e.urlAfterRedirects))),
    { initialValue: pathOf(this.router.url) },
  );
  private readonly index = computed(() => this.navLinks.findIndex(link => link.route === this.path()));

  readonly current = computed<NavLink | null>(() => this.navLinks[this.index()] ?? null);
  readonly previous = computed(() => (this.index() > 0 ? this.navLinks[this.index() - 1] : null));
  readonly next = computed(() => {
    const i = this.index();
    return i >= 0 && i < this.navLinks.length - 1 ? this.navLinks[i + 1] : null;
  });

  /** The pager's page list. */
  readonly menuOpen = signal(false);

  constructor() {
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => this.menuOpen.set(false));
    const onPointerDown = (event: PointerEvent) => {
      if (this.menuOpen() && !this.host.contains(event.target as Node)) this.menuOpen.set(false);
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('pointerdown', onPointerDown);
      inject(DestroyRef).onDestroy(() => document.removeEventListener('pointerdown', onPointerDown));
    }
  }

  /** Accessible name for a pager arrow: "Previous: Now", "Next: Greeting". */
  arrowLabel(direction: 'Previous' | 'Next', link: NavLink): string {
    return `${direction}: ${link.label ?? link.ariaLabel ?? ''}`;
  }

  toggleMenu(): void {
    this.menuOpen.update(open => !open);
  }

  onEscape(event: Event): void {
    if (!this.menuOpen()) return;
    // Handled here, so the site-wide Escape (back to the greeting) doesn't also fire.
    event.preventDefault();
    this.menuOpen.set(false);
    this.menuButton()?.nativeElement.focus();
  }
}
