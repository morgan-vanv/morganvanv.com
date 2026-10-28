import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { fromEvent } from 'rxjs';
import { GREETING_ROUTE, MAIN_NAV_ROUTES, navRouteFor } from '../main-routes';
import { ScrollRegionService } from '../scroll-region/scroll-region.service';
import { SkyService } from '../sky/sky.service';

const SCROLL_STEP_PX = 120;
const DEFAULT_MAIN_ROUTE = MAIN_NAV_ROUTES[0];

/**
 * Site-wide arrow-key navigation: Left/Right move between main pages in
 * MAIN_ROUTES order, Up/Down scroll the page's registered scroll region,
 * Escape returns to the greeting. Any arrow leaves the greeting page.
 */
@Injectable({ providedIn: 'root' })
export class KeyboardNavService {
  private readonly router = inject(Router);
  private readonly scrollRegions = inject(ScrollRegionService);
  private readonly sky = inject(SkyService);

  constructor() {
    if (typeof window === 'undefined') return;
    fromEvent<KeyboardEvent>(window, 'keydown')
      .subscribe(e => this.onKeyDown(e));
  }

  onKeyDown(e: KeyboardEvent): void {
    if (e.defaultPrevented) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (this.isEditableTarget(document.activeElement)) return;

    const currentPath = this.getCurrentPath();

    if (currentPath === GREETING_ROUTE) {
      // While looking up the greeting is hidden: ↑/↓ belong to the page, so they do nothing; ← → still go on.
      const vertical = e.key === 'ArrowUp' || e.key === 'ArrowDown';
      if (e.key.startsWith('Arrow') && DEFAULT_MAIN_ROUTE && !(vertical && this.sky.lookingUp())) {
        this.router.navigate([DEFAULT_MAIN_ROUTE]);
      }
      return;
    }

    if (e.key === 'Escape') {
      this.router.navigate([GREETING_ROUTE]);
      return;
    }

    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const container = this.scrollRegions.active();
      // Not while the page is hidden (looking up at the sky makes it inert).
      if (container && !container.closest('[inert]')) {
        e.preventDefault();
        container.scrollBy({ top: e.key === 'ArrowDown' ? SCROLL_STEP_PX : -SCROLL_STEP_PX, behavior: 'auto' });
      }
      return;
    }

    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

    // A side page (the colophon) steps on from its parent's place.
    const idx = MAIN_NAV_ROUTES.indexOf(navRouteFor(currentPath));
    if (idx === -1) return;

    const nextIdx = e.key === 'ArrowLeft' ? idx - 1 : idx + 1;
    if (nextIdx >= 0 && nextIdx < MAIN_NAV_ROUTES.length) {
      this.router.navigate([MAIN_NAV_ROUTES[nextIdx]]);
    }
  }

  private getCurrentPath(): string {
    const tree = this.router.parseUrl(this.router.url);
    const primarySegments = tree.root.children['primary']?.segments ?? [];
    return primarySegments.length > 0 ? `/${primarySegments[0].path}` : GREETING_ROUTE;
  }

  private isEditableTarget(target: Element | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return (
      target.tagName === 'INPUT'
      || target.tagName === 'TEXTAREA'
      || target.tagName === 'SELECT'
      || target.isContentEditable
    );
  }
}
